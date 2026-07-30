const basePath = '/open-shelves';
const metadataDataset = 'institutional/institutional-books-1.0-metadata';
const ocrDataset = 'institutional/institutional-books-1.0';
const datasetsApi = 'https://datasets-server.huggingface.co';
const tokenKey = 'open-shelves-hf-token';
const consentKey = 'open-shelves-hf-consent';
const recentKey = 'open-shelves-recent-books';
const progressKey = 'open-shelves-reading-progress';
const settingsKey = 'open-shelves-reader-settings';
const pageSize = 24;
const collectionRows = 983004;

const accessPanel = document.querySelector('#access-panel');
const consentIntroduction = document.querySelector('#consent-introduction');
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
const recentSection = document.querySelector('#recent-section');
const recentResults = document.querySelector('#recent-results');
const clearRecent = document.querySelector('#clear-recent');
const reader = document.querySelector('#ocr-reader');
const readerTitle = document.querySelector('#reader-title');
const readerAuthor = document.querySelector('#reader-author');
const readerMeta = document.querySelector('#reader-meta');
const readerStatus = document.querySelector('#reader-status');
const readerChrome = document.querySelector('#reader-chrome');
const readerControls = document.querySelector('#reader-controls');
const readerProgress = document.querySelector('#reader-progress');
const readerProgressFill = document.querySelector('#reader-progress-fill');
const readerPage = document.querySelector('#reader-page');
const readerPageNumber = document.querySelector('#reader-page-number');
const readerPageCount = document.querySelector('#reader-page-count');
const previousReaderPage = document.querySelector('#previous-reader-page');
const nextReaderPage = document.querySelector('#next-reader-page');
const closeReader = document.querySelector('#close-reader');
const copyPageLink = document.querySelector('#copy-page-link');
const readerTheme = document.querySelector('#reader-theme');
const readerFont = document.querySelector('#reader-font');
const readerFontSize = document.querySelector('#reader-font-size');
const readerLineHeight = document.querySelector('#reader-line-height');
const readerWidth = document.querySelector('#reader-width');

let offset = 0;
let totalRows = collectionRows;
let currentQuery = '';
let metadataSplit;
let ocrSplit;
let currentPages = [];
let currentPageIndex = 0;
let currentBook;
let lockedScrollY = 0;
let openedByApp = false;
let handlingRoute = false;
let swipeStart;

const defaultReaderSettings = {
  theme: 'system',
  font: 'serif',
  fontSize: 18,
  lineHeight: 1.8,
  width: 72
};

const token = () => sessionStorage.getItem(tokenKey);

const readJson = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local persistence is a progressive enhancement.
  }
};

const hasConsent = () => {
  try {
    return localStorage.getItem(consentKey) === 'accepted';
  } catch {
    return false;
  }
};

const rememberConsent = () => {
  try {
    localStorage.setItem(consentKey, 'accepted');
  } catch {
    // Browsing can still continue for this session when persistent storage is unavailable.
  }
};

const readRecent = () => {
  const value = readJson(recentKey, []);
  return Array.isArray(value) ? value : [];
};
const writeRecent = books => writeJson(recentKey, books);

const readProgress = () => {
  const value = readJson(progressKey, {});
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
};

const progressFor = barcode => {
  if (!barcode) return 1;
  const page = Number(readProgress()[barcode]?.page);
  return Number.isInteger(page) && page > 0 ? page : 1;
};

const rememberProgress = (barcode, page) => {
  if (!barcode || !Number.isInteger(page) || page < 1) return;
  const progress = readProgress();
  progress[barcode] = { page, updatedAt: new Date().toISOString() };
  writeJson(progressKey, progress);
};

const readReaderSettings = () => ({ ...defaultReaderSettings, ...readJson(settingsKey, {}) });
const writeReaderSettings = settings => writeJson(settingsKey, settings);

const applyReaderSettings = settings => {
  const next = { ...defaultReaderSettings, ...settings };
  reader.dataset.readerTheme = next.theme;
  reader.dataset.readerFont = next.font;
  reader.style.setProperty('--reader-font-size', `${next.fontSize}px`);
  reader.style.setProperty('--reader-line-height', String(next.lineHeight));
  reader.style.setProperty('--reader-width', `${next.width}ch`);
  if (readerTheme) readerTheme.value = next.theme;
  if (readerFont) readerFont.value = next.font;
  if (readerFontSize) readerFontSize.value = String(next.fontSize);
  if (readerLineHeight) readerLineHeight.value = String(next.lineHeight);
  if (readerWidth) readerWidth.value = String(next.width);
};

