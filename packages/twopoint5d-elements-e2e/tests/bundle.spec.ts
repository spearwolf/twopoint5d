import {expect, test} from '@playwright/test';

test.describe('bundle', () => {
  test.beforeEach('goto page', async ({page}) => {
    await page.goto('/pages/bundle.html');
  });

  test.describe('simple-greeting', () => {
    test('has element', async ({page}) => {
      await expect(page.getByTestId('sg')).toBeAttached();
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
      await expect(page.getByTestId('two5display')).toBeAttached();
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
});
