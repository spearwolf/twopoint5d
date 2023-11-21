import {expect, test, type Page} from '@playwright/test';

const whenDefined = (page: Page, tagName: string) =>
  page.evaluate(
    (tagName: string) =>
      customElements
        .whenDefined(tagName)
        .then(() => true)
        .catch(() => false),
    tagName,
  );

test.describe('bundle', () => {
  test.beforeEach('goto page', async ({page}) => {
    await page.goto('/pages/bundle.html');
  });

  test.describe('two5-display', () => {
    test('has element', async ({page}) => {
      await expect(page.getByTestId('display')).toBeAttached();
    });

    test('custom element is defined', async ({page}) => {
      expect(await whenDefined(page, 'two5-display')).toBe(true);
    });
  });

  test.describe('two5-stage2d', () => {
    test('has element', async ({page}) => {
      await expect(page.getByTestId('stage2d')).toBeAttached();
    });

    test('custom element is defined', async ({page}) => {
      expect(await whenDefined(page, 'two5-stage2d')).toBe(true);
    });
  });

  test.describe('two5-texture-store', () => {
    test('has element', async ({page}) => {
      await expect(page.getByTestId('texture-store')).toBeAttached();
    });

    test('custom element is defined', async ({page}) => {
      expect(await whenDefined(page, 'two5-texture-store')).toBe(true);
    });
  });

  test.describe('two5-post-processing', () => {
    test('has element', async ({page}) => {
      await expect(page.getByTestId('post-processing')).toBeAttached();
    });

    test('custom element is defined', async ({page}) => {
      expect(await whenDefined(page, 'two5-post-processing')).toBe(true);
    });
  });
});
