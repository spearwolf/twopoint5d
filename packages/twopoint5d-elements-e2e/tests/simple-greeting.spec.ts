import {expect, test} from '@playwright/test';

test.describe('simple-greeting', () => {
  test.beforeEach('goto page', async ({page}) => {
    await page.goto('/pages/simple-greeting.html');
  });

  test('has element', async ({page}) => {
    await expect(page.getByTestId('hello')).toBeAttached();
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
