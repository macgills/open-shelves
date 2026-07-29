const basePath = '/open-shelves';
const form = document.querySelector('#harvard-search');
const input = document.querySelector('#harvard-query');
const mode = document.querySelector('#harvard-mode');
const results = document.querySelector('#harvard-results');
const status = document.querySelector('#harvard-status');

const normalise = value => value.normalize('NFKD').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

form?.addEventListener('submit', async event => {
  event.preventDefault();
  const query = input.value.trim();
  const key = normalise(query).slice(0, 2).padEnd(2, '_') || '__';
  if (normalise(query).length < 2) {
    status.textContent = 'Enter at least two letters.';
    results.replaceChildren();
    return;
  }

  status.textContent = 'Searching the Harvard metadata export…';
  results.replaceChildren();
  try {
    const response = await fetch(`${basePath}/harvard/${mode.value}/${key}.json`);
    if (!response.ok) throw new Error(response.status === 404 ? 'No matching prefix shard is available.' : `HTTP ${response.status}`);
    const records = await response.json();
    const needle = query.toLocaleLowerCase();
    const field = mode.value === 'author' ? 'a' : 't';
    const matches = records.filter(record => record[field].toLocaleLowerCase().includes(needle)).slice(0, 100);
    status.textContent = `${matches.length}${matches.length === 100 ? '+' : ''} result${matches.length === 1 ? '' : 's'} shown.`;
    for (const record of matches) {
      const article = document.createElement('article');
      article.className = 'book-card';
      article.innerHTML = `<p class="eyebrow">${escapeHtml(record.l || 'und')} · ${escapeHtml(record.d || 'Undated')}</p><h2>${escapeHtml(record.t)}</h2><p>${escapeHtml(record.a)}</p><p class="muted">Harvard volume identifier: <code>${escapeHtml(record.i)}</code></p>`;
      results.append(article);
    }
  } catch (error) {
    status.textContent = error.message.includes('prefix shard')
      ? error.message
      : 'The full metadata export has not been generated yet. Add HF_TOKEN to GitHub Actions and run the Pages workflow.';
  }
});
