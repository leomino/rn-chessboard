// Legacy regression suites explicitly inject one test-owned store.
const { createChessStore } = jest.requireActual<
  typeof import('../store/chessStore')
>('../store/chessStore');
export const useChessStore = createChessStore();
export const usePromotionStore = useChessStore.getState().promotionStore;
