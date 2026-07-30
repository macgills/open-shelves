import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { escapeHtml } from '../scripts/lib.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('escapes generated page content', () => {
  assert.equal(escapeHtml(`<script a="b">&'</script>`), '&lt;script a=&quot;b&quot;&gt;&amp;&#39;&lt;/script&gt;');
});

test('declares a public Hugging Face OAuth client as JSON', async () => {
  const metadata = JSON.parse(await read('public/oauth-cimd.json'));
  assert.equal(metadata.client_id, 'https://macgills.github.io/open-shelves/oauth-cimd.json');
  assert.equal(metadata.token_endpoint_auth_method, 'none');
  assert.deepEqual(metadata.grant_types, ['authorization_code']);
  assert.deepEqual(metadata.response_types, ['code']);
  assert.deepEqual(metadata.redirect_uris, ['https://macgills.github.io/open-shelves/oauth/callback/huggingface/']);
});

test('requests only gated read access for dataset browsing', async () => {
  const browser = await read('public/assets/harvard.js');
  assert.match(browser, /openid profile gated-repos/);
  assert.match(browser, /datasets-server\.huggingface\.co/);
  assert.doesNotMatch(browser, /HF_TOKEN|GUTENBERG/i);
});

test('persists consent and hides the general consent state after acknowledgement', async () => {
  const browser = await read('public/assets/harvard.js');
  assert.match(browser, /open-shelves-hf-consent/);
  assert.match(browser, /localStorage\.setItem\(consentKey, 'accepted'\)/);
  assert.match(browser, /consentIntroduction\.hidden = consented/);
  assert.match(browser, /accessPanel\.hidden = connected/);
});

test('catalogue uses deterministic generated covers and recent books', async () => {
  const browser = await read('public/assets/harvard.js');
  assert.match(browser, /className = `book-cover/);
  assert.match(browser, /open-shelves-recent-books/);
  assert.match(browser, /rememberRecent\(fetched\.rowIndex/);
  assert.match(browser, /renderRecent\(\)/);
});

test('opens the reader with an in-modal loading state and locks background scroll', async () => {
  const browser = await read('public/assets/harvard.js');
  assert.match(browser, /showReaderLoading\(metadata\);\s*try \{/);
  assert.match(browser, /reader\.showModal\(\)/);
  assert.match(browser, /document\.body\.classList\.add\('reader-open'\)/);
  assert.match(browser, /unlockDocumentScroll\(\)/);
  assert.match(browser, /Fetching page-level OCR from the official dataset/);
});

test('uses stable barcode routes instead of row-index query parameters', async () => {
  const browser = await read('public/assets/harvard.js');
  assert.match(browser, /const bookPath = \(barcode, page = 1\)/);
  assert.match(browser, /\/books\/\$\{encodeURIComponent\(barcode\)\}\/page\//);
  assert.match(browser, /routeFromLocation/);
  assert.match(browser, /fetchOcrBook/);
  assert.match(browser, /where: `"barcode_src"='\$\{escapedBarcode\}'`/);
  assert.doesNotMatch(browser, /searchParams\.set\('book'/);
});

test('persists reading position and reader preferences', async () => {
  const browser = await read('public/assets/harvard.js');
  assert.match(browser, /open-shelves-reading-progress/);
  assert.match(browser, /rememberProgress\(currentBook\.barcode, page\)/);
  assert.match(browser, /progressFor\(canonicalBarcode\)/);
  assert.match(browser, /open-shelves-reader-settings/);
  assert.match(browser, /applyReaderSettings\(readReaderSettings\(\)\)/);
});

test('supports browser history, keyboard, swipe and copyable page links', async () => {
  const browser = await read('public/assets/harvard.js');
  assert.match(browser, /history\[method\]/);
  assert.match(browser, /window\.addEventListener\('popstate', applyRoute\)/);
  assert.match(browser, /event\.key === 'ArrowLeft'/);
  assert.match(browser, /touchstart/);
  assert.match(browser, /navigator\.clipboard\.writeText/);
});

test('reader exposes visual page progress', async () => {
  const browser = await read('public/assets/harvard.js');
  assert.match(browser, /readerProgressFill\.style\.width/);
  assert.match(browser, /readerProgress\.setAttribute\('aria-valuenow'/);
});

test('generated markup contains durable reader controls and a 404 app shell', async () => {
  const build = await read('scripts/build.mjs');
  assert.match(build, /id="recent-section"/);
  assert.match(build, /id="reader-progress"/);
  assert.match(build, /id="copy-page-link"/);
  assert.match(build, /id="reader-theme"/);
  assert.match(build, /id="reader-font-size"/);
  assert.match(build, /output\('404\.html', page\)/);
  assert.match(build, /assets\/reader\.css/);
});

test('styles include covers, compact returning state and full-screen mobile reader', async () => {
  const styles = await read('public/assets/site.css');
  const readerStyles = await read('public/assets/reader.css');
  assert.match(styles, /\.book-cover/);
  assert.match(styles, /\.returning-user \.stats/);
  assert.match(styles, /#ocr-reader \{ width: 100vw; height: 100dvh/);
  assert.match(readerStyles, /data-reader-theme='sepia'/);
  assert.match(readerStyles, /--reader-font-size/);
  assert.match(readerStyles, /\.reader-settings-grid/);
});

test('production build rewrites OAuth references to the JSON document', async () => {
  const build = await read('scripts/build.mjs');
  assert.match(build, /oauth-cimd\.json/);
  assert.match(build, /replaceAll\(legacyOAuthClientPath, oauthClientPath\)/);
});

test('branch preview rewrites app and OAuth URLs beneath the preview path', async () => {
  const preview = await read('scripts/build-preview.mjs');
  const workflow = await read('.github/workflows/preview-durable-reader.yml');
  assert.match(preview, /previews\/\$\{previewSlug\}/);
  assert.match(preview, /Preview OAuth metadata was not rewritten/);
  assert.match(workflow, /production\/dist\/previews\/durable-reader/);
  assert.match(workflow, /ref: main/);
});

test('build is Harvard-only and does not run an ingestion exporter', async () => {
  const packageJson = JSON.parse(await read('package.json'));
  assert.equal(packageJson.scripts.build, 'node scripts/build.mjs');
  assert.equal(packageJson.scripts.ingest, undefined);
});
