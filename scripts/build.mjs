import path from 'node:path';
import { escapeHtml, loadBooks, output, resetDist, root, validateBook } from './lib.mjs';

const basePath = '/open-shelves';
const books = await loadBooks();
const failures = books.flatMap(book => validateBook(book).map(error => `${book.slug ?? 'unknown'}: ${error}`));
if (failures.length) throw new Error(`Content validation failed:\n${failures.join('\n')}`);
await resetDist();

const shell = ({ title, body, description = 'Open, provenance-first public-domain books.', scripts = '' }) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${escapeHtml(description)}"><meta name="color-scheme" content="light dark">
<title>${escapeHtml(title)} · Open Shelves</title><link rel="stylesheet" href="${basePath}/assets/site.css">
<script type="module" src="${basePath}/assets/site.js"></script>${scripts}</head>
<body><header><a class="brand" href="${basePath}/">Open Shelves</a><nav><a href="${basePath}/">Library</a><a href="${basePath}/harvard/">Harvard dataset</a><a href="${basePath}/about/">About</a></nav></header>
<main>${body}</main><footer><p>Code under MIT. Every book carries its own rights and provenance record.</p></footer></body></html>`;

const cards = books.map(book => `<article class="book-card" data-search="${escapeHtml([book.title, ...book.authors.map(a=>a.name), ...(book.subjects??[])].join(' ').toLowerCase())}">
<p class="eyebrow">${escapeHtml(book.language.toUpperCase())} · ${book.publishedYear ?? 'Undated'}</p>
<h2><a href="${basePath}/books/${book.slug}/">${escapeHtml(book.title)}</a></h2>
<p>${escapeHtml(book.authors.map(a=>a.name).join(', '))}</p><p>${escapeHtml(book.description)}</p>
<div class="tags">${(book.subjects??[]).map(s=>`<span>${escapeHtml(s)}</span>`).join('')}</div></article>`).join('\n');

await output('index.html', shell({ title: 'Library', body: `<section class="hero"><p class="eyebrow">A public-domain reading room</p><h1>Old books, made visible.</h1><p>Fast, accessible editions with explicit provenance and conservative copyright checks.</p><p><a href="${basePath}/harvard/">Explore the 983,004-volume Harvard Institutional Books collection →</a></p><label class="search"><span>Search the readable library</span><input id="search" type="search" autocomplete="off" placeholder="Title, author, or subject"></label></section><section><p id="result-count" aria-live="polite">${books.length} book${books.length===1?'':'s'}</p><div id="catalog" class="catalog">${cards}</div></section>` }));

for (const book of books) {
  const sections = book.content.map(section => `<section>${section.heading ? `<h2>${escapeHtml(section.heading)}</h2>` : ''}${section.paragraphs.map(p=>`<p>${escapeHtml(p)}</p>`).join('')}</section>`).join('');
  const authors = book.authors.map(a=>`${escapeHtml(a.name)} (${a.deathYear})`).join(', ');
  await output(`books/${book.slug}/index.html`, shell({ title: book.title, description: book.description, body: `<article class="reader" data-pagefind-body><a class="back" href="${basePath}/">← Library</a><header class="book-header"><p class="eyebrow">${escapeHtml(book.language.toUpperCase())} · ${book.publishedYear ?? 'Undated'}</p><h1>${escapeHtml(book.title)}</h1><p>${authors}</p><p class="dek">${escapeHtml(book.description)}</p></header>${sections}<aside class="provenance"><h2>Rights & provenance</h2><dl><dt>Source</dt><dd><a href="${escapeHtml(book.source.landingPage)}">${escapeHtml(book.source.name)}</a></dd><dt>Retrieved</dt><dd>${escapeHtml(book.source.retrieved)}</dd><dt>Basis</dt><dd>${escapeHtml(book.source.rightsBasis)}</dd></dl></aside></article>` }));
}

await output('harvard/index.html', shell({
  title: 'Harvard Institutional Books',
  description: 'A human-facing discovery layer for Harvard Institutional Books 1.0.',
  scripts: `<script type="module" src="${basePath}/assets/harvard.js"></script>`,
  body: `<article class="reader"><p class="eyebrow">Institutional Books 1.0</p><h1>Nearly one million library books, made discoverable.</h1><p class="dek">Harvard's Institutional Data Initiative released metadata and OCR for 983,004 public-domain volumes digitised through the Google Books project. The complete OCR corpus is roughly 947 GB, so Open Shelves exposes a lightweight metadata discovery layer and promotes selected volumes into readable editions.</p><div class="catalog"><article class="book-card"><p class="eyebrow">Volumes</p><h2>983,004</h2></article><article class="book-card"><p class="eyebrow">Pages</p><h2>386 million</h2></article><article class="book-card"><p class="eyebrow">Languages</p><h2>254</h2></article><article class="book-card"><p class="eyebrow">OCR corpus</p><h2>947 GB</h2></article></div><h2>Search the metadata</h2><p>This searches compact title or author prefix shards generated from the official metadata-only release. It does not download the OCR text into your browser.</p><form id="harvard-search" class="search"><label><span>Search by</span><select id="harvard-mode"><option value="title">Title</option><option value="author">Author</option></select></label><label><span>At least two letters</span><input id="harvard-query" type="search" required minlength="2" placeholder="e.g. Darwin or dictionary"></label><button type="submit">Search</button></form><p id="harvard-status" aria-live="polite">The metadata export is generated during deployment when an authorised Hugging Face token is available.</p><div id="harvard-results" class="catalog"></div><aside class="provenance"><h2>Source and access</h2><p>The official release is gated by early-access terms on Hugging Face. Open Shelves does not bypass that gate or redistribute credentials. Its build uses an authorised token, exports bibliographic discovery fields, and links the collection back to the official source.</p><p><a href="https://huggingface.co/datasets/institutional/institutional-books-1.0-metadata">Official metadata dataset</a> · <a href="https://huggingface.co/datasets/institutional/institutional-books-1.0">Official OCR dataset</a> · <a href="https://institutional.org/institutional-books/">Project overview</a></p></aside></article>`
}));

await output('about/index.html', shell({ title: 'About', body: `<article class="reader"><h1>Built for responsible visibility</h1><p>Open Shelves is a static, community-owned reading and discovery interface. It does not treat “available online” as equivalent to “safe to republish”.</p><h2>Two layers</h2><p>The readable library contains complete texts with book-level provenance. The Harvard discovery layer exposes metadata for a much larger corpus while keeping the gated OCR release at its official source.</p><h2>Admission policy</h2><p>For named literary authors, the automated baseline requires every author to have died at least 71 years before the build year. Contributors must also record the exact source, retrieval date, and legal basis. Translations, illustrations, introductions, and modern typography require separate review.</p></article>` }));

const searchIndex = books.map(({ slug,title,authors,subjects,description }) => ({ slug,title,authors:authors.map(a=>a.name),subjects,description }));
await output('assets/search-index.json', JSON.stringify(searchIndex));
console.log(`Built ${books.length} readable book(s) into ${path.join(root, 'dist')}`);
