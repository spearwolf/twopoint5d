import {expect, test} from '@playwright/test';
import {onceAsync} from '@spearwolf/eventize';
import {DisplayElement} from '@spearwolf/twopoint5d-elements';

test.describe('display', () => {
  test.beforeEach('goto page', async ({page}) => {
    await page.goto('/pages/display.html');
  });

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

  test('display started', async ({page}) => {
    expect(
      await page.evaluate(() =>
        window
          .whenDefined<DisplayElement>(document.querySelector('two5-display'))
          .then((el: DisplayElement) => onceAsync(el.display, 'start'))
          .then(() => true),
      ),
    ).toBe(true);
  });
});
