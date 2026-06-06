import { create } from "zustand";
import { logApi } from "../api/client";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import type { DrinkLog } from "../types";

interface LogState {
  logs: DrinkLog[];
  loading: boolean;
  error: string | null;
  fetchLogs: (dateStr?: string) => Promise<void>;
  addLog: (recipeId: string, dateStr: string, rating: number | null, notes: string | null) => Promise<void>;
  deleteLog: (logId: string) => Promise<void>;
}

export const useLogStore = create<LogState>((set, get) => ({
  logs: [],
  loading: false,
  error: null,

  fetchLogs: async (dateStr?: string) => {
    set({ loading: true, error: null });
    try {
      const dbLogs = await logApi.list(dateStr);
      
      const logs = await Promise.all(dbLogs.map(async (log) => {
        // 转换菜谱封面
        if (log.recipe && log.recipe.image_url) {
          try {
            const absolutePath = await invoke<string>("get_image_url", { imageName: log.recipe.image_url });
            log.recipe.image_url = convertFileSrc(absolutePath);
          } catch (e) {
            console.warn("Failed to get local image url for log recipe:", e);
          }
        }
        
        // 转换日志的多图
        if (log.images) {
          try {
            const imageNames: string[] = JSON.parse(log.images);
            const imageUrls = await Promise.all(imageNames.map(async (name) => {
              // 已经是 tauri 协议或者 base64 的，直接返回
              if (name.startsWith('asset://') || name.startsWith('data:image')) {
                return name;
              }
              const absolutePath = await invoke<string>("get_image_url", { imageName: name });
              return convertFileSrc(absolutePath);
            }));
            log.images = JSON.stringify(imageUrls);
          } catch (e) {
            console.warn("Failed to parse or convert log images:", e);
          }
        }

        return log;
      }));

      set({ logs, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  addLog: async (recipeId: string, dateStr: string, rating: number | null, notes: string | null) => {
    try {
      await logApi.add(recipeId, dateStr, rating, notes, null);
      get().fetchLogs(dateStr); // Refresh logs for the added date
    } catch (err) {
      console.error("Failed to add drink log", err);
    }
  },

  deleteLog: async (logId: string) => {
    try {
      await logApi.delete(logId);
      // Remove it from current state immediately for snappy UI
      set((state) => ({ logs: state.logs.filter(l => l.id !== logId) }));
    } catch (err) {
      console.error("Failed to delete drink log", err);
    }
  },
}));
