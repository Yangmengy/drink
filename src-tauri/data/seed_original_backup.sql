-- 测试数据 (Seed Data)
-- 插入经典鸡尾酒配方用于开发测试

-- ============================================
-- 1. 插入原料 (Ingredients)
-- ============================================

-- 基酒
INSERT OR IGNORE INTO ingredients VALUES 
('tequila-blanco', '龙舌兰酒 (银)', 'Tequila Blanco', 'spirits', 'tequila', 40.0, '墨西哥特产烈酒，由蓝色龙舌兰制成', '🍶', strftime('%s', 'now'), strftime('%s', 'now'), NULL);

INSERT OR IGNORE INTO ingredients VALUES 
('white-rum', '白朗姆酒', 'White Rum', 'spirits', 'rum', 40.0, '加勒比地区特产烈酒', '🍶', strftime('%s', 'now'), strftime('%s', 'now'), NULL);

INSERT OR IGNORE INTO ingredients VALUES 
('vodka', '伏特加', 'Vodka', 'spirits', 'vodka', 40.0, '东欧传统烈酒', '🍶', strftime('%s', 'now'), strftime('%s', 'now'), NULL);

INSERT OR IGNORE INTO ingredients VALUES 
('gin', '金酒', 'Gin', 'spirits', 'gin', 40.0, '以杜松子为主要香料的烈酒', '🍶', strftime('%s', 'now'), strftime('%s', 'now'), NULL);

-- 利口酒
INSERT OR IGNORE INTO ingredients VALUES 
('triple-sec', '三倍橙酒', 'Triple Sec', 'liqueur', 'orange', 40.0, '橙味利口酒', '🍊', strftime('%s', 'now'), strftime('%s', 'now'), NULL);

INSERT OR IGNORE INTO ingredients VALUES 
('kahlua', '咖啡利口酒', 'Kahlua', 'liqueur', 'coffee', 20.0, '墨西哥咖啡利口酒', '☕', strftime('%s', 'now'), strftime('%s', 'now'), NULL);

-- 果汁和其他
INSERT OR IGNORE INTO ingredients VALUES 
('lime-juice', '青柠汁', 'Lime Juice', 'juice', 'citrus', 0, '新鲜青柠榨汁', '🟢', strftime('%s', 'now'), strftime('%s', 'now'), NULL);

INSERT OR IGNORE INTO ingredients VALUES 
('lemon-juice', '柠檬汁', 'Lemon Juice', 'juice', 'citrus', 0, '新鲜柠檬榨汁', '🍋', strftime('%s', 'now'), strftime('%s', 'now'), NULL);

INSERT OR IGNORE INTO ingredients VALUES 
('simple-syrup', '糖浆', 'Simple Syrup', 'syrup', 'sweetener', 0, '1:1 白砂糖与水的混合', '🍯', strftime('%s', 'now'), strftime('%s', 'now'), NULL);

INSERT OR IGNORE INTO ingredients VALUES 
('mint-leaves', '薄荷叶', 'Mint Leaves', 'herb', 'garnish', 0, '新鲜薄荷叶', '🌿', strftime('%s', 'now'), strftime('%s', 'now'), NULL);

INSERT OR IGNORE INTO ingredients VALUES 
('soda-water', '苏打水', 'Soda Water', 'mixer', 'carbonated', 0, '碳酸水', '💧', strftime('%s', 'now'), strftime('%s', 'now'), NULL);

INSERT OR IGNORE INTO ingredients VALUES 
('cola', '可乐', 'Cola', 'mixer', 'soft-drink', 0, '可口可乐或百事可乐', '🥤', strftime('%s', 'now'), strftime('%s', 'now'), NULL);

INSERT OR IGNORE INTO ingredients VALUES 
('cream', '奶油', 'Cream', 'dairy', 'cream', 0, '鲜奶油', '🥛', strftime('%s', 'now'), strftime('%s', 'now'), NULL);

-- ============================================
-- 2. 插入配方 (Recipes)
-- ============================================

-- Margarita (玛格丽特)
INSERT OR IGNORE INTO recipes (id, name_zh, name_en, category, description, story, method, color, tags, flavor_profile, occasion, season, mood, origin, year_created, creator, variations, pairing, image_url, glass_type, ice_type, garnish, abv, difficulty, prep_time, source, is_iba, is_favorite, view_count, last_viewed_at, created_at, updated_at, synced_at) VALUES (
    'margarita-classic',
    '玛格丽特',
    'Margarita',
    'classic',
    '经典龙舌兰鸡尾酒，酸甜平衡，是全球最受欢迎的鸡尾酒之一',
    '传说在 1930 年代，一位酒保为他那对烈酒过敏、唯独能喝龙舌兰的初恋女友 Margarita 创作了这款酒。杯口的那圈盐边，据说象征着思念的眼泪。',
    '摇和法 (Shake)',
    '#E0F2F1',
    '["经典", "酸甜", "夏日", "龙舌兰"]',
    '{"sweet": 2, "sour": 4, "bitter": 1, "strong": 3}',
    '["派对", "聚会", "餐前"]',
    '["夏季", "春季"]',
    '["欢乐", "放松", "热情"]',
    '墨西哥',
    1938,
    'Carlos "Danny" Herrera',
    '["Tommy''s Margarita (汤米玛格丽特)", "Frozen Margarita (冰沙玛格丽特)", "Strawberry Margarita (草莓玛格丽特)"]',
    '{"food": ["墨西哥塔可", "玉米片与莎莎酱", "烤海鲜"], "music": ["拉丁流行", "Bossa Nova"]}',
    NULL,
    'margarita',
    'cubed',
    '盐边 + 青柠角',
    15.0,
    2,
    5,
    'IBA',
    1,
    0,
    0,
    NULL,
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    NULL
);

