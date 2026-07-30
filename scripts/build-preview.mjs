import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { root } from './lib.mjs';

const productionBasePath = '/open-shelves';
const previewSlug = process.env.OPEN_SHELVES_PREVIEW_SLUG ?? 'durable-reader';
const previewBasePath = `${productionBasePath}/previews/${previewSlug}`;
const dist = path.join(root, 'dist');
const rewriteExtensions = new Set(['.html', '.js', '.json', '.css', '.xml', '.txt']);

async function filesUnder(directory) {
  const entries = await readdir(directory);
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry);
    const info = await stat(target);
    if (info.isDirectory()) files.push(...await filesUnder(target));
    else files.push(target);
  }
  return files;
}

for (const file of await filesUnder(dist)) {
  if (!rewriteExtensions.has(path.extname(file))) continue;
  const source = await readFile(file, 'utf8');
  const rewritten = source.replaceAll(productionBasePath, previewBasePath);
  if (rewritten !== source) await writeFile(file, rewritten);
}

const metadataPath = path.join(dist, 'oauth-cimd.json');
const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
const expectedClientId = `https://macgills.github.io${previewBasePath}/oauth-cimd.json`;
const expectedCallback = `https://macgills.github.io${previewBasePath}/oauth/callback/huggingface/`;

if (metadata.client_id !== expectedClientId || metadata.redirect_uris?.[0] !== expectedCallback) {
  throw new Error('Preview OAuth metadata was not rewritten to the preview URL');
}

for (const relativePath of ['index.html', 'assets/harvard.js', 'assets/oauth-callback.js']) {
  const content = await readFile(path.join(dist, relativePath), 'utf8');
  if (!content.includes(previewBasePath) || content.includes(`'${productionBasePath}'`)) {
    throw new Error(`${relativePath} is not configured for ${previewBasePath}`);
  }
}

console.log(`Prepared preview build for https://macgills.github.io${previewBasePath}/`);
