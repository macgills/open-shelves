import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('loading content fills the reader without looking like an empty page', async () => {
  const styles = await read('public/assets/reader-layout.css');
  assert.match(styles, /\.reader-dialog \{[\s\S]*display: flex/);
  assert.match(styles, /#reader-page\[aria-busy='true'\][\s\S]*align-self: stretch/);
  assert.match(styles, /#reader-page\[aria-busy='true'\][\s\S]*width: 100%/);
  assert.match(styles, /#reader-page\[aria-busy='true'\][\s\S]*max-width: none/);
  assert.match(styles, /#reader-page\[aria-busy='true'\][\s\S]*background: transparent/);
  assert.match(styles, /#reader-page\[aria-busy='true'\] \+ \.provenance/);
});

test('rendered page changes reset the modal scroll position', async () => {
  const behaviour = await read('public/assets/reader-behaviour.js');
  const build = await read('scripts/build.mjs');
  assert.match(behaviour, /new MutationObserver\(scrollReaderToTop\)/);
  assert.match(behaviour, /reader\.scrollTo\(\{ top: 0/);
  assert.match(behaviour, /attributeFilter: \['aria-busy'\]/);
  assert.match(build, /assets\/reader-behaviour\.js/);
  assert.match(build, /assets\/reader-layout\.css/);
});
