import { type PieceSymbol } from 'chess.js';
import { create } from 'zustand/index';
import { devtools } from 'zustand/middleware';

type PromotionStore = {
  modalOpen: boolean;
  modalResolver: ((value: PieceSymbol) => void) | null;
  openModal: () => Promise<PieceSymbol>;
  closeModal: (selection: PieceSymbol) => void;
};

export const usePromotionStore = create<PromotionStore>()(
  devtools((set, get) => ({
    modalOpen: false,
    modalResolver: null,
    openModal: () =>
      new Promise((resolve) => {
        set({ modalOpen: true, modalResolver: resolve });
      }),
    closeModal: (selection) => {
      const resolver = get().modalResolver;
      if (resolver) {
        resolver(selection);
        set({ modalOpen: false, modalResolver: null });
      }
    },
  }))
);
