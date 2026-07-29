const input = document.querySelector('#search');
const cards = [...document.querySelectorAll('.book-card')];
const count = document.querySelector('#result-count');
input?.addEventListener('input', () => {
  const query = input.value.trim().toLowerCase();
  let visible = 0;
  for (const card of cards) {
    const show = card.dataset.search.includes(query);
    card.hidden = !show;
    visible += Number(show);
  }
  count.textContent = `${visible} book${visible === 1 ? '' : 's'}`;
});
