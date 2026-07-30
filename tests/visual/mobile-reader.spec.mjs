import { test, expect } from '@playwright/test';

const sampleText = `PREFACE.\n\nSoon after its expansion in 1894 into a national organization, the American Mathematical Society inaugurated the series of Colloquia which have been held in connection with its summer meetings since 1896, at intervals of two or three years.\n\nColloquia consist of courses of lectures delivered by specialists on selected chapters of their fields of work.`;
const longSampleText = Array.from({ length: 12 }, () => sampleText).join('\n\n');

async function stageReader(page, rawText) {
  await page.goto('/open-shelves/', { waitUntil: 'networkidle' });

  await page.evaluate(({ rawText }) => {
    const dialog = document.querySelector('#ocr-reader');
    const chrome = document.querySelector('#reader-chrome');
    const pageNode = document.querySelector('#reader-page');
    const status = document.querySelector('#reader-status');

    document.querySelector('#reader-title').textContent = 'The Madison Colloquium';
    document.querySelector('#reader-author').textContent = 'Smith, David Eugene';
    document.querySelector('#reader-meta').textContent = 'English · 1914 · 264 pages';
    document.querySelector('#reader-page-number').value = '9';
    document.querySelector('#reader-page-count').textContent = '264';
    document.querySelector('#reader-progress').setAttribute('aria-valuemax', '264');
    document.querySelector('#reader-progress').setAttribute('aria-valuenow', '9');
    document.querySelector('#reader-progress-fill').style.width = `${(9 / 264) * 100}%`;
    document.querySelector('#previous-reader-page').disabled = false;
    document.querySelector('#next-reader-page').disabled = false;

    status.hidden = true;
    chrome.hidden = false;
    pageNode.removeAttribute('aria-busy');
    pageNode.textContent = rawText;

    document.documentElement.classList.add('reader-open');
    document.body.classList.add('reader-open');
    dialog.showModal();
  }, { rawText });

  await expect(page.locator('#ocr-reader')).toBeVisible();
  await expect(page.locator('#reader-controls-bottom')).toBeVisible();
  await page.waitForTimeout(100);
}

async function expectMobileReaderToFit(page) {
  const layout = await page.evaluate(() => {
    const rect = selector => {
      const node = document.querySelector(selector);
      const value = node.getBoundingClientRect();
      return {
        left: value.left,
        right: value.right,
        top: value.top,
        bottom: value.bottom,
        width: value.width,
        hidden: node.hidden
      };
    };

    const viewportWidth = document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll('#ocr-reader *')]
      .map(node => ({ node, rect: node.getBoundingClientRect() }))
      .filter(({ rect: value }) => value.width > 0 && (value.left < -1 || value.right > viewportWidth + 1))
      .map(({ node, rect: value }) => ({
        element: node.id ? `#${node.id}` : node.className || node.tagName,
        left: value.left,
        right: value.right
      }));

    return {
      viewportWidth,
      documentWidth: document.documentElement.scrollWidth,
      dialog: rect('#ocr-reader'),
      chrome: rect('#reader-chrome'),
      context: rect('#reader-text-context'),
      readerPage: rect('#reader-page'),
      bottomControls: rect('#reader-controls-bottom'),
      offenders
    };
  });

  expect(Math.abs(layout.dialog.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(layout.dialog.right - layout.viewportWidth)).toBeLessThanOrEqual(1);
  expect(Math.abs(layout.dialog.width - layout.viewportWidth)).toBeLessThanOrEqual(1);
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.readerPage.left).toBeGreaterThanOrEqual(-1);
  expect(layout.readerPage.right).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.bottomControls.left).toBeGreaterThanOrEqual(-1);
  expect(layout.bottomControls.right).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.bottomControls.top).toBeGreaterThanOrEqual(layout.readerPage.bottom - 1);
  expect(layout.offenders).toEqual([]);

  const contentStart = layout.context.hidden ? layout.readerPage.top : layout.context.top;
  expect(layout.chrome.bottom).toBeLessThanOrEqual(contentStart + 1);
  if (!layout.context.hidden) {
    expect(layout.context.bottom).toBeLessThanOrEqual(layout.readerPage.top + 1);
  }
}

test('loaded mobile reader fills the viewport without a right gutter or overlapping controls', async ({ page }, testInfo) => {
  await stageReader(page, sampleText);
  await expectMobileReaderToFit(page);
  await page.screenshot({
    path: testInfo.outputPath('mobile-reader-loaded.png'),
    animations: 'disabled'
  });
});

test('next-page navigation is available after scrolling through a long page', async ({ page }, testInfo) => {
  await stageReader(page, longSampleText);
  const dialog = page.locator('#ocr-reader');
  await dialog.evaluate(node => node.scrollTo({ top: node.scrollHeight, behavior: 'instant' }));
  await expect(page.locator('#next-reader-page-bottom')).toBeInViewport();
  await expect(page.locator('#next-reader-page-bottom')).toBeEnabled();
  await page.screenshot({
    path: testInfo.outputPath('mobile-reader-bottom-navigation.png'),
    animations: 'disabled'
  });
});

test('empty mobile reader remains full width and presents a compact non-technical state', async ({ page }, testInfo) => {
  await stageReader(page, '[No OCR text was supplied for this page.]');
  await expect(page.getByText('No readable text for this page')).toBeVisible();
  await expect(page.locator('#reader-text-context')).toBeHidden();
  await expectMobileReaderToFit(page);
  await page.screenshot({
    path: testInfo.outputPath('mobile-reader-empty.png'),
    animations: 'disabled'
  });
});
