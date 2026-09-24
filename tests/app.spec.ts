import { test, expect } from '@playwright/test';

// Only the IPC transport is replaced. Production builds always require Tauri.
// Rust integration tests independently exercise the database and actual ADK tool loop.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const ingredients = [{ id: 'gin', name: '金酒', category: 'spirits', owned: false }, { id: 'tonic', name: '汤力水', category: 'mixer', owned: false }];
    const recipes = [{ id: 'gin-tonic', name: '金汤力', nameEn: 'Gin & Tonic', description: '清爽的金酒与汤力水。', category: 'Gin', source: 'builtin', image: 'gin_tonic.png', method: '直调', flavor: { sweet: 1, sour: 2, bitter: 2, strong: 2 }, ingredients: [{ id: 'gin', name: '金酒', amount: 45, unit: 'ml', optional: false }, { id: 'tonic', name: '汤力水', amount: 100, unit: 'ml', optional: false }], steps: ['杯中加冰，加入材料轻轻搅拌。'], missing: ['金酒', '汤力水'], canMake: false }];
    let settings = { name: '', preferences: '', model: 'qwen-plus', baseUrl: 'https://example.com/v1', apiKeyConfigured: true, dataDirectory: '/local/cocktail-app' };
    const history: unknown[] = [];
    const traces: unknown[] = [];
    let failNext = false;
    let failLocal = false;
    let failSave = false;
    let failTrace = false;
    let failClear = false;
    let clearCalls = 0;
    let failIngredient = false;
    let ingredientCalls = 0;
    let callbackId = 0;
    const callbacks = new Map<number, (value: unknown) => void>();
    const streamIndexes = new Map<number, number>();
    let activeChannel: { id: number } | undefined;
    let activeTraceId = '';
    const emitStream = (event: Record<string, unknown>) => {
      if (!activeChannel) return;
      const index = streamIndexes.get(activeChannel.id) ?? 0;
      streamIndexes.set(activeChannel.id, index + 1);
      callbacks.get(activeChannel.id)?.({ index, message: { traceId: activeTraceId, ...event } });
    };
    let holdSave: Promise<void> | undefined;
    let releaseSave: (() => void) | undefined;
    let holdMessage: Promise<void> | undefined;
    let releaseMessage: (() => void) | undefined;
    let holdLocal: Promise<void> | undefined;
    let releaseLocal: (() => void) | undefined;
    let holdInventory: Promise<void> | undefined;
    let releaseInventory: (() => void) | undefined;
    let holdClear: Promise<void> | undefined;
    let releaseClear: (() => void) | undefined;
    let holdIngredient: Promise<void> | undefined;
    let releaseIngredient: (() => void) | undefined;
    function menu() { return recipes.map(r => { const missing = r.ingredients.filter(i => !i.optional && !ingredients.some(s => s.id === i.id && s.owned)).map(i => i.name); return { ...r, missing, canMake: missing.length === 0 }; }); }
    Object.assign(window, {
      __failNextMessage: () => { failNext = true; },
      __setConfigured: (value: boolean) => { settings.apiKeyConfigured = value; },
      __failNextLocal: () => { failLocal = true; },
      __failNextSave: () => { failSave = true; },
      __failNextTrace: () => { failTrace = true; },
      __failNextClear: () => { failClear = true; },
      __clearCalls: () => clearCalls,
      __failNextIngredient: () => { failIngredient = true; },
      __ingredientCalls: () => ingredientCalls,
      __clearTraces: () => { traces.length = 0; },
      __streamText: (text: string) => emitStream({ type: 'text', text }),
      __streamTrace: (phase: string) => emitStream({ type: 'trace', event: { phase, elapsedMs: 0, detail: `执行 ${phase}` } }),
      __holdSave: () => { holdSave = new Promise(resolve => { releaseSave = resolve; }); },
      __releaseSave: () => { releaseSave?.(); },
      __holdMessage: () => { holdMessage = new Promise(resolve => { releaseMessage = resolve; }); },
      __releaseMessage: () => { releaseMessage?.(); },
      __holdLocal: () => { holdLocal = new Promise(resolve => { releaseLocal = resolve; }); },
      __releaseLocal: () => { releaseLocal?.(); },
      __holdInventory: () => { holdInventory = new Promise(resolve => { releaseInventory = resolve; }); },
      __releaseInventory: () => { releaseInventory?.(); },
      __holdClear: () => { holdClear = new Promise(resolve => { releaseClear = resolve; }); },
      __releaseClear: () => { releaseClear?.(); },
      __holdIngredient: () => { holdIngredient = new Promise(resolve => { releaseIngredient = resolve; }); },
      __releaseIngredient: () => { releaseIngredient?.(); },
      __TAURI_INTERNALS__: {
        transformCallback: (callback: (value: unknown) => void) => { const id = ++callbackId; callbacks.set(id, callback); return id; },
        unregisterCallback: (id: number) => { callbacks.delete(id); },
        invoke: async (command: string, args: Record<string, any> = {}) => {
        if (command === 'get_chat_history') return [...history];
        if (command === 'list_ingredients') return ingredients.map(i => ({ ...i }));
        if (command === 'search_menu') return menu();
        if (command === 'get_settings') return { ...settings };
        if (command === 'save_settings') { settings = { ...settings, ...args.input, apiKeyConfigured: args.input.apiKey == null ? settings.apiKeyConfigured : args.input.apiKey !== '' }; return { ...settings }; }
        if (command === 'list_agent_traces') { if (failTrace) { failTrace = false; throw new Error('模拟链路读取失败'); } return [...traces]; }
        if (command === 'set_ingredient_owned') { const hold = holdInventory; holdInventory = undefined; await hold; ingredients.find(i => i.id === args.id)!.owned = args.owned; return; }
        if (command === 'add_ingredient') {
          ingredientCalls++;
          const hold = holdIngredient; holdIngredient = undefined; await hold;
          if (failIngredient) { failIngredient = false; throw new Error('模拟原料保存失败，请重试'); }
          const { name: rawName, category, owned } = args.input;
          const name = rawName.trim();
          if (!name || Array.from(name).length > 80) throw new Error('原料名称须为 1–80 个字符');
          if (!['spirits', 'liqueur', 'juice', 'syrup', 'herb', 'mixer', 'dairy', 'fruit', 'other'].includes(category)) throw new Error('原料分类无效');
          let ingredient = ingredients.find(i => i.name.trim().toLowerCase() === name.toLowerCase());
          const created = !ingredient;
          if (ingredient) { if (owned) ingredient.owned = true; }
          else {
            ingredient = { id: `ingredient-${ingredientCalls}`, name, category, owned };
            ingredients.push(ingredient);
          }
          return { ingredient: { ...ingredient }, created };
        }
        if (command === 'clear_chat_history') {
          clearCalls++;
          const hold = holdClear; holdClear = undefined; await hold;
          if (failClear) { failClear = false; throw new Error('模拟清空失败，请重试'); }
          history.length = 0; return;
        }
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
          activeChannel = args.onEvent;
          activeTraceId = `turn-${history.length}`;
          const hold = holdMessage; holdMessage = undefined; await hold;
          if (failNext) {
            failNext = false;
            const id = '00000000-0000-4000-8000-000000000001';
            traces.push({ id, startedAt: 1789600000, durationMs: 100, status: 'error', events: [{ phase: 'model.error', elapsedMs: 100, detail: '模拟网络失败' }], error: '模拟网络失败' });
            throw new Error(`模拟网络失败，请重试（链路 ${id}）`);
          }
          if (!settings.apiKeyConfigured) {
            const id = `local-guidance-${history.length}`;
            const response = { id, role: 'assistant', mode: 'local', text: '暂时还没有连接聊天模型，无法智能陪聊。请点开顶部的“调整推荐条件”。', recipes: [], traceId: id };
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

test('five entry points, inventory and menu availability', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation').getByRole('link')).toHaveCount(5);
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

test('private ops console renders independently from the main shell', async ({ page }) => {
  await page.goto('/ops');
  await expect(page.getByRole('heading', { name: 'Agent Ops' })).toBeVisible();
  await expect(page.getByText('桌面本机')).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.getByText('还没有链路事件。')).toBeVisible();
  await expect(page.getByText('没有匹配的 trace。')).toBeVisible();
  await expect(page.getByText('事件来自 agent_traces')).toBeVisible();
});

test('web users without owner access see no observability data', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as any).__TAURI_INTERNALS__;
    localStorage.setItem('drink_token', 'web-token');
  });
  await page.route('**/auth/me', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ id: 'web-user', email: 'web@example.com', createdAt: '2026-09-21T00:00:00Z' }),
  }));
  await page.route('**/observability/summary', route => route.fulfill({
    status: 403,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'Ops access is restricted' }),
  }));

  await page.goto('/ops');
  await expect(page.getByRole('heading', { name: '私有控制台不可用' })).toBeVisible();
  await expect(page.getByText('Ops access is restricted')).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
});

