const basePath = '/open-shelves';
const metadataDataset = 'institutional/institutional-books-1.0-metadata';
const ocrDataset = 'institutional/institutional-books-1.0';
const datasetsApi = 'https://datasets-server.huggingface.co';
const tokenKey = 'open-shelves-hf-token';
const pageSize = 24;
const collectionRows = 983004;

const termsConfirmed = document.querySelector('#terms-confirmed');
const signIn = document.querySelector('#hf-sign-in');
const signOut = document.querySelector('#hf-sign-out');
const authStatus = document.querySelector('#auth-status');
const browser = document.querySelector('#collection-browser');
const form = document.querySelector('#harvard-search');
const input = document.querySelector('#harvard-query');
const clearSearch = document.querySelector('#clear-search');
const results = document.querySelector('#harvard-results');
const status = document.querySelector('#harvard-status');
const previousButtons = [document.querySelector('#previous-page'), document.querySelector('#previous-page-bottom')];
const nextButtons = [document.querySelector('#next-page'), document.querySelector('#next-page-bottom')];
const randomPage = document.querySelector('#random-page');
const reader = document.querySelector('#ocr-reader');
const readerTitle = document.querySelector('#reader-title');
const readerAuthor = document.querySelector('#reader-author');
const readerMeta = document.querySelector('#reader-meta');
const readerPage = document.querySelector('#reader-page');
const readerPageNumber = document.querySelector('#reader-page-number');
const readerPageCount = document.querySelector('#reader-page-count');
const previousReaderPage = document.querySelector('#previous-reader-page');
const nextReaderPage = document.querySelector('#next-reader-page');
const closeReader = document.querySelector('#close-reader');

let offset = 0;
let totalRows = collectionRows;
let currentQuery = '';
let metadataSplit;
let ocrSplit;
let currentPages = [];
let currentPageIndex = 0;

const token = () => sessionStorage.getItem(tokenKey);
const setBusy = busy => {
  for (const button of [...previousButtons, ...nextButtons, randomPage, form?.querySelector('button[type="submit"]')].filter(Boolean)) {
    button.disabled = busy;
  }
};

