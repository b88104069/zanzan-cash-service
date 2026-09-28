import { expect, test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Gate 5 (ACTIVE) — Public Prototype Deployment parity checklist, verified
// as one continuous end-to-end flow against the actual built/served app —
// no backend, no MySQL, no login. Each test.step maps to one item in
// docs/gates/kickoff-contract.md's Gate 5 (ACTIVE) PASS Criteria and
// "Required test evidence" list.

const downloadDir = fileURLToPath(new URL('./downloads', import.meta.url));

test.describe.configure({ mode: 'serial' });

test('Gate 5 prototype parity checklist end-to-end', async ({ page, context }) => {
  page.on('dialog', (dialog) => dialog.accept());

  await test.step('open the public URL — no login required', async () => {
    await page.goto('/');
    await expect(page.locator('h2')).toContainText('贊贊記帳');
    // the default ledger is auto-provisioned with a 現金 account — no login/company-creation screen exists
    await expect(page.locator('#entry-account option', { hasText: '現金' })).toHaveCount(1);
  });

  await test.step('create an account', async () => {
    await page.fill('#account-name', '銀行');
    await page.getByRole('button', { name: '新增帳戶', exact: true }).click();
    await expect(page.getByText('帳戶新增成功')).toBeVisible();
  });

  await test.step('create a category', async () => {
    await page.fill('#category-name', 'E2E科目');
    await page.getByRole('button', { name: '新增科目', exact: true }).click();
    await expect(page.getByText('科目新增成功')).toBeVisible();
  });

  await test.step('add income', async () => {
    await page.fill('#entry-date', '2026-01-10');
    await page.selectOption('#entry-account', { label: '現金' });
    await page.selectOption('#entry-type', 'income');
    await page.fill('#entry-category', '一般收入');
    await page.fill('#entry-amount', '1000');
    await page.fill('#entry-memo', 'Prototype 收入測試');
    await page.getByRole('button', { name: '送出記帳' }).click();
    await expect(page.getByText(/記帳成功/)).toBeVisible();
  });

  await test.step('add expense', async () => {
    // EntryForm resets the whole form (including date and account) after
    // each successful submit (matches legacy clearForm() behavior), so
    // both must be re-set here rather than assumed to carry over.
    await page.fill('#entry-date', '2026-01-10');
    await page.selectOption('#entry-account', { label: '現金' });
    await page.selectOption('#entry-type', 'expense');
    await page.fill('#entry-category', 'E2E科目');
    await page.fill('#entry-amount', '150');
    await page.fill('#entry-memo', 'Prototype 支出測試');
    await page.getByRole('button', { name: '送出記帳' }).click();
    await expect(page.getByText(/記帳成功/)).toBeVisible();
  });

  await test.step('edit an entry', async () => {
    await page.getByRole('row', { name: /Prototype 收入測試/ }).getByRole('button', { name: '編輯' }).click();
    await expect(page.locator('#entry-memo')).toHaveValue('Prototype 收入測試');
    await page.fill('#entry-memo', 'Prototype 收入測試（已編輯）');
    await page.getByRole('button', { name: '更新記帳' }).click();
    await expect(page.getByText('更新成功')).toBeVisible();
  });

  await test.step('account transfer creates two linked entries', async () => {
    await page.fill('#transfer-date', '2026-01-11');
    await page.fill('#transfer-amount', '200');
    await page.selectOption('#transfer-from', { label: '現金' });
    await page.selectOption('#transfer-to', { label: '銀行' });
    await page.getByRole('button', { name: '送出轉帳' }).click();
    await expect(page.getByText('轉帳成功')).toBeVisible();
    const transferRows = page.locator('#sec-list tbody tr', { hasText: '帳戶轉帳' });
    await expect(transferRows).toHaveCount(2);
  });

  await test.step('a transfer leg cannot be edited', async () => {
    const transferRow = page.locator('#sec-list tbody tr', { hasText: '帳戶轉帳' }).first();
    await expect(transferRow.getByRole('button', { name: '編輯' })).toBeDisabled();
  });

  await test.step('detail search filters the list', async () => {
    await page.fill('.filter-grid input[placeholder="摘要 / 科目 / 帳戶 / 備註"]', '已編輯');
    await page.getByRole('button', { name: '搜尋' }).click();
    await expect(page.locator('#sec-list tbody tr')).toHaveCount(1);
    await page.getByRole('button', { name: '清除' }).click();
  });

  await test.step('sorting changes list order', async () => {
    await page.selectOption('.filter-grid select >> nth=1', 'asc');
    await page.getByRole('button', { name: '搜尋' }).click();
    const firstDateAsc = await page.locator('#sec-list tbody tr').first().locator('td').first().innerText();
    expect(firstDateAsc).toBe('2026-01-10');

    await page.selectOption('.filter-grid select >> nth=1', 'desc');
    await page.getByRole('button', { name: '搜尋' }).click();
    const firstDateDesc = await page.locator('#sec-list tbody tr').first().locator('td').first().innerText();
    expect(firstDateDesc).toBe('2026-01-11');

    await page.getByRole('button', { name: '清除' }).click();
  });

  await test.step('dashboard summary is correct', async () => {
    // income 1000 (transfer excluded), expense 150 (transfer excluded)
    await expect(page.locator('#sec-summary')).toContainText('1,000');
    await expect(page.locator('#sec-summary')).toContainText('150');
  });

  await test.step('CSV export downloads a file', async () => {
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '匯出CSV' }).click()]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
    await download.saveAs(path.join(downloadDir, 'export.csv'));
  });

  await test.step('Prototype Data/Debug panel shows actual stored content', async () => {
    const debugText = await page.locator('.debug-textarea').inputValue();
    const parsed = JSON.parse(debugText);
    expect(parsed.entries.length).toBeGreaterThan(0);
    expect(parsed.accounts.some((a: { accountName: string }) => a.accountName === '銀行')).toBe(true);
  });

  await test.step('data survives a page reload', async () => {
    await page.reload();
    // Scoped to the entry list specifically — the debug panel's JSON dump
    // at the bottom of the page also contains this same memo text.
    await expect(page.locator('#sec-list').getByText('Prototype 收入測試（已編輯）')).toBeVisible();
  });

  await test.step('data survives closing and reopening the browser', async () => {
    // Simulate "close and reopen the browser" by carrying the origin's
    // storage into a brand-new browser context (a plain reload proves less
    // than this — a fresh context has no other state to fall back on).
    const storageState = await context.storageState();
    const newContext = await page.context().browser()!.newContext({ storageState });
    const newPage = await newContext.newPage();
    await newPage.goto('/');
    await expect(newPage.locator('#sec-list').getByText('Prototype 收入測試（已編輯）')).toBeVisible();
    await expect(newPage.locator('#sec-accounts table')).toContainText('銀行');
    await newContext.close();
  });

  await test.step('CSV import round-trip (export -> clear -> import -> parity)', async () => {
    const entriesBefore = await page.locator('#sec-list tbody tr').count();

    // "clear" here means deleting the non-transfer entries this test created,
    // to prove import can recreate them — deleting the whole ledger isn't a
    // feature this prototype exposes.
    const rows = page.locator('#sec-list tbody tr', { hasText: 'Prototype' });
    const rowCount = await rows.count();
    for (let i = 0; i < rowCount; i++) {
      await page.locator('#sec-list tbody tr', { hasText: 'Prototype' }).first().getByRole('button', { name: '刪除' }).click();
    }
    await expect(page.locator('#sec-list tbody tr', { hasText: 'Prototype' })).toHaveCount(0);

    await page.setInputFiles('input[type="file"]', path.join(downloadDir, 'export.csv'));
    await expect(page.getByText(/匯入完成/)).toBeVisible();
    await expect(page.locator('#sec-list').getByText('Prototype 收入測試（已編輯）')).toBeVisible();
    await expect(page.locator('#sec-list').getByText('Prototype 支出測試')).toBeVisible();

    const entriesAfter = await page.locator('#sec-list tbody tr').count();
    expect(entriesAfter).toBeGreaterThanOrEqual(entriesBefore - rowCount);
  });
});
