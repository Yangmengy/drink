# 设计实现指南

> 本文档指导如何将设计系统落地到代码

---

## 快速开始

### 1. 引入设计 Token

```typescript
// src/main.tsx
import './styles/design-tokens.css';
import './styles/global.css';
```

### 2. 全局样式设置

```css
/* src/styles/global.css */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body {
  font-family: var(--font-family-base);
  font-size: var(--font-size-body);
  line-height: var(--line-height-normal);
  color: var(--text-primary);
  background: var(--bg-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* iOS 安全区域 */
body {
  padding-top: var(--safe-area-top);
  padding-bottom: var(--safe-area-bottom);
  padding-left: var(--safe-area-left);
  padding-right: var(--safe-area-right);
}

/* 禁用文字选择(移动端) */
body {
  -webkit-user-select: none;
  user-select: none;
}

/* 输入框允许选择 */
input,
textarea {
  -webkit-user-select: text;
  user-select: text;
}

/* 点击高亮取消(iOS) */
* {
  -webkit-tap-highlight-color: transparent;
}

/* 滚动条隐藏(WebView) */
::-webkit-scrollbar {
  display: none;
}
```

---

## 组件实现示例

### 1. 按钮组件

```typescript
// src/components/Button.tsx

import { ReactNode } from 'react';
import styles from './Button.module.css';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

export function Button({ 
  variant = 'primary', 
  size = 'md',
  children,
  onClick,
  disabled 
}: ButtonProps) {
  return (
    <button
      className={`${styles.button} ${styles[variant]} ${styles[size]}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
```

```css
/* src/components/Button.module.css */

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-family-base);
  font-weight: var(--font-weight-semibold);
  border: none;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  white-space: nowrap;
}

.button:active {
  transform: scale(0.96);
}

.button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 主要按钮 */
.primary {
  background: var(--color-primary);
  color: white;
  box-shadow: var(--shadow-primary);
}

/* 次要按钮 */
.secondary {
  background: rgba(120, 120, 128, 0.16);
  color: var(--color-primary);
}

/* 毛玻璃按钮 */
.glass {
  composes: glass from '../styles/design-tokens.css';
  color: var(--text-primary);
}

/* 尺寸 */
.sm {
  font-size: var(--font-size-footnote);
  padding: 8px 16px;
  border-radius: var(--radius-sm);
}

.md {
  font-size: var(--font-size-body);
  padding: 14px 24px;
  border-radius: var(--radius-md);
}

.lg {
  font-size: var(--font-size-h4);
  padding: 16px 32px;
  border-radius: var(--radius-lg);
}
```


### 2. 搜索栏组件

```typescript
// src/components/SearchBar.tsx

import { Search, X } from 'lucide-react';
import { useState } from 'react';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  onClear?: () => void;
}

export function SearchBar({
  placeholder = '搜索鸡尾酒...',
  value = '',
  onChange,
  onFocus,
  onClear
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = () => {
    onChange?.('');
    onClear?.();
  };

  return (
    <div className={`${styles.searchBar} ${isFocused ? styles.focused : ''}`}>
      <Search size={20} className={styles.icon} />
      <input
        type="text"
        className={styles.input}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={() => {
          setIsFocused(true);
          onFocus?.();
        }}
        onBlur={() => setIsFocused(false)}
      />
      {value && (
        <button className={styles.clearBtn} onClick={handleClear}>
          <X size={16} />
        </button>
      )}
    </div>
  );
}
```

```css
/* src/components/SearchBar.module.css */

.searchBar {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  background: rgba(142, 142, 147, 0.12);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  transition: all var(--duration-normal) var(--ease-out);
}

.searchBar.focused {
  background: rgba(142, 142, 147, 0.18);
  transform: scale(1.01);
}

.icon {
  color: var(--text-quaternary);
  flex-shrink: 0;
}

.input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: var(--font-size-body);
  color: var(--text-primary);
  font-family: var(--font-family-base);
}

.input::placeholder {
  color: var(--text-quaternary);
}

