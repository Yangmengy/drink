// utils/data.js - 完整配方和原料数据
// 从原版 Tauri App 迁移的真实数据

/**
 * 配方数据
 */
export const RECIPES = [
  {
    id: 'margarita-classic',
    name_zh: '玛格丽特',
    name_en: 'Margarita',
    category: 'classic',
    description: '经典龙舌兰鸡尾酒，酸甜平衡，是全球最受欢迎的鸡尾酒之一',
    story: '传说在 1930 年代，一位酒保为他那对烈酒过敏、唯独能喝龙舌兰的初恋女友 Margarita 创作了这款酒。杯口的那圈盐边，据说象征着思念的眼泪。',
    method: '摇和法',
    glass_type: 'margarita',
    garnish: '盐边 + 青柠角',
    abv: 15.0,
    difficulty: 2,
    prep_time: 5,
    ingredients: [
      { id: 'tequila-blanco', name_zh: '龙舌兰酒', amount: 50, unit: 'ml' },
      { id: 'triple-sec', name_zh: '三倍橙酒', amount: 20, unit: 'ml' },
      { id: 'lime-juice', name_zh: '青柠汁', amount: 30, unit: 'ml' }
    ],
    steps: [
      '用青柠片湿润杯口，在盐上滚动形成盐边',
      '在摇壶中加入龙舌兰酒、三倍橙酒、青柠汁',
      '加满冰块，用力摇晃15秒',
      '滤冰倒入杯中',
      '用青柠角装饰'
    ]
  },
  {
    id: 'mojito-classic',
    name_zh: '莫吉托',
    name_en: 'Mojito',
    category: 'tropical',
    description: '古巴经典鸡尾酒，清爽薄荷风味，夏日首选',
    story: '源自古巴哈瓦那，曾是海盗和水手用于预防坏血病的饮品。大文豪海明威更是将其推向世界。',
    method: '捣和法',
    glass_type: 'highball',
    garnish: '薄荷叶 + 青柠角',
    abv: 10.0,
    difficulty: 1,
    prep_time: 5,
    ingredients: [
      { id: 'white-rum', name_zh: '白朗姆酒', amount: 50, unit: 'ml' },
      { id: 'lime-juice', name_zh: '青柠汁', amount: 20, unit: 'ml' },
      { id: 'simple-syrup', name_zh: '糖浆', amount: 15, unit: 'ml' },
      { id: 'mint-leaves', name_zh: '薄荷叶', amount: 10, unit: '片' },
      { id: 'soda-water', name_zh: '苏打水', amount: 100, unit: 'ml' }
    ],
    steps: [
      '在杯中放入薄荷叶和糖浆，轻轻捣碎释放香气',
      '加入青柠汁',
      '加满碎冰至八分满',
      '倒入白朗姆酒',
      '倒入苏打水至满杯',
      '轻轻搅拌',
      '用薄荷叶和青柠角装饰'
    ]
  },
  {
    id: 'old-fashioned',
    name_zh: '老式鸡尾酒',
    name_en: 'Old Fashioned',
    category: 'classic',
    description: '威士忌经典，简单而优雅的绅士之选',
    story: '诞生于1880年代的肯塔基州，是美国最古老的鸡尾酒之一，也是《广告狂人》Don Draper的最爱。',
    method: '调和法',
    glass_type: 'old-fashioned',
    garnish: '橙皮 + 樱桃',
    abv: 30.0,
    difficulty: 2,
    prep_time: 3,
    ingredients: [
      { id: 'bourbon', name_zh: '波本威士忌', amount: 60, unit: 'ml' },
      { id: 'simple-syrup', name_zh: '糖浆', amount: 10, unit: 'ml' },
      { id: 'bitters', name_zh: '苦精', amount: 2, unit: 'dash' }
    ],
    steps: [
      '在古典杯中加入糖浆和苦精',
      '加入冰块',
      '倒入波本威士忌',
      '轻轻搅拌30秒',
      '用橙皮在杯口挤压释放香气',
      '放入橙皮和樱桃装饰'
    ]
  },
  {
    id: 'white-russian',
    name_zh: '白俄罗斯',
    name_en: 'White Russian',
    category: 'contemporary',
    description: '奶油伏特加咖啡鸡尾酒，甜美醇厚',
    story: '因电影《大智若愚》（The Big Lebowski）而闻名，是主角 Dude 的最爱。',
    method: '调和法',
    glass_type: 'old-fashioned',
    garnish: '无',
    abv: 20.0,
    difficulty: 1,
    prep_time: 3,
    ingredients: [
      { id: 'vodka', name_zh: '伏特加', amount: 40, unit: 'ml' },
      { id: 'kahlua', name_zh: '咖啡利口酒', amount: 20, unit: 'ml' },
      { id: 'cream', name_zh: '鲜奶油', amount: 30, unit: 'ml' }
    ],
    steps: [
      '在古典杯中加入冰块',
      '倒入伏特加',
      '倒入咖啡利口酒',
      '轻轻搅拌',
      '缓慢倒入鲜奶油形成分层',
      '也可以搅匀饮用'
    ]
  },
  {
    id: 'cuba-libre',
    name_zh: '自由古巴',
    name_en: 'Cuba Libre',
    category: 'long-drink',
    description: '朗姆可乐加青柠，简单却经典',
    story: '诞生于1900年的古巴独立战争期间，"Cuba Libre"（自由古巴）是当时的革命口号。',
    method: '调和法',
    glass_type: 'highball',
    garnish: '青柠角',
    abv: 12.0,
    difficulty: 1,
    prep_time: 2,
    ingredients: [
      { id: 'white-rum', name_zh: '白朗姆酒', amount: 50, unit: 'ml' },
      { id: 'cola', name_zh: '可乐', amount: 120, unit: 'ml' },
      { id: 'lime-juice', name_zh: '青柠汁', amount: 10, unit: 'ml' }
    ],
    steps: [
      '在高球杯中加满冰块',
      '倒入白朗姆酒',
      '挤入青柠汁',
      '倒入可乐',
      '轻轻搅拌',
      '用青柠角装饰'
    ]
  },
  {
    id: 'negroni',
    name_zh: '内格罗尼',
    name_en: 'Negroni',
    category: 'classic',
    description: '苦甜平衡的意式经典，餐前开胃首选',
    story: '1919年，佛罗伦萨伯爵 Camillo Negroni 要求将美国佬鸡尾酒中的苏打水换成金酒，这款强劲的鸡尾酒由此诞生。',
    method: '调和法',
    glass_type: 'old-fashioned',
    garnish: '橙皮',
    abv: 24.0,
    difficulty: 1,
    prep_time: 3,
    ingredients: [
      { id: 'gin', name_zh: '金酒', amount: 30, unit: 'ml' },
      { id: 'campari', name_zh: '金巴利', amount: 30, unit: 'ml' },
      { id: 'sweet-vermouth', name_zh: '甜苦艾酒', amount: 30, unit: 'ml' }
    ],
    steps: [
      '在古典杯中加入大冰块',
      '倒入金酒、金巴利、甜苦艾酒',
      '轻轻搅拌15秒',
      '用橙皮在杯口挤压释放香气',
      '将橙皮放入杯中'
    ]
  }
];

