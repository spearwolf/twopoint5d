import {expect, test} from '@playwright/test';

test.describe('bundle', () => {
  test.beforeEach('goto page', async ({page}) => {
    await page.goto('/pages/bundle.html');
  });

  test.describe('simple-greeting', () => {
    test('has element', async ({page}) => {
      await expect(page.getByTestId('simple-greeting')).toBeAttached();
    });

    test('custom element is defined', async ({page}) => {
      expect(
        await page.evaluate(() =>
          customElements
            .whenDefined('simple-greeting')
            .then(() => true)
            .catch(() => false),
        ),
      ).toBe(true);
    });
  });

  test.describe('two5-display', () => {
    test('has element', async ({page}) => {
      await expect(page.getByTestId('display')).toBeAttached();
    });

    test('custom element is defined', async ({page}) => {
      expect(
        await page.evaluate(() =>
          customElements
            .whenDefined('two5-display')
            .then(() => true)
            .catch(() => false),
        ),
      ).toBe(true);
    });
  });

  test.describe('two5-texture-store', () => {
    test('has element', async ({page}) => {
      await expect(page.getByTestId('texture-store')).toBeAttached();
    });

    test('custom element is defined', async ({page}) => {
      expect(
        await page.evaluate(() =>
          customElements
            .whenDefined('two5-texture-store')
            .then(() => true)
            .catch(() => false),
        ),
      ).toBe(true);
    });
  });
});