.clearBtn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.1);
  border: none;
  border-radius: var(--radius-full);
  width: 20px;
  height: 20px;
  padding: 0;
  cursor: pointer;
  color: var(--text-quaternary);
  transition: all var(--duration-fast) var(--ease-out);
}

.clearBtn:active {
  transform: scale(0.9);
  background: rgba(0, 0, 0, 0.15);
}
```

### 3. 鸡尾酒卡片组件

```typescript
// src/components/CocktailCard.tsx

import { Heart, Flame } from 'lucide-react';
import { Recipe } from '@/types';
import styles from './CocktailCard.module.css';

interface CocktailCardProps {
  recipe: Recipe;
  isFavorite?: boolean;
  onFavoriteToggle?: () => void;
  onClick?: () => void;
}

export function CocktailCard({ 
  recipe, 
  isFavorite = false,
  onFavoriteToggle,
  onClick 
}: CocktailCardProps) {
  const difficultyStars = '🌟'.repeat(Math.min(recipe.difficulty, 5));
  
  return (
    <div className={styles.card} onClick={onClick}>
      {/* 图片区域 */}
      <div className={styles.imageWrapper}>
        {recipe.image_url ? (
          <img 
            src={recipe.image_url} 
            alt={recipe.name_zh}
            className={styles.image}
          />
        ) : (
          <div className={styles.imagePlaceholder}>
            🍸
          </div>
        )}
      </div>
      
      {/* 内容区域 */}
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.titles}>
            <h3 className={styles.titleZh}>{recipe.name_zh}</h3>
            {recipe.name_en && (
              <p className={styles.titleEn}>{recipe.name_en}</p>
            )}
          </div>
          <button 
            className={styles.favoriteBtn}
            onClick={(e) => {
              e.stopPropagation();
              onFavoriteToggle?.();
            }}
          >
            <Heart 
              size={20} 
              fill={isFavorite ? 'currentColor' : 'none'}
              className={isFavorite ? styles.favorited : ''}
            />
          </button>
        </div>
        
        {/* 标签行 */}
        <div className={styles.tags}>
          <span className={styles.tag}>
            {difficultyStars} {getDifficultyText(recipe.difficulty)}
          </span>
          {recipe.abv && (
            <span className={styles.tag}>
              <Flame size={14} /> {recipe.abv}%
            </span>
          )}
          <span className={styles.tag}>
            🏷️ {getCategoryText(recipe.category)}
          </span>
        </div>
        
        {/* 描述 */}
        {recipe.description && (
          <p className={styles.description}>
            {recipe.description}
          </p>
        )}
      </div>
    </div>
  );
}

function getDifficultyText(level: number): string {
  const map = { 1: '简单', 2: '中等', 3: '中等', 4: '困难', 5: '大师' };
  return map[level as keyof typeof map] || '中等';
}

function getCategoryText(category: string): string {
  const map: Record<string, string> = {
    classic: '经典',
    contemporary: '当代',
    tropical: '热带',
    short: '短饮',
    long: '长饮',
    mocktail: '无酒精'
  };
  return map[category] || category;
}
```

```css
/* src/components/CocktailCard.module.css */

.card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 0.5px solid rgba(255, 255, 255, 0.5);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  transition: all var(--duration-normal) var(--ease-out);
  cursor: pointer;
}

.card:active {
  transform: scale(0.98);
  box-shadow: var(--shadow-md);
}

.imageWrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: linear-gradient(135deg, var(--color-primary-light), var(--color-primary));
}

.image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.imagePlaceholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
}

.content {
  padding: var(--spacing-md);
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xs);
}

.titles {
  flex: 1;
}

.titleZh {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0;
}

.titleEn {
  font-size: var(--font-size-subhead);
  color: var(--text-secondary);
  margin: 2px 0 0 0;
}

.favoriteBtn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: var(--text-quaternary);
  transition: all var(--duration-fast) var(--ease-out);
}

.favoriteBtn:active {
  transform: scale(0.9);
}