const api = async (endpoint, dataset, params = {}) => {
  const accessToken = token();
  if (!accessToken) throw new Error('Sign in with Hugging Face to continue.');
  const url = new URL(`${datasetsApi}/${endpoint}`);
  url.searchParams.set('dataset', dataset);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (response.status === 401 || response.status === 403) {
    throw new Error('Hugging Face has not granted this session access. Confirm that you accepted the dataset terms, then sign in again.');
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Hugging Face returned HTTP ${response.status}.`);
  return payload;
};

const resolveSplit = async dataset => {
  const payload = await api('splits', dataset);
  const available = payload.splits ?? [];
  const preferred = available.find(item => item.split === 'train') ?? available[0];
  if (!preferred) throw new Error('The dataset does not currently expose a browsable split.');
  return { config: preferred.config, split: preferred.split };
};

const beginOAuth = async () => {
  const random = size => {
    const bytes = crypto.getRandomValues(new Uint8Array(size));
    return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  };
  const verifier = random(48);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  const state = random(24);
  const clientId = `${location.origin}${basePath}/.well-known/oauth-cimd`;
  const redirectUri = `${location.origin}${basePath}/oauth/callback/huggingface/`;

  sessionStorage.setItem('open-shelves-pkce-verifier', verifier);
  sessionStorage.setItem('open-shelves-oauth-state', state);
  sessionStorage.setItem('open-shelves-return-to', location.href);

  const authorize = new URL('https://huggingface.co/oauth/authorize');
  authorize.searchParams.set('client_id', clientId);
  authorize.searchParams.set('redirect_uri', redirectUri);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('scope', 'openid profile gated-repos');
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('code_challenge', challenge);
  authorize.searchParams.set('code_challenge_method', 'S256');
  location.assign(authorize);
};

const updateAuthUi = connected => {
  browser.hidden = !connected;
  signOut.hidden = !connected;
  signIn.hidden = connected;
  termsConfirmed.disabled = connected;
  if (connected) {
    authStatus.textContent = 'Connected with gated repository access. The token remains in this tab only.';
  } else {
    authStatus.textContent = 'Not connected.';
    results.replaceChildren();
  }
};

const text = (value, fallback = '') => {
  if (Array.isArray(value)) return value.filter(Boolean).join('; ');
  if (value && typeof value === 'object') return Object.values(value).flat().filter(Boolean).join('; ');
  return value == null || value === '' ? fallback : String(value);
};

const createDetail = (label, value) => {
  const span = document.createElement('span');
  span.textContent = `${label}: ${value}`;
  return span;
};

const renderRows = payload => {
  results.replaceChildren();
  const rows = payload.rows ?? [];
  totalRows = payload.num_rows_total ?? totalRows;

  for (const wrapper of rows) {
    const record = wrapper.row ?? {};
    const article = document.createElement('article');
    article.className = 'book-card';

    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = `${text(record.language_src, text(record.language_gen, 'und')).toUpperCase()} · ${text(record.date1_src, 'Undated')}`;

    const heading = document.createElement('h3');
    heading.textContent = text(record.title_src, 'Untitled volume');

    const author = document.createElement('p');
    author.textContent = text(record.author_src, 'Unknown author');

    const details = document.createElement('p');
    details.className = 'card-details';
    details.append(
      createDetail('Pages', text(record.page_count_src, 'unknown')),
      createDetail('Topic', text(record.topic_or_subject_gen, text(record.topic_or_subject_src, 'uncatalogued'))),
      createDetail('Barcode', text(record.barcode_src, 'unknown'))
    );

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Read OCR';
    button.addEventListener('click', () => openBook(wrapper.row_idx, record));

    article.append(eyebrow, heading, author, details, button);
    results.append(article);
  }

  const first = rows.length ? offset + 1 : 0;
  const last = offset + rows.length;
  const searchLabel = currentQuery ? ` for “${currentQuery}”` : '';
  status.textContent = `${first.toLocaleString()}–${last.toLocaleString()} of ${totalRows.toLocaleString()} volumes${searchLabel}${payload.partial ? ' (Hugging Face returned a partial index)' : ''}.`;
  for (const button of previousButtons) button.disabled = offset === 0;
  for (const button of nextButtons) button.disabled = rows.length < pageSize || offset + rows.length >= totalRows;
};

const loadShelf = async () => {
  setBusy(true);
  status.textContent = currentQuery ? 'Searching the official metadata dataset…' : 'Loading a shelf from the official metadata dataset…';
  let payload;
  try {
    metadataSplit ??= await resolveSplit(metadataDataset);
    const endpoint = currentQuery ? 'search' : 'rows';
    payload = await api(endpoint, metadataDataset, {
      ...metadataSplit,
      offset,
      length: pageSize,
      ...(currentQuery ? { query: currentQuery } : {})
    });
  } catch (error) {
    status.textContent = error.message;
    results.replaceChildren();
  } finally {
    setBusy(false);
  }
  if (payload) renderRows(payload);
};

const fetchOcrRow = async (rowIndex, barcode) => {
  ocrSplit ??= await resolveSplit(ocrDataset);
  const byIndex = await api('rows', ocrDataset, { ...ocrSplit, offset: rowIndex, length: 1 });
  const candidate = byIndex.rows?.[0]?.row;
  if (candidate && (!barcode || candidate.barcode_src === barcode)) return candidate;

  if (!barcode) throw new Error('The OCR volume could not be matched to its metadata row.');
  const escapedBarcode = barcode.replaceAll("'", "''");
  const filtered = await api('filter', ocrDataset, {
    ...ocrSplit,
    where: `"barcode_src"='${escapedBarcode}'`,
    offset: 0,
    length: 1
  });
  const fallback = filtered.rows?.[0]?.row;
  if (!fallback) throw new Error('The OCR volume could not be found in the official dataset.');
  return fallback;
};

const showReaderPage = index => {
  if (!currentPages.length) return;
  currentPageIndex = Math.max(0, Math.min(index, currentPages.length - 1));
  readerPage.textContent = text(currentPages[currentPageIndex], '[No OCR text was supplied for this page.]');
  readerPageNumber.value = String(currentPageIndex + 1);
  readerPageCount.textContent = currentPages.length.toLocaleString();
  previousReaderPage.disabled = currentPageIndex === 0;
  nextReaderPage.disabled = currentPageIndex === currentPages.length - 1;
  readerPage.scrollTop = 0;
  readerPage.focus({ preventScroll: true });
};

const openBook = async (rowIndex, metadata = {}) => {
  status.textContent = `Loading OCR for ${text(metadata.title_src, 'the selected volume')}…`;
  try {
    const record = await fetchOcrRow(rowIndex, metadata.barcode_src);
    currentPages = record.text_by_page_gen?.length ? record.text_by_page_gen : record.text_by_page_src ?? [];
    if (!currentPages.length) throw new Error('This volume does not contain page-level OCR text.');

    readerTitle.textContent = text(record.title_src, text(metadata.title_src, 'Untitled volume'));
    readerAuthor.textContent = text(record.author_src, text(metadata.author_src, 'Unknown author'));
    readerMeta.textContent = `${text(record.language_src, 'und').toUpperCase()} · ${text(record.date1_src, 'Undated')} · ${currentPages.length.toLocaleString()} OCR pages · ${text(record.barcode_src, 'No barcode')}`;
    showReaderPage(0);
    reader.showModal();

    const url = new URL(location.href);
    url.searchParams.set('book', String(rowIndex));
    history.replaceState(null, '', url);
    status.textContent = 'OCR volume loaded from the official dataset.';
  } catch (error) {
    status.textContent = error.message;
  }
};

termsConfirmed?.addEventListener('change', () => { signIn.disabled = !termsConfirmed.checked; });
signIn?.addEventListener('click', beginOAuth);
signOut?.addEventListener('click', () => {
  sessionStorage.removeItem(tokenKey);
  updateAuthUi(false);
});

form?.addEventListener('submit', event => {
  event.preventDefault();
  currentQuery = input.value.trim();
  offset = 0;
  loadShelf();
});
clearSearch?.addEventListener('click', () => {
  input.value = '';
  currentQuery = '';
  offset = 0;
  totalRows = collectionRows;
  loadShelf();
});
for (const button of previousButtons) button?.addEventListener('click', () => { offset = Math.max(0, offset - pageSize); loadShelf(); });
for (const button of nextButtons) button?.addEventListener('click', () => { offset += pageSize; loadShelf(); });
randomPage?.addEventListener('click', () => {
  currentQuery = '';
  input.value = '';
  totalRows = collectionRows;
  const pages = Math.max(1, Math.floor(collectionRows / pageSize));
  offset = Math.floor(Math.random() * pages) * pageSize;
  loadShelf();
});

previousReaderPage?.addEventListener('click', () => showReaderPage(currentPageIndex - 1));
nextReaderPage?.addEventListener('click', () => showReaderPage(currentPageIndex + 1));
readerPageNumber?.addEventListener('change', () => showReaderPage(Number(readerPageNumber.value) - 1));
closeReader?.addEventListener('click', () => reader.close());
reader?.addEventListener('close', () => {
  currentPages = [];
  const url = new URL(location.href);
  url.searchParams.delete('book');
  history.replaceState(null, '', url);
});

const initialise = async () => {
  if (!token()) {
    updateAuthUi(false);
    return;
  }
  updateAuthUi(true);
  await loadShelf();
  const bookParam = new URL(location.href).searchParams.get('book');
  if (bookParam !== null) {
    const deepLink = Number(bookParam);
    if (Number.isInteger(deepLink) && deepLink >= 0) await openBook(deepLink);
  }
};

initialise();
