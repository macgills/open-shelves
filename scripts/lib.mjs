import { readFile, readdir, mkdir, rm, writeFile, cp } from 'node:fs/promises';
import path from 'node:path';

export const root = path.resolve(import.meta.dirname, '..');
export const escapeHtml = value => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
export const slugify = value => value.toLowerCase().normalize('NFKD')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function validateBook(book, year = new Date().getUTCFullYear()) {
  const errors = [];
  for (const key of ['slug','title','language','description','source','content']) if (!book[key]) errors.push(`Missing ${key}`);
  if (!Array.isArray(book.authors) || book.authors.length === 0) errors.push('At least one author is required');
  const cutoff = year - 71;
  for (const author of book.authors ?? []) {
    if (!Number.isInteger(author.deathYear)) errors.push(`Missing death year for ${author.name ?? 'author'}`);
    else if (author.deathYear > cutoff) errors.push(`${author.name} died in ${author.deathYear}; conservative Irish cutoff is ${cutoff}`);
  }
  if (!book.source?.landingPage || !book.source?.rightsBasis || !book.source?.retrieved) errors.push('Source requires landingPage, rightsBasis, and retrieved');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(book.slug ?? '')) errors.push('Slug must be lowercase kebab-case');
  return errors;
}

export async function loadBooks() {
  const dir = path.join(root, 'src/content/books');
  const files = (await readdir(dir)).filter(file => file.endsWith('.json')).sort();
  return Promise.all(files.map(async file => JSON.parse(await readFile(path.join(dir, file), 'utf8'))));
}

export async function resetDist() {
  const dist = path.join(root, 'dist');
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  await cp(path.join(root, 'public'), dist, { recursive: true });
  return dist;
}

export async function output(file, contents) {
  const target = path.join(root, 'dist', file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
}