.favoriteBtn .favorited {
  color: var(--color-error);
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-size-footnote);
  color: var(--text-secondary);
  white-space: nowrap;
}

.description {
  font-size: var(--font-size-subhead);
  color: var(--text-secondary);
  line-height: var(--line-height-normal);
  margin: 0;
  
  /* 两行截断 */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}
```


### 4. TabBar 组件

```typescript
// src/components/TabBar.tsx

import { Home, Search, Package, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './TabBar.module.css';

interface Tab {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  path: string;
}

const tabs: Tab[] = [
  { id: 'discover', label: '发现', icon: Home, path: '/' },
  { id: 'search', label: '搜索', icon: Search, path: '/search' },
  { id: 'bar', label: '酒柜', icon: Package, path: '/bar' },
  { id: 'profile', label: '我的', icon: User, path: '/profile' },
];

export function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const handleTabClick = (path: string) => {
    // 如果点击当前 Tab，滚动到顶部
    if (location.pathname === path) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate(path);
    }
  };

  return (
    <nav className={styles.tabBar}>
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path;
        const Icon = tab.icon;
        
        return (
          <button
            key={tab.id}
            className={`${styles.tabItem} ${isActive ? styles.active : ''}`}
            onClick={() => handleTabClick(tab.path)}
          >
            <Icon size={28} className={styles.icon} />
            <span className={styles.label}>{tab.label}</span>
            {isActive && <span className={styles.indicator} />}
          </button>
        );
      })}
    </nav>
  );
}
```

```css
/* src/components/TabBar.module.css */

.tabBar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background: rgba(242, 242, 247, 0.8);
  backdrop-filter: blur(30px) saturate(180%);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
  border-top: 0.5px solid rgba(0, 0, 0, 0.05);
  padding-bottom: var(--safe-area-bottom);
  height: calc(49px + var(--safe-area-bottom));
  z-index: var(--z-fixed);
}

@media (prefers-color-scheme: dark) {
  .tabBar {
    background: rgba(0, 0, 0, 0.8);
    border-top-color: rgba(255, 255, 255, 0.1);
  }
}

.tabItem {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: var(--text-quaternary);
  transition: color var(--duration-normal) var(--ease-out);
  position: relative;
}

.tabItem.active {
  color: var(--color-primary);
}

.icon {
  transition: transform var(--duration-fast) var(--ease-spring);
}

.tabItem:active .icon {
  transform: scale(0.9);
}

.label {
  font-size: 10px;
  font-weight: var(--font-weight-medium);
}

.indicator {
  position: absolute;
  bottom: -4px;
  width: 4px;
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  animation: fadeIn var(--duration-normal) var(--ease-out);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

### 5. 标签组件

```typescript
// src/components/Tag.tsx

import { ReactNode } from 'react';
import styles from './Tag.module.css';

interface TagProps {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error';
  selected?: boolean;
  onClick?: () => void;
}

export function Tag({ 
  children, 
  variant = 'default',
  selected = false,
  onClick 
}: TagProps) {
  return (
    <button
      className={`${styles.tag} ${styles[variant]} ${selected ? styles.selected : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
```

```css
/* src/components/Tag.module.css */

.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-footnote);
  font-weight: var(--font-weight-medium);
  border: none;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  white-space: nowrap;
}

.tag:active {
  transform: scale(0.96);
}

/* 默认样式 */
.default {
  background: rgba(120, 120, 128, 0.12);
  color: var(--text-secondary);
}

.default.selected {
  background: var(--color-primary);
  color: white;
  box-shadow: var(--shadow-primary);
}

/* 主色调 */
.primary {
  background: rgba(255, 149, 0, 0.15);
  color: var(--color-primary);
}

/* 成功 */
.success {
  background: rgba(52, 199, 89, 0.15);
  color: var(--color-success);
}

/* 警告 */
.warning {
  background: rgba(255, 149, 0, 0.15);
  color: var(--color-warning);
}

