import { type PieceSymbol } from 'chess.js';
import { create } from 'zustand';

type PromotionStore = {
  modalOpen: boolean;
  modalResolver: ((value: PieceSymbol | undefined) => void) | null;
  openModal: () => Promise<PieceSymbol | undefined>;
  closeModal: (selection: PieceSymbol) => void;
  cancelModal: () => void;
};
export const usePromotionStore = create<PromotionStore>()((set, get) => ({
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
  cancelModal: () => {
    const resolver = get().modalResolver;
    set({ modalOpen: false, modalResolver: null });
    resolver?.(undefined);
  },
}));
