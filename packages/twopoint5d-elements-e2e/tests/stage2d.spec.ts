import {expect, test} from '@playwright/test';

test.describe('stage2d', () => {
  test.beforeEach('goto page', async ({page}) => {
    await page.goto('/pages/stage2d.html');
  });

  test('has element', async ({page}) => {
    await expect(page.getByTestId('s2d')).toBeAttached();
  });

  test('custom element is defined', async ({page}) => {
    expect(
      await page.evaluate(() =>
        customElements
          .whenDefined('two5-stage2d')
          .then(() => true)
          .catch(() => false),
      ),
    ).toBe(true);
  });
});