/* 错误 */
.error {
  background: rgba(255, 59, 48, 0.15);
  color: var(--color-error);
}
```


---

## 页面布局实现

### 1. 页面容器组件

```typescript
// src/components/PageContainer.tsx

import { ReactNode } from 'react';
import styles from './PageContainer.module.css';

interface PageContainerProps {
  children: ReactNode;
  hasTabBar?: boolean;
  className?: string;
}

export function PageContainer({ 
  children, 
  hasTabBar = true,
  className = '' 
}: PageContainerProps) {
  return (
    <div className={`${styles.container} ${hasTabBar ? styles.withTabBar : ''} ${className}`}>
      {children}
    </div>
  );
}
```

```css
/* src/components/PageContainer.module.css */

.container {
  min-height: 100vh;
  padding: var(--content-padding);
  padding-top: calc(var(--safe-area-top) + var(--content-padding));
  padding-bottom: var(--content-padding);
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.withTabBar {
  padding-bottom: calc(49px + var(--safe-area-bottom) + var(--content-padding));
}
```

### 2. 导航栏组件

```typescript
// src/components/Navbar.tsx

import { ChevronLeft, Bell, Moon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import styles from './Navbar.module.css';

interface NavbarProps {
  title: string;
  showBack?: boolean;
  showBell?: boolean;
  showTheme?: boolean;
  onThemeToggle?: () => void;
}

export function Navbar({ 
  title, 
  showBack = false,
  showBell = false,
  showTheme = false,
  onThemeToggle 
}: NavbarProps) {
  const navigate = useNavigate();

  return (
    <nav className={styles.navbar}>
      <div className={styles.left}>
        {showBack && (
          <button className={styles.backBtn} onClick={() => navigate(-1)}>
            <ChevronLeft size={28} />
          </button>
        )}
        <h1 className={styles.title}>{title}</h1>
      </div>
      
      <div className={styles.right}>
        {showBell && (
          <button className={styles.iconBtn}>
            <Bell size={24} />
            <span className={styles.badge}>2</span>
          </button>
        )}
        {showTheme && (
          <button className={styles.iconBtn} onClick={onThemeToggle}>
            <Moon size={24} />
          </button>
        )}
      </div>
    </nav>
  );
}
```

```css
/* src/components/Navbar.module.css */

.navbar {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(242, 242, 247, 0.8);
  backdrop-filter: blur(30px) saturate(180%);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
  padding: 12px var(--content-padding);
  padding-top: calc(var(--safe-area-top) + 12px);
  min-height: 44px;
  z-index: var(--z-sticky);
  margin: calc(-1 * var(--content-padding));
  margin-bottom: var(--spacing-lg);
}

@media (prefers-color-scheme: dark) {
  .navbar {
    background: rgba(0, 0, 0, 0.8);
  }
}

.left {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.backBtn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 0;
  color: var(--color-primary);
  cursor: pointer;
  transition: transform var(--duration-fast) var(--ease-out);
}

.backBtn:active {
  transform: scale(0.9);
}

.title {
  font-size: var(--font-size-h2);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0;
}

.right {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.iconBtn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 0;
  color: var(--text-primary);
  cursor: pointer;
  transition: transform var(--duration-fast) var(--ease-out);
}

.iconBtn:active {
  transform: scale(0.9);
}

.badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  background: var(--color-error);
  color: white;
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
}
```

### 3. 分节标题组件

```typescript
// src/components/SectionTitle.tsx

import styles from './SectionTitle.module.css';

interface SectionTitleProps {
  children: string;
}

export function SectionTitle({ children }: SectionTitleProps) {
  return (
    <div className={styles.section}>
      <div className={styles.line} />
      <h2 className={styles.title}>{children}</h2>
      <div className={styles.line} />
    </div>
  );
}
```

```css
/* src/components/SectionTitle.module.css */

.section {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin: var(--spacing-xl) 0 var(--spacing-lg);
}

.line {
  flex: 1;
  height: 1px;
  background: var(--divider);
}

.title {
  font-size: var(--font-size-subhead);
  font-weight: var(--font-weight-semibold);
  color: var(--text-secondary);
  margin: 0;
  white-space: nowrap;
}
```


---

## 动画效果实现

### 1. 页面切换动画

```typescript
// src/components/PageTransition.tsx

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
}

