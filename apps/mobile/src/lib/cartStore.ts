import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CartItemDto } from "@kss/shared";
import { cartApi } from "./endpoints";

export type CartStore = {
  /** The server-synced items. */
  items: CartItemDto[];
  /** Derived: number of distinct items. */
  itemCount: number;
  /** Derived: sum of lineTotalPaise across all items. */
  subtotalPaise: number;
  /** True while a server mutation is in flight. */
  loading: boolean;
  /** Last error message, if any. */
  error: string | null;

  /** Fetch the cart from the server (called on app mount). */
  fetchCart: () => Promise<void>;
  /** Add a variant. Upserts server-side (increments if already in cart). */
  addItem: (variantId: string, quantity: number) => Promise<void>;
  /** Update item quantity. */
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  /** Remove item. */
  removeItem: (itemId: string) => Promise<void>;
  /** Clear local state (on logout). */
  clear: () => void;
};

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      itemCount: 0,
      subtotalPaise: 0,
      loading: false,
      error: null,

      async fetchCart() {
        try {
          set({ loading: true, error: null });
          const cart = await cartApi.getCart();
          set({
            items: cart.items,
            itemCount: cart.itemCount,
            subtotalPaise: cart.subtotalPaise,
            loading: false,
          });
        } catch (err: any) {
          set({ loading: false, error: err?.message ?? "Couldn't load cart." });
        }
      },

      async addItem(variantId, quantity) {
        try {
          set({ loading: true, error: null });
          const cart = await cartApi.addToCart(variantId, quantity);
          set({
            items: cart.items,
            itemCount: cart.itemCount,
            subtotalPaise: cart.subtotalPaise,
            loading: false,
          });
        } catch (err: any) {
          set({ loading: false, error: err?.message ?? "Couldn't add to cart." });
        }
      },

      async updateItem(itemId, quantity) {
        try {
          set({ loading: true, error: null });
          const cart = await cartApi.updateCartItem(itemId, quantity);
          set({
            items: cart.items,
            itemCount: cart.itemCount,
            subtotalPaise: cart.subtotalPaise,
            loading: false,
          });
        } catch (err: any) {
          set({ loading: false, error: err?.message ?? "Couldn't update item." });
        }
      },

      async removeItem(itemId) {
        try {
          set({ loading: true, error: null });
          const cart = await cartApi.removeCartItem(itemId);
          set({
            items: cart.items,
            itemCount: cart.itemCount,
            subtotalPaise: cart.subtotalPaise,
            loading: false,
          });
        } catch (err: any) {
          set({ loading: false, error: err?.message ?? "Couldn't remove item." });
        }
      },

      clear() {
        set({ items: [], itemCount: 0, subtotalPaise: 0, error: null });
      },
    }),
    {
      name: "kss.cart",
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the items; the server is the source of truth for counts.
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        // After rehydration, recalculate derived values.
        if (state) {
          state.itemCount = state.items.length;
          state.subtotalPaise = state.items.reduce(
            (sum, it) => sum + (it.lineTotalPaise ?? 0),
            0,
          );
        }
      },
    },
  ),
);