test('added ingredients survive navigation and make custom recipes available to local recommendations', async ({ page }) => {
  await page.goto('/bar');
  await page.getByRole('button', { name: '添加原料', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '添加原料', exact: true });
  await expect(dialog.getByLabel('我已有这项原料')).toBeChecked();
  await dialog.getByLabel('原料名称', { exact: true }).fill('  柚子汁  ');
  await dialog.getByRole('combobox', { name: '原料分类', exact: true }).selectOption('juice');
  await dialog.getByRole('button', { name: '保存原料', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: '柚子汁', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'test-results/ingredient-added-desktop.png', fullPage: true });
  await page.getByRole('link', { name: '自定义', exact: true }).click();
  await expect(page.locator('#ingredient-names option[value="柚子汁"]')).toHaveCount(1);
  await page.getByRole('link', { name: '酒柜', exact: true }).click();
  await expect(page.getByRole('button', { name: '柚子汁', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('tab', { name: /酒单/ }).click();
  await page.getByRole('link', { name: '添加酒品', exact: true }).click();
  await page.getByLabel('酒品名称').fill('柚子微风');
  await page.getByRole('combobox', { name: '原料 1', exact: true }).fill('柚子汁');
  await page.getByRole('textbox', { name: '步骤 1', exact: true }).fill('柚子汁加冰，轻轻搅拌。');
  await page.getByRole('button', { name: '保存到酒单' }).click();
  await expect(page.getByRole('button', { name: /柚子微风/ })).toContainText('材料齐了');
  await page.evaluate(() => (window as any).__setConfigured(false));
  await page.getByRole('link', { name: '聊天', exact: true }).click();
  await page.getByText('调整推荐条件 · 本地酒单', { exact: true }).click();
  await page.getByLabel('酒名或原料关键词').fill('柚子汁');
  await page.getByRole('button', { name: '用现有材料推荐', exact: true }).click();
  await expect(page.getByRole('button', { name: /柚子微风/ })).toContainText('材料齐了');
  await expect.poll(() => page.evaluate(() => (window as any).__ingredientCalls())).toBe(1);
});

test('adding an existing ingredient reuses it, preserves ownership and refreshes earlier chat cards', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('说点什么').fill('推荐一杯酒');
  await page.getByRole('button', { name: '发送消息' }).click();
  await expect(page.getByText('缺 2 种：金酒、汤力水')).toBeVisible();
  await page.getByRole('link', { name: '酒柜', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '添加原料', exact: true });
  for (const alreadyOwned of [false, true]) {
    await page.getByRole('button', { name: '添加原料', exact: true }).click();
    await dialog.getByLabel('原料名称', { exact: true }).fill('  金酒  ');
    await expect(dialog.getByRole('combobox', { name: '原料分类', exact: true })).toHaveValue('spirits');
    await expect(dialog.getByRole('combobox', { name: '原料分类', exact: true })).toBeDisabled();
    await expect(dialog.getByLabel('我已有这项原料')).toBeChecked();
    if (alreadyOwned) await expect(dialog.getByLabel('我已有这项原料')).toBeDisabled();
    else await expect(dialog.getByLabel('我已有这项原料')).toBeEnabled();
    await dialog.getByRole('button', { name: '保存原料', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: '金酒', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('textbox', { name: '搜索原料' }).fill('');
    await expect(page.locator('.inventory-item')).toHaveCount(2);
  }
  await page.getByRole('tab', { name: /酒单/ }).click();
  await expect(page.getByRole('button', { name: /金汤力/ })).toContainText('缺 1 种：汤力水');
  await page.getByRole('link', { name: '聊天', exact: true }).click();
  await expect(page.getByRole('button', { name: /金汤力/ })).toContainText('缺 1 种：汤力水');
  await expect.poll(() => page.evaluate(() => (window as any).__ingredientCalls())).toBe(2);
});

test('ingredient cancellation and blank names do not save, while pending failures preserve a retryable form', async ({ page }) => {
  await page.goto('/bar');
  const addButton = page.getByRole('button', { name: '添加原料', exact: true });
  const dialog = page.getByRole('dialog', { name: '添加原料', exact: true });
  await addButton.click();
  await dialog.getByLabel('原料名称', { exact: true }).fill('这项不要保存');
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: '这项不要保存', exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as any).__ingredientCalls())).toBe(0);
  await addButton.click();
  await dialog.getByLabel('原料名称', { exact: true }).fill('   ');
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__ingredientCalls())).toBe(0);
  await dialog.getByLabel('原料名称', { exact: true }).fill('柠檬糖浆');
  await dialog.getByRole('combobox', { name: '原料分类', exact: true }).selectOption('syrup');
  await dialog.getByLabel('我已有这项原料').uncheck();
  await page.evaluate(() => { (window as any).__failNextIngredient(); (window as any).__holdIngredient(); });
  await dialog.getByRole('button', { name: '保存原料', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '正在保存…', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: '取消', exact: true })).toBeDisabled();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__ingredientCalls())).toBe(1);
  await page.evaluate(() => (window as any).__releaseIngredient());
  await expect(dialog.getByRole('alert')).toContainText('模拟原料保存失败');
  await expect(dialog.getByLabel('原料名称', { exact: true })).toHaveValue('柠檬糖浆');
  await expect(dialog.getByRole('combobox', { name: '原料分类', exact: true })).toHaveValue('syrup');
  await expect(dialog.getByLabel('我已有这项原料')).not.toBeChecked();
  await page.screenshot({ path: 'test-results/ingredient-save-error.png', fullPage: true });
  await dialog.getByRole('button', { name: '保存原料', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: '柠檬糖浆', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => page.evaluate(() => (window as any).__ingredientCalls())).toBe(2);
});

