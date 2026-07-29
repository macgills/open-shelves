import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { root, slugify, validateBook } from './lib.mjs';

const MIRROR = process.env.GUTENBERG_MIRROR ?? 'https://www.mirrorservice.org/sites/ftp.ibiblio.org/pub/docs/books/gutenberg';
const catalogue = JSON.parse(await readFile(path.join(root, 'src/catalogue.json'), 'utf8'));
const outputDir = path.join(root, 'src/content/books');
const retrieved = new Date().toISOString().slice(0, 10);

function sourceCandidates(id) {
  const digits = String(id).split('/').join('');
  const nested = digits.split('').join('/');
  const legacyNested = digits.slice(0, -1).split('').join('/');
  return [
    `${MIRROR}/${nested}/${id}/${id}-0.txt`,
    `${MIRROR}/${nested}/${id}/${id}.txt`,
    `${MIRROR}/${legacyNested}/${id}/${id}-0.txt`,
    `${MIRROR}/${legacyNested}/${id}/${id}.txt`
  ];
}

async function downloadText(id) {
  const failures = [];
  for (const url of sourceCandidates(id)) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'open-shelves/0.2 (+https://github.com/macgills/open-shelves)' },
        signal: AbortSignal.timeout(30_000)
      });
      if (!response.ok) {
        failures.push(`${response.status} ${url}`);
        continue;
      }
      const text = await response.text();
      if (text.length < 5_000) {
        failures.push(`too short ${url}`);
        continue;
      }
      return { text, url };
    } catch (error) {
      failures.push(`${error.message} ${url}`);
    }
  }
  throw new Error(`Unable to fetch ebook ${id}:\n${failures.join('\n')}`);
}

function stripGutenbergWrapper(input) {
  const normalized = input.replaceAll('\r\n', '\n').replaceAll('\r', '\n').replace(/^\uFEFF/, '');
  const start = normalized.search(/\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i);
  const end = normalized.search(/\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i);
  const bodyStart = start >= 0 ? normalized.indexOf('\n', start) + 1 : 0;
  const bodyEnd = end > bodyStart ? end : normalized.length;
  return normalized.slice(bodyStart, bodyEnd).trim();
}

function looksLikeHeading(value) {
  const line = value.trim();
  if (!line || line.length > 100) return false;
  return /^(chapter|book|part|volume|act|scene)\b/i.test(line)
    || /^(prologue|epilogue|preface|introduction|conclusion)$/i.test(line)
    || (/^[A-Z0-9 .,'’“”!?—:-]+$/.test(line) && line.length >= 4 && /[A-Z]/.test(line));
}

function toSections(text) {
  const blocks = text.split(/\n\s*\n+/).map(block => block.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const sections = [];
  let current = { heading: null, paragraphs: [] };

  for (const block of blocks) {
    if (looksLikeHeading(block) && current.paragraphs.length) {
      sections.push(current);
      current = { heading: block, paragraphs: [] };
    } else if (looksLikeHeading(block) && !current.heading && current.paragraphs.length === 0) {
      current.heading = block;
    } else {
      current.paragraphs.push(block);
    }
  }
  if (current.heading || current.paragraphs.length) sections.push(current);

  const useful = sections.filter(section => section.paragraphs.join(' ').length >= 120);
  return useful.length ? useful : [{ heading: null, paragraphs: blocks }];
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

for (const entry of catalogue) {
  if (slugify(entry.title) === '') throw new Error(`Invalid title for Gutenberg ebook ${entry.id}`);
  const { text, url } = await downloadText(entry.id);
  const cleaned = stripGutenbergWrapper(text);
  const content = toSections(cleaned);
  const book = {
    slug: entry.slug,
    title: entry.title,
    authors: [{ name: entry.author, deathYear: entry.deathYear }],
    language: 'en',
    publishedYear: entry.publishedYear,
    description: entry.description,
    subjects: entry.subjects,
    source: {
      name: `Project Gutenberg ebook ${entry.id}, retrieved from an approved mirror`,
      landingPage: `https://www.gutenberg.org/ebooks/${entry.id}`,
      downloadUrl: url,
      retrieved,
      rightsBasis: `${entry.author} died in ${entry.deathYear}. The underlying English-language work is beyond Ireland's life-plus-70 copyright term; the Project Gutenberg transcription is redistributed with source attribution and without use of its trademark as the site identity.`
    },
    content
  };
  const errors = validateBook(book);
  if (errors.length) throw new Error(`${entry.slug}: ${errors.join('; ')}`);
  await writeFile(path.join(outputDir, `${entry.slug}.json`), `${JSON.stringify(book, null, 2)}\n`);
  console.log(`Imported ${entry.title}: ${content.length} section(s), ${cleaned.length.toLocaleString()} characters`);
}

console.log(`Imported ${catalogue.length} complete books.`);