const collectReaderSettings = () => ({
  theme: readerTheme?.value ?? defaultReaderSettings.theme,
  font: readerFont?.value ?? defaultReaderSettings.font,
  fontSize: Number(readerFontSize?.value ?? defaultReaderSettings.fontSize),
  lineHeight: Number(readerLineHeight?.value ?? defaultReaderSettings.lineHeight),
  width: Number(readerWidth?.value ?? defaultReaderSettings.width)
});

const updateReaderSettings = () => {
  const settings = collectReaderSettings();
  applyReaderSettings(settings);
  writeReaderSettings(settings);
};

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
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
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
  if (!hasConsent()) return;
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
  const consented = hasConsent();
  document.body.classList.toggle('returning-user', consented || connected);
  accessPanel.hidden = connected;
  accessPanel.classList.toggle('is-compact', consented && !connected);
  browser.hidden = !connected;
  signOut.hidden = !connected;
  consentIntroduction.hidden = consented;
  termsConfirmed.checked = consented;
  signIn.disabled = !consented;

  if (connected) {
    authStatus.textContent = '';
    renderRecent();
  } else if (consented) {
    authStatus.textContent = 'Your terms acknowledgement is saved on this device. Sign in to browse.';
    signIn.textContent = 'Sign in with Hugging Face';
    results.replaceChildren();
    recentSection.hidden = true;
  } else {
    authStatus.textContent = 'Not connected.';
    signIn.textContent = 'Continue with Hugging Face';
    results.replaceChildren();
    recentSection.hidden = true;
  }
};

const text = (value, fallback = '') => {
  if (Array.isArray(value)) return value.filter(Boolean).join('; ');
  if (value && typeof value === 'object') return Object.values(value).flat().filter(Boolean).join('; ');
  return value == null || value === '' ? fallback : String(value);
};

const barcodeOf = record => text(record?.barcode_src).trim();
const bookPath = (barcode, page = 1) => `${basePath}/books/${encodeURIComponent(barcode)}/page/${Math.max(1, page)}`;

const routeFromLocation = () => {
  const routed = new URL(location.href).searchParams.get('route');
  if (routed) {
    const target = new URL(routed, location.origin);
    history.replaceState(null, '', `${target.pathname}${target.search}${target.hash}`);
  }
  const escapedBase = basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = location.pathname.match(new RegExp(`^${escapedBase}/books/([^/]+)(?:/page/(\\d+))?/?$`));
  if (!match) return null;
  const page = Number(match[2] ?? 1);
  return {
    barcode: decodeURIComponent(match[1]),
    page: Number.isInteger(page) && page > 0 ? page : 1
  };
};

const hash = value => {
  let result = 0;
  for (const character of String(value)) result = ((result << 5) - result + character.charCodeAt(0)) | 0;
  return Math.abs(result);
};

const coverPalette = record => {
  const seed = text(record.barcode_src, `${record.title_src}-${record.author_src}`);
  const value = hash(seed);
  return { hue: value % 360, shift: 22 + (value % 38) };
};

const createCover = (record, compact = false) => {
  const cover = document.createElement('div');
  cover.className = `book-cover${compact ? ' compact' : ''}`;
  const palette = coverPalette(record);
  cover.style.setProperty('--cover-hue', String(palette.hue));
  cover.style.setProperty('--cover-shift', String(palette.shift));
  cover.setAttribute('aria-hidden', 'true');

  const frame = document.createElement('div');
  frame.className = 'cover-frame';
  const title = document.createElement('strong');
  title.textContent = text(record.title_src, 'Untitled volume');
  const author = document.createElement('span');
  author.textContent = text(record.author_src, 'Unknown author');
  const year = document.createElement('small');
  year.textContent = text(record.date1_src, 'Undated');
  frame.append(title, author, year);
  cover.append(frame);
  return cover;
};

const createDetail = (label, value) => {
  const span = document.createElement('span');
  span.textContent = `${label}: ${value}`;
  return span;
};