test('ingredient dialog fits 350px and newly added unowned ingredients remain visible after owned-only filtering', async ({ page }) => {
  await page.setViewportSize({ width: 350, height: 700 });
  await page.goto('/bar');
  await page.getByLabel('只看已有').check();
  await page.getByRole('textbox', { name: '搜索原料' }).fill('金酒');
  await page.getByRole('button', { name: '添加原料', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '添加原料', exact: true });
  await dialog.getByLabel('原料名称', { exact: true }).fill('粉红西柚汁（无糖）');
  await dialog.getByRole('combobox', { name: '原料分类', exact: true }).selectOption('juice');
  await dialog.getByLabel('我已有这项原料').uncheck();
  await expect(dialog.getByRole('button', { name: '保存原料', exact: true })).toBeInViewport();
  await expect.poll(() => dialog.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight
      && Array.from(el.querySelectorAll('input, select, button')).every(control => {
        const bounds = control.getBoundingClientRect();
        return bounds.left >= rect.left && bounds.right <= rect.right;
      });
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/add-ingredient-mobile.png', fullPage: true });
  await dialog.getByRole('button', { name: '保存原料', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: '粉红西柚汁（无糖）', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: '粉红西柚汁（无糖）', exact: true })).toBeInViewport();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/ingredient-unowned-mobile.png', fullPage: true });
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
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('model.start')).toBeInViewport();
  await page.getByRole('button', { name: '查看本轮链路' }).click();
  await expect(page.getByRole('region', { name: '链路详情' })).toHaveCount(0);
  await page.locator('.session-rail .conversation-delete').click();
  await page.getByRole('dialog', { name: '清空这段对话？' }).getByRole('button', { name: '确认清空' }).click();
  await expect(page.getByText('今天过得怎么样？')).toBeVisible();
});

test('clear chat requires confirmation and cancel or Escape preserves history and draft', async ({ page }) => {
  await page.goto('/');
  const clearButton = page.locator('.session-rail .conversation-delete');
  await expect(clearButton).toBeEnabled();
  await page.getByLabel('说点什么').fill('这段对话要保留');
  await page.getByRole('button', { name: '发送消息' }).click();
  await expect(page.locator('.message')).toHaveCount(2);
  await page.getByLabel('说点什么').fill('还没发出的草稿');
  const dialog = page.getByRole('dialog', { name: '清空这段对话？' });
  await clearButton.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: '取消' })).toBeFocused();
  await expect(dialog).toContainText('聊天记录和 Agent 上下文将被清除，无法恢复。');
  await expect.poll(() => page.evaluate(() => (window as any).__clearCalls())).toBe(0);
  await dialog.getByRole('button', { name: '取消' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(clearButton).toBeFocused();
  await clearButton.click();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.message')).toHaveCount(2);
  await expect(page.getByLabel('说点什么')).toHaveValue('还没发出的草稿');
  await expect.poll(() => page.evaluate(() => (window as any).__clearCalls())).toBe(0);
});

