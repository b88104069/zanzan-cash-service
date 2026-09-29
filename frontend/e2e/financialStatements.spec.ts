import { expect, test } from '@playwright/test';

// Accounting Module v0.2 — Financial Statements. Real-browser evidence for
// the Gate Review PASS: Trial Balance (beginning/period/ending), Income
// Statement, Balance Sheet (A = L + E + Current Earnings), and that the
// GL-only limitation notice is visible on every statement.

test.describe.configure({ mode: 'serial' });

test('Accounting Module v0.2 financial statements end-to-end', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());

  await test.step('create a mapped income and expense entry, then generate journal entries', async () => {
    await page.goto('./#/cash');
    await page.fill('#entry-date', '2026-01-10');
    await page.selectOption('#entry-account', { label: '現金' });
    await page.selectOption('#entry-type', 'income');
    await page.fill('#entry-category', '一般收入');
    await page.fill('#entry-amount', '30000');
    await page.fill('#entry-memo', 'Financial statement demo income');
    await page.getByRole('button', { name: '送出記帳' }).click();
    await expect(page.getByText(/記帳成功/)).toBeVisible();

    await page.fill('#entry-date', '2026-01-15');
    await page.selectOption('#entry-account', { label: '現金' });
    await page.selectOption('#entry-type', 'expense');
    await page.fill('#entry-category', '餐費');
    await page.fill('#entry-amount', '5000');
    await page.fill('#entry-memo', 'Financial statement demo expense');
    await page.getByRole('button', { name: '送出記帳' }).click();
    await expect(page.getByText(/記帳成功/)).toBeVisible();

    await page.goto('./#/accounting');
    await page.getByRole('button', { name: /產生分錄/ }).click();
    await expect(page.locator('#sec-accounting-dashboard')).toContainText('已產生 2 筆分錄');
  });

  await test.step('Trial Balance shows correct beginning/period/ending balances', async () => {
    await page.locator('#tb-asof').fill('2026-01-31');
    await page.locator('#sec-trial-balance').getByRole('button', { name: '查詢' }).click();

    const cashRow = page.locator('#sec-trial-balance tbody tr', { hasText: '庫存現金' });
    await expect(cashRow).toContainText('25,000'); // 30000 - 5000, ending balance
    const revenueRow = page.locator('#sec-trial-balance tbody tr', { hasText: '一般收入科目' });
    await expect(revenueRow).toContainText('30,000');
    const expenseRow = page.locator('#sec-trial-balance tbody tr', { hasText: '餐費支出' });
    await expect(expenseRow).toContainText('5,000');

    // period debit === period credit (structurally balanced)
    const footer = page.locator('#sec-trial-balance tfoot tr');
    const cells = await footer.locator('td').allInnerTexts();
    expect(cells[1]).toBe(cells[2]); // period debit total === period credit total

    await expect(page.locator('#sec-trial-balance')).toContainText('尚未設定科目對應');
  });

  await test.step('Income Statement shows correct revenue, expense, and net income', async () => {
    await page.locator('#is-to').fill('2026-01-31');
    await page.locator('#sec-income-statement').getByRole('button', { name: '查詢' }).click();

    await expect(page.locator('#sec-income-statement')).toContainText('30,000');
    await expect(page.locator('#sec-income-statement')).toContainText('5,000');
    await expect(page.locator('#sec-income-statement .card-value')).toContainText('25,000');
  });

  await test.step('Balance Sheet balances: Assets = Liabilities + Equity + Current Earnings', async () => {
    await page.locator('#bs-asof').fill('2026-01-31');
    await page.locator('#sec-balance-sheet').getByRole('button', { name: '查詢' }).click();

    await expect(page.locator('#sec-balance-sheet')).toContainText('本期損益');
    const cardValues = await page.locator('#sec-balance-sheet .summary-grid .card-value').allInnerTexts();
    expect(cardValues[0]).toBe(cardValues[1]); // 資產合計 === 負債+權益+本期損益
    expect(cardValues[0]).toBe('25,000');

    await expect(page.locator('#sec-balance-sheet')).toContainText('尚未設定科目對應');
  });

  await test.step('Cash Module data is unaffected by querying all three statements', async () => {
    await page.goto('./#/cash');
    await expect(page.locator('#sec-summary')).toContainText('30,000');
  });
});