const createBookCard = (rowIndex, record, compact = false) => {
  const article = document.createElement('article');
  article.className = `book-card${compact ? ' compact' : ''}`;
  const cover = createCover(record, compact);
  const content = document.createElement('div');
  content.className = 'book-card-content';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = `${text(record.language_src, text(record.language_gen, 'und')).toUpperCase()} · ${text(record.date1_src, 'Undated')}`;
  const heading = document.createElement('h3');
  heading.textContent = text(record.title_src, 'Untitled volume');
  const author = document.createElement('p');
  author.className = 'book-author';
  author.textContent = text(record.author_src, 'Unknown author');
  const details = document.createElement('p');
  details.className = 'card-details';
  details.append(
    createDetail('Pages', text(record.page_count_src, 'unknown')),
    createDetail('Subject', text(record.topic_or_subject_gen, text(record.topic_or_subject_src, 'uncatalogued')))
  );
  const button = document.createElement('button');
  button.type = 'button';
  const barcode = barcodeOf(record);
  const savedPage = progressFor(barcode);
  button.textContent = savedPage > 1 ? `Continue at page ${savedPage}` : compact ? 'Open again' : 'Open book';
  button.addEventListener('click', () => openBook({ rowIndex, barcode, metadata: record, historyMode: 'push' }));
  content.append(eyebrow, heading, author, details, button);
  article.append(cover, content);
  return article;
};

const serialiseRecent = (rowIndex, record) => ({
  rowIndex,
  barcode: barcodeOf(record),
  record: {
    title_src: text(record.title_src, 'Untitled volume'),
    author_src: text(record.author_src, 'Unknown author'),
    language_src: text(record.language_src, text(record.language_gen, 'und')),
    date1_src: text(record.date1_src, 'Undated'),
    page_count_src: text(record.page_count_src, 'unknown'),
    topic_or_subject_gen: text(record.topic_or_subject_gen, text(record.topic_or_subject_src, 'uncatalogued')),
    barcode_src: barcodeOf(record)
  }
});

const rememberRecent = (rowIndex, record) => {
  const item = serialiseRecent(rowIndex, record);
  const key = item.barcode || `row:${rowIndex}`;
  const next = [item, ...readRecent().filter(existing => (existing.barcode || `row:${existing.rowIndex}`) !== key)].slice(0, 8);
  writeRecent(next);
};

function renderRecent() {
  const books = readRecent();
  recentResults.replaceChildren();
  recentSection.hidden = books.length === 0 || !token();
  for (const item of books) recentResults.append(createBookCard(item.rowIndex, item.record, true));
}

const renderRows = payload => {
  results.replaceChildren();
  const rows = payload.rows ?? [];
  totalRows = payload.num_rows_total ?? totalRows;
  for (const wrapper of rows) results.append(createBookCard(wrapper.row_idx, wrapper.row ?? {}));
  const first = rows.length ? offset + 1 : 0;
  const last = offset + rows.length;
  status.textContent = currentQuery
    ? `${totalRows.toLocaleString()} volumes found for “${currentQuery}” · showing ${first.toLocaleString()}–${last.toLocaleString()}.`
    : `Shelf ${first.toLocaleString()}–${last.toLocaleString()} of ${totalRows.toLocaleString()} volumes.`;
  for (const button of previousButtons) button.disabled = offset === 0;
  for (const button of nextButtons) button.disabled = rows.length < pageSize || offset + rows.length >= totalRows;
};