test('clear chat blocks duplicates, keeps failures visible and allows a confirmed retry', async ({ page }) => {
  await page.setViewportSize({ width: 350, height: 700 });
  await page.goto('/');
  await page.getByLabel('说点什么').fill('测试清空失败');
  await page.getByRole('button', { name: '发送消息' }).click();
  await expect(page.locator('.message')).toHaveCount(2);
  await page.getByLabel('说点什么').fill('清空后也保留草稿');
  await page.evaluate(() => { (window as any).__failNextClear(); (window as any).__holdClear(); });
  await page.getByRole('button', { name: '清空对话', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '清空这段对话？' });
  await dialog.getByRole('button', { name: '确认清空' }).click();
  await expect(dialog.getByRole('button', { name: '正在清空…' })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: '取消' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__clearCalls())).toBe(1);
  await page.evaluate(() => (window as any).__releaseClear());
  await expect(dialog.getByRole('alert')).toContainText('模拟清空失败');
  await expect(page.locator('.message')).toHaveCount(2);
  await page.screenshot({ path: 'test-results/clear-chat-confirmation-mobile.png' });
  await dialog.getByRole('button', { name: '确认清空' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.message')).toHaveCount(0);
  await expect(page.locator('.welcome h2')).toBeVisible();
  await expect(page.getByLabel('说点什么')).toHaveValue('清空后也保留草稿');
  await expect(page.getByRole('button', { name: '清空对话', exact: true })).toBeDisabled();
  await expect.poll(() => page.evaluate(() => (window as any).__clearCalls())).toBe(2);
});

test('desktop and mobile views have no overflow and remain operable', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  const composerFits = () => page.evaluate(() => {
    const box = document.querySelector('.composer-dock')!.getBoundingClientRect();
    const send = document.querySelector('.send-button')!.getBoundingClientRect();
    const panel = document.querySelector('.app-shell > main')!;
    const mobile = window.matchMedia('(max-width: 720px)').matches;
    const bottom = mobile ? document.querySelector('.sidebar')!.getBoundingClientRect().top : panel.getBoundingClientRect().bottom;
    const inset = mobile ? 10 : parseFloat(getComputedStyle(panel).borderBottomWidth) + parseFloat(getComputedStyle(panel).paddingBottom);
    return box.height >= 66 && bottom - box.bottom === inset && send.width === 36 && send.height === 36;
  });
  await expect.poll(composerFits).toBe(true);
  await page.screenshot({ path: 'test-results/chat-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole('button', { name: '发送消息' })).toBeVisible();
  await expect.poll(composerFits).toBe(true);
  await page.getByLabel('说点什么').fill('多行草稿在输入框内部滚动。\n'.repeat(15));
  await expect.poll(composerFits).toBe(true);
  await expect.poll(() => page.getByLabel('说点什么').evaluate(el => el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY === 'auto')).toBe(true);
  await page.getByLabel('说点什么').fill('');
  await page.screenshot({ path: 'test-results/chat-mobile.png', fullPage: true });
  for (const name of ['酒柜', '自定义', '设置']) {
    await page.getByRole('link', { name, exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('link', { name: '自定义', exact: true }).click();
  await page.screenshot({ path: 'test-results/custom-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('message traces expand independently in place, retry reads and explain expired records', async ({ page }) => {
  await page.goto('/');
  for (const text of ['第一轮聊天', '第二轮聊天']) {
    await page.getByLabel('说点什么').fill(text);
    await page.getByRole('button', { name: '发送消息' }).click();
    await expect(page.getByRole('button', { name: '发送消息' })).toBeDisabled();
    await expect(page.getByText('正在听你说，也在想怎么回答…')).toHaveCount(0);
  }
  const first = page.locator('.message.assistant').nth(0);
  const second = page.locator('.message.assistant').nth(1);
  await expect(first.getByRole('region', { name: '链路详情' })).toContainText('model.start');
  await expect(second.getByRole('button', { name: '查看本轮链路' })).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => first.evaluate(el => el.querySelector('.message-author')!.nextElementSibling?.classList.contains('chat-trace-panel'))).toBe(true);
  await second.getByRole('button', { name: '查看本轮链路' }).click();
  await page.evaluate(() => (window as any).__failNextTrace());
  await second.getByRole('button', { name: '查看本轮链路' }).click();
  await expect(second.getByRole('alert')).toContainText('模拟链路读取失败');
  await second.getByRole('button', { name: '重新加载链路' }).click();
  await expect(second.getByRole('region', { name: '链路详情' })).toContainText('turn.complete');
  await first.getByRole('button', { name: '查看本轮链路' }).click();
  await expect(first.getByRole('region', { name: '链路详情' })).toHaveCount(0);
  await expect(second.getByRole('region', { name: '链路详情' })).toBeVisible();
  await second.getByRole('button', { name: '查看本轮链路' }).click();
  await page.evaluate(() => (window as any).__clearTraces());
  await second.getByRole('button', { name: '查看本轮链路' }).click();
  await expect(second.getByRole('region', { name: '链路详情' })).toContainText('已被清理');
  await expect(page).toHaveURL(/\/$/);
});

test('reply text and compact trace steps arrive before completion and survive navigation', async ({ page }) => {
  await page.setViewportSize({ width: 350, height: 700 });
  await page.goto('/');
  await page.evaluate(() => (window as any).__holdMessage());
  await page.getByLabel('说点什么').fill('这是正在阅读的旧消息。'.repeat(70));
  await page.getByRole('button', { name: '发送消息' }).click();
  await page.evaluate(() => {
    for (const phase of ['model.start', 'model.first_response']) (window as any).__streamTrace(phase);
    (window as any).__streamText('我在。');
  });
  await expect(page.locator('.streaming-reply')).toHaveText('我在。');
  const trace = page.locator('.message.assistant .chat-trace-panel');
  await expect(trace.locator('li:visible')).toHaveCount(2);
  await expect(trace.locator('time, code, .chat-trace-meta, .trace-time, ol')).toHaveCount(0);
  await expect.poll(() => trace.locator('li').first().evaluate(el => getComputedStyle(el, '::before').content)).toBe('"·"');
  await page.evaluate(() => { (window as any).__streamTrace('tool.start'); (window as any).__streamTrace('tool.complete'); });
  await expect(trace.locator('li:visible')).toHaveCount(0);
  await expect(trace.getByRole('button', { name: '查看本轮链路' })).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(() => trace.evaluate(el => el.getBoundingClientRect().height)).toBe(38);
  await trace.getByRole('button', { name: '查看本轮链路' }).click();
  await expect(trace.locator('li:visible')).toHaveCount(4);
  await page.evaluate(() => (window as any).__streamTrace('output.validate'));
  await expect(trace.locator('li:visible')).toHaveCount(5);
  await trace.getByRole('button', { name: '查看本轮链路' }).click();
  await expect.poll(() => trace.evaluate(el => el.getBoundingClientRect().height)).toBe(38);
  await trace.getByRole('button', { name: '查看本轮链路' }).click();
  await page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    (window as any).__streamText('我在。流式回复还在继续。');
  });
  await expect(page.locator('.streaming-reply')).toHaveText('我在。流式回复还在继续。');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.getByLabel('说点什么').fill('下一句草稿');
  await page.getByRole('link', { name: '酒柜', exact: true }).click();
  await page.evaluate(() => (window as any).__streamText('我在。我们慢慢聊。'));
  await page.getByRole('link', { name: '聊天', exact: true }).click();
  await expect(page.locator('.streaming-reply')).toHaveText('我在。我们慢慢聊。');
  await expect(page.getByLabel('说点什么')).toHaveValue('下一句草稿');
  await page.evaluate(() => (window as any).__releaseMessage());
  await expect(page.locator('.streaming-reply')).toHaveCount(0);
  await expect(page.locator('.message.assistant')).toHaveCount(1);
  await expect(page.locator('.message.assistant .assistant-content > p')).toHaveText('我在。我们慢慢聊。');
  await page.evaluate(() => (window as any).__streamText('迟到的旧片段'));
  await expect(page.getByText('迟到的旧片段')).toHaveCount(0);
  await expect(page.getByText('model.start', { exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await expect.poll(() => page.evaluate(() => {
    const messages = document.querySelectorAll('.message.assistant');
    const gap = document.querySelector('.composer-dock')!.getBoundingClientRect().top - messages[messages.length - 1].getBoundingClientRect().bottom;
    return gap >= 0 && gap < 80;
  })).toBe(true);
  await expect(page.getByRole('button', { name: '回到最新' })).toHaveCount(0);
});

test('a failed stream restores the draft and never saves a partial assistant message', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { (window as any).__holdMessage(); (window as any).__failNextMessage(); });
  await page.getByLabel('说点什么').fill('流式失败后要保留的原消息');
  await page.getByRole('button', { name: '发送消息' }).click();
  await page.evaluate(() => { (window as any).__streamTrace('model.start'); (window as any).__streamText('尚未生成完整'); });
  await expect(page.locator('.streaming-reply')).toHaveText('尚未生成完整');
  await page.evaluate(() => (window as any).__releaseMessage());
  await expect(page.getByLabel('说点什么')).toHaveValue('流式失败后要保留的原消息');
  await expect(page.locator('.message.assistant')).toHaveCount(0);
  await expect(page.locator('.streaming-reply')).toHaveCount(0);
  await page.getByRole('button', { name: '重试这条消息' }).click();
  await expect(page.locator('.message.assistant')).toHaveCount(1);
  await expect(page.locator('.message.assistant .assistant-content > p')).toHaveText('我在。我们慢慢聊。');
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
  await expect(page.locator('.inventory-item')).toHaveCount(2);
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
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.chat-trace-detail')).not.toContainText('本地完成');
  await expect(page.locator('.chat-trace-detail')).toContainText('fallback.guidance');
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
  await expect(page.getByRole('button', { name: '查看失败链路' })).toBeVisible();
  await page.getByLabel('酒名或原料关键词').fill('金酒');
  await page.evaluate(() => (window as any).__failNextLocal());
  await page.getByRole('button', { name: '按缺料从少到多', exact: true }).click();
  await expect(page.getByText(/本地查询未完成：模拟本地数据库读取失败/)).toBeVisible();
  await expect(page.getByLabel('酒名或原料关键词')).toHaveValue('金酒');
  await page.getByRole('button', { name: '按缺料从少到多', exact: true }).click();
  await expect(page.getByRole('button', { name: /金汤力/ })).toBeVisible();
  await expect(page.locator('.error.archived')).toContainText('模拟网络失败');
  await expect.poll(() => page.evaluate(() => {
    const children = Array.from(document.querySelector('.conversation')!.children);
    const failed = children.findIndex(item => item.classList.contains('error'));
    const request = children.findIndex(item => item.classList.contains('message') && item.textContent?.includes('金酒'));
    return failed >= 0 && request > failed;
  })).toBe(true);
  await expect(page.getByRole('button', { name: '重试这条消息' })).toBeVisible();
  await expect(page.getByLabel('说点什么')).toHaveValue('原消息先不要丢');
  await page.getByRole('button', { name: '查看本轮链路' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.message.assistant .chat-trace-detail')).toContainText('来源失败链路：00000000-0000-4000-8000-000000000001');
  await expect(page.locator('.message.assistant .chat-trace-detail')).not.toContainText('本地完成');
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
  await page.getByRole('button', { name: '清空对话' }).click();
  await page.getByRole('dialog', { name: '清空这段对话？' }).getByRole('button', { name: '确认清空' }).click();
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
  await expect.poll(() => page.evaluate(() => {
    const header = document.querySelector('.page-header')!.getBoundingClientRect();
    const options = document.querySelector('.local-options')!.getBoundingClientRect();
    return window.scrollY > 0 && header.top === 0 && options.top - header.bottom === 5;
  })).toBe(true);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(page.getByRole('button', { name: '回到最新' })).toBeVisible();
  await page.evaluate(() => (window as any).__releaseMessage());
  await expect(page.getByText('正在听你说，也在想怎么回答…')).toHaveCount(0);
  await expect(page.locator('.message.assistant')).toHaveCount(4);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.getByRole('button', { name: '回到最新' }).click();
  await expect(page.locator('.message.assistant').last()).toBeInViewport();
  await expect(page.getByRole('button', { name: '回到最新' })).toHaveCount(0);
});

for (const viewport of [{ width: 350, height: 700 }, { width: 1100, height: 820 }]) {
  test(`local choices collapse into a visible chat turn and reopen with their values at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/bar');
    await page.evaluate(() => (window as any).__setConfigured(false));
    await page.getByRole('link', { name: '聊天', exact: true }).click();
    await expect(page.locator('.local-options')).not.toHaveAttribute('open');
    if (viewport.width > 720) {
      await expect.poll(() => page.evaluate(() => {
        const header = document.querySelector('.page-header')!;
        const options = document.querySelector('.local-options')!;
        const main = document.querySelector('.app-shell > main')!;
        const newConversation = document.querySelector('.new-conversation')!;
        return header.nextElementSibling === options
          && Math.abs(options.getBoundingClientRect().top - newConversation.getBoundingClientRect().top) < 1;
      })).toBe(true);
    } else {
      await expect.poll(() => page.evaluate(() => {
        const header = document.querySelector('.page-header')!;
        const options = document.querySelector('.local-options')!;
        const gap = options.getBoundingClientRect().top - header.getBoundingClientRect().bottom;
        return header.nextElementSibling === options && gap >= 4 && gap <= 6;
      })).toBe(true);
    }
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
      const reply = document.querySelector('.message.assistant .assistant-content > p')!.getBoundingClientRect();
      const header = document.querySelector('.chat-top')!.getBoundingClientRect();
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

test('web login keeps invalid credential errors visible instead of reloading', async ({ page }) => {
  await page.addInitScript(() => { delete (window as any).__TAURI_INTERNALS__; });
  await page.route('**/auth/login', route => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'invalid email or password' }),
  }));
  await page.goto('/login');
  await page.getByPlaceholder('邮箱').fill('user@example.com');
  await page.getByPlaceholder('密码（至少 8 位）').fill('wrong-password');
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page.getByRole('alert')).toContainText('邮箱或密码不正确');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('navigation')).toHaveCount(0);
});

test('web registration signs in and avoids the desktop preview message', async ({ page }) => {
  await page.addInitScript(() => { delete (window as any).__TAURI_INTERNALS__; });
  await page.route('**/auth/register', route => route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({
      token: 'web-token',
      tokenType: 'Bearer',
      expiresAt: '2026-09-28T00:00:00Z',
      user: { id: '9d2b', email: 'web@example.com', createdAt: '2026-09-21T00:00:00Z' },
    }),
  }));
  await page.route('**/ingredients', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/recipes*', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/chat', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/settings', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ name: '', preferences: '', model: 'qwen-plus', baseUrl: 'https://example.com/v1', apiKeyConfigured: false, dataDirectory: 'browser' }) }));
  await page.route('**/traces', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto('/login');
  await page.getByPlaceholder('邮箱').fill('web@example.com');
  await page.getByPlaceholder('密码（至少 8 位）').fill('web-password-123');
  await page.getByRole('button', { name: '注册新用户', exact: true }).click();
  await expect(page.getByRole('button', { name: '注册并登录', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '注册并登录', exact: true }).click();
  await expect(page.getByRole('navigation').getByRole('link')).toHaveCount(5);
  await expect(page.getByText('当前为界面预览。请运行 npm run tauri:dev，使用本地酒柜和 Agent。')).toHaveCount(0);
  await expect(page.getByText('本地模式')).toBeVisible();
  await page.getByRole('link', { name: '设置', exact: true }).click();
  const account = page.getByRole('main').getByRole('region', { name: '当前账号' });
  await expect(account).toContainText('web@example.com');
  await expect(account).toContainText('注册于');
  await account.getByRole('button', { name: '退出', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('web registration mode returns to login without submitting', async ({ page }) => {
  await page.addInitScript(() => { delete (window as any).__TAURI_INTERNALS__; });
  let registerCalls = 0;
  await page.route('**/auth/register', route => {
    registerCalls++;
    return route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/login');
  await page.getByRole('button', { name: '注册新用户', exact: true }).click();
  await page.getByRole('button', { name: '返回登录', exact: true }).click();
  await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '注册并登录', exact: true })).toHaveCount(0);
  await expect.poll(() => registerCalls).toBe(0);
});

test('web session token survives a temporary auth status check failure', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as any).__TAURI_INTERNALS__;
    localStorage.setItem('drink_token', 'stored-web-token');
  });
  await page.route('**/auth/me', route => route.abort('connectionreset'));
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.getByPlaceholder('邮箱')).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('drink_token'))).toBe('stored-web-token');

  await page.unroute('**/auth/me');
  await page.route('**/auth/me', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ id: 'web-user', email: 'web@example.com', createdAt: '2026-09-21T00:00:00Z' }),
  }));
  await page.route('**/ingredients', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/recipes*', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/chat', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/settings', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ name: '', preferences: '', model: 'qwen-plus', baseUrl: 'https://example.com/v1', apiKeyConfigured: false, dataDirectory: 'browser' }) }));
  await page.route('**/traces', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.reload();
  await expect(page.getByRole('navigation').getByRole('link')).toHaveCount(5);
  await expect(page.getByText('web@example.com')).toBeVisible();
});

test('web local recommendation queries the server without any model API', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as any).__TAURI_INTERNALS__;
    localStorage.setItem('drink_token', 'web-token');
    localStorage.setItem('drink_model_key', 'browser-held-key');
  });
  await page.route('**/auth/me', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ id: 'web-user', email: 'web@example.com', createdAt: '2026-09-21T00:00:00Z' }),
  }));
  await page.route('**/ingredients', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/recipes*', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/chat', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/settings', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ name: '', preferences: '', model: 'qwen-plus', baseUrl: 'https://example.com/v1', apiKeyConfigured: false, dataDirectory: 'browser' }) }));
  await page.route('**/traces', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  const profileEvents: any[] = [];
  await page.route('**/profile/events', async route => {
    profileEvents.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'event-1', seq: 1, eventType: 'like', source: 'structured_ui',
        recipeId: 'gin-tonic', payload: {}, idempotencyKey: 'test-key',
        traceId: null, occurredAt: '2026-09-23T00:00:00Z', processedAt: '2026-09-23T00:00:00Z',
      }),
    });
  });
  await page.route('**/recommendations/local', async route => {
    const body = route.request().postDataJSON() as { availability: string };
    await expect(() => {
      if (!body.availability) throw new Error('availability is required');
    }).not.toThrow();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        request: '本地查酒单：只差一种材料',
        message: {
          id: 'web-local-1',
          role: 'assistant',
          text: '本地查酒单：只差一种材料。\n找到 1 款，先列出 1 款：\n金汤力：还缺 金酒',
          recipes: [{ id: 'gin-tonic', name: '金汤力', nameEn: 'Gin & Tonic', description: '', category: 'Gin', source: 'builtin', image: null, method: '直调', flavor: { sweet: 1, sour: 2, bitter: 2, strong: 2 }, ingredients: [], steps: [], missing: ['金酒'], canMake: false }],
          traceId: null,
          mode: 'local',
        },
      }),
    });
  });
  await page.goto('/');
  await page.getByText('调整推荐条件 · 本地酒单', { exact: true }).click();
  await page.getByRole('button', { name: '只差一种材料' }).click();
  await expect(page.locator('.message.assistant')).toHaveCount(1);
  await expect(page.getByText('Bartender · 本地模式')).toBeVisible();
  await expect(page.getByText(/找到 1 款/)).toBeVisible();
  await expect(page.getByRole('heading', { name: '金汤力', exact: true })).toBeVisible();

  await page.getByRole('button', { name: '喜欢', exact: true }).click();
  await expect(page.getByRole('button', { name: '已记喜欢' })).toBeVisible();
  await expect(page.getByText('已用于调整你的口味画像。')).toBeVisible();
  await expect(profileEvents).toHaveLength(1);
  expect(profileEvents[0]).toMatchObject({
    eventType: 'like',
    recipeId: 'gin-tonic',
    traceId: null,
    idempotencyKey: 'recommendation:web-local-1:gin-tonic:like',
  });

  await page.getByRole('button', { name: '调整口味' }).click();
  await page.getByRole('button', { name: '太甜' }).click();
  await expect(page.getByRole('button', { name: '已记太甜' })).toBeVisible();
  expect(profileEvents[1]).toMatchObject({
    eventType: 'feedback',
    recipeId: 'gin-tonic',
    payload: { dimension: 'sweet', direction: 'lower' },
    idempotencyKey: 'recommendation:web-local-1:gin-tonic:feedback:sweet-lower',
  });
});

test('web chat without a browser key stays local and never calls the server agent', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as any).__TAURI_INTERNALS__;
    localStorage.setItem('drink_token', 'web-token');
  });
  await page.route('**/auth/me', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ id: 'web-user', email: 'web@example.com', createdAt: '2026-09-21T00:00:00Z' }),
  }));
  await page.route('**/ingredients', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/recipes*', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/chat', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/settings', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      name: '',
      preferences: '',
      model: 'qwen-plus',
      baseUrl: 'https://dashscope.example/v1',
      apiKeyConfigured: false,
      dataDirectory: '浏览器本机；服务器不保存 API Key',
    }),
  }));
  await page.route('**/traces', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  let agentCalled = false;
  await page.route('**/chat/send', async route => {
    agentCalled = true;
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'should not be called' }) });
  });

  await page.goto('/');
  await expect(page.locator('.local-mode')).toContainText('尚未配置 API');
  await page.getByLabel('说点什么').fill('不想喝酒，想聊聊');
  await page.getByRole('button', { name: '发送消息' }).click();

  await expect(page.locator('.message.assistant')).toContainText('暂时还没有连接聊天模型');
  await expect(page.locator('.message.assistant')).toContainText('调整推荐条件');
  await expect(page.locator('.recommendations')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(agentCalled).toBe(false);
});

test('web agent sends the browser-held model key without saving it on the server', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as any).__TAURI_INTERNALS__;
    localStorage.setItem('drink_token', 'web-token');
    localStorage.setItem('drink_model_key', 'browser-held-key');
  });
  await page.route('**/auth/me', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ id: 'web-user', email: 'web@example.com', createdAt: '2026-09-21T00:00:00Z' }),
  }));
  await page.route('**/ingredients', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/recipes*', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/chat', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/settings', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ name: '', preferences: '', model: 'qwen-plus', baseUrl: 'https://dashscope.example/v1', apiKeyConfigured: false, dataDirectory: '浏览器本机；服务器不保存 API Key' }) }));
  await page.route('**/traces', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  let sentKey = '';
  await page.route('**/chat/send', async route => {
    const body = route.request().postDataJSON() as { message: string; apiKey?: string };
    sentKey = body.apiKey ?? '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'web-agent-reply', role: 'assistant', text: '我在。今晚想放松一点吗？', recipes: [],
        traceId: 'web-agent-trace', mode: 'agent',
      }),
    });
  });
  await page.goto('/');
  await expect(page.getByLabel('说点什么')).toBeEnabled();
  await page.getByLabel('说点什么').fill('今天有点累');
  await page.getByRole('button', { name: '发送消息' }).click();
  await expect(page.getByText('我在。今晚想放松一点吗？')).toBeVisible();
  await expect(page.getByText('Bartender', { exact: true })).toBeVisible();
  await expect.poll(() => sentKey).toBe('browser-held-key');
});

test('web settings save model preferences without sending the API key to the server', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as any).__TAURI_INTERNALS__;
    localStorage.setItem('drink_token', 'web-token');
  });
  await page.route('**/auth/me', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ id: 'web-user', email: 'web@example.com', createdAt: '2026-09-21T00:00:00Z' }),
  }));
  await page.route('**/ingredients', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/recipes*', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/chat', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/traces', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/profile', route => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: '画像尚未生成' }) }));
  await page.route('**/memory/settings', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ allowAutoLowRisk: false, lowRiskTtlDays: 180, allowTemporaryContext: false, temporaryContextTtlDays: 7, updatedAt: '2026-09-24T00:00:00Z' }) }));
  await page.route('**/memory/statements', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

  let savedRequestBody: Record<string, unknown> | undefined;
  await page.route(/\/api\/settings$/, async route => {
    const request = route.request();
    if (request.method() === 'PUT') {
      savedRequestBody = request.postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          name: 'Yang',
          preferences: '少糖',
          model: 'qwen-max',
          baseUrl: 'https://model.example.com/v1',
          apiKeyConfigured: false,
          dataDirectory: '浏览器本机；服务器不保存 API Key',
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        name: 'Yang',
        preferences: '少糖',
        model: 'qwen-max',
        baseUrl: 'https://model.example.com/v1',
        apiKeyConfigured: savedRequestBody != null,
        dataDirectory: '浏览器本机；服务器不保存 API Key',
      }),
    });
  });

  await page.goto('/settings');
  await page.getByLabel('API Key', { exact: false }).fill('browser-only-key');
  await page.getByRole('button', { name: '保存设置' }).click();

  await expect(page.getByRole('status')).toContainText('已保存');
  await expect(page.getByText('已保存模型配置，可以回到聊天开始对话。')).toBeVisible();
  await expect(page.getByLabel('API Key', { exact: false })).toHaveValue('');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('drink_model_key'))).toBe('browser-only-key');
  expect(savedRequestBody).toMatchObject({
    name: 'Yang',
    preferences: '少糖',
    model: 'qwen-max',
    baseUrl: 'https://model.example.com/v1',
  });
  expect(savedRequestBody && 'apiKey' in savedRequestBody).toBe(false);
});

test('desktop chat scrolls inside the fixed right panel', async ({ page }) => {
  await page.goto('/');
  for (let i = 0; i < 4; i++) {
    await page.getByLabel('说点什么').fill(`第 ${i + 1} 轮：` + '这是足够长的对话内容，用来验证右侧面板内部滚动。'.repeat(6));
    await page.getByRole('button', { name: '发送消息' }).click();
    await expect(page.locator('.message.assistant')).toHaveCount(i + 1);
  }
  const readPanel = () => page.evaluate(() => ({
    main: document.querySelector('.app-shell > main')!.getBoundingClientRect().toJSON(),
    composer: document.querySelector('.composer-dock')!.getBoundingClientRect().toJSON(),
    bodyScroll: window.scrollY,
    conversationScroll: document.querySelector('.conversation')!.scrollTop,
  }));
  const scrolledDown = await readPanel();
  await expect.poll(() => page.evaluate(() => document.querySelector('.conversation')!.scrollTop)).toBeGreaterThan(0);

  await page.evaluate(() => document.querySelector('.conversation')!.scrollTo({ top: 0 }));
  await expect.poll(() => page.evaluate(() => document.querySelector('.conversation')!.scrollTop)).toBe(0);
  const scrolledUp = await readPanel();
  expect(scrolledDown.main).toEqual(scrolledUp.main);
  expect(scrolledDown.composer).toEqual(scrolledUp.composer);
  expect(scrolledDown.bodyScroll).toBe(0);
  expect(scrolledUp.bodyScroll).toBe(0);
});

test('web profile panel supports onboarding and constraint memories', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as any).__TAURI_INTERNALS__;
    localStorage.setItem('drink_token', 'web-token');
  });
  await page.route('**/auth/me', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ id: 'web-user', email: 'web@example.com', createdAt: '2026-09-21T00:00:00Z' }),
  }));
  await page.route('**/ingredients', route => route.fulfill({ status: 200, body: '[]', contentType: 'application/json' }));
  await page.route('**/recipes*', route => route.fulfill({ status: 200, body: '[]', contentType: 'application/json' }));
  await page.route('**/chat', route => route.fulfill({ status: 200, body: '[]', contentType: 'application/json' }));
  await page.route('**/traces', route => route.fulfill({ status: 200, body: '[]', contentType: 'application/json' }));
  await page.route(/\/api\/settings$/, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ name: 'Yang', preferences: '', model: 'qwen-plus', baseUrl: 'https://example.com/v1', apiKeyConfigured: false, dataDirectory: 'browser' }),
  }));

  const profileEvents: any[] = [];
  const memoryBodies: any[] = [];
  let memoryDeleted = 0;
  await page.route(/\/api\/profile\/events$/, async route => {
    profileEvents.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'event-1', seq: 1, eventType: 'quiz_answer', source: 'structured_ui', recipeId: null, payload: {}, idempotencyKey: 'quiz', traceId: null, occurredAt: '2026-09-24T00:00:00Z', processedAt: null }),
    });
  });
  await page.route(/\/api\/memory\/settings$/, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ allowAutoLowRisk: false, lowRiskTtlDays: 180, allowTemporaryContext: false, temporaryContextTtlDays: 7, updatedAt: '2026-09-24T00:00:00Z' }),
    });
  });
  await page.route(/\/api\/memory\/statements\/[^/?]+$/, async route => {
    if (route.request().method() === 'DELETE') {
      memoryDeleted += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ deleted: 1 }) });
      return;
    }
    await route.fulfill({ status: 204, body: '' });
  });
  await page.route(/\/api\/memory\/statements(\?.*)?$/, async route => {
    if (route.request().method() === 'POST') {
      memoryBodies.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'memory-1', kind: 'constraint', content: '对乳制品过敏。', source: 'structured_ui', retentionPolicy: 'explicit', confidence: 0.8, status: 'active', expiresAt: null, lastSeenAt: '2026-09-24T00:00:00Z', createdAt: '2026-09-24T00:00:00Z' }),
      });
      return;
    }
    if (route.request().method() === 'DELETE') {
      memoryDeleted += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ deleted: 1 }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 'memory-1', kind: 'constraint', content: '对乳制品过敏。', source: 'structured_ui', retentionPolicy: 'explicit', confidence: 0.8, status: 'active', expiresAt: null, lastSeenAt: '2026-09-24T00:00:00Z', createdAt: '2026-09-24T00:00:00Z' }]),
    });
  });
  await page.route(/\/api\/profile$/, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      schemaVersion: 1,
      constraints: { noAlcohol: false, allergies: ['dairy'], avoidIngredients: [], maxAbvLevel: null },
      preferences: { flavor: { sweet: 1, sour: 4, bitter: 1, strong: 2 }, baseSpirit: {}, tagAffinity: {} },
      confidence: { flavor: { sweet: .3, sour: .3, bitter: .3, strong: .3 } },
      profileRevision: 2, lastEventSeq: 3, computedAt: '2026-09-24T00:00:00Z', updatedAt: '2026-09-24T00:00:00Z',
    }),
  }));

  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: '口味画像' })).toBeVisible();
  await expect(page.getByText('乳制品过敏')).toBeVisible();

  await page.getByRole('checkbox', { name: '乳制品' }).check();
  await page.getByRole('radio', { name: '偏酸' }).check();
  await page.getByRole('button', { name: '保存问卷' }).click();
  await expect(profileEvents).toHaveLength(1);
  expect(profileEvents[0].payload.constraints.allergies).toEqual(['dairy']);
  expect(profileEvents[0].payload.preferences.flavor.sour).toBe(4);

  await page.locator('.memory-form select').selectOption('constraint');
  await page.locator('.memory-form textarea').fill('对乳制品过敏。');
  await page.locator('.memory-form input').nth(1).fill('dairy');
  await page.getByRole('button', { name: '保存记忆' }).click();
  expect(memoryBodies[0]).toMatchObject({
    kind: 'constraint',
    content: '对乳制品过敏。',
    constraintPayload: { constraints: { allergies: ['dairy'] } },
  });

  page.on('dialog', dialog => void dialog.accept());
  await page.locator('.memory-item').getByRole('button', { name: '删除' }).click();
  await expect.poll(() => memoryDeleted).toBe(1);
});
