const ocrDataset = 'institutional/institutional-books-1.0';
const originalFetch = window.fetch.bind(window);
let expectedBarcode = '';

window.addEventListener('open-shelves:book-opening', event => {
  expectedBarcode = String(event.detail?.barcode ?? '');
});

window.fetch = async (...args) => {
  const response = await originalFetch(...args);
  try {
    const input = args[0];
    const requestUrl = input instanceof Request ? input.url : String(input);
    const url = new URL(requestUrl, location.href);
    if (response.ok && url.hostname === 'datasets-server.huggingface.co' && url.searchParams.get('dataset') === ocrDataset) {
      const clone = response.clone();
      queueMicrotask(async () => {
        const payload = await clone.json().catch(() => null);
        const record = payload?.rows?.[0]?.row;
        const barcode = String(record?.barcode_src ?? '');
        if (expectedBarcode && barcode !== expectedBarcode) return;
        const pages = record?.text_by_page_gen?.length ? record.text_by_page_gen : record?.text_by_page_src ?? [];
        if (!pages.length) return;
        window.dispatchEvent(new CustomEvent('open-shelves:ocr-loaded', {
          detail: {
            barcode,
            title: String(record.title_src ?? 'Untitled volume'),
            pages
          }
        }));
      });
    }
  } catch {
    // Search indexing must never interfere with the reader request.
  }
  return response;
};

const form = document.querySelector('#reader-book-search');
const input = document.querySelector('#reader-book-query');
const clear = document.querySelector('#clear-reader-search');
const status = document.querySelector('#reader-search-status');
const results = document.querySelector('#reader-search-results');
const pageNumber = document.querySelector('#reader-page-number');
let pages = [];

const resetSearch = message => {
  results?.replaceChildren();
  if (status) status.textContent = message;
};

const snippetFor = (page, index, length) => {
  const value = String(page);
  const start = Math.max(0, index - 70);
  const end = Math.min(value.length, index + length + 110);
  const snippet = value.slice(start, end).replaceAll(/\s+/g, ' ').trim();
  return `${start > 0 ? '…' : ''}${snippet}${end < value.length ? '…' : ''}`;
};

const openPage = page => {
  if (!pageNumber) return;
  pageNumber.value = String(page);
  pageNumber.dispatchEvent(new Event('change', { bubbles: true }));
};

form?.addEventListener('submit', event => {
  event.preventDefault();
  const query = input.value.trim();
  if (query.length < 2) {
    resetSearch('Enter at least two characters.');
    return;
  }

  const normalisedQuery = query.toLocaleLowerCase();
  const matches = [];
  for (let index = 0; index < pages.length; index += 1) {
    const page = String(pages[index] ?? '');
    const location = page.toLocaleLowerCase().indexOf(normalisedQuery);
    if (location < 0) continue;
    matches.push({ page: index + 1, snippet: snippetFor(page, location, query.length) });
    if (matches.length === 100) break;
  }

  results.replaceChildren();
  for (const match of matches) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'reader-search-result';
    const heading = document.createElement('strong');
    heading.textContent = `Page ${match.page}`;
    const snippet = document.createElement('span');
    snippet.textContent = match.snippet;
    button.append(heading, snippet);
    button.addEventListener('click', () => openPage(match.page));
    results.append(button);
  }

  const capped = matches.length === 100 ? ' First 100 shown.' : '';
  status.textContent = matches.length
    ? `${matches.length.toLocaleString()} matching page${matches.length === 1 ? '' : 's'}.${capped}`
    : `No pages contain “${query}”.`;
});

clear?.addEventListener('click', () => {
  input.value = '';
  resetSearch(pages.length ? `Search across ${pages.length.toLocaleString()} pages.` : 'Open a book to search its text.');
  input.focus();
});

window.addEventListener('open-shelves:ocr-loaded', event => {
  pages = Array.isArray(event.detail?.pages) ? event.detail.pages : [];
  if (input) input.disabled = pages.length === 0;
  if (form) form.querySelector('button[type="submit"]').disabled = pages.length === 0;
  resetSearch(pages.length ? `Search across ${pages.length.toLocaleString()} pages.` : 'This book has no searchable text.');
});