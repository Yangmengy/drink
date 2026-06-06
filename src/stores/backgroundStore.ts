import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type BackgroundType = 'preset' | 'custom';

export interface BackgroundState {
  type: BackgroundType;
  preset?: string;
  customImage?: string;
  setPresetBackground: (preset: string) => void;
  setCustomBackground: (imageData: string) => void;
  resetBackground: () => void;
}

// 内置纯色背景预设
export const PRESET_BACKGROUNDS = [
  { id: 'default', name: '默认渐变', value: 'default' },
  { id: 'mint', name: '薄荷绿', value: 'linear-gradient(165deg, #E8F5F3 0%, #D4EDE8 50%, #E0F2ED 100%)' },
  { id: 'peach', name: '蜜桃粉', value: 'linear-gradient(165deg, #FFE8E5 0%, #FFD5CF 50%, #FFE0DB 100%)' },
  { id: 'lavender', name: '薰衣草', value: 'linear-gradient(165deg, #F0E8F5 0%, #E5D9F0 50%, #EBE0F3 100%)' },
  { id: 'cream', name: '奶油白', value: 'linear-gradient(165deg, #FFF9F0 0%, #FFF5E8 50%, #FFF7EC 100%)' },
  { id: 'sky', name: '天空蓝', value: 'linear-gradient(165deg, #E3F2FD 0%, #BBDEFB 50%, #D1E7F9 100%)' },
  { id: 'rose', name: '玫瑰金', value: 'linear-gradient(165deg, #FFF0F5 0%, #FFE4EC 50%, #FFEAF2 100%)' },
  { id: 'sage', name: '鼠尾草', value: 'linear-gradient(165deg, #EDF3EE 0%, #DFE9E0 50%, #E7F0E8 100%)' },
] as const;

export const useBackgroundStore = create<BackgroundState>()(
  persist(
    (set) => ({
      type: 'preset',
      preset: 'default',
      customImage: undefined,
      
      setPresetBackground: (preset: string) => {
        set({ type: 'preset', preset, customImage: undefined });
      },
      
      setCustomBackground: (imageData: string) => {
        set({ type: 'custom', customImage: imageData, preset: undefined });
      },
      
      resetBackground: () => {
        set({ type: 'preset', preset: 'default', customImage: undefined });
      },
    }),
    {
      name: 'background-storage',
    }
  )
);