-- Mojito (莫吉托)
INSERT OR IGNORE INTO recipes (id, name_zh, name_en, category, description, story, method, color, tags, flavor_profile, occasion, season, mood, origin, year_created, creator, variations, pairing, image_url, glass_type, ice_type, garnish, abv, difficulty, prep_time, source, is_iba, is_favorite, view_count, last_viewed_at, created_at, updated_at, synced_at) VALUES (
    'mojito-classic',
    '莫吉托',
    'Mojito',
    'tropical',
    '古巴经典鸡尾酒，清爽薄荷风味，夏日首选',
    '源自古巴哈瓦那，曾是海盗和水手用于预防坏血病的饮品。大文豪海明威更是将其推向世界，他曾留下名言："My mojito in La Bodeguita, My daiquiri in El Floridita"。',
    '捣和法 (Muddle & Build)',
    '#F1F8E9',
    '["清爽", "薄荷", "夏日", "朗姆"]',
    '{"sweet": 3, "sour": 3, "bitter": 0, "strong": 2}',
    '["沙滩", "下午茶", "聚会"]',
    '["夏季"]',
    '["清爽", "活力", "悠闲"]',
    '古巴哈瓦那',
    1586,
    'Sir Francis Drake (传闻)',
    '["Strawberry Mojito (草莓莫吉托)", "Passionfruit Mojito (百香果莫吉托)", "Virgin Mojito (无酒精莫吉托)"]',
    '{"food": ["古巴三明治", "海鲜沙拉", "轻快小吃"], "music": ["加勒比雷鬼", "古巴爵士"]}',
    NULL,
    'highball',
    'crushed',
    '薄荷枝 + 青柠片',
    10.0,
    2,
    8,
    'IBA',
    1,
    0,
    0,
    NULL,
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    NULL
);

-- White Russian (白俄罗斯)
INSERT OR IGNORE INTO recipes (id, name_zh, name_en, category, description, story, method, color, tags, flavor_profile, occasion, season, mood, origin, year_created, creator, variations, pairing, image_url, glass_type, ice_type, garnish, abv, difficulty, prep_time, source, is_iba, is_favorite, view_count, last_viewed_at, created_at, updated_at, synced_at) VALUES (
    'white-russian',
    '白俄罗斯',
    'White Russian',
    'classic',
    '奶油咖啡味鸡尾酒，口感丝滑香甜',
    '尽管名字带有"俄罗斯"，但其实诞生于布鲁塞尔。电影《谋杀绿脚趾》(The Big Lebowski) 中主角 "The Dude" 对这款酒的痴迷，使它在 1990 年代重获极高的人气。',
    '直调法 (Build)',
    '#EFEBE9',
    '["咖啡", "奶香", "丝滑", "伏特加"]',
    '{"sweet": 4, "sour": 0, "bitter": 2, "strong": 3}',
    '["餐后", "深夜", "独饮"]',
    '["冬季", "秋季"]',
    '["舒适", "慵懒", "温暖"]',
    '比利时布鲁塞尔',
    1949,
    'Gustave Tops',
    '["Black Russian (黑俄罗斯)", "Blind Russian (盲俄罗斯 - 用百利甜替代奶油)"]',
    '{"food": ["提拉米苏", "巧克力慕斯", "坚果"], "music": ["Lofi 嘻哈", "蓝调爵士"]}',
    NULL,
    'old-fashioned',
    'cubed',
    '无 / 咖啡豆几粒',
    18.0,
    1,
    3,
    'IBA',
    1,
    0,
    0,
    NULL,
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    NULL
);

-- ============================================
-- 3. 插入配方原料关联 (Recipe Ingredients)
-- ============================================

-- Margarita 原料
INSERT OR IGNORE INTO recipe_ingredients VALUES 
('ri-margarita-1', 'margarita-classic', 'tequila-blanco', 50, 'ml', 0, 1, strftime('%s', 'now'));

INSERT OR IGNORE INTO recipe_ingredients VALUES 
('ri-margarita-2', 'margarita-classic', 'triple-sec', 20, 'ml', 0, 2, strftime('%s', 'now'));

