import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { escapeHtml } from '../scripts/lib.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('escapes generated page content', () => {
  assert.equal(escapeHtml(`<script a="b">&'</script>`), '&lt;script a=&quot;b&quot;&gt;&amp;&#39;&lt;/script&gt;');
});

test('declares a public Hugging Face OAuth client as JSON', async () => {
  const metadata = JSON.parse(await read('public/oauth-cimd.json'));
  assert.equal(metadata.client_id, 'https://macgills.github.io/open-shelves/oauth-cimd.json');
  assert.equal(metadata.token_endpoint_auth_method, 'none');
  assert.deepEqual(metadata.grant_types, ['authorization_code']);
  assert.deepEqual(metadata.response_types, ['code']);
  assert.deepEqual(metadata.redirect_uris, ['https://macgills.github.io/open-shelves/oauth/callback/huggingface/']);
});

test('requests only gated read access for dataset browsing', async () => {
  const browser = await read('public/assets/harvard.js');
  assert.match(browser, /openid profile gated-repos/);
  assert.match(browser, /datasets-server\.huggingface\.co/);
  assert.doesNotMatch(browser, /HF_TOKEN|GUTENBERG/i);
});

test('production build rewrites OAuth references to the JSON document', async () => {
  const build = await read('scripts/build.mjs');
  assert.match(build, /oauth-cimd\.json/);
  assert.match(build, /replaceAll\(legacyOAuthClientPath, oauthClientPath\)/);
});

test('build is Harvard-only and does not run an ingestion exporter', async () => {
  const packageJson = JSON.parse(await read('package.json'));
  assert.equal(packageJson.scripts.build, 'node scripts/build.mjs');
  assert.equal(packageJson.scripts.ingest, undefined);
});
