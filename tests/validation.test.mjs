import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { escapeHtml, root } from '../scripts/lib.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('escapes generated page content', () => {
  assert.equal(escapeHtml(`<script a="b">&'</script>`), '&lt;script a=&quot;b&quot;&gt;&amp;&#39;&lt;/script&gt;');
});

test('declares a public Hugging Face OAuth client', async () => {
  const metadata = JSON.parse(await read('public/.well-known/oauth-cimd'));
  assert.equal(metadata.token_endpoint_auth_method, 'none');
  assert.deepEqual(metadata.redirect_uris, ['https://macgills.github.io/open-shelves/oauth/callback/huggingface/']);
});

test('requests only gated read access for dataset browsing', async () => {
  const browser = await read('public/assets/harvard.js');
  assert.match(browser, /openid profile gated-repos/);
  assert.match(browser, /datasets-server\.huggingface\.co/);
  assert.doesNotMatch(browser, /HF_TOKEN|GUTENBERG/i);
});

test('build is Harvard-only and does not run an ingestion exporter', async () => {
  const packageJson = JSON.parse(await read('package.json'));
  assert.equal(packageJson.scripts.build, 'node scripts/build.mjs');
  assert.equal(root.endsWith('open-shelves'), true);
});
