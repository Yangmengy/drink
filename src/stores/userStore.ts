import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserState {
  username: string;
  avatar: string | null; // This will hold the image filename returned from upload_image
  setUsername: (name: string) => void;
  setAvatar: (avatar: string) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      username: '喵星人', // 默认好听的名字
      avatar: null,
      setUsername: (name) => set({ username: name }),
      setAvatar: (avatar) => set({ avatar }),
    }),
    {
      name: 'user-storage',
    }
  )
);