const loadShelf = async () => {
  setBusy(true);
  status.textContent = currentQuery ? 'Searching the catalogue…' : 'Opening the next shelf…';
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

const fetchOcrBook = async (rowIndex, barcode) => {
  ocrSplit ??= await resolveSplit(ocrDataset);
  if (Number.isInteger(rowIndex) && rowIndex >= 0) {
    const byIndex = await api('rows', ocrDataset, { ...ocrSplit, offset: rowIndex, length: 1 });
    const wrapper = byIndex.rows?.[0];
    const candidate = wrapper?.row;
    if (candidate && (!barcode || barcodeOf(candidate) === barcode)) {
      return { rowIndex: wrapper.row_idx ?? rowIndex, record: candidate };
    }
  }
  if (!barcode) throw new Error('The OCR volume could not be matched to a stable barcode.');
  const escapedBarcode = barcode.replaceAll("'", "''");
  const filtered = await api('filter', ocrDataset, {
    ...ocrSplit,
    where: `"barcode_src"='${escapedBarcode}'`,
    offset: 0,
    length: 1
  });
  const wrapper = filtered.rows?.[0];
  if (!wrapper?.row) throw new Error('The OCR volume could not be found in the official dataset.');
  return { rowIndex: wrapper.row_idx, record: wrapper.row };
};

const lockDocumentScroll = () => {
  if (document.body.classList.contains('reader-open')) return;
  lockedScrollY = window.scrollY;
  document.documentElement.classList.add('reader-open');
  document.body.classList.add('reader-open');
  document.body.style.top = `-${lockedScrollY}px`;
};

const unlockDocumentScroll = () => {
  if (!document.body.classList.contains('reader-open')) return;
  document.documentElement.classList.remove('reader-open');
  document.body.classList.remove('reader-open');
  document.body.style.top = '';
  window.scrollTo(0, lockedScrollY);
};

const ensureReaderOpen = () => {
  if (reader.open) return;
  lockDocumentScroll();
  reader.showModal();
};

const showReaderLoading = metadata => {
  currentPages = [];
  currentBook = undefined;
  readerTitle.textContent = text(metadata.title_src, 'Loading volume…');
  readerAuthor.textContent = text(metadata.author_src, '');
  readerMeta.textContent = `${text(metadata.language_src, 'und').toUpperCase()} · ${text(metadata.date1_src, 'Undated')}`;
  readerStatus.hidden = false;
  readerStatus.textContent = 'Fetching page-level OCR from the official dataset…';
  readerChrome.hidden = true;
  readerPage.setAttribute('aria-busy', 'true');
  readerPage.textContent = 'Loading OCR…';
  ensureReaderOpen();
};

const updateBookUrl = (page, mode = 'replace') => {
  if (!currentBook?.barcode || handlingRoute) return;
  const method = mode === 'push' ? 'pushState' : 'replaceState';
  history[method]({ book: currentBook.barcode, page }, '', bookPath(currentBook.barcode, page));
};

const showReaderPage = (index, { updateUrl = true, persist = true } = {}) => {
  if (!currentPages.length || !currentBook) return;
  currentPageIndex = Math.max(0, Math.min(index, currentPages.length - 1));
  const page = currentPageIndex + 1;
  const percentage = (page / currentPages.length) * 100;
  readerPage.removeAttribute('aria-busy');
  readerPage.textContent = text(currentPages[currentPageIndex], '[No OCR text was supplied for this page.]');
  readerPageNumber.value = String(page);
  readerPageCount.textContent = currentPages.length.toLocaleString();
  readerProgress.setAttribute('aria-valuemax', String(currentPages.length));
  readerProgress.setAttribute('aria-valuenow', String(page));
  readerProgressFill.style.width = `${percentage}%`;
  previousReaderPage.disabled = currentPageIndex === 0;
  nextReaderPage.disabled = currentPageIndex === currentPages.length - 1;
  readerPage.scrollTop = 0;
  readerPage.focus({ preventScroll: true });
  if (persist) rememberProgress(currentBook.barcode, page);
  if (updateUrl) updateBookUrl(page);
};

const openBook = async ({ rowIndex, barcode, metadata = {}, page, historyMode = 'push' }) => {
  showReaderLoading(metadata);
  try {
    const fetched = await fetchOcrBook(rowIndex, barcode || barcodeOf(metadata));
    const record = fetched.record;
    const canonicalBarcode = barcodeOf(record) || barcode || barcodeOf(metadata);
    if (!canonicalBarcode) throw new Error('This volume does not expose a stable barcode.');
    currentPages = record.text_by_page_gen?.length ? record.text_by_page_gen : record.text_by_page_src ?? [];
    if (!currentPages.length) throw new Error('This volume does not contain page-level OCR text.');

    currentBook = { rowIndex: fetched.rowIndex, barcode: canonicalBarcode, record: { ...metadata, ...record } };
    readerTitle.textContent = text(record.title_src, text(metadata.title_src, 'Untitled volume'));
    readerAuthor.textContent = text(record.author_src, text(metadata.author_src, 'Unknown author'));
    readerMeta.textContent = `${text(record.language_src, 'und').toUpperCase()} · ${text(record.date1_src, 'Undated')} · ${currentPages.length.toLocaleString()} OCR pages`;
    readerStatus.hidden = true;
    readerChrome.hidden = false;
    readerControls.hidden = false;
    const initialPage = page ?? progressFor(canonicalBarcode);
    showReaderPage(initialPage - 1, { updateUrl: false });
    rememberRecent(fetched.rowIndex, currentBook.record);
    renderRecent();

    if (historyMode === 'push') {
      openedByApp = true;
      updateBookUrl(currentPageIndex + 1, 'push');
    } else if (historyMode === 'replace') {
      openedByApp = false;
      updateBookUrl(currentPageIndex + 1, 'replace');
    }
  } catch (error) {
    readerStatus.hidden = false;
    readerStatus.textContent = 'The selected volume could not be loaded.';
    readerChrome.hidden = true;
    readerPage.removeAttribute('aria-busy');
    readerPage.textContent = error.message;
  }
};

const closeReaderWithoutNavigation = () => {
  if (reader.open) reader.close();
  else unlockDocumentScroll();
};

const applyRoute = async () => {
  if (!token()) return;
  const route = routeFromLocation();
  handlingRoute = true;
  try {
    if (!route) {
      openedByApp = false;
      closeReaderWithoutNavigation();
      return;
    }
    if (currentBook?.barcode === route.barcode && currentPages.length) {
      ensureReaderOpen();
      showReaderPage(route.page - 1, { updateUrl: false });
      return;
    }
    await openBook({ barcode: route.barcode, page: route.page, historyMode: 'none' });
  } finally {
    handlingRoute = false;
  }
};

const copyCurrentPageLink = async () => {
  if (!currentBook) return;
  const link = new URL(bookPath(currentBook.barcode, currentPageIndex + 1), location.origin).href;
  try {
    await navigator.clipboard.writeText(link);
  } catch {
    const temporary = document.createElement('textarea');
    temporary.value = link;
    temporary.setAttribute('readonly', '');
    temporary.style.position = 'fixed';
    temporary.style.opacity = '0';
    document.body.append(temporary);
    temporary.select();
    document.execCommand('copy');
    temporary.remove();
  }
  const original = copyPageLink.textContent;
  copyPageLink.textContent = 'Link copied';
  window.setTimeout(() => { copyPageLink.textContent = original; }, 1600);
};

termsConfirmed?.addEventListener('change', () => {
  if (!termsConfirmed.checked) return;
  rememberConsent();
  updateAuthUi(false);
});
signIn?.addEventListener('click', beginOAuth);
signOut?.addEventListener('click', () => {
  sessionStorage.removeItem(tokenKey);
  closeReaderWithoutNavigation();
  history.replaceState(null, '', `${basePath}/`);
  updateAuthUi(false);
});
clearRecent?.addEventListener('click', () => {
  writeRecent([]);
  renderRecent();
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
copyPageLink?.addEventListener('click', copyCurrentPageLink);
for (const control of [readerTheme, readerFont, readerFontSize, readerLineHeight, readerWidth].filter(Boolean)) {
  control.addEventListener('input', updateReaderSettings);
  control.addEventListener('change', updateReaderSettings);
}

closeReader?.addEventListener('click', () => {
  if (openedByApp) history.back();
  else {
    closeReaderWithoutNavigation();
    history.replaceState(null, '', `${basePath}/`);
  }
});

reader?.addEventListener('close', () => {
  currentPages = [];
  currentBook = undefined;
  unlockDocumentScroll();
});

window.addEventListener('popstate', applyRoute);
window.addEventListener('keydown', event => {
  if (!reader.open || event.defaultPrevented || ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    showReaderPage(currentPageIndex - 1);
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    showReaderPage(currentPageIndex + 1);
  } else if (event.key.toLowerCase() === 'c' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    copyCurrentPageLink();
  }
});

readerPage?.addEventListener('touchstart', event => {
  const touch = event.changedTouches[0];
  swipeStart = { x: touch.clientX, y: touch.clientY };
}, { passive: true });
readerPage?.addEventListener('touchend', event => {
  if (!swipeStart) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - swipeStart.x;
  const dy = touch.clientY - swipeStart.y;
  swipeStart = undefined;
  if (Math.abs(dx) < 60 || Math.abs(dx) <= Math.abs(dy)) return;
  showReaderPage(currentPageIndex + (dx < 0 ? 1 : -1));
}, { passive: true });

const initialise = async () => {
  applyReaderSettings(readReaderSettings());
  if (!token()) {
    updateAuthUi(false);
    return;
  }
  updateAuthUi(true);
  await loadShelf();
  await applyRoute();
};

initialise();