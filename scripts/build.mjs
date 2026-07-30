import path from 'node:path';
import { escapeHtml, output, resetDist, root } from './lib.mjs';

const basePath = '/open-shelves';
await resetDist();

const shell = ({ title, body, description = 'Browse and read Harvard Institutional Books with your own gated access.', scripts = '' }) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${escapeHtml(description)}"><meta name="color-scheme" content="light dark">
<title>${escapeHtml(title)} · Open Shelves</title><link rel="stylesheet" href="${basePath}/assets/site.css">
<script type="module" src="${basePath}/assets/site.js"></script>${scripts}</head>
<body><header><a class="brand" href="${basePath}/">Open Shelves</a><nav><a href="${basePath}/">Browse</a><a href="${basePath}/about/">About</a></nav></header>
<main>${body}</main><footer><p>Open Shelves is an independent interface. Dataset access and use remain governed by the Institutional Data Initiative and Hugging Face.</p></footer></body></html>`;

const collection = `<section class="hero"><p class="eyebrow">Harvard Institutional Books 1.0</p><h1>Nearly one million public-domain volumes.</h1><p>Browse the official collection, search its metadata, and open OCR page by page without copying the dataset into this site.</p></section>
<section class="stats" aria-label="Collection scale"><article><strong>983,004</strong><span>volumes</span></article><article><strong>386M</strong><span>pages</span></article><article><strong>254</strong><span>languages</span></article><article><strong>947 GB</strong><span>OCR corpus</span></article></section>
<section id="access-panel" class="access-panel"><p class="eyebrow">Access</p><h2>Use your own approved access</h2><p>The collection is gated by its publisher. Review and accept the official terms on Hugging Face, then sign in here. Open Shelves requests only the <code>gated-repos</code> permission and keeps the short-lived token in this browser session.</p><p><a class="button secondary" href="https://huggingface.co/datasets/institutional/institutional-books-1.0" target="_blank" rel="noreferrer">Review the official terms ↗</a></p><label class="agreement"><input id="terms-confirmed" type="checkbox"> I have reviewed and accepted the official dataset terms on Hugging Face.</label><div class="button-row"><button id="hf-sign-in" type="button" disabled>Sign in with Hugging Face</button><button id="hf-sign-out" type="button" class="secondary" hidden>Sign out</button></div><p id="auth-status" aria-live="polite">Not connected.</p></section>
<section id="collection-browser" hidden><div class="browser-heading"><div><p class="eyebrow">Collection browser</p><h2>Browse the shelves</h2></div><form id="harvard-search" class="search inline"><label><span>Optional search</span><input id="harvard-query" type="search" placeholder="Title, author, subject, barcode…"></label><button type="submit">Search</button><button id="clear-search" type="button" class="secondary">Clear</button></form></div><div class="browse-controls"><button id="previous-page" type="button" class="secondary">← Previous</button><button id="random-page" type="button" class="secondary">Random shelf</button><button id="next-page" type="button">Next →</button></div><p id="harvard-status" aria-live="polite">Connect to load the collection.</p><div id="harvard-results" class="catalog"></div><div class="browse-controls"><button id="previous-page-bottom" type="button" class="secondary">← Previous</button><button id="next-page-bottom" type="button">Next →</button></div></section>
<dialog id="ocr-reader"><article class="reader-dialog"><header><div><p id="reader-meta" class="eyebrow"></p><h2 id="reader-title">Book</h2><p id="reader-author"></p></div><button id="close-reader" type="button" class="secondary" aria-label="Close reader">Close</button></header><nav class="page-controls" aria-label="OCR pages"><button id="previous-reader-page" type="button" class="secondary">← Previous page</button><label>Page <input id="reader-page-number" type="number" min="1" value="1"> of <span id="reader-page-count">1</span></label><button id="next-reader-page" type="button">Next page →</button></nav><pre id="reader-page" tabindex="0"></pre><aside class="provenance"><h3>About this text</h3><p>This is OCR supplied by the official Institutional Books dataset and fetched using your own authorised session. Errors, missing characters, and page artefacts are part of the source OCR.</p></aside></article></dialog>`;

const page = shell({
  title: 'Browse Harvard Institutional Books',
  scripts: `<script type="module" src="${basePath}/assets/harvard.js"></script>`,
  body: collection
});

await output('index.html', page);
await output('harvard/index.html', page);
await output('about/index.html', shell({
  title: 'About',
  body: `<article class="reader"><p class="eyebrow">About Open Shelves</p><h1>A reader, not another corpus mirror.</h1><p class="dek">Open Shelves is a static interface for exploring Harvard Institutional Books 1.0 through Hugging Face's official gated APIs.</p><h2>How access works</h2><p>Every visitor accepts the publisher's terms on Hugging Face and signs in using OAuth. Open Shelves never embeds a repository token, never publishes metadata shards, and never republishes the OCR corpus in its Pages artifact.</p><h2>What the browser does</h2><p>Browsing requests small slices from the official metadata dataset. Opening a volume requests its corresponding row from the official OCR dataset and renders one page at a time in the browser.</p><h2>Independence</h2><p>This project is not operated by Harvard, the Institutional Data Initiative, Google, HathiTrust, or Hugging Face.</p></article>`
}));

console.log(`Built the Harvard-first Open Shelves site into ${path.join(root, 'dist')}`);