const pageVariants = {
  initial: {
    opacity: 0,
    x: '100%',
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.35,
      ease: [0.42, 0, 0.58, 1],
    },
  },
  exit: {
    opacity: 0,
    x: '-30%',
    transition: {
      duration: 0.35,
      ease: [0.42, 0, 0.58, 1],
    },
  },
};

export function PageTransition({ children }: PageTransitionProps) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}
```

### 2. 列表项动画

```typescript
// src/components/AnimatedList.tsx

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface AnimatedListProps {
  children: ReactNode[];
  staggerDelay?: number;
}

export function AnimatedList({ children, staggerDelay = 0.05 }: AnimatedListProps) {
  return (
    <>
      {children.map((child, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.25,
            delay: index * staggerDelay,
            ease: [0, 0, 0.2, 1],
          }}
        >
          {child}
        </motion.div>
      ))}
    </>
  );
}
```

### 3. 模态框动画

```typescript
// src/components/Modal.tsx

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { ReactNode } from 'react';
import styles from './Modal.module.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

export function Modal({ isOpen, onClose, children, title }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />
          
          {/* 模态框内容 */}
          <motion.div
            className={styles.modal}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              duration: 0.35,
              ease: [0.175, 0.885, 0.32, 1.275],
            }}
          >
            <div className={styles.handle} />
            
            {title && (
              <div className={styles.header}>
                <h2 className={styles.title}>{title}</h2>
                <button className={styles.closeBtn} onClick={onClose}>
                  <X size={24} />
                </button>
              </div>
            )}
            
            <div className={styles.content}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

```css
/* src/components/Modal.module.css */

.backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: var(--z-modal-backdrop);
}

.modal {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-height: 90vh;
  background: var(--bg-secondary);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  z-index: var(--z-modal);
  overflow: hidden;
  padding-bottom: var(--safe-area-bottom);
}

.handle {
  width: 36px;
  height: 5px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: var(--radius-full);
  margin: 12px auto;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--spacing-lg) var(--spacing-md);
  border-bottom: 0.5px solid var(--divider);
}

.title {
  font-size: var(--font-size-h3);
  font-weight: var(--font-weight-semibold);
  margin: 0;
}

.closeBtn {
  background: none;
  border: none;
  padding: 0;
  color: var(--text-secondary);
  cursor: pointer;
  transition: transform var(--duration-fast) var(--ease-out);
}

.closeBtn:active {
  transform: scale(0.9);
}

.content {
  padding: var(--spacing-lg);
  overflow-y: auto;
  max-height: calc(90vh - 100px);
}
```


---

## 性能优化技巧

### 1. 图片懒加载

```typescript
// src/components/LazyImage.tsx

import { useState, useEffect, useRef } from 'react';
import styles from './LazyImage.module.css';

interface LazyImageProps {
  src: string;
  alt: string;
  placeholder?: string;
  className?: string;
}

export function LazyImage({ 
  src, 
  alt, 
  placeholder = 'data:image/svg+xml,...', // Base64 占位图
  className 
}: LazyImageProps) {
  const [imageSrc, setImageSrc] = useState(placeholder);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setImageSrc(src);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '50px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [src]);

  return (
    <img
      ref={imgRef}
      src={imageSrc}
      alt={alt}
      className={`${styles.image} ${isLoaded ? styles.loaded : ''} ${className}`}
      onLoad={() => setIsLoaded(true)}
    />
  );
}
```

```css
/* src/components/LazyImage.module.css */

.image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity var(--duration-normal) var(--ease-out);
}

.image.loaded {
  opacity: 1;
}
```

### 2. 虚拟列表

```typescript
// src/components/VirtualList.tsx

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import styles from './VirtualList.module.css';

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimateSize?: number;
}

export function VirtualList<T>({ 
  items, 
  renderItem,
  estimateSize = 200 
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 5,
  });

  return (
    <div ref={parentRef} className={styles.container}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
```

