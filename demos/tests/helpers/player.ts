// Starting the theater in a test. The theater starts by itself when the page already counts as user-activated
// (browser automation often does) and otherwise waits for a tap on its overlay; either way, afterwards it plays.
import type { Page } from 'playwright';

export async function startTheater(page: Page): Promise<void> {
  const overlay = page.locator('.start-overlay');
  try {
    await overlay.click({ timeout: 5000 });
  } catch (e) {
    if (await overlay.count()) throw e; // the overlay is still there: a real failure
  }
}
