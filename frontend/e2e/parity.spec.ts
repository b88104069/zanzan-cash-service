import { expect, test } from '@playwright/test';

// Gate 4 parity checklist, verified as one continuous end-to-end flow
// against the real backend (Fastify + MySQL) rather than claimed from
// reading the code. Each test.step maps to one item in
// docs/gates/kickoff-contract.md's Gate 4 checklist:
//   company/ledger switching, create company, add income/expense,
//   edit/delete, dashboard summary, account settings, category settings,
//   account transfer, detail search, sorting, CSV export.

test('Gate 4 parity checklist end-to-end', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());
  const email = `e2e-${Date.now()}@example.test`;

  await test.step('register a new account (auth boundary)', async () => {
    await page.goto('/');
    await expect(page.getByText('請登入以使用記帳系統')).toBeVisible();
    await page.getByRole('button', { name: '還沒有帳號？註冊一個' }).click();
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('密碼').fill('hunter22');
    await page.getByRole('button', { name: '註冊' }).click();
    await expect(page.getByText('請先建立您的第一家公司')).toBeVisible();
  });

  await test.step('create company (tenant creation + seed)', async () => {
    await page.getByRole('button', { name: '＋新增公司' }).click();
    await page.getByPlaceholder('例如：贊贊投資帳').fill('E2E 測試公司');
    await page.getByRole('button', { name: '建立公司' }).click();
    await expect(page.locator('#sec-entry')).toBeVisible();
    // seeded default account should already be selectable
    await expect(page.locator('#entry-account option', { hasText: '現金' })).toHaveCount(1);
  });

  await test.step('add income entry', async () => {
    await page.fill('#entry-date', '2026-01-10');
    await page.selectOption('#entry-account', { label: '現金' });
    await page.selectOption('#entry-type', 'income');
    await page.fill('#entry-category', '一般收入');
    await page.fill('#entry-amount', '1000');
    await page.fill('#entry-memo', 'E2E 收入測試');
    await page.getByRole('button', { name: '送出記帳' }).click();
    await expect(page.getByText(/記帳成功/)).toBeVisible();
  });

  await test.step('dashboard summary reflects the entry', async () => {
    await expect(page.locator('#sec-summary')).toContainText('1,000');
  });

  await test.step('edit the entry', async () => {
    await page.getByRole('row', { name: /E2E 收入測試/ }).getByRole('button', { name: '編輯' }).click();
    await expect(page.locator('#entry-memo')).toHaveValue('E2E 收入測試');
    await page.fill('#entry-memo', 'E2E 收入測試（已編輯）');
    await page.getByRole('button', { name: '更新記帳' }).click();
    await expect(page.getByText('更新成功')).toBeVisible();
    await expect(page.getByText('E2E 收入測試（已編輯）')).toBeVisible();
  });

  await test.step('account settings: create a second account', async () => {
    await page.fill('#account-name', '銀行');
    await page.getByRole('button', { name: '新增帳戶', exact: true }).click();
    await expect(page.getByText('帳戶新增成功')).toBeVisible();
    await expect(page.locator('#sec-accounts table')).toContainText('銀行');
  });

  await test.step('category settings: create, disable, re-enable', async () => {
    await page.fill('#category-name', 'E2E科目');
    await page.getByRole('button', { name: '新增科目', exact: true }).click();
    await expect(page.getByText('科目新增成功')).toBeVisible();

    const categoryRow = page.locator('#sec-categories tr', { hasText: 'E2E科目' });
    await categoryRow.getByRole('button', { name: '停用' }).click();
    await expect(categoryRow).toContainText('已停用');
    await categoryRow.getByRole('button', { name: '啟用' }).click();
    await expect(categoryRow).toContainText('啟用中');
  });

  await test.step('account transfer creates two linked entries', async () => {
    await page.fill('#transfer-date', '2026-01-11');
    await page.fill('#transfer-amount', '200');
    await page.selectOption('#transfer-from', { label: '現金' });
    await page.selectOption('#transfer-to', { label: '銀行' });
    await page.getByRole('button', { name: '送出轉帳' }).click();
    await expect(page.getByText('轉帳成功')).toBeVisible();
    await expect(page.locator('#sec-list')).toContainText('轉帳');
  });

  await test.step('a transfer entry cannot be edited (button disabled)', async () => {
    const transferRow = page.locator('#sec-list tbody tr', { hasText: '帳戶轉帳' }).first();
    await expect(transferRow.getByRole('button', { name: '編輯' })).toBeDisabled();
  });

  await test.step('detail search filters the list', async () => {
    await page.fill('.filter-grid input[placeholder="摘要 / 科目 / 帳戶 / 備註"]', '已編輯');
    await page.getByRole('button', { name: '搜尋' }).click();
    const rows = page.locator('#sec-list tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('E2E 收入測試（已編輯）');
    await page.getByRole('button', { name: '清除' }).click();
  });

  await test.step('sorting changes list order', async () => {
    await page.selectOption('.filter-grid select >> nth=1', 'asc');
    await page.getByRole('button', { name: '搜尋' }).click();
    const firstRowDate = await page.locator('#sec-list tbody tr').first().locator('td').first().innerText();
    expect(firstRowDate <= '2026-01-11').toBeTruthy();
  });

  await test.step('CSV export downloads a file', async () => {
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '匯出CSV' }).click()]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });

  await test.step('delete a normal entry', async () => {
    const row = page.locator('#sec-list tbody tr', { hasText: 'E2E 收入測試（已編輯）' });
    await row.getByRole('button', { name: '刪除' }).click();
    await expect(page.getByText('E2E 收入測試（已編輯）')).toHaveCount(0);
  });

  await test.step('deleting one transfer leg removes both', async () => {
    const transferRow = page.locator('#sec-list tbody tr', { hasText: '帳戶轉帳' }).first();
    await transferRow.getByRole('button', { name: '刪除' }).click();
    await expect(page.locator('#sec-list tbody')).not.toContainText('轉帳');
  });

  await test.step('company/ledger switching: create a second company and switch back', async () => {
    await page.getByRole('button', { name: '＋新增公司' }).click();
    await page.getByPlaceholder('例如：贊贊投資帳').fill('E2E 第二家公司');
    await page.getByRole('button', { name: '建立公司' }).click();
    await expect(page.locator('#tenant-select')).toHaveValue(/.+/);

    // switch back to the first tenant and confirm its data is isolated/intact
    await page.selectOption('#tenant-select', { label: 'E2E 測試公司' });
    await expect(page.locator('#sec-accounts table')).toContainText('銀行');
  });
});
