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
    let failLocal = false;
    let failSave = false;
    let holdSave: Promise<void> | undefined;
    let releaseSave: (() => void) | undefined;
    let holdMessage: Promise<void> | undefined;
    let releaseMessage: (() => void) | undefined;
    let holdLocal: Promise<void> | undefined;
    let releaseLocal: (() => void) | undefined;
    let holdInventory: Promise<void> | undefined;
    let releaseInventory: (() => void) | undefined;
    function menu() { return recipes.map(r => { const missing = r.ingredients.filter(i => !i.optional && !ingredients.some(s => s.id === i.id && s.owned)).map(i => i.name); return { ...r, missing, canMake: missing.length === 0 }; }); }
    Object.assign(window, {
      __failNextMessage: () => { failNext = true; },
      __setConfigured: (value: boolean) => { settings.apiKeyConfigured = value; },
      __failNextLocal: () => { failLocal = true; },
      __failNextSave: () => { failSave = true; },
      __holdSave: () => { holdSave = new Promise(resolve => { releaseSave = resolve; }); },
      __releaseSave: () => { releaseSave?.(); },
      __holdMessage: () => { holdMessage = new Promise(resolve => { releaseMessage = resolve; }); },
      __releaseMessage: () => { releaseMessage?.(); },
      __holdLocal: () => { holdLocal = new Promise(resolve => { releaseLocal = resolve; }); },
      __releaseLocal: () => { releaseLocal?.(); },
      __holdInventory: () => { holdInventory = new Promise(resolve => { releaseInventory = resolve; }); },
      __releaseInventory: () => { releaseInventory?.(); },
      __TAURI_INTERNALS__: { invoke: async (command: string, args: Record<string, any> = {}) => {
        if (command === 'get_chat_history') return [...history];
        if (command === 'list_ingredients') return ingredients.map(i => ({ ...i }));
        if (command === 'search_menu') return menu();
        if (command === 'get_settings') return { ...settings };
        if (command === 'save_settings') { settings = { ...settings, ...args.input, apiKeyConfigured: args.input.apiKey == null ? settings.apiKeyConfigured : args.input.apiKey !== '' }; return { ...settings }; }
        if (command === 'list_agent_traces') return [...traces];
        if (command === 'set_ingredient_owned') { const hold = holdInventory; holdInventory = undefined; await hold; ingredients.find(i => i.id === args.id)!.owned = args.owned; return; }
        if (command === 'clear_chat_history') { history.length = 0; return; }
        if (command === 'delete_custom_recipe') { const index = recipes.findIndex(r => r.id === args.id); if (index >= 0) recipes.splice(index, 1); return; }
        if (command === 'save_custom_recipe') {
          const hold = holdSave; holdSave = undefined; await hold;
          if (failSave) { failSave = false; throw new Error('模拟保存失败'); }
          const r = args.input;
          const id = r.id || 'custom-test';
          const resolved = r.ingredients.map((i: any) => { let item = ingredients.find(p => p.name === i.name); if (!item) { item = { id: i.name, name: i.name, owned: false, category: 'other' }; ingredients.push(item); } return { ...i, id: item.id }; });
          const value = { ...r, id, source: 'custom', nameEn: '', category: '自创', image: null, ingredients: resolved, missing: [], canMake: false };
          const index = recipes.findIndex(p => p.id === id); if (index < 0) recipes.push(value); else recipes[index] = value;
          return id;
        }
        if (command === 'recommend_local') {
          const hold = holdLocal; holdLocal = undefined; await hold;
          if (failLocal) { failLocal = false; throw new Error('模拟本地数据库读取失败'); }
          const { query, availability, afterTraceId } = args.input;
          const found = menu().filter(r => `${r.name} ${r.ingredients.map(i => i.name).join(' ')}`.includes(query.query)
            && (query.maxSweet == null || r.flavor.sweet <= query.maxSweet)
            && (query.minSour == null || r.flavor.sour >= query.minSour)
            && (query.maxStrong == null || r.flavor.strong <= query.maxStrong)
            && (availability === 'any' || (availability === 'ready' ? r.canMake : r.missing.length === 1)));
          const id = `local-menu-${history.length}`;
          const request = '本地查酒单：' + (availability === 'ready' ? '材料齐全' : availability === 'missingOne' ? '只差一种材料' : '按缺料从少到多');
          const message = { id, role: 'assistant', mode: 'local', text: found.length ? `找到 ${found.length} 款，按明确条件推荐。` : '没有找到同时符合这些条件的配方。我保留了全部筛选条件。', recipes: found.slice(0, 3), traceId: id };
          history.push({ id: `${id}-user`, role: 'user', text: request, recipes: [] }, message);
          traces.push({ id, startedAt: 1789600000, durationMs: 10, status: 'local', events: [{ phase: 'fallback.start', elapsedMs: 0, detail: afterTraceId ? `来源失败链路：${afterTraceId}` : '本地查询' }, { phase: 'fallback.query', elapsedMs: 1, detail: JSON.stringify(args.input) }, { phase: 'fallback.result', elapsedMs: 10, detail: JSON.stringify({ recipeIds: message.recipes.map(r => r.id) }) }], error: null });
          return { request, message };
        }
        if (command === 'send_chat_message') {
          const hold = holdMessage; holdMessage = undefined; await hold;
          if (failNext) {
            failNext = false;
            const id = '00000000-0000-4000-8000-000000000001';
            traces.push({ id, startedAt: 1789600000, durationMs: 100, status: 'error', events: [{ phase: 'model.error', elapsedMs: 100, detail: '模拟网络失败' }], error: '模拟网络失败' });
            throw new Error(`模拟网络失败，请重试（链路 ${id}）`);
          }
          if (!settings.apiKeyConfigured) {
            const id = `local-guidance-${history.length}`;
            const response = { id, role: 'assistant', mode: 'local', text: '暂时还没有连接聊天模型，无法智能陪聊。请使用下方本地查询。', recipes: [], traceId: id };
            history.push({ id: `${id}-user`, role: 'user', text: args.message, recipes: [] }, response);
            traces.push({ id, startedAt: 1789600000, durationMs: 10, status: 'local', events: [{ phase: 'fallback.guidance', elapsedMs: 10, detail: '未配置 API Key' }], error: null });
            return response;
          }
          const id = `turn-${history.length}`;
          const response = { id, role: 'assistant', text: '我在。我们慢慢聊。', recipes: args.message.includes('自创') ? menu().filter(r => r.source === 'custom') : args.message.includes('酒') ? menu().slice(0, 1) : [], traceId: id };
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
  await expect(page).toHaveURL(/\/bar\?tab=menu&recipe=custom-test/);
  await expect(page.getByRole('tab', { name: /酒单/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('status')).toContainText('已保存到酒单');
  await expect(page.getByRole('status')).toBeInViewport();
  await expect(page.locator('.recipe-highlight')).toContainText('晚风');
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
  await expect(page.getByText('model.start')).toBeInViewport();
  await expect(page.locator('.trace-selected')).toBeFocused();
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


for (const fails of [false, true]) {
  test(`pending reply ${fails ? 'failure' : 'success'} preserves the next draft across navigation`, async ({ page }) => {
    await page.goto('/');
    await page.evaluate(fail => { (window as any).__holdMessage(); if (fail) (window as any).__failNextMessage(); }, fails);
    await page.getByLabel('说点什么').fill('第一句话');
    await page.getByRole('button', { name: '发送消息' }).click();
    await expect(page.getByLabel('说点什么')).toHaveValue('');
    await page.getByLabel('说点什么').fill('还没写完的下一句');
    await page.getByRole('link', { name: '酒柜', exact: true }).click();
    await page.evaluate(() => (window as any).__releaseMessage());
    await page.getByRole('link', { name: '聊天', exact: true }).click();
    await expect(page.getByLabel('说点什么')).toHaveValue('还没写完的下一句');
    if (fails) {
      await expect(page.getByRole('alert')).toContainText('第一句话');
      await page.getByRole('button', { name: '重试这条消息' }).click();
    }
    await expect(page.getByText('我在。我们慢慢聊。')).toBeVisible();
    await expect(page.getByLabel('说点什么')).toHaveValue('还没写完的下一句');
    await expect(page.locator('.message.user')).toHaveCount(1);
  });
}

test('custom drafts survive navigation and failed saves, and clear only after saving', async ({ page }) => {
  await page.goto('/custom');
  await page.getByLabel('酒品名称').fill('草稿晚风');
  await page.getByRole('combobox', { name: '原料 1', exact: true }).fill('金酒');
  await page.getByRole('textbox', { name: '步骤 1', exact: true }).fill('加冰');
  await page.getByRole('slider', { name: '甜', exact: true }).fill('4');
  await page.getByRole('link', { name: '酒柜', exact: true }).click();
  await page.getByRole('link', { name: '自定义', exact: true }).click();
  await expect(page.getByLabel('酒品名称')).toHaveValue('草稿晚风');
  await expect(page.getByRole('slider', { name: '甜', exact: true })).toHaveValue('4');
  await page.evaluate(() => (window as any).__failNextSave());
  await page.getByRole('button', { name: '保存到酒单' }).click();
  await expect(page.getByRole('alert')).toContainText('模拟保存失败');
  await page.getByRole('link', { name: '聊天', exact: true }).click();
  await page.getByRole('link', { name: '自定义', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '步骤 1', exact: true })).toHaveValue('加冰');
  await page.getByRole('button', { name: '保存到酒单' }).click();
  await expect(page.getByRole('heading', { name: '草稿晚风' })).toBeVisible();
  await page.getByRole('link', { name: '自定义', exact: true }).click();
  await expect(page.getByLabel('酒品名称')).toHaveValue('');
  await page.getByLabel('酒品名称').fill('另一份新草稿');
  await page.getByRole('link', { name: /草稿晚风/ }).click();
  await expect(page.getByLabel('酒品名称')).toHaveValue('草稿晚风');
  await page.getByLabel('酒品名称').fill('编辑中的晚风');
  await page.getByRole('link', { name: '记一杯新酒' }).click();
  await expect(page.getByLabel('酒品名称')).toHaveValue('另一份新草稿');
  await page.getByRole('link', { name: /草稿晚风/ }).click();
  await expect(page.getByLabel('酒品名称')).toHaveValue('编辑中的晚风');
});

test('inventory edits save independently and refresh previous chat cards', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('说点什么').fill('推荐一杯酒');
  await page.getByRole('button', { name: '发送消息' }).click();
  await expect(page.getByText('缺 2 种：金酒、汤力水')).toBeVisible();
  await page.getByRole('link', { name: '酒柜', exact: true }).click();
  const order = await page.locator('.inventory-item').allTextContents();
  await page.evaluate(() => (window as any).__holdInventory());
  await page.getByRole('button', { name: '金酒', exact: true }).click();
  await expect(page.getByRole('button', { name: '金酒', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '汤力水', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '汤力水', exact: true }).click();
  await expect(page.getByRole('button', { name: '汤力水', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => (window as any).__releaseInventory());
  await expect(page.getByRole('button', { name: '金酒', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.locator('.inventory-item').allTextContents()).toEqual(order);
  await page.getByRole('tab', { name: /酒单/ }).click();
  await page.getByRole('button', { name: '现在能做', exact: true }).click();
  await page.getByRole('textbox', { name: '搜索酒单' }).fill('金汤力');
  await page.getByRole('link', { name: '聊天', exact: true }).click();
  await expect(page.getByText('材料齐了', { exact: true })).toBeVisible();
  await expect(page.getByText('我在。我们慢慢聊。')).toBeVisible();
  await page.getByRole('link', { name: '酒柜', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '搜索酒单' })).toHaveValue('金汤力');
  await expect(page.getByRole('button', { name: '现在能做', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('deleted custom recommendations stay readable as history without claiming availability', async ({ page }) => {
  await page.goto('/custom');
  await page.getByLabel('酒品名称').fill('一杯晚风');
  await page.getByRole('combobox', { name: '原料 1', exact: true }).fill('金酒');
  await page.getByRole('textbox', { name: '步骤 1', exact: true }).fill('加冰');
  await page.getByRole('button', { name: '保存到酒单' }).click();
  await expect(page.getByRole('heading', { name: '一杯晚风' })).toBeVisible();
  await page.getByRole('link', { name: '聊天', exact: true }).click();
  await page.getByLabel('说点什么').fill('推荐自创酒');
  await page.getByRole('button', { name: '发送消息' }).click();
  await page.getByRole('button', { name: /一杯晚风/ }).click();
  await page.getByRole('link', { name: '编辑这款酒' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '删除这款酒' }).click();
  await expect(page.getByRole('status')).toContainText('已从酒单移除');
  await page.getByRole('link', { name: '聊天', exact: true }).click();
  await expect(page.getByRole('button', { name: /一杯晚风/ })).toContainText('已从酒单移除 · 历史配方');
  await page.getByRole('button', { name: /一杯晚风/ }).click();
  await expect(page.getByRole('dialog').getByText('加冰', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '编辑这款酒' })).toHaveCount(0);
});

test('expired trace links explain the missing record and themes support arrow keys', async ({ page }) => {
  await page.goto('/settings?trace=expired');
  await expect(page.getByRole('status')).toContainText('已不在最近 100 条记录中');
  await expect(page.getByRole('status')).toBeInViewport();
  const selected = page.getByRole('radio', { checked: true });
  await selected.focus();
  const label = await selected.innerText();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { checked: true })).toBeFocused();
  await expect(page.getByRole('radio', { checked: true })).not.toHaveText(label);
});


test('a slow save cannot erase newer edits after returning to the editor', async ({ page }) => {
  await page.goto('/custom');
  await page.getByLabel('酒品名称').fill('先保存的版本');
  await page.getByRole('combobox', { name: '原料 1', exact: true }).fill('金酒');
  await page.getByRole('textbox', { name: '步骤 1', exact: true }).fill('加冰');
  await page.evaluate(() => (window as any).__holdSave());
  await page.getByRole('button', { name: '保存到酒单' }).click();
  await page.getByRole('link', { name: '酒柜', exact: true }).click();
  await expect(page.getByRole('tab', { name: /我的原料/ })).toBeVisible();
  await page.getByRole('link', { name: '自定义', exact: true }).click();
  await page.getByLabel('酒品名称').fill('仍在编辑的新草稿');
  await page.evaluate(() => (window as any).__releaseSave());
  await expect(page.getByRole('link', { name: /先保存的版本/ })).toBeVisible();
  await expect(page.getByLabel('酒品名称')).toHaveValue('仍在编辑的新草稿');
  await expect(page).toHaveURL(/\/custom$/);
});


test('without an API the chat labels local mode and never pretends to understand casual text', async ({ page }) => {
  await page.goto('/bar');
  await page.evaluate(() => (window as any).__setConfigured(false));
  await page.getByRole('link', { name: '聊天', exact: true }).click();
  await expect(page.locator('.local-mode')).toContainText('暂时无法智能陪聊');
  await page.getByText('调整推荐条件 · 本地酒单', { exact: true }).click();
  await expect(page.getByRole('button', { name: '用现有材料推荐', exact: true })).toBeVisible();
  await page.getByLabel('说点什么').fill('不想喝酒，想聊聊');
  await page.getByRole('button', { name: '发送消息' }).click();
  await expect(page.locator('.message.assistant')).toContainText('本地模式');
  await expect(page.locator('.message.assistant')).toContainText('无法智能陪聊');
  await expect(page.locator('.recommendations')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('link', { name: '查看本轮链路' }).click();
  await expect(page.locator('.trace-selected')).toContainText('本地完成');
  await expect(page.locator('.trace-selected')).toContainText('fallback.guidance');
});

test('offline menu queries retain strict filters and return real missing-material cards', async ({ page }) => {
  await page.goto('/bar');
  await page.evaluate(() => (window as any).__setConfigured(false));
  await page.getByRole('link', { name: '聊天', exact: true }).click();
  await page.getByText('调整推荐条件 · 本地酒单', { exact: true }).click();
  await page.getByLabel('酒名或原料关键词').fill('金酒');
  await page.getByLabel('少甜（≤2）', { exact: true }).check();
  await page.getByLabel('偏酸（≥3）', { exact: true }).check();
  await page.getByRole('button', { name: '按缺料从少到多', exact: true }).click();
  await expect(page.locator('.message.assistant').last()).toContainText('保留了全部筛选条件');
  await expect(page.locator('.recommendations')).toHaveCount(0);
  await page.getByText('调整推荐条件 · 本地酒单', { exact: true }).click();
  await expect(page.getByLabel('偏酸（≥3）', { exact: true })).toBeChecked();
  await page.getByLabel('偏酸（≥3）', { exact: true }).uncheck();
  await page.getByRole('button', { name: '用现有材料推荐', exact: true }).click();
  await expect(page.locator('.message.assistant')).toHaveCount(2);
  await expect(page.locator('.recommendations')).toHaveCount(0);
  await page.getByText('调整推荐条件 · 本地酒单', { exact: true }).click();
  await page.getByRole('button', { name: '按缺料从少到多', exact: true }).click();
  await expect(page.getByRole('button', { name: /金汤力/ })).toContainText('缺 2 种：金酒、汤力水');
  await page.setViewportSize({ width: 375, height: 812 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/local-chat-mobile.png', fullPage: true });
});

test('API failure offers local lookup with its trace and preserves the original message for retry', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => (window as any).__failNextMessage());
  await page.getByLabel('说点什么').fill('原消息先不要丢');
  await page.getByRole('button', { name: '发送消息' }).click();
  await page.getByRole('button', { name: '使用本地推荐', exact: true }).click();
  await expect(page.getByRole('link', { name: '查看失败链路' })).toBeVisible();
  await page.getByLabel('酒名或原料关键词').fill('金酒');
  await page.evaluate(() => (window as any).__failNextLocal());
  await page.getByRole('button', { name: '按缺料从少到多', exact: true }).click();
  await expect(page.getByText(/本地查询未完成：模拟本地数据库读取失败/)).toBeVisible();
  await expect(page.getByLabel('酒名或原料关键词')).toHaveValue('金酒');
  await page.getByRole('button', { name: '按缺料从少到多', exact: true }).click();
  await expect(page.getByRole('button', { name: /金汤力/ })).toBeVisible();
  await expect(page.getByLabel('说点什么')).toHaveValue('原消息先不要丢');
  await page.getByRole('link', { name: '查看本轮链路' }).click();
  await expect(page.locator('.trace-selected')).toContainText('00000000-0000-4000-8000-000000000001');
  await expect(page.locator('.trace-selected')).toContainText('本地完成');
  await page.getByRole('link', { name: '聊天', exact: true }).click();
  await page.getByRole('button', { name: '重试这条消息' }).click();
  await expect(page.getByText('我在。我们慢慢聊。')).toBeVisible();
  await expect(page.locator('.message.user').filter({ hasText: '原消息先不要丢' })).toHaveCount(1);
});

test('saving a model configuration restores normal chat after local mode', async ({ page }) => {
  await page.goto('/bar');
  await page.evaluate(() => (window as any).__setConfigured(false));
  await page.getByRole('link', { name: '聊天', exact: true }).click();
  await page.getByRole('link', { name: '配置聊天模型', exact: true }).click();
  await page.getByLabel('API Key', { exact: false }).fill('test-ui-only-key');
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('已保存');
  await page.getByRole('link', { name: '聊天', exact: true }).click();
  await expect(page.locator('.local-mode')).toHaveCount(0);
  await page.getByLabel('说点什么').fill('今天想聊聊');
  await page.getByRole('button', { name: '发送消息' }).click();
  await expect(page.getByText('我在。我们慢慢聊。')).toBeVisible();
});

// A visible heading may still sit behind the sticky page header; check geometry.
test('empty chat stays at the top on narrow screens and failed sends do not bring back the welcome panel', async ({ page }) => {
  await page.setViewportSize({ width: 350, height: 700 });
  await page.goto('/');
  await expect(page.getByLabel('说点什么')).toBeEnabled();
  await expect(page.getByRole('status')).toHaveCount(0);
  const welcomeIsBelowHeader = () => page.evaluate(() => {
    const heading = document.querySelector('.welcome h2')?.getBoundingClientRect();
    const header = document.querySelector('.page-header')?.getBoundingClientRect();
    return !!heading && !!header && window.scrollY === 0 && heading.top >= header.bottom && heading.bottom < innerHeight;
  });
  await expect.poll(welcomeIsBelowHeader).toBe(true);
  await page.screenshot({ path: 'test-results/welcome-narrow.png' });
  await page.evaluate(() => (window as any).__failNextMessage());
  await page.getByLabel('说点什么').fill('用我现有的材料，做一杯不太甜的酒');
  await page.getByRole('button', { name: '发送消息' }).click();
  await expect(page.getByRole('alert')).toContainText('模拟网络失败');
  await expect(page.locator('.welcome')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '重试这条消息' })).toBeInViewport();
  await page.getByRole('button', { name: '重试这条消息' }).click();
  await expect(page.locator('.message.assistant')).toHaveCount(1);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '清空对话' }).click();
  await expect(page.locator('.welcome h2')).toBeVisible();
  await expect.poll(welcomeIsBelowHeader).toBe(true);
  await page.getByRole('link', { name: '设置', exact: true }).click();
  await page.getByRole('heading', { name: '对话链路', exact: true }).scrollIntoViewIfNeeded();
  await page.getByRole('link', { name: '聊天', exact: true }).click();
  await expect.poll(welcomeIsBelowHeader).toBe(true);
});


test('new replies do not interrupt reading older messages, and return-to-latest still works', async ({ page }) => {
  await page.setViewportSize({ width: 350, height: 700 });
  await page.goto('/');
  for (let n = 0; n < 3; n++) {
    await page.getByLabel('说点什么').fill(`第 ${n + 1} 条：` + '这是一段正在阅读的消息。'.repeat(30));
    await page.getByRole('button', { name: '发送消息' }).click();
    await expect(page.locator('.message.assistant')).toHaveCount(n + 1);
  }
  await page.evaluate(() => (window as any).__holdMessage());
  await page.getByLabel('说点什么').fill('等回复时先看看前面的消息');
  await page.getByRole('button', { name: '发送消息' }).click();
  await expect(page.getByText('正在听你说，也在想怎么回答…')).toBeInViewport();
  await expect(page.getByRole('button', { name: '回到最新' })).toHaveCount(0);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(page.getByRole('button', { name: '回到最新' })).toBeVisible();
  await page.evaluate(() => (window as any).__releaseMessage());
  await expect(page.getByText('正在听你说，也在想怎么回答…')).toHaveCount(0);
  await expect(page.locator('.message.assistant')).toHaveCount(4);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.getByRole('button', { name: '回到最新' }).click();
  await expect(page.locator('.message.assistant').last()).toBeInViewport();
});

for (const viewport of [{ width: 350, height: 700 }, { width: 1100, height: 820 }]) {
  test(`local choices collapse into a visible chat turn and reopen with their values at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/bar');
    await page.evaluate(() => (window as any).__setConfigured(false));
    await page.getByRole('link', { name: '聊天', exact: true }).click();
    await expect(page.locator('.local-options')).not.toHaveAttribute('open');
    await expect.poll(() => page.evaluate(() => {
      const header = document.querySelector('.page-header')!;
      const options = document.querySelector('.local-options')!;
      return header.nextElementSibling === options && options.getBoundingClientRect().top - header.getBoundingClientRect().bottom === 5;
    })).toBe(true);
    await page.getByText('调整推荐条件 · 本地酒单', { exact: true }).click();
    await page.getByLabel('酒名或原料关键词').fill('金酒');
    await page.getByLabel('少甜（≤2）', { exact: true }).check();
    await page.getByLabel('说点什么').fill('这句草稿继续保留');
    await page.evaluate(() => (window as any).__holdLocal());
    await page.getByRole('button', { name: '按缺料从少到多', exact: true }).click();
    await expect(page.locator('.local-options')).not.toHaveAttribute('open');
    await expect(page.getByText('正在处理本地请求…')).toBeInViewport();
    await page.evaluate(() => (window as any).__releaseLocal());
    await expect(page.locator('.message.assistant')).toContainText('找到 1 款');
    await expect(page.getByLabel('酒名或原料关键词')).toBeHidden();
    await expect.poll(() => page.evaluate(() => {
      const request = document.querySelector('.message.user')!.getBoundingClientRect();
      const reply = document.querySelector('.message.assistant > p')!.getBoundingClientRect();
      const header = document.querySelector('.page-header')!.getBoundingClientRect();
      const composer = document.querySelector('.composer-dock')!.getBoundingClientRect();
      return request.top >= header.bottom && reply.top >= request.bottom && reply.bottom <= composer.top;
    })).toBe(true);
    await expect(page.getByLabel('说点什么')).toHaveValue('这句草稿继续保留');
    await page.getByText('调整推荐条件 · 本地酒单', { exact: true }).click();
    await expect(page.getByLabel('酒名或原料关键词')).toHaveValue('金酒');
    await expect(page.getByLabel('少甜（≤2）', { exact: true })).toBeChecked();
    await page.evaluate(() => (window as any).__failNextLocal());
    await page.getByRole('button', { name: '按缺料从少到多', exact: true }).click();
    await expect(page.locator('.local-options')).toHaveAttribute('open', '');
    await expect(page.getByText(/本地查询未完成：模拟本地数据库读取失败/)).toBeVisible();
    await expect(page.getByLabel('酒名或原料关键词')).toHaveValue('金酒');
    await expect(page.locator('.message.assistant')).toHaveCount(1);
  });
}
