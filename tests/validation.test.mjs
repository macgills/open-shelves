import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { escapeHtml } from '../scripts/lib.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('escapes generated page content', () => {
  assert.equal(escapeHtml(`<script a="b">&'</script>`), '&lt;script a=&quot;b&quot;&gt;&amp;&#39;&lt;/script&gt;');
});

test('build supports registered OAuth without embedding a client secret', async () => {
  const build = await read('scripts/build.mjs');
  assert.match(build, /HF_OAUTH_CLIENT_ID/);
  assert.match(build, /missing-hf-oauth-client-id/);
  assert.match(build, /JSON\.stringify\(oauthClientId\)/);
  assert.match(build, /name="hf-oauth-client-id"/);
  assert.doesNotMatch(build, /oauth-cimd\.json/);
});

test('provides a validated session-only token fallback', async () => {
  const build = await read('scripts/build.mjs');
  const fallback = await read('public/assets/auth-fallback.js');
  const app = await read('public/assets/app.js');
  assert.match(build, /id="hf-token-form"/);
  assert.match(build, /type="password"/);
  assert.match(fallback, /sessionStorage\.setItem\(tokenKey, accessToken\)/);
  assert.match(fallback, /datasets-server\.huggingface\.co/);
  assert.match(fallback, /That token does not have access/);
  assert.doesNotMatch(fallback, /localStorage\.setItem\([^\n]*token/i);
  assert.match(app, /auth-fallback\.js[\s\S]*harvard\.js/);
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
});

test('presents scanned text in readable and exact views', async () => {
  const build = await read('scripts/build.mjs');
  const presentation = await read('public/assets/readable-text.js');
  const styles = await read('public/assets/readable-text.css');
  assert.match(build, /Readable text\./);
  assert.match(build, /Exact transcription/);
  assert.match(build, /How this text was made/);
  assert.match(build, /aria-label="Book pages"/);
  assert.match(presentation, /normaliseMechanicalBreaks/);
  assert.match(presentation, /isVerse/);
  assert.match(presentation, /open-shelves-text-view/);
  assert.match(styles, /data-text-view='readable'/);
  assert.match(styles, /transcription-paragraph/);
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

test('reader repeats page navigation after the book contents', async () => {
  const build = await read('scripts/build.mjs');
  const app = await read('public/assets/app.js');
  const behaviour = await read('public/assets/reader-bottom-nav.js');
  const styles = await read('public/assets/reader-bottom-nav.css');
  assert.match(build, /id="reader-page"[\s\S]*id="reader-controls-bottom"/);
  assert.match(build, /id="next-reader-page-bottom"/);
  assert.match(app, /harvard\.js[\s\S]*reader-bottom-nav\.js[\s\S]*reader-behaviour\.js/);
  assert.match(behaviour, /nextBottom\?\.addEventListener\('click'/);
  assert.match(behaviour, /nextTop\?\.click\(\)/);
  assert.match(styles, /\.reader-controls-bottom/);
});

test('generated markup contains durable reader controls and access fallback', async () => {
  const build = await read('scripts/build.mjs');
  assert.match(build, /id="recent-section"/);
  assert.match(build, /id="reader-progress"/);
  assert.match(build, /id="copy-page-link"/);
  assert.match(build, /id="reader-theme"/);
  assert.match(build, /id="hf-token-form"/);
  assert.match(build, /assets\/auth\.css/);
  assert.match(build, /output\('404\.html', page\)/);
});

test('styles include covers, compact returning state and full-screen mobile reader', async () => {
  const styles = await read('public/assets/site.css');
  const readerStyles = await read('public/assets/reader.css');
  const authStyles = await read('public/assets/auth.css');
  assert.match(styles, /\.book-cover/);
  assert.match(styles, /\.returning-user \.stats/);
  assert.match(styles, /#ocr-reader \{ width: 100vw; height: 100dvh/);
  assert.match(readerStyles, /data-reader-theme='sepia'/);
  assert.match(readerStyles, /--reader-font-size/);
  assert.match(authStyles, /\.token-form/);
});

test('production and preview workflows use the OAuth client ID repository secret', async () => {
  const workflows = await Promise.all([
    read('.github/workflows/pages.yml'),
    read('.github/workflows/preview-durable-reader.yml'),
    read('.github/workflows/preview-library-search.yml')
  ]);
  for (const workflow of workflows) {
    assert.match(workflow, /secrets\.HF_OAUTH_CLIENT_ID/);
    assert.doesNotMatch(workflow, /vars\.HF_OAUTH_CLIENT_ID/);
    assert.match(workflow, /Require registered OAuth client/);
    assert.match(workflow, /! grep -Fq 'oauth-cimd'/);
    assert.match(workflow, /if-no-files-found: warn/);
  }
});

test('branch preview rewrites app URLs beneath the preview path', async () => {
  const preview = await read('scripts/build-preview.mjs');
  const workflow = await read('.github/workflows/preview-durable-reader.yml');
  assert.match(preview, /previews\/\$\{previewSlug\}/);
  assert.match(preview, /hf-token-form/);
  assert.match(workflow, /production\/dist\/previews\/durable-reader/);
  assert.match(workflow, /ref: main/);
});

test('build is Harvard-only and does not run an ingestion exporter', async () => {
  const packageJson = JSON.parse(await read('package.json'));
  assert.equal(packageJson.scripts.build, 'node scripts/build.mjs');
  assert.equal(packageJson.scripts.ingest, undefined);
});
