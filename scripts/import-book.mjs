import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { root, slugify, validateBook } from './lib.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(arg => { const [k,...v] = arg.replace(/^--/,'').split('='); return [k,v.join('=')]; }));
const required = ['title','author','death-year','source-url','source-name','rights-basis','file'];
const missing = required.filter(key => !args[key]);
if (missing.length) throw new Error(`Missing: ${missing.map(x=>`--${x}=...`).join(', ')}`);
const text = await readFile(path.resolve(args.file), 'utf8');
const paragraphs = text.replaceAll('\r\n','\n').split(/\n\s*\n/).map(p=>p.replace(/\s+/g,' ').trim()).filter(Boolean);
const book = {
  slug: args.slug ?? slugify(args.title), title: args.title,
  authors: [{ name: args.author, deathYear: Number(args['death-year']) }],
  language: args.language ?? 'en', publishedYear: args['published-year'] ? Number(args['published-year']) : undefined,
  subjects: (args.subjects ?? '').split(',').map(s=>s.trim()).filter(Boolean),
  description: args.description ?? `A public-domain edition of ${args.title}.`,
  source: { name: args['source-name'], landingPage: args['source-url'], retrieved: new Date().toISOString().slice(0,10), rightsBasis: args['rights-basis'] },
  content: [{ paragraphs }]
};
const errors = validateBook(book);
if (errors.length) throw new Error(errors.join('\n'));
const target = path.join(root, 'src/content/books', `${book.slug}.json`);
await writeFile(target, JSON.stringify(book, null, 2) + '\n', { flag: 'wx' });
console.log(`Imported ${book.title} -> ${target}`);
