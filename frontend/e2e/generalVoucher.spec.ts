import { expect, test } from '@playwright/test';

// Accounting Module v0.4 — Manual Journal Entry + General Voucher. Real-
// browser evidence for the Gate Review final PASS: a manual voucher draft
// with 2+ lines is created and does NOT appear in Trial Balance while
// unposted; posting it makes Trial Balance/statements include it and the
// Journal Entry list shows the correct 來源 (source) label; an unbalanced
// draft is rejected with a clear error message; posting after deactivating
// one of the target COAs is blocked; and existing Cash Module / v0.1-v0.3
// flows (mapped income journalization) still work unaffected.

test.describe.configure({ mode: 'serial' });

test('Accounting Module v0.4 manual journal entry / general voucher end-to-end', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());

  await test.step('open the Accounting Module and confirm the demo GL seed (庫存現金 / 銀行存款) is present', async () => {
    await page.goto('./#/accounting');
    await expect(page.locator('h2')).toContainText('會計模組');
    await expect(page.locator('#sec-coa table').first()).toContainText('庫存現金');
    await expect(page.locator('#sec-coa table').first()).toContainText('銀行存款');
  });

  await test.step('create a manual voucher draft with 2 lines — it must NOT appear in Trial Balance while unposted', async () => {
    const tbBefore = page.locator('#sec-trial-balance');
    await tbBefore.getByRole('button', { name: '查詢' }).click();
    await expect(tbBefore).not.toContainText('5,000');

    await page.fill('#gv-date', '2026-03-01');
    await page.fill('#gv-memo', 'Manual voucher e2e test');
    await page.getByLabel('gv-line-account-0').selectOption({ label: '1101 庫存現金' });
    await page.getByLabel('gv-line-debit-0').fill('5000');
    await page.getByLabel('gv-line-account-1').selectOption({ label: '1102 銀行存款' });
    await page.getByLabel('gv-line-credit-1').fill('5000');
    await page.locator('#sec-general-voucher').getByRole('button', { name: '新增傳票草稿' }).click();
    await expect(page.getByText('傳票草稿新增成功')).toBeVisible();

    const draftRow = page.locator('#sec-general-voucher tbody tr', { hasText: 'Manual voucher e2e test' });
    await expect(draftRow).toContainText('草稿');

    await tbBefore.getByRole('button', { name: '查詢' }).click();
    await expect(tbBefore).not.toContainText('5,000');
  });

  await test.step('posting the draft makes it flow into Trial Balance and the Journal Entry list shows the manual/GL source label', async () => {
    const draftRow = page.locator('#sec-general-voucher tbody tr', { hasText: 'Manual voucher e2e test' });
    await draftRow.getByRole('button', { name: '過帳' }).click();
    await expect(page.getByText('傳票已過帳')).toBeVisible();
    await expect(draftRow).toContainText('已過帳');
    // A posted draft offers neither 過帳 nor 刪除 any more.
    await expect(draftRow.getByRole('button', { name: '過帳' })).toHaveCount(0);
    await expect(draftRow.getByRole('button', { name: '刪除' })).toHaveCount(0);

    const tb = page.locator('#sec-trial-balance');
    await tb.getByRole('button', { name: '查詢' }).click();
    const cashRow = tb.locator('tbody tr', { hasText: '庫存現金' });
    await expect(cashRow).toContainText('5,000');
    const bankRow = tb.locator('tbody tr', { hasText: '銀行存款' });
    await expect(bankRow).toContainText('-5,000');

    const journalRow = page.locator('#sec-journal-entries tbody tr', { hasText: 'Manual voucher e2e test' });
    await expect(journalRow).toContainText('人工過帳 (GL)');
  });

  await test.step('an unbalanced draft is rejected at post time with a clear error message', async () => {
    await page.fill('#gv-date', '2026-03-02');
    await page.fill('#gv-memo', 'Unbalanced draft e2e test');
    await page.getByLabel('gv-line-account-0').selectOption({ label: '1101 庫存現金' });
    await page.getByLabel('gv-line-debit-0').fill('1000');
    await page.getByLabel('gv-line-account-1').selectOption({ label: '1102 銀行存款' });
    await page.getByLabel('gv-line-credit-1').fill('999');
    await page.locator('#sec-general-voucher').getByRole('button', { name: '新增傳票草稿' }).click();
    await expect(page.getByText('傳票草稿新增成功')).toBeVisible();

    const draftRow = page.locator('#sec-general-voucher tbody tr', { hasText: 'Unbalanced draft e2e test' });
    await draftRow.getByRole('button', { name: '過帳' }).click();
    await expect(page.locator('#sec-general-voucher .error-text')).toContainText('借方合計與貸方合計不相等');
    await expect(draftRow).toContainText('草稿'); // still a draft — nothing was posted
  });

  await test.step('deactivating a target COA blocks posting to a draft that already references it', async () => {
    // Create the draft FIRST, while 銀行存款 is still active and selectable.
    await page.fill('#gv-date', '2026-03-03');
    await page.fill('#gv-memo', 'Inactive COA e2e test');
    await page.getByLabel('gv-line-account-0').selectOption({ label: '1101 庫存現金' });
    await page.getByLabel('gv-line-debit-0').fill('200');
    await page.getByLabel('gv-line-account-1').selectOption({ label: '1102 銀行存款' });
    await page.getByLabel('gv-line-credit-1').fill('200');
    await page.locator('#sec-general-voucher').getByRole('button', { name: '新增傳票草稿' }).click();
    await expect(page.getByText('傳票草稿新增成功')).toBeVisible();

    // Now deactivate 銀行存款 and confirm the dropdown no longer offers it
    // for NEW draft lines (UI-level guardrail matching the backend rule).
    const bankRow = page.locator('#sec-coa table').first().locator('tbody tr', { hasText: '銀行存款' });
    await bankRow.getByRole('button', { name: '停用' }).click();
    await expect(bankRow).toContainText('已停用');
    const options = await page.getByLabel('gv-line-account-0').locator('option').allInnerTexts();
    expect(options.some((o) => o.includes('銀行存款'))).toBe(false);

    // Posting the pre-existing draft (which still references 銀行存款) is
    // now blocked by the same shared CHART_OF_ACCOUNT_INACTIVE rule.
    const draftRow = page.locator('#sec-general-voucher tbody tr', { hasText: 'Inactive COA e2e test' });
    await draftRow.getByRole('button', { name: '過帳' }).click();
    await expect(page.locator('#sec-general-voucher .error-text')).toContainText('已停用');
    await expect(draftRow).toContainText('草稿'); // still a draft — nothing was posted

    // Reactivate so later steps (and other specs sharing this seed data) are unaffected.
    await bankRow.getByRole('button', { name: '啟用' }).click();
    await expect(bankRow).toContainText('啟用中');
  });

  await test.step('Cash Module entries and existing v0.1-v0.3 flows still work unaffected', async () => {
    await page.getByRole('button', { name: '記帳模組' }).click();
    await page.fill('#entry-date', '2026-03-05');
    await page.selectOption('#entry-account', { label: '現金' });
    await page.selectOption('#entry-type', 'income');
    await page.fill('#entry-category', '一般收入');
    await page.fill('#entry-amount', '8000');
    await page.fill('#entry-memo', 'Cash module regression after v0.4');
    await page.getByRole('button', { name: '送出記帳' }).click();
    await expect(page.getByText(/記帳成功/)).toBeVisible();

    await page.getByRole('button', { name: '會計模組' }).click();
    await page.getByRole('button', { name: /產生分錄/ }).click();
    await expect(page.locator('#sec-accounting-dashboard')).toContainText('已產生 1 筆分錄');

    const journalRow = page.locator('#sec-journal-entries tbody tr', { hasText: 'Cash module regression after v0.4' });
    await expect(journalRow).toContainText('記帳模組 (CASH)');
  });
});
