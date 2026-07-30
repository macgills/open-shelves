import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { escapeHtml, output, resetDist, root } from './lib.mjs';

const basePath = '/open-shelves';
const oauthClientExpression = '`${location.origin}${basePath}/.well-known/oauth-cimd`';
const oauthClientId = process.env.HF_OAUTH_CLIENT_ID?.trim() || 'missing-hf-oauth-client-id';
await resetDist();

for (const relativePath of ['assets/harvard.js', 'assets/oauth-callback.js']) {
  const target = path.join(root, 'dist', relativePath);
  const source = await readFile(target, 'utf8');
  if (!source.includes(oauthClientExpression)) {
    throw new Error(`${relativePath} does not contain the expected OAuth client expression`);
  }
  await writeFile(target, source.replaceAll(oauthClientExpression, JSON.stringify(oauthClientId)));
}

const shell = ({ title, body, description = 'Browse and read Harvard Institutional Books with your own gated access.', scripts = '' }) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${escapeHtml(description)}"><meta name="color-scheme" content="light dark">
<title>${escapeHtml(title)} · Open Shelves</title><link rel="stylesheet" href="${basePath}/assets/site.css"><link rel="stylesheet" href="${basePath}/assets/reader.css"><link rel="stylesheet" href="${basePath}/assets/reader-layout.css"><link rel="stylesheet" href="${basePath}/assets/readable-text.css">${scripts}</head>
<body><header class="site-header"><a class="brand" href="${basePath}/"><span>Open Shelves</span><small>Harvard Institutional Books</small></a><nav><a href="${basePath}/">Browse</a><a href="${basePath}/about/">About</a></nav></header>
<main>${body}</main><footer><p>Open Shelves is an independent interface. Dataset access and use remain governed by the Institutional Data Initiative and Hugging Face.</p></footer></body></html>`;

const readerSettings = `<div class="reader-tools"><button id="copy-page-link" type="button" class="secondary">Copy page link</button><details class="reader-settings"><summary>Reading settings</summary><div class="reader-settings-grid"><label><span>Theme</span><select id="reader-theme"><option value="system">System</option><option value="light">Light</option><option value="sepia">Sepia</option><option value="dark">Dark</option></select></label><label><span>Typeface</span><select id="reader-font"><option value="serif">Book serif</option><option value="sans">Clear sans</option></select></label><label><span>Text size</span><input id="reader-font-size" type="range" min="15" max="28" step="1" value="18"></label><label><span>Line spacing</span><input id="reader-line-height" type="range" min="1.4" max="2.2" step="0.1" value="1.8"></label><label><span>Reading width</span><input id="reader-width" type="range" min="48" max="90" step="2" value="72"></label></div></details></div>`;

const textContext = `<div id="reader-text-context" class="reader-text-context" hidden><p><strong>Readable text.</strong> This page was read automatically from a scan, so it may contain mistakes.</p><div class="text-view-switch" role="group" aria-label="Text view"><button id="text-view-readable" type="button" aria-pressed="true">Readable</button><button id="text-view-exact" type="button" aria-pressed="false">Exact transcription</button></div></div>`;
const provenance = `<details class="provenance"><summary>How this text was made</summary><p>A computer read the words from images of the original pages. Open Shelves tidies mechanical line breaks for easier reading, but it does not rewrite or correct the book.</p><p><strong>Technical detail:</strong> this process is called optical character recognition, or OCR. Choose <em>Exact transcription</em> to see the text exactly as supplied by the collection.</p></details>`;

const collection = `<section id="collection-intro" class="hero"><p class="eyebrow">Harvard Institutional Books 1.0</p><h1>A reading room for nearly one million public-domain volumes.</h1><p>Wander through the collection, search its catalogue, and read each scanned book page by page.</p></section>
<section class="stats" aria-label="Collection scale"><article><strong>983,004</strong><span>volumes</span></article><article><strong>386M</strong><span>pages</span></article><article><strong>254</strong><span>languages</span></article><article><strong>947 GB</strong><span>searchable text</span></article></section>
<section id="access-panel" class="access-panel"><div id="consent-introduction"><p class="eyebrow">Access</p><h2>Use your own approved access</h2><p>The collection is gated by its publisher. Review and accept the official terms on Hugging Face, then sign in here. Open Shelves requests only the <code>gated-repos</code> permission and keeps the short-lived token in this browser session.</p><p><a class="button secondary" href="https://huggingface.co/datasets/institutional/institutional-books-1.0" target="_blank" rel="noreferrer">Review the official terms ↗</a></p><label class="agreement"><input id="terms-confirmed" type="checkbox"> I have reviewed and accepted the official dataset terms on Hugging Face.</label></div><div class="button-row"><button id="hf-sign-in" type="button" disabled>Continue with Hugging Face</button></div><p id="auth-status" aria-live="polite">Not connected.</p></section>
<section id="collection-browser" hidden><section id="recent-section" class="recent-section" hidden><div class="section-heading"><div><p class="eyebrow">Your reading table</p><h2>Recently opened</h2></div><button id="clear-recent" type="button" class="text-button">Clear history</button></div><div id="recent-results" class="recent-strip"></div></section><div class="browser-heading"><div><p class="eyebrow">The catalogue</p><h2>Browse the shelves</h2></div><div class="browser-actions"><button id="hf-sign-out" type="button" class="secondary" hidden>Sign out</button><form id="harvard-search" class="search inline"><label><span>Search the catalogue</span><input id="harvard-query" type="search" placeholder="Titles, authors, subjects or shelfmarks…"></label><button type="submit">Search</button><button id="clear-search" type="button" class="secondary">Clear</button></form></div></div><div class="browse-controls"><button id="previous-page" type="button" class="secondary">← Previous shelf</button><button id="random-page" type="button" class="secondary">Surprise me</button><button id="next-page" type="button">Next shelf →</button></div><p id="harvard-status" class="shelf-status" aria-live="polite">Connect to load the collection.</p><div id="harvard-results" class="catalog"></div><div class="browse-controls"><button id="previous-page-bottom" type="button" class="secondary">← Previous shelf</button><button id="next-page-bottom" type="button">Next shelf →</button></div></section>
<dialog id="ocr-reader" aria-labelledby="reader-title"><article class="reader-dialog"><header><div><p id="reader-meta" class="eyebrow"></p><h2 id="reader-title">Book</h2><p id="reader-author" class="reader-author"></p></div><button id="close-reader" type="button" class="secondary" aria-label="Close reader">Close</button></header><p id="reader-status" class="reader-status" aria-live="polite" hidden></p><div id="reader-chrome" hidden><div id="reader-progress" class="reader-progress" role="progressbar" aria-label="Reading progress" aria-valuemin="1" aria-valuemax="1" aria-valuenow="1"><span id="reader-progress-fill"></span></div><nav id="reader-controls" class="page-controls" aria-label="Book pages"><button id="previous-reader-page" type="button" class="secondary">← Previous page</button><label>Page <input id="reader-page-number" type="number" min="1" value="1"> of <span id="reader-page-count">1</span></label><button id="next-reader-page" type="button">Next page →</button></nav>${readerSettings}</div>${textContext}<article id="reader-page" tabindex="0"></article>${provenance}</article></dialog>`;

const page = shell({
  title: 'Browse Harvard Institutional Books',
  scripts: `<script type="module" src="${basePath}/assets/harvard.js"></script><script type="module" src="${basePath}/assets/reader-behaviour.js"></script><script type="module" src="${basePath}/assets/readable-text.js"></script>`,
  body: collection
});

await output('index.html', page);
await output('404.html', page);
await output('harvard/index.html', page);
await output('about/index.html', shell({
  title: 'About',
  body: `<article class="reader"><p class="eyebrow">About Open Shelves</p><h1>A reader, not another corpus mirror.</h1><p class="dek">Open Shelves is a static interface for exploring Harvard Institutional Books 1.0 through Hugging Face's official gated APIs.</p><h2>How access works</h2><p>Every visitor accepts the publisher's terms on Hugging Face and signs in using a registered public OAuth application with PKCE. Open Shelves never embeds a client secret, repository token, metadata shard, or full-text collection in its Pages artifact.</p><h2>What the reader does</h2><p>Opening a volume loads text that was automatically read from images of the scanned pages. The default readable view tidies mechanical line wrapping while preserving the supplied wording. An exact transcription view is always available.</p><h2>Durable links</h2><p>Books and pages use barcode-based URLs so a reading position can be bookmarked, shared and restored independently of dataset row ordering.</p><h2>Independence</h2><p>This project is not operated by Harvard, the Institutional Data Initiative, Google, HathiTrust, or Hugging Face.</p></article>`
}));

console.log(`Built the Harvard-first Open Shelves site into ${path.join(root, 'dist')}`);