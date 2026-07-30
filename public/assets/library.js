const basePath = '/open-shelves';
const databaseName = 'open-shelves-library';
const storeName = 'books';

const librarySection = document.querySelector('#library-section');
const libraryResults = document.querySelector('#library-results');
const libraryStatus = document.querySelector('#library-status');
const saveBook = document.querySelector('#save-book');
const reader = document.querySelector('#ocr-reader');
const readerTitle = document.querySelector('#reader-title');
const readerAuthor = document.querySelector('#reader-author');
const readerMeta = document.querySelector('#reader-meta');
const readerPageNumber = document.querySelector('#reader-page-number');
const readerProgress = document.querySelector('#reader-progress');

const request = value => new Promise((resolve, reject) => {
  value.addEventListener('success', () => resolve(value.result), { once: true });
  value.addEventListener('error', () => reject(value.error), { once: true });
});

const database = new Promise((resolve, reject) => {
  const opening = indexedDB.open(databaseName, 1);
  opening.addEventListener('upgradeneeded', () => {
    if (!opening.result.objectStoreNames.contains(storeName)) {
      opening.result.createObjectStore(storeName, { keyPath: 'barcode' });
    }
  });
  opening.addEventListener('success', () => resolve(opening.result), { once: true });
  opening.addEventListener('error', () => reject(opening.error), { once: true });
});

const withStore = async (mode, operation) => {
  const db = await database;
  const transaction = db.transaction(storeName, mode);
  const completion = new Promise((resolve, reject) => {
    transaction.addEventListener('complete', resolve, { once: true });
    transaction.addEventListener('abort', () => reject(transaction.error), { once: true });
    transaction.addEventListener('error', () => reject(transaction.error), { once: true });
  });
  const result = await operation(transaction.objectStore(storeName));
  await completion;
  return result;
};

const getBook = barcode => withStore('readonly', store => request(store.get(barcode)));
const getBooks = () => withStore('readonly', store => request(store.getAll()));
const putBook = book => withStore('readwrite', store => request(store.put(book)));
const deleteBook = barcode => withStore('readwrite', store => request(store.delete(barcode)));

const route = () => {
  const escapedBase = basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = location.pathname.match(new RegExp(`^${escapedBase}/books/([^/]+)(?:/page/(\\d+))?/?$`));
  if (!match) return null;
  const routedPage = Number(match[2] ?? 1);
  return {
    barcode: decodeURIComponent(match[1]),
    page: Number.isInteger(routedPage) && routedPage > 0 ? routedPage : 1
  };
};

const bookPath = (barcode, page = 1) => `${basePath}/books/${encodeURIComponent(barcode)}/page/${Math.max(1, page)}`;

const hash = value => {
  let result = 0;
  for (const character of String(value)) result = ((result << 5) - result + character.charCodeAt(0)) | 0;
  return Math.abs(result);
};

const createLibraryCard = book => {
  const article = document.createElement('article');
  article.className = 'library-card';
  const cover = document.createElement('div');
  cover.className = 'library-cover';
  cover.style.setProperty('--library-hue', String(hash(book.barcode) % 360));
  cover.setAttribute('aria-hidden', 'true');
  const title = document.createElement('strong');
  title.textContent = book.title;
  const author = document.createElement('span');
  author.textContent = book.author;
  cover.append(title, author);

  const content = document.createElement('div');
  content.className = 'library-card-content';
  const heading = document.createElement('h3');
  heading.textContent = book.title;
  const byline = document.createElement('p');
  byline.textContent = book.author;
  const meta = document.createElement('p');
  meta.className = 'library-card-meta';
  meta.textContent = `Continue at page ${book.page}`;
  const actions = document.createElement('div');
  actions.className = 'library-card-actions';
  const open = document.createElement('a');
  open.className = 'button';
  open.href = bookPath(book.barcode, book.page);
  open.textContent = 'Continue reading';
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'secondary';
  remove.textContent = 'Remove';
  remove.addEventListener('click', async () => {
    await deleteBook(book.barcode);
    await renderLibrary();
    await refreshSaveButton();
  });
  actions.append(open, remove);
  content.append(heading, byline, meta, actions);
  article.append(cover, content);
  return article;
};

async function renderLibrary() {
  try {
    const books = (await getBooks()).sort((left, right) => String(right.savedAt).localeCompare(String(left.savedAt)));
    libraryResults.replaceChildren();
    for (const book of books) libraryResults.append(createLibraryCard(book));
    librarySection.hidden = books.length === 0;
    libraryStatus.textContent = books.length
      ? `${books.length.toLocaleString()} saved book${books.length === 1 ? '' : 's'} on this device.`
      : 'Books you save will appear here.';
  } catch {
    librarySection.hidden = true;
    saveBook.hidden = true;
  }
}

const currentBook = () => {
  const currentRoute = route();
  if (!currentRoute || !reader?.open) return null;
  const displayedPage = Number(readerPageNumber?.value);
  return {
    barcode: currentRoute.barcode,
    page: Number.isInteger(displayedPage) && displayedPage > 0 ? displayedPage : currentRoute.page,
    title: readerTitle?.textContent?.trim() || 'Untitled volume',
    author: readerAuthor?.textContent?.trim() || 'Unknown author',
    meta: readerMeta?.textContent?.trim() || '',
    savedAt: new Date().toISOString()
  };
};

async function refreshSaveButton() {
  const book = currentBook();
  saveBook.hidden = !book;
  if (!book) return;
  try {
    const saved = await getBook(book.barcode);
    saveBook.dataset.saved = saved ? 'true' : 'false';
    saveBook.textContent = saved ? 'Saved to library' : 'Save to library';
    saveBook.setAttribute('aria-pressed', saved ? 'true' : 'false');
  } catch {
    saveBook.hidden = true;
  }
}

const updateSavedProgress = async () => {
  const book = currentBook();
  if (!book) return;
  const saved = await getBook(book.barcode);
  if (!saved || saved.page === book.page) return;
  await putBook({ ...saved, page: book.page, savedAt: new Date().toISOString() });
  await renderLibrary();
};

saveBook?.addEventListener('click', async () => {
  const book = currentBook();
  if (!book) return;
  const saved = await getBook(book.barcode);
  if (saved) await deleteBook(book.barcode);
  else await putBook(book);
  await renderLibrary();
  await refreshSaveButton();
});

readerPageNumber?.addEventListener('change', updateSavedProgress);

if (reader) {
  const observer = new MutationObserver(refreshSaveButton);
  observer.observe(reader, { attributes: true, attributeFilter: ['open'] });
  reader.addEventListener('close', refreshSaveButton);
}

if (readerProgress) {
  const progressObserver = new MutationObserver(updateSavedProgress);
  progressObserver.observe(readerProgress, { attributes: true, attributeFilter: ['aria-valuenow'] });
}

window.addEventListener('popstate', refreshSaveButton);
renderLibrary();
refreshSaveButton();