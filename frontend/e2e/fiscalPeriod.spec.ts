import { expect, test } from '@playwright/test';

// Accounting Module v0.3 — Fiscal Period + Close Lock. Real-browser
// evidence for the Gate Review PASS: create + close a fiscal period,
// confirm the closed-period posting lock blocks a new journalization while
// leaving other pending entries unaffected (Dashboard surfaces the skip
// count), and confirm Trial Balance / Balance Sheet queried via the
// fiscal-period selector reproduce the expected figures with the GL-only
// limitation notice still visible. Also confirms Cash Module data is
// untouched throughout.

test.describe.configure({ mode: 'serial' });

test('Accounting Module v0.3 fiscal period + close lock end-to-end', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());

  await test.step('journalize two January entries before any fiscal period exists', async () => {
    await page.goto('./#/cash');
    await page.fill('#entry-date', '2026-01-10');
    await page.selectOption('#entry-account', { label: '現金' });
    await page.selectOption('#entry-type', 'income');
    await page.fill('#entry-category', '一般收入');
    await page.fill('#entry-amount', '20000');
    await page.fill('#entry-memo', 'Fiscal period demo income');
    await page.getByRole('button', { name: '送出記帳' }).click();
    await expect(page.getByText(/記帳成功/)).toBeVisible();

    await page.fill('#entry-date', '2026-01-15');
    await page.selectOption('#entry-account', { label: '現金' });
    await page.selectOption('#entry-type', 'expense');
    await page.fill('#entry-category', '餐費');
    await page.fill('#entry-amount', '3000');
    await page.fill('#entry-memo', 'Fiscal period demo expense');
    await page.getByRole('button', { name: '送出記帳' }).click();
    await expect(page.getByText(/記帳成功/)).toBeVisible();

    await page.goto('./#/accounting');
    await page.getByRole('button', { name: /產生分錄/ }).click();
    await expect(page.locator('#sec-accounting-dashboard')).toContainText('已產生 2 筆分錄');
  });

  await test.step('create and close a January fiscal period', async () => {
    await page.fill('#fp-name', '2026年1月');
    await page.fill('#fp-start', '2026-01-01');
    await page.fill('#fp-end', '2026-01-31');
    await page.locator('#sec-fiscal-periods').getByRole('button', { name: '新增會計期間' }).click();
    await expect(page.locator('#sec-fiscal-periods')).toContainText('2026年1月');
    await expect(page.locator('#sec-fiscal-periods')).toContainText('開放中');

    await page.locator('#sec-fiscal-periods').getByRole('button', { name: '關帳 / 停止過帳' }).click();
    await expect(page.locator('#sec-fiscal-periods')).toContainText('已關帳');
  });

  await test.step('a new January-dated entry is blocked from journalizing once the period is closed, without affecting other pending entries', async () => {
    await page.goto('./#/cash');
    await page.fill('#entry-date', '2026-01-20');
    await page.selectOption('#entry-account', { label: '現金' });
    await page.selectOption('#entry-type', 'income');
    await page.fill('#entry-category', '一般收入');
    await page.fill('#entry-amount', '5000');
    await page.fill('#entry-memo', 'Late January entry after close');
    await page.getByRole('button', { name: '送出記帳' }).click();
    await expect(page.getByText(/記帳成功/)).toBeVisible();

    await page.goto('./#/accounting');
    await page.getByRole('button', { name: /產生分錄/ }).click();
    // The only newly-pending entry is the late January one, which is
    // period-closed — journaled stays 0 for this round, and the skip is
    // visible, never silently dropped.
    await expect(page.locator('#sec-accounting-dashboard')).toContainText('已產生 0 筆分錄');
    await expect(page.locator('#sec-accounting-dashboard')).toContainText('期間已關帳，略過 1 筆');
  });

  await test.step('Trial Balance via the fiscal-period selector excludes the blocked entry and shows the closed status', async () => {
    const periodOption = page.locator('#tb-period option', { hasText: '2026年1月' });
    await expect(periodOption).toContainText('已關帳');
    await page.selectOption('#tb-period', { label: await periodOption.innerText() });
    await page.locator('#sec-trial-balance').getByRole('button', { name: '查詢' }).click();

    const cashRow = page.locator('#sec-trial-balance tbody tr', { hasText: '庫存現金' });
    await expect(cashRow).toContainText('17,000'); // 20000 - 3000; the blocked 5000 entry never posted
    const footer = page.locator('#sec-trial-balance tfoot tr');
    const cells = await footer.locator('td').allInnerTexts();
    expect(cells[1]).toBe(cells[2]); // period debit total === period credit total

    await expect(page.locator('#sec-trial-balance')).toContainText('尚未設定科目對應');
  });

  await test.step('Balance Sheet via the fiscal-period selector uses the period end date and still balances', async () => {
    const periodOption = page.locator('#bs-period option', { hasText: '2026年1月' });
    await page.selectOption('#bs-period', { label: await periodOption.innerText() });
    await page.locator('#sec-balance-sheet').getByRole('button', { name: '查詢' }).click();

    const cardValues = await page.locator('#sec-balance-sheet .summary-grid .card-value').allInnerTexts();
    expect(cardValues[0]).toBe(cardValues[1]); // 資產合計 === 負債+權益+本期損益
    expect(cardValues[0]).toBe('17,000');
  });

  await test.step('Cash Module data is unaffected — all three entries (including the blocked one) remain visible', async () => {
    await page.goto('./#/cash');
    await expect(page.locator('#sec-list')).toContainText('Fiscal period demo income');
    await expect(page.locator('#sec-list')).toContainText('Fiscal period demo expense');
    await expect(page.locator('#sec-list')).toContainText('Late January entry after close');
  });
});
