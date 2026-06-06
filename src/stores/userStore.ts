import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';

interface UserState {
  username: string;
  avatar: string | null; // 存储已转换的 asset:// URL，可直接用于 <img src>
  avatarFilename: string | null; // 存储原始文件名，用于后端操作
  setUsername: (name: string) => void;
  setAvatar: (filename: string) => Promise<void>; // 传入文件名，自动转换
  loadFromProfile: (username: string, avatarFilename: string | null) => Promise<void>;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      username: '喵星人',
      avatar: null,
      avatarFilename: null,

      setUsername: (name) => set({ username: name }),

      // 接收文件名，转换为可用 URL 后存储
      setAvatar: async (filename: string) => {
        try {
          const absolutePath = await invoke<string>('get_image_url', { imageName: filename });
          const url = convertFileSrc(absolutePath);
          set({ avatar: url, avatarFilename: filename });
        } catch {
          set({ avatar: null, avatarFilename: null });
        }
      },

      // 从 profile 数据同步，头像文件名转为 URL
      loadFromProfile: async (username: string, avatarFilename: string | null) => {
        set({ username });
        if (avatarFilename) {
          try {
            const absolutePath = await invoke<string>('get_image_url', { imageName: avatarFilename });
            const url = convertFileSrc(absolutePath);
            set({ avatar: url, avatarFilename });
          } catch {
            set({ avatar: null, avatarFilename: null });
          }
        } else {
          set({ avatar: null, avatarFilename: null });
        }
      },
    }),
    {
      name: 'user-storage',
      // 只持久化文件名，URL 每次启动重新生成
      partialize: (state) => ({
        username: state.username,
        avatarFilename: state.avatarFilename,
      }),
    }
  )
);
