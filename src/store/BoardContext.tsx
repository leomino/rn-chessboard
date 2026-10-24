import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import type { createChessStore } from './chessStore';
import type { createPromotionStore } from './promotionStore';

export const BoardContext = createContext<ReturnType<
  typeof createChessStore
> | null>(null);

export function useBoardStore() {
  const store = useContext(BoardContext);
  if (!store)
    throw new Error('Board components require a ChessBoard provider.');
  return store;
}

export function useChessStore<T>(
  selector: (
    state: ReturnType<ReturnType<typeof createChessStore>['getState']>
  ) => T
): T {
  return useStore(useBoardStore(), selector);
}

export function usePromotionStore<T>(
  selector: (
    state: ReturnType<ReturnType<typeof createPromotionStore>['getState']>
  ) => T
): T {
  return useStore(useBoardStore().getState().promotionStore, selector);
}
