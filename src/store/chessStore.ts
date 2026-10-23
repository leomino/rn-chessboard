import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';
import { create } from 'zustand';
import { usePromotionStore } from './promotionStore';

type ChessStore = {
  chess: Chess;
  move: (from: Square, to: Square) => Promise<void>;
  selectedSquare: Square | null;
  selectSquare: (square: Square) => Promise<void>;
  orientation: Color;
  setOrientation: (value: Color) => void;
};

export const useChessStore = create<ChessStore>()((set, get) => ({
  chess: new Chess(),
  move: async (from, to) => {
    const chess = new Chess();
    chess.loadPgn(get().chess.pgn());
    const piece = chess.get(from);
    if (!piece) {
      throw new Error('No piece found at square to be moved.');
    }
    let promotion: PieceSymbol | undefined;
    if (
      piece.type === 'p' &&
      to.charAt(1) === (piece.color === 'w' ? '8' : '1')
    ) {
      promotion = await usePromotionStore.getState().openModal();
    }
    chess.move({ from, to, promotion });
    return set({ chess });
  },
  selectedSquare: null,
  selectSquare: async (square) => {
    const { selectedSquare, chess, move } = get();
    if (!!chess.get(square) && chess.get(square)?.color === chess.turn()) {
      return set({ selectedSquare: square });
    }
    if (!selectedSquare || square === selectedSquare) {
      return;
    }
    const validDestinations = new Set(
      chess
        .moves({
          verbose: true,
          square: selectedSquare,
        })
        .map(({ to }) => to)
    );
    if (validDestinations.has(square)) {
      await move(selectedSquare, square);
    }
    return set({ selectedSquare: null });
  },
  orientation: 'w',
  setOrientation: (orientation) => set({ orientation }),
}));
