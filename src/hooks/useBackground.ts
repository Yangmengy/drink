import { useEffect } from 'react';
import { useBackgroundStore, PRESET_BACKGROUNDS } from '@/stores/backgroundStore';

/**
 * 应用背景设置到 body 元素
 */
export function useBackground() {
  const { type, preset, customImage } = useBackgroundStore();

  useEffect(() => {
    const body = document.body;
    
    // 清除所有背景相关属性
    body.removeAttribute('data-custom-background');
    body.removeAttribute('data-preset-background');
    body.style.removeProperty('--custom-background-image');
    body.style.removeProperty('--preset-background');

    if (type === 'custom' && customImage) {
      // 应用自定义背景图片
      body.setAttribute('data-custom-background', 'true');
      body.style.setProperty('--custom-background-image', `url(${customImage})`);
    } else if (type === 'preset' && preset && preset !== 'default') {
      // 应用预设背景
      const presetBg = PRESET_BACKGROUNDS.find(bg => bg.id === preset);
      if (presetBg) {
        body.setAttribute('data-preset-background', preset);
        body.style.setProperty('--preset-background', presetBg.value);
      }
    }
    // 如果是 default，不设置任何属性，使用默认的 CSS

  }, [type, preset, customImage]);
}