INSERT OR IGNORE INTO recipe_ingredients VALUES 
('ri-margarita-3', 'margarita-classic', 'lime-juice', 20, 'ml', 0, 3, strftime('%s', 'now'));

-- Mojito 原料
INSERT OR IGNORE INTO recipe_ingredients VALUES 
('ri-mojito-1', 'mojito-classic', 'white-rum', 45, 'ml', 0, 1, strftime('%s', 'now'));

INSERT OR IGNORE INTO recipe_ingredients VALUES 
('ri-mojito-2', 'mojito-classic', 'lime-juice', 20, 'ml', 0, 2, strftime('%s', 'now'));

INSERT OR IGNORE INTO recipe_ingredients VALUES 
('ri-mojito-3', 'mojito-classic', 'simple-syrup', 15, 'ml', 0, 3, strftime('%s', 'now'));

INSERT OR IGNORE INTO recipe_ingredients VALUES 
('ri-mojito-4', 'mojito-classic', 'mint-leaves', 10, 'leaves', 0, 4, strftime('%s', 'now'));

INSERT OR IGNORE INTO recipe_ingredients VALUES 
('ri-mojito-5', 'mojito-classic', 'soda-water', 60, 'ml', 0, 5, strftime('%s', 'now'));

-- White Russian 原料
INSERT OR IGNORE INTO recipe_ingredients VALUES 
('ri-white-russian-1', 'white-russian', 'vodka', 50, 'ml', 0, 1, strftime('%s', 'now'));

INSERT OR IGNORE INTO recipe_ingredients VALUES 
('ri-white-russian-2', 'white-russian', 'kahlua', 20, 'ml', 0, 2, strftime('%s', 'now'));

INSERT OR IGNORE INTO recipe_ingredients VALUES 
('ri-white-russian-3', 'white-russian', 'cream', 30, 'ml', 0, 3, strftime('%s', 'now'));

-- ============================================
-- 4. 插入制作步骤 (Recipe Steps)
-- ============================================

-- Margarita 步骤
INSERT OR IGNORE INTO recipe_steps VALUES 
('step-margarita-1', 'margarita-classic', 1, '准备杯子', '用青柠片擦拭玛格丽特杯口，然后沾上盐边', 30, strftime('%s', 'now'));

INSERT OR IGNORE INTO recipe_steps VALUES 
('step-margarita-2', 'margarita-classic', 2, '混合原料', '在摇酒器中加入龙舌兰、三倍橙酒、青柠汁和冰块', 15, strftime('%s', 'now'));

INSERT OR IGNORE INTO recipe_steps VALUES 
('step-margarita-3', 'margarita-classic', 3, '摇匀', '用力摇晃 10-15 秒至摇酒器外部结霜', 15, strftime('%s', 'now'));

INSERT OR IGNORE INTO recipe_steps VALUES 
('step-margarita-4', 'margarita-classic', 4, '过滤倒入', '滤掉冰块，将酒液倒入准备好的杯中', 10, strftime('%s', 'now'));

-- Mojito 步骤
INSERT OR IGNORE INTO recipe_steps VALUES 
('step-mojito-1', 'mojito-classic', 1, '混合薄荷', '在高球杯中放入薄荷叶和糖浆，轻轻捣碎薄荷释放香气', 30, strftime('%s', 'now'));

INSERT OR IGNORE INTO recipe_steps VALUES 
('step-mojito-2', 'mojito-classic', 2, '加入青柠', '加入青柠汁和冰块', 15, strftime('%s', 'now'));

INSERT OR IGNORE INTO recipe_steps VALUES 
('step-mojito-3', 'mojito-classic', 3, '倒入朗姆', '倒入白朗姆酒并轻轻搅拌', 10, strftime('%s', 'now'));

INSERT OR IGNORE INTO recipe_steps VALUES 
('step-mojito-4', 'mojito-classic', 4, '补充苏打水', '加满苏打水，用薄荷枝和青柠片装饰', 15, strftime('%s', 'now'));

-- White Russian 步骤
INSERT OR IGNORE INTO recipe_steps VALUES 
('step-white-russian-1', 'white-russian', 1, '加入伏特加', '在古典杯中加入冰块和伏特加', 15, strftime('%s', 'now'));

INSERT OR IGNORE INTO recipe_steps VALUES 
('step-white-russian-2', 'white-russian', 2, '加入咖啡酒', '加入咖啡利口酒并轻轻搅拌', 10, strftime('%s', 'now'));

INSERT OR IGNORE INTO recipe_steps VALUES 
('step-white-russian-3', 'white-russian', 3, '浮上奶油', '在酒液表面缓慢倒入奶油形成分层效果', 20, strftime('%s', 'now'));

-- ============================================
-- 5. 初始化用户偏好 (User Preferences)
-- ============================================
INSERT OR IGNORE INTO user_preferences VALUES (
    'default',
    'zh',
    'system',
    'metric',
    NULL,
    NULL,
    strftime('%s', 'now'),
    strftime('%s', 'now')
);
