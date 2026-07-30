const viewKey = 'open-shelves-text-view';
const reader = document.querySelector('#ocr-reader');
const readerChrome = document.querySelector('#reader-chrome');
const readerPage = document.querySelector('#reader-page');
const readerContext = document.querySelector('#reader-text-context');
const readableButton = document.querySelector('#text-view-readable');
const exactButton = document.querySelector('#text-view-exact');
const readerStatus = document.querySelector('#reader-status');
const readerMeta = document.querySelector('#reader-meta');

const noTextMarkers = new Set([
  '',
  '[No OCR text was supplied for this page.]',
  'No readable text is available for this page.'
]);

let rawText = '';
let currentView = 'readable';
let pageObserver;

try {
  const saved = localStorage.getItem(viewKey);
  if (saved === 'exact' || saved === 'readable') currentView = saved;
} catch {
  // The readable view remains the default when storage is unavailable.
}

const tidySentence = value => value
  .replaceAll(/\s+/g, ' ')
  .replaceAll(/\s+([,.;:!?])/g, '$1')
  .trim();

const normaliseMechanicalBreaks = value => String(value)
  .replaceAll('\r\n', '\n')
  .replaceAll('\r', '\n')
  .replaceAll(/([A-Za-zÀ-ÖØ-öø-ÿ])-\n(?=[a-zà-öø-ÿ])/g, '$1')
  .trim();

const hasReadableText = value => !noTextMarkers.has(String(value).trim());

const isHeading = lines => {
  if (lines.length !== 1) return false;
  const value = lines[0];
  if (value.length > 90 || value.split(/\s+/).length > 12) return false;
  const letters = value.replaceAll(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '');
  return letters.length > 2 && (letters === letters.toUpperCase() || !/[.!?;:]$/.test(value));
};

const isVerse = lines => {
  if (lines.length < 3) return false;
  const average = lines.reduce((sum, line) => sum + line.length, 0) / lines.length;
  const longLines = lines.filter(line => line.length > 62).length;
  return average < 48 && longLines <= 1;
};

const createReadableBlock = block => {
  const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
  if (!lines.length) return null;

  if (isHeading(lines)) {
    const heading = document.createElement('h3');
    heading.className = 'transcription-heading';
    heading.textContent = tidySentence(lines[0]);
    return heading;
  }

  const paragraph = document.createElement('p');
  if (isVerse(lines)) {
    paragraph.className = 'transcription-verse';
    for (const [index, line] of lines.entries()) {
      if (index) paragraph.append(document.createElement('br'));
      paragraph.append(document.createTextNode(line));
    }
  } else {
    paragraph.className = 'transcription-paragraph';
    paragraph.textContent = tidySentence(lines.join(' '));
  }
  return paragraph;
};

const renderEmptyPage = () => {
  const empty = document.createElement('div');
  empty.className = 'transcription-empty-state';
  const heading = document.createElement('strong');
  heading.textContent = 'No readable text for this page';
  const explanation = document.createElement('span');
  explanation.textContent = 'The page is present in the scanned book, but its words could not be converted into searchable text.';
  empty.append(heading, explanation);
  readerPage.replaceChildren(empty);
};

const renderReadable = () => {
  if (!hasReadableText(rawText)) {
    renderEmptyPage();
    return;
  }

  const fragment = document.createDocumentFragment();
  const normalised = normaliseMechanicalBreaks(rawText);
  for (const block of normalised.split(/\n\s*\n+/)) {
    const element = createReadableBlock(block);
    if (element) fragment.append(element);
  }
  if (!fragment.childNodes.length) {
    renderEmptyPage();
    return;
  }
  readerPage.replaceChildren(fragment);
};

const updateButtons = () => {
  readableButton?.setAttribute('aria-pressed', currentView === 'readable' ? 'true' : 'false');
  exactButton?.setAttribute('aria-pressed', currentView === 'exact' ? 'true' : 'false');
};

const observePage = () => pageObserver?.observe(readerPage, {
  attributes: true,
  attributeFilter: ['aria-busy'],
  childList: true,
  characterData: true,
  subtree: true
});

const translateError = value => String(value)
  .replace('This volume does not contain page-level OCR text.', 'Readable text is not available for this book.')
  .replace('[No OCR text was supplied for this page.]', 'No readable text is available for this page.');

const renderCurrentPage = () => {
  if (!readerPage) return;
  pageObserver?.disconnect();
  const busy = readerPage.hasAttribute('aria-busy');
  const reading = !busy && readerChrome && !readerChrome.hidden;
  const hasText = hasReadableText(rawText);
  readerContext.hidden = !reading || !hasText;

  if (busy) {
    readerPage.textContent = 'Preparing readable text…';
    readerPage.dataset.textView = 'loading';
  } else if (!reading) {
    readerPage.textContent = translateError(readerPage.textContent);
    readerPage.dataset.textView = 'message';
  } else if (!hasText) {
    readerPage.dataset.textView = 'empty';
    renderEmptyPage();
  } else if (currentView === 'exact') {
    readerPage.textContent = rawText;
    readerPage.dataset.textView = 'exact';
  } else {
    readerPage.dataset.textView = 'readable';
    renderReadable();
  }

  updateButtons();
  observePage();
};

const capturePage = () => {
  if (!readerPage.hasAttribute('aria-busy') && readerChrome && !readerChrome.hidden) {
    rawText = readerPage.textContent;
  }
  renderCurrentPage();
};

const setView = view => {
  currentView = view;
  try {
    localStorage.setItem(viewKey, view);
  } catch {
    // The setting can remain session-only when storage is unavailable.
  }
  renderCurrentPage();
};

const translateInterfaceCopy = node => {
  if (!node) return;
  const translated = node.textContent
    .replace('Fetching page-level OCR from the official dataset…', 'Preparing readable text from the scanned pages…')
    .replace(/([\d,]+) OCR pages/g, '$1 pages');
  if (translated !== node.textContent) node.textContent = translated;
};

readableButton?.addEventListener('click', () => setView('readable'));
exactButton?.addEventListener('click', () => setView('exact'));

if (readerPage) {
  pageObserver = new MutationObserver(capturePage);
  if (!readerPage.hasAttribute('aria-busy') && readerChrome && !readerChrome.hidden) rawText = readerPage.textContent;
  renderCurrentPage();
}

for (const node of [readerStatus, readerMeta]) {
  if (!node) continue;
  translateInterfaceCopy(node);
  new MutationObserver(() => translateInterfaceCopy(node)).observe(node, { childList: true, characterData: true, subtree: true });
}