```css
/* src/components/VirtualList.module.css */

.container {
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
```

### 3. 下拉刷新

```typescript
// src/components/PullToRefresh.tsx

import { useState, useRef, ReactNode } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { Loader } from 'lucide-react';
import styles from './PullToRefresh.module.css';

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
}

export function PullToRefresh({ children, onRefresh }: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 80], [0, 1]);
  const rotate = useTransform(y, [0, 80], [0, 360]);

  const handleDragEnd = async () => {
    if (y.get() > 80 && !isRefreshing) {
      setIsRefreshing(true);
      await onRefresh();
      setIsRefreshing(false);
    }
    y.set(0);
  };

  return (
    <div className={styles.container}>
      <motion.div
        className={styles.indicator}
        style={{ opacity }}
      >
        <motion.div style={{ rotate }}>
          <Loader size={24} className={styles.loader} />
        </motion.div>
      </motion.div>
      
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 100 }}
        dragElastic={0.2}
        style={{ y }}
        onDragEnd={handleDragEnd}
      >
        {children}
      </motion.div>
    </div>
  );
}
```

```css
/* src/components/PullToRefresh.module.css */

.container {
  position: relative;
  overflow: hidden;
}

.indicator {
  position: absolute;
  top: -50px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  z-index: var(--z-sticky);
}

.loader {
  color: var(--color-primary);
}
```

---

## 主题切换实现

```typescript
// src/hooks/useTheme.ts

import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'system';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme') as Theme;
    return stored || 'system';
  });

  useEffect(() => {
    const root = document.documentElement;
    
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', theme);
    }
    
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'system';
      return 'light';
    });
  };

  return { theme, setTheme, toggleTheme };
}
```

---

## 工具函数

```typescript
// src/utils/format.ts

/**
 * 格式化酒精度
 */
export function formatABV(abv: number): string {
  return `${abv.toFixed(1)}%`;
}

/**
 * 格式化用量
 */
export function formatAmount(amount: number, unit: string): string {
  if (unit === 'ml') return `${amount}ml`;
  if (unit === 'dash') return `${amount} dash`;
  if (unit === 'slice') return `${amount} 片`;
  return `${amount} ${unit}`;
}

/**
 * 获取难度文本
 */
export function getDifficultyText(level: number): string {
  const map: Record<number, string> = {
    1: '简单',
    2: '中等',
    3: '中等',
    4: '困难',
    5: '大师级',
  };
  return map[level] || '中等';
}

/**
 * 获取难度星星
 */
export function getDifficultyStars(level: number): string {
  return '🌟'.repeat(Math.min(Math.max(level, 1), 5));
}

/**
 * 格式化时间戳
 */
export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  
  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  
  return date.toLocaleDateString('zh-CN');
}
```

---

## 开发建议

### 1. 组件开发顺序
1. 先开发原子组件（Button、Tag、SearchBar）
2. 再开发卡片类组件（CocktailCard）
3. 最后开发页面级组件（Navbar、TabBar）

### 2. 样式开发规范
- 优先使用 CSS Module
- 使用设计 Token（CSS 变量）
- 避免硬编码颜色和尺寸
- 响应式优先考虑移动端

### 3. 性能优化清单
- [ ] 使用 React.memo 避免不必要的重渲染
- [ ] 使用 useMemo 缓存计算结果
- [ ] 使用 useCallback 缓存回调函数
- [ ] 图片使用 WebP 格式
- [ ] 列表使用虚拟滚动
- [ ] 懒加载非关键资源

### 4. 测试要点
- [ ] 组件在浅色/深色模式下正常显示
- [ ] 触摸交互流畅（60fps）
- [ ] 安全区域适配正确
- [ ] 长文本正确截断
- [ ] 空状态正确展示

---

*以上为调酒 App 的设计系统落地指南，配合 DESIGN-SYSTEM.md 和 DESIGN-MOCKUPS.md 使用。*
