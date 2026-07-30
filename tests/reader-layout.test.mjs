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

test('mobile dialog explicitly overrides browser default maximum sizing', async () => {
  const styles = await read('public/assets/reader-layout.css');
  assert.match(styles, /#ocr-reader\[open\] \{[\s\S]*inset: 0/);
  assert.match(styles, /#ocr-reader\[open\] \{[\s\S]*inline-size: 100%/);
  assert.match(styles, /#ocr-reader\[open\] \{[\s\S]*max-inline-size: none/);
  assert.match(styles, /#ocr-reader\[open\] \{[\s\S]*max-block-size: none/);
  assert.match(styles, /#ocr-reader \.reader-dialog \{[\s\S]*width: 100%/);
  assert.match(styles, /#reader-page \{[\s\S]*max-width: 100%/);
});

test('mobile reader controls flow vertically instead of overlapping', async () => {
  const readerStyles = await read('public/assets/reader.css');
  const textStyles = await read('public/assets/readable-text.css');
  assert.match(readerStyles, /@media \(max-width: 760px\)[\s\S]*#reader-chrome \{[\s\S]*position: static/);
  assert.match(readerStyles, /\.reader-settings-grid \{[\s\S]*position: static/);
  assert.match(textStyles, /\.text-view-switch \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/);
  assert.match(textStyles, /\.reader-text-context \{[\s\S]*padding: 0;[\s\S]*border: 0/);
});

test('missing source text becomes a reader-friendly empty state', async () => {
  const presentation = await read('public/assets/readable-text.js');
  const styles = await read('public/assets/readable-text.css');
  assert.match(presentation, /const noTextMarkers = new Set/);
  assert.match(presentation, /No readable text for this page/);
  assert.match(presentation, /readerContext\.hidden = !reading \|\| !hasText/);
  assert.match(styles, /\.transcription-empty-state/);
  assert.match(styles, /#reader-page\[data-text-view='empty'\]/);
});

test('rendered page changes reset the modal scroll position', async () => {
  const behaviour = await read('public/assets/reader-behaviour.js');
  const app = await read('public/assets/app.js');
  assert.match(behaviour, /new MutationObserver\(scrollReaderToTop\)/);
  assert.match(behaviour, /reader\.scrollTo\(\{ top: 0/);
  assert.match(behaviour, /attributeFilter: \['aria-busy'\]/);
  assert.match(app, /reader-behaviour\.js/);
});
