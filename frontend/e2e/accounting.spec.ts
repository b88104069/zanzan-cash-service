import { expect, test } from '@playwright/test';

// Accounting Module Prototype v0.1 — required evidence per the Gate Review
// PASS on the revised pre-implementation plan (Slack #ai-gate-test):
// independent bookmarkable module URL, demo mapped income/expense journal
// creation, unmapped account/category cases, transfer excluded + visible
// count, JournalEntry-Voucher traceability, accounting data reload
// persistence. Runs against a fresh localStorage state each time (a new
// test = a new browser context here), independent of parity.spec.ts.

test.describe.configure({ mode: 'serial' });

test('Accounting Module v0.1 checklist end-to-end', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());

  await test.step('#/cash and #/accounting are independently openable, reloadable, and bookmarkable', async () => {
    await page.goto('./#/cash');
    await expect(page.locator('h2')).toContainText('贊贊記帳');

    await page.goto('./#/accounting');
    await expect(page.locator('h2')).toContainText('會計模組');
    await page.reload();
    await expect(page.locator('h2')).toContainText('會計模組');

    // module switcher round-trips correctly
    await page.getByRole('button', { name: '記帳模組' }).click();
    await expect(page.locator('h2')).toContainText('贊贊記帳');
    await page.getByRole('button', { name: '會計模組' }).click();
    await expect(page.locator('h2')).toContainText('會計模組');
  });

  await test.step('demo mapping seed is visible on first load', async () => {
    await expect(page.locator('#sec-coa table').first()).toContainText('庫存現金');
    await expect(page.locator('#sec-coa')).toContainText('一般收入');
  });

  await test.step('create a cash income entry mapped by the demo seed, then generate its journal entry', async () => {
    await page.getByRole('button', { name: '記帳模組' }).click();
    await page.fill('#entry-date', '2026-09-28');
    await page.selectOption('#entry-account', { label: '現金' });
    await page.selectOption('#entry-type', 'income');
    await page.fill('#entry-category', '一般收入');
    await page.fill('#entry-amount', '30000');
    await page.fill('#entry-memo', 'Accounting demo income');
    await page.getByRole('button', { name: '送出記帳' }).click();
    await expect(page.getByText(/記帳成功/)).toBeVisible();

    await page.getByRole('button', { name: '會計模組' }).click();
    await expect(page.locator('#sec-accounting-dashboard')).toContainText('待處理交易');
    const processButton = page.getByRole('button', { name: /產生分錄/ });
    await processButton.click();
    await expect(page.locator('#sec-accounting-dashboard')).toContainText('已產生 1 筆分錄');
  });

  await test.step('journal entry shows correct debit/credit GL accounts for income', async () => {
    const row = page.locator('#sec-journal-entries tbody tr', { hasText: 'Accounting demo income' });
    await expect(row).toContainText('庫存現金'); // debit
    await expect(row).toContainText('一般收入科目'); // credit
    await expect(row).toContainText('30,000');
  });

  await test.step('voucher is created 1:1 and traceable to the journal entry', async () => {
    await expect(page.locator('#sec-vouchers')).toContainText('JV00001');
    await expect(page.locator('#sec-vouchers')).toContainText('庫存現金');
    await expect(page.locator('#sec-vouchers')).toContainText('一般收入科目');
  });

  await test.step('an entry with an unmapped category is flagged, not guessed', async () => {
    await page.getByRole('button', { name: '記帳模組' }).click();
    await page.fill('#category-name', 'Unmapped科目');
    await page.selectOption('#category-type', 'expense');
    await page.getByRole('button', { name: '新增科目', exact: true }).click();
    await expect(page.getByText('科目新增成功')).toBeVisible();

    await page.fill('#entry-date', '2026-09-28');
    await page.selectOption('#entry-account', { label: '現金' });
    await page.selectOption('#entry-type', 'expense');
    await page.fill('#entry-category', 'Unmapped科目');
    await page.fill('#entry-amount', '500');
    await page.fill('#entry-memo', 'Unmapped category test');
    await page.getByRole('button', { name: '送出記帳' }).click();
    await expect(page.getByText(/記帳成功/)).toBeVisible();

    await page.getByRole('button', { name: '會計模組' }).click();
    await expect(page.locator('#sec-accounting-dashboard')).toContainText('待設定科目對應');
    const unmappedCount = await page
      .locator('#sec-accounting-dashboard .card', { hasText: '待設定科目對應' })
      .locator('.card-value')
      .innerText();
    expect(Number(unmappedCount)).toBeGreaterThanOrEqual(1);

    // "產生分錄" only processes MAPPED-and-pending entries — an unmapped
    // entry is never guessed at, so the button has nothing to do for it
    // and the journal entry count stays exactly as before (1).
    await expect(page.getByRole('button', { name: /產生分錄/ })).toBeDisabled();
    await expect(page.locator('#sec-journal-entries tbody tr')).toHaveCount(1);
  });

  await test.step('a transfer is excluded from v0.1 auto-mapping but visibly counted, not silently dropped', async () => {
    await page.getByRole('button', { name: '記帳模組' }).click();
    await page.fill('#account-name', '銀行');
    await page.getByRole('button', { name: '新增帳戶', exact: true }).click();
    await expect(page.getByText('帳戶新增成功')).toBeVisible();

    await page.fill('#transfer-date', '2026-09-28');
    await page.fill('#transfer-amount', '1000');
    await page.selectOption('#transfer-from', { label: '現金' });
    await page.selectOption('#transfer-to', { label: '銀行' });
    await page.getByRole('button', { name: '送出轉帳' }).click();
    await expect(page.getByText('轉帳成功')).toBeVisible();

    await page.getByRole('button', { name: '會計模組' }).click();
    await expect(page.locator('#sec-accounting-dashboard')).toContainText('未處理轉帳');
    const excludedCount = await page
      .locator('#sec-accounting-dashboard .card', { hasText: '未處理轉帳' })
      .locator('.card-value')
      .innerText();
    expect(Number(excludedCount)).toBeGreaterThanOrEqual(2); // both transfer legs

    // still only 1 journal entry total — the transfer legs were never journalized
    await expect(page.locator('#sec-journal-entries tbody tr')).toHaveCount(1);
  });

  await test.step('accounting data survives a page reload', async () => {
    await page.reload();
    await expect(page.locator('#sec-journal-entries tbody tr')).toHaveCount(1);
    await expect(page.locator('#sec-vouchers')).toContainText('JV00001');
  });

  await test.step('Cash Module core parity is unaffected by the accounting flow', async () => {
    await page.getByRole('button', { name: '記帳模組' }).click();
    await expect(page.locator('#sec-summary')).toContainText('30,000');
    const transferRows = page.locator('#sec-list tbody tr', { hasText: '帳戶轉帳' });
    await expect(transferRows).toHaveCount(2);
  });
});