/**
 * 原料数据
 */
export const INGREDIENTS = [
  // 基酒
  { id: 'tequila-blanco', name_zh: '龙舌兰酒', name_en: 'Tequila', category: 'spirits', abv: 40.0, emoji: '🍶' },
  { id: 'white-rum', name_zh: '白朗姆酒', name_en: 'White Rum', category: 'spirits', abv: 40.0, emoji: '🍶' },
  { id: 'dark-rum', name_zh: '黑朗姆酒', name_en: 'Dark Rum', category: 'spirits', abv: 40.0, emoji: '🍶' },
  { id: 'vodka', name_zh: '伏特加', name_en: 'Vodka', category: 'spirits', abv: 40.0, emoji: '🍶' },
  { id: 'gin', name_zh: '金酒', name_en: 'Gin', category: 'spirits', abv: 40.0, emoji: '🍶' },
  { id: 'bourbon', name_zh: '波本威士忌', name_en: 'Bourbon', category: 'spirits', abv: 40.0, emoji: '🥃' },
  { id: 'scotch', name_zh: '苏格兰威士忌', name_en: 'Scotch', category: 'spirits', abv: 40.0, emoji: '🥃' },
  { id: 'cognac', name_zh: '干邑', name_en: 'Cognac', category: 'spirits', abv: 40.0, emoji: '🥃' },
  
  // 利口酒
  { id: 'triple-sec', name_zh: '三倍橙酒', name_en: 'Triple Sec', category: 'liqueur', abv: 40.0, emoji: '🍊' },
  { id: 'kahlua', name_zh: '咖啡利口酒', name_en: 'Kahlua', category: 'liqueur', abv: 20.0, emoji: '☕' },
  { id: 'campari', name_zh: '金巴利', name_en: 'Campari', category: 'liqueur', abv: 25.0, emoji: '🍷' },
  { id: 'sweet-vermouth', name_zh: '甜苦艾酒', name_en: 'Sweet Vermouth', category: 'liqueur', abv: 16.0, emoji: '🍷' },
  { id: 'baileys', name_zh: '百利甜', name_en: 'Baileys', category: 'liqueur', abv: 17.0, emoji: '🥛' },
  
  // 果汁
  { id: 'lime-juice', name_zh: '青柠汁', name_en: 'Lime Juice', category: 'juice', abv: 0, emoji: '🟢' },
  { id: 'lemon-juice', name_zh: '柠檬汁', name_en: 'Lemon Juice', category: 'juice', abv: 0, emoji: '🍋' },
  { id: 'orange-juice', name_zh: '橙汁', name_en: 'Orange Juice', category: 'juice', abv: 0, emoji: '🍊' },
  { id: 'pineapple-juice', name_zh: '菠萝汁', name_en: 'Pineapple Juice', category: 'juice', abv: 0, emoji: '🍍' },
  { id: 'cranberry-juice', name_zh: '蔓越莓汁', name_en: 'Cranberry Juice', category: 'juice', abv: 0, emoji: '🔴' },
  
  // 软饮
  { id: 'soda-water', name_zh: '苏打水', name_en: 'Soda Water', category: 'mixer', abv: 0, emoji: '💧' },
  { id: 'tonic-water', name_zh: '汤力水', name_en: 'Tonic Water', category: 'mixer', abv: 0, emoji: '💧' },
  { id: 'cola', name_zh: '可乐', name_en: 'Cola', category: 'mixer', abv: 0, emoji: '🥤' },
  { id: 'ginger-ale', name_zh: '姜汁汽水', name_en: 'Ginger Ale', category: 'mixer', abv: 0, emoji: '🥤' },
  { id: 'ginger-beer', name_zh: '姜啤', name_en: 'Ginger Beer', category: 'mixer', abv: 0, emoji: '🥤' },
  
  // 糖浆
  { id: 'simple-syrup', name_zh: '糖浆', name_en: 'Simple Syrup', category: 'syrup', abv: 0, emoji: '🍯' },
  { id: 'grenadine', name_zh: '石榴糖浆', name_en: 'Grenadine', category: 'syrup', abv: 0, emoji: '🍒' },
  { id: 'honey', name_zh: '蜂蜜', name_en: 'Honey', category: 'syrup', abv: 0, emoji: '🍯' },
  
  // 装饰和香草
  { id: 'mint-leaves', name_zh: '薄荷叶', name_en: 'Mint', category: 'herb', abv: 0, emoji: '🌿' },
  { id: 'basil', name_zh: '罗勒', name_en: 'Basil', category: 'herb', abv: 0, emoji: '🌿' },
  { id: 'lime-wedge', name_zh: '青柠角', name_en: 'Lime Wedge', category: 'garnish', abv: 0, emoji: '🟢' },
  { id: 'lemon-peel', name_zh: '柠檬皮', name_en: 'Lemon Peel', category: 'garnish', abv: 0, emoji: '🍋' },
  { id: 'orange-peel', name_zh: '橙皮', name_en: 'Orange Peel', category: 'garnish', abv: 0, emoji: '🍊' },
  { id: 'cherry', name_zh: '樱桃', name_en: 'Cherry', category: 'garnish', abv: 0, emoji: '🍒' },
  { id: 'olive', name_zh: '橄榄', name_en: 'Olive', category: 'garnish', abv: 0, emoji: '🫒' },
  
  // 其他
  { id: 'cream', name_zh: '鲜奶油', name_en: 'Cream', category: 'dairy', abv: 0, emoji: '🥛' },
  { id: 'milk', name_zh: '牛奶', name_en: 'Milk', category: 'dairy', abv: 0, emoji: '🥛' },
  { id: 'egg-white', name_zh: '蛋白', name_en: 'Egg White', category: 'other', abv: 0, emoji: '🥚' },
  { id: 'bitters', name_zh: '苦精', name_en: 'Bitters', category: 'other', abv: 45.0, emoji: '💧' },
  { id: 'salt', name_zh: '盐', name_en: 'Salt', category: 'other', abv: 0, emoji: '🧂' },
  { id: 'sugar', name_zh: '白砂糖', name_en: 'Sugar', category: 'other', abv: 0, emoji: '🧂' },
  { id: 'ice', name_zh: '冰块', name_en: 'Ice', category: 'ice', abv: 0, emoji: '🧊' }
];

/**
 * 分类数据
 */
export const CATEGORIES = [
  { id: 'all', name: '全部' },
  { id: 'classic', name: '经典' },
  { id: 'tropical', name: '热带' },
  { id: 'contemporary', name: '现代' },
  { id: 'long-drink', name: '长饮' },
  { id: 'short-drink', name: '短饮' }
];

/**
 * 原料分类
 */
export const INGREDIENT_CATEGORIES = [
  { id: 'all', name: '全部' },
  { id: 'spirits', name: '基酒' },
  { id: 'liqueur', name: '利口酒' },
  { id: 'juice', name: '果汁' },
  { id: 'mixer', name: '软饮' },
  { id: 'syrup', name: '糖浆' },
  { id: 'herb', name: '香草' },
  { id: 'garnish', name: '装饰' },
  { id: 'dairy', name: '乳制品' },
  { id: 'ice', name: '冰块' },
  { id: 'other', name: '其他' }
];
