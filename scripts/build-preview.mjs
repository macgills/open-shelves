import { execFileSync } from 'node:child_process';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { root } from './lib.mjs';

const productionBasePath = '/open-shelves';
const previewSlug = process.env.OPEN_SHELVES_PREVIEW_SLUG ?? 'durable-reader';
const previewBasePath = `${productionBasePath}/previews/${previewSlug}`;
const dist = path.join(root, 'dist');
const rewriteExtensions = new Set(['.html', '.js', '.json', '.css', '.xml', '.txt']);
const previewSha = (process.env.OPEN_SHELVES_PREVIEW_SHA
  ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' })).trim();
const shortSha = previewSha.slice(0, 8);
const previewBadge = `<small data-preview-build style="display:block;margin-bottom:.35rem;color:var(--muted);font:700 .65rem/1.2 system-ui;letter-spacing:.08em;text-transform:uppercase">Preview ${shortSha}</small>`;

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
  let rewritten = source.replaceAll(productionBasePath, previewBasePath);

  if (path.extname(file) === '.html') {
    rewritten = rewritten.replace(
      '<meta name="description"',
      `<meta name="open-shelves-preview" content="${previewSha}"><meta name="description"`
    );
    rewritten = rewritten.replace(
      '<p id="reader-meta"',
      `${previewBadge}<p id="reader-meta"`
    );
    rewritten = rewritten.replace(
      /((?:src|href)="[^"]+\/assets\/[^"]+?)(?="|\?)/g,
      value => value.includes('?') ? value : `${value}?v=${shortSha}`
    );
  }

  if (rewritten !== source) await writeFile(file, rewritten);
}

await writeFile(path.join(dist, 'preview-build.json'), `${JSON.stringify({
  preview: previewSlug,
  sha: previewSha,
  builtAt: new Date().toISOString()
}, null, 2)}\n`);

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

const builtIndex = await readFile(path.join(dist, 'index.html'), 'utf8');
if (!builtIndex.includes(`Preview ${shortSha}`) || !builtIndex.includes(`?v=${shortSha}`)) {
  throw new Error('Preview build marker or cache-busting asset version is missing');
}

console.log(`Prepared preview ${shortSha} for https://macgills.github.io${previewBasePath}/`);
