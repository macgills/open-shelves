import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBook } from '../scripts/lib.mjs';
const base={slug:'a-book',title:'A Book',language:'en',description:'x',authors:[{name:'A',deathYear:1900}],source:{landingPage:'https://example.com',retrieved:'2026-01-01',rightsBasis:'Public domain'},content:[{paragraphs:['x']}]};
test('accepts conservatively public-domain author',()=>assert.deepEqual(validateBook(base,2026),[]));
test('rejects author inside Irish life-plus-70 term',()=>assert.match(validateBook({...base,authors:[{name:'A',deathYear:1956}]},2026).join('\n'),/conservative Irish cutoff/));
test('requires provenance',()=>assert.match(validateBook({...base,source:{}},2026).join('\n'),/Source requires/));
