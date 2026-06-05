import { create } from "zustand";
import type { InventoryItem } from "../types";
import { inventoryApi } from "../api/client";

interface InventoryState {
  items: InventoryItem[];
  loading: boolean;
  error: string | null;
  fetchInventory: () => Promise<void>;
  addItem: (ingredientId: string) => Promise<void>;
  removeItem: (ingredientId: string) => Promise<void>;
}

export const useInventoryStore = create<InventoryState>((set) => ({
  items: [],
  loading: false,
  error: null,

  fetchInventory: async () => {
    set({ loading: true, error: null });
    try {
      const items = await inventoryApi.list();
      set({ items, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  addItem: async (ingredientId: string) => {
    try {
      await inventoryApi.add(ingredientId);
      const items = await inventoryApi.list();
      set({ items });
    } catch (err) {
      set({ error: String(err) });
    }
  },

  removeItem: async (ingredientId: string) => {
    try {
      await inventoryApi.remove(ingredientId);
      const items = await inventoryApi.list();
      set({ items });
    } catch (err) {
      set({ error: String(err) });
    }
  },
}));
