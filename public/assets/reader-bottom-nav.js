const readerChrome = document.querySelector('#reader-chrome');
const readerProgress = document.querySelector('#reader-progress');
const bottomControls = document.querySelector('#reader-controls-bottom');
const previousTop = document.querySelector('#previous-reader-page');
const nextTop = document.querySelector('#next-reader-page');
const previousBottom = document.querySelector('#previous-reader-page-bottom');
const nextBottom = document.querySelector('#next-reader-page-bottom');

const syncBottomControls = () => {
  if (!bottomControls || !previousTop || !nextTop || !previousBottom || !nextBottom) return;
  bottomControls.hidden = Boolean(readerChrome?.hidden);
  previousBottom.disabled = previousTop.disabled;
  nextBottom.disabled = nextTop.disabled;
};

previousBottom?.addEventListener('click', () => previousTop?.click());
nextBottom?.addEventListener('click', () => nextTop?.click());

for (const control of [previousTop, nextTop, readerChrome, readerProgress].filter(Boolean)) {
  new MutationObserver(syncBottomControls).observe(control, {
    attributes: true,
    attributeFilter: control === readerProgress ? ['aria-valuenow', 'aria-valuemax'] : ['disabled', 'hidden']
  });
}

syncBottomControls();
