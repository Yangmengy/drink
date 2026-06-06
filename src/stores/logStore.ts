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
        if (log.recipe && log.recipe.image_url) {
          try {
            const absolutePath = await invoke<string>("get_image_url", { imageName: log.recipe.image_url });
            log.recipe.image_url = convertFileSrc(absolutePath);
          } catch (e) {
            console.warn("Failed to get local image url for log:", e);
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
      await logApi.add(recipeId, dateStr, rating, notes);
      get().fetchLogs(dateStr); // Refresh logs for the added date
    } catch (err) {
      console.error("Failed to add drink log", err);
    }
  },
}));
