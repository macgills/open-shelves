import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('app installs text capture before the catalogue and presentation after it', async () => {
  const app = await read('public/assets/app.js');
  assert.match(app, /reader-search\.js[\s\S]*harvard\.js[\s\S]*reader-behaviour\.js[\s\S]*readable-text\.js[\s\S]*library\.js/);
});

test('book search indexes source pages without modifying the API response', async () => {
  const search = await read('public/assets/reader-search.js');
  assert.match(search, /const originalFetch = window\.fetch\.bind\(window\)/);
  assert.match(search, /const clone = response\.clone\(\)/);
  assert.match(search, /open-shelves:ocr-loaded/);
  assert.match(search, /matches\.length === 100/);
  assert.match(search, /pageNumber\.dispatchEvent\(new Event\('change'/);
  assert.match(search, /expectedBarcode && barcode !== expectedBarcode/);
  assert.match(search, /Search across \$\{pages\.length\.toLocaleString\(\)\} pages/);
  assert.doesNotMatch(search, /search its OCR|OCR pages/);
});

test('personal library is local, barcode keyed and follows reading progress', async () => {
  const library = await read('public/assets/library.js');
  assert.match(library, /indexedDB\.open\(databaseName, 1\)/);
  assert.match(library, /createObjectStore\(storeName, \{ keyPath: 'barcode' \}\)/);
  assert.match(library, /\/books\/\$\{encodeURIComponent\(barcode\)\}\/page\//);
  assert.match(library, /progressObserver\.observe\(readerProgress/);
  assert.match(library, /putBook\(\{ \.\.\.saved, page: book\.page/);
  assert.doesNotMatch(library, /fetch\(|localStorage/);
});

test('generated UI exposes saved books and plain-language book search', async () => {
  const build = await read('scripts/build.mjs');
  const styles = await read('public/assets/library-search.css');
  assert.match(build, /id="library-section"/);
  assert.match(build, /id="save-book"/);
  assert.match(build, /id="reader-book-search"/);
  assert.match(build, /Search the text of this book/);
  assert.match(build, /mistakes introduced while scanning/);
  assert.match(build, /id="reader-search-results"/);
  assert.match(build, /assets\/app\.js/);
  assert.match(styles, /\.library-grid/);
  assert.match(styles, /\.reader-search-help/);
  assert.match(styles, /\.reader-search-result/);
});
