import { create } from "zustand";
import { todoApi } from "../api/client";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import type { TodoItem } from "../types";

interface TodoState {
  todos: TodoItem[];
  loading: boolean;
  error: string | null;
  fetchTodos: () => Promise<void>;
  addTodo: (recipeId: string) => Promise<void>;
  removeTodo: (recipeId: string) => Promise<void>;
}

export const useTodoStore = create<TodoState>((set, get) => ({
  todos: [],
  loading: false,
  error: null,

  fetchTodos: async () => {
    set({ loading: true, error: null });
    try {
      const dbTodos = await todoApi.list();
      
      const todos = await Promise.all(dbTodos.map(async (todo) => {
        if (todo.recipe.image_url) {
          try {
            const absolutePath = await invoke<string>("get_image_url", { imageName: todo.recipe.image_url });
            todo.recipe.image_url = convertFileSrc(absolutePath);
          } catch (e) {
            console.warn("Failed to get local image url for todo:", e);
          }
        }
        return todo;
      }));

      set({ todos, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  addTodo: async (recipeId: string) => {
    try {
      await todoApi.add(recipeId);
      get().fetchTodos();
    } catch (err) {
      console.error("Failed to add todo", err);
    }
  },

  removeTodo: async (recipeId: string) => {
    try {
      await todoApi.remove(recipeId);
      get().fetchTodos();
    } catch (err) {
      console.error("Failed to remove todo", err);
    }
  },
}));
