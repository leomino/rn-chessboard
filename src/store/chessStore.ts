import {
  Chess,
  SQUARES,
  type Color,
  type PieceSymbol,
  type Square,
} from 'chess.js';
import { create } from 'zustand';
import { usePromotionStore } from './promotionStore';

type ChessStore = {
  chess: Chess;
  pieceIds: Record<Square, Square>;
  move: (from: Square, to: Square) => Promise<void>;
  selectedSquare: Square | null;
  selectSquare: (square: Square) => Promise<void>;
  orientation: Color;
  setOrientation: (value: Color) => void;
};

export const useChessStore = create<ChessStore>()((set, get) => ({
  chess: new Chess(),
  // Swap square IDs along with pieces so their React identity survives a move.
  pieceIds: Object.fromEntries(
    SQUARES.map((square) => [square, square])
  ) as Record<Square, Square>,
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
    const move = chess.move({ from, to, promotion });
    const pieceIds = { ...get().pieceIds };
    const swapIds = (source: Square, destination: Square) => {
      [pieceIds[source], pieceIds[destination]] = [
        pieceIds[destination],
        pieceIds[source],
      ];
    };
    swapIds(from, to);
    if (move.isKingsideCastle()) {
      swapIds(`h${from[1]}` as Square, `f${from[1]}` as Square);
    } else if (move.isQueensideCastle()) {
      swapIds(`a${from[1]}` as Square, `d${from[1]}` as Square);
    }
    return set({ chess, pieceIds });
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
