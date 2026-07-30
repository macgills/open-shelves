const reader = document.querySelector('#ocr-reader');
const readerPage = document.querySelector('#reader-page');

if (reader && readerPage) {
  let frame;
  const scrollReaderToTop = () => {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(() => {
      reader.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
  };

  const observer = new MutationObserver(scrollReaderToTop);
  observer.observe(readerPage, {
    attributes: true,
    attributeFilter: ['aria-busy'],
    childList: true,
    characterData: true,
    subtree: true
  });

  reader.addEventListener('close', () => window.cancelAnimationFrame(frame));
}
