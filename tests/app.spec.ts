import { test, expect } from '@playwright/test';

// Only the IPC transport is replaced. Production builds always require Tauri.
// Rust integration tests independently exercise the database and actual ADK tool loop.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const ingredients = [{ id: 'gin', name: '金酒', category: 'spirit', owned: false }, { id: 'tonic', name: '汤力水', category: 'mixer', owned: false }];
    const recipes = [{ id: 'gin-tonic', name: '金汤力', nameEn: 'Gin & Tonic', description: '清爽的金酒与汤力水。', category: 'Gin', source: 'builtin', image: 'gin_tonic.png', method: '直调', flavor: { sweet: 1, sour: 2, bitter: 2, strong: 2 }, ingredients: [{ id: 'gin', name: '金酒', amount: 45, unit: 'ml', optional: false }, { id: 'tonic', name: '汤力水', amount: 100, unit: 'ml', optional: false }], steps: ['杯中加冰，加入材料轻轻搅拌。'], missing: ['金酒', '汤力水'], canMake: false }];
    let settings = { name: '', preferences: '', model: 'qwen-plus', baseUrl: 'https://example.com/v1', apiKeyConfigured: true, dataDirectory: '/local/cocktail-app' };
    const history: unknown[] = [];
    const traces: unknown[] = [];
    let failNext = false;
    function menu() { return recipes.map(r => { const missing = r.ingredients.filter(i => !i.optional && !ingredients.some(s => s.id === i.id && s.owned)).map(i => i.name); return { ...r, missing, canMake: missing.length === 0 }; }); }
    Object.assign(window, {
      __failNextMessage: () => { failNext = true; },
      __TAURI_INTERNALS__: { invoke: async (command: string, args: Record<string, any> = {}) => {
        if (command === 'get_chat_history') return [...history];
        if (command === 'list_ingredients') return ingredients.map(i => ({ ...i }));
        if (command === 'search_menu') return menu();
        if (command === 'get_settings') return { ...settings };
        if (command === 'save_settings') { settings = { ...settings, ...args.input, apiKeyConfigured: args.input.apiKey !== '' }; return { ...settings }; }
        if (command === 'list_agent_traces') return [...traces];
        if (command === 'set_ingredient_owned') { ingredients.find(i => i.id === args.id)!.owned = args.owned; return; }
        if (command === 'clear_chat_history') { history.length = 0; return; }
        if (command === 'save_custom_recipe') {
          const r = args.input;
          const id = r.id || 'custom-test';
          const resolved = r.ingredients.map((i: any) => { let item = ingredients.find(p => p.name === i.name); if (!item) { item = { id: i.name, name: i.name, owned: false, category: 'other' }; ingredients.push(item); } return { ...i, id: item.id }; });
          const value = { ...r, id, source: 'custom', nameEn: '', category: '自创', image: null, ingredients: resolved, missing: [], canMake: false };
          const index = recipes.findIndex(p => p.id === id); if (index < 0) recipes.push(value); else recipes[index] = value;
          return id;
        }
        if (command === 'send_chat_message') {
          if (failNext) { failNext = false; throw new Error('模拟网络失败，请重试'); }
          const id = `turn-${history.length}`;
          const response = { id, role: 'assistant', text: '我在。我们慢慢聊。', recipes: args.message.includes('酒') ? menu().slice(0, 1) : [], traceId: id };
          history.push({ id: `${id}-user`, role: 'user', text: args.message, recipes: [] }, response);
          traces.push({ id, startedAt: 1789600000, durationMs: 200, status: 'ok', events: [{ phase: 'model.start', elapsedMs: 2, detail: 'qwen-plus' }, { phase: 'turn.complete', elapsedMs: 200, detail: '已保存' }], error: null });
          return response;
        }
        throw new Error(`Unexpected IPC: ${command}`);
      } },
    });
  });
});

test('four entry points, inventory and menu availability', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation').getByRole('link')).toHaveCount(4);
  await page.getByRole('link', { name: '酒柜', exact: true }).click();
  await page.getByRole('button', { name: '金酒', exact: true }).click();
  await expect(page.getByRole('button', { name: '金酒', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('tab', { name: /酒单/ }).click();
  await expect(page.getByText('缺 1 种：汤力水')).toBeVisible();
  await page.getByRole('button', { name: /金汤力/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('杯中加冰，加入材料轻轻搅拌。')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('custom recipe saves to menu and can be edited', async ({ page }) => {
  await page.goto('/custom');
  await page.getByLabel('酒品名称').fill('晚风');
  await page.getByRole('combobox', { name: '原料 1', exact: true }).fill('金酒');
  await page.getByRole('textbox', { name: '步骤 1', exact: true }).fill('加冰搅拌');
  await page.getByRole('button', { name: '保存到酒单' }).click();
  await expect(page).toHaveURL(/\/bar$/);
  await page.getByRole('tab', { name: /酒单/ }).click();
  await page.getByRole('button', { name: /晚风/ }).click();
  await expect(page.getByRole('dialog').getByText('还缺：金酒')).toBeVisible();
  await page.getByRole('link', { name: '编辑这款酒' }).click();
  await expect(page.getByLabel('酒品名称')).toHaveValue('晚风');
  await page.getByLabel('酒品名称').fill('晚风二号');
  await page.getByRole('button', { name: '保存到酒单' }).click();
  await page.getByRole('tab', { name: /酒单/ }).click();
  await expect(page.getByRole('heading', { name: '晚风二号' })).toBeVisible();
});

test('chat error preserves draft, retry succeeds, trace opens and context clears', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => (window as any).__failNextMessage());
  await page.getByLabel('说点什么').fill('今天想聊聊');
  await page.getByRole('button', { name: '发送消息' }).click();
  await expect(page.getByRole('alert')).toContainText('模拟网络失败');
  await expect(page.getByLabel('说点什么')).toHaveValue('今天想聊聊');
  await page.getByRole('button', { name: '发送消息' }).click();
  await expect(page.getByText('我在。我们慢慢聊。')).toBeVisible();
  await page.getByRole('link', { name: '查看本轮链路' }).click();
  await expect(page.getByText('model.start')).toBeVisible();
  await page.getByRole('link', { name: '聊天', exact: true }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '清空对话' }).click();
  await expect(page.getByText('今天过得怎么样？')).toBeVisible();
});

test('desktop and mobile views have no overflow and remain operable', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.screenshot({ path: 'test-results/chat-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole('button', { name: '发送消息' })).toBeVisible();
  await page.screenshot({ path: 'test-results/chat-mobile.png', fullPage: true });
  for (const name of ['酒柜', '自定义', '设置']) {
    await page.getByRole('link', { name, exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('link', { name: '自定义', exact: true }).click();
  await page.screenshot({ path: 'test-results/custom-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
