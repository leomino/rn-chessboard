import {
  Chess,
  SQUARES,
  type Color,
  type Move,
  type PieceSymbol,
  type Square,
} from 'chess.js';
import { create } from 'zustand';
import { usePromotionStore } from './promotionStore';
import {
  cloneChess,
  getBoardPieces,
  getPieceTransitions,
  type ChessBoardHistoryState,
  type HistoryEntry,
  type HistoryTransition,
  type PieceIds,
} from '../utils/history';

type Drag = { from: Square; revision: number };

type ChessStore = {
  chess: Chess;
  pieceIds: PieceIds;
  historyEntries: readonly HistoryEntry[];
  historyIndex: number;
  transition: HistoryTransition | null;
  positionRevision: number;
  movePending: boolean;
  drag: Drag | null;
  lastPlayedMove: Move | null;
  move: (from: Square, to: Square, revision?: number) => Promise<void>;
  selectedSquare: Square | null;
  selectSquare: (square: Square, revision?: number) => Promise<void>;
  beginDrag: (from: Square, revision: number) => void;
  endDrag: (from: Square, to: Square | null, revision: number) => Promise<void>;
  orientation: Color;
  setOrientation: (value: Color) => void;
  goBack: () => boolean;
  goForward: () => boolean;
  getHistoryState: () => ChessBoardHistoryState;
  finishTransition: (id: number) => void;
  releaseInteractions: () => void;
};

export function canPlay(state: ChessStore): boolean {
  return (
    state.historyIndex === state.historyEntries.length &&
    !state.transition &&
    !state.movePending
  );
}

export function selectHistoryState(state: ChessStore): ChessBoardHistoryState {
  const idle = !state.transition && !state.movePending && !state.drag;
  return {
    index: state.historyIndex,
    length: state.historyEntries.length,
    canGoBack: idle && state.historyIndex > 0,
    canGoForward: idle && state.historyIndex < state.historyEntries.length,
    isReviewing: state.historyIndex < state.historyEntries.length,
    isAnimating: state.transition !== null,
  };
}

// IDs remain unique even when a board unmounts or the store is reset.
let nextTransitionId = 0;

export const useChessStore = create<ChessStore>()((set, get) => {
  const navigate = (direction: -1 | 1): boolean => {
    const state = get();
    const availability = selectHistoryState(state);
    if (
      direction === -1 ? !availability.canGoBack : !availability.canGoForward
    ) {
      return false;
    }
    const entry =
      state.historyEntries[
        direction === -1 ? state.historyIndex - 1 : state.historyIndex
      ]!;
    const chess = cloneChess(state.chess);
    if (direction === -1) {
      chess.undo();
    } else {
      chess.move({
        from: entry.from,
        to: entry.to,
        promotion: entry.promotion,
      });
    }
    const pieceIds =
      direction === -1 ? entry.pieceIdsBefore : entry.pieceIdsAfter;
    set({
      chess,
      pieceIds,
      historyIndex: state.historyIndex + direction,
      positionRevision: state.positionRevision + 1,
      selectedSquare: null,
      transition: {
        id: ++nextTransitionId,
        pieces: getPieceTransitions(
          getBoardPieces(state.chess, state.pieceIds),
          getBoardPieces(chess, pieceIds)
        ),
      },
    });
    return true;
  };

  return {
    chess: new Chess(),
    // Swap square IDs along with pieces so their React identity survives a move.
    pieceIds: Object.fromEntries(
      SQUARES.map((square) => [square, square])
    ) as Record<Square, Square>,
    historyEntries: [],
    historyIndex: 0,
    transition: null,
    positionRevision: 0,
    movePending: false,
    drag: null,
    lastPlayedMove: null,
    move: async (from, to, revision) => {
      const state = get();
      const expectedRevision = revision ?? state.positionRevision;
      if (
        !canPlay(state) ||
        expectedRevision !== state.positionRevision ||
        (state.drag &&
          (state.drag.from !== from || state.drag.revision !== revision))
      ) {
        return;
      }
      set({ movePending: true });
      try {
        const chess = cloneChess(state.chess);
        const piece = chess.get(from);
        if (!piece) {
          throw new Error('No piece found at square to be moved.');
        }
        let promotion: PieceSymbol | undefined;
        if (
          piece.type === 'p' &&
          to.charAt(1) === (piece.color === 'w' ? '8' : '1') &&
          chess.moves({ square: from, verbose: true }).some((m) => m.to === to)
        ) {
          promotion = await usePromotionStore.getState().openModal();
          if (!promotion) return;
        }
        if (get().positionRevision !== expectedRevision) return;
        const played = chess.move({ from, to, promotion });
        const pieceIds = { ...state.pieceIds };
        const swapIds = (source: Square, destination: Square) => {
          [pieceIds[source], pieceIds[destination]] = [
            pieceIds[destination],
            pieceIds[source],
          ];
        };
        swapIds(from, to);
        if (played.isKingsideCastle()) {
          swapIds(`h${from[1]}` as Square, `f${from[1]}` as Square);
        } else if (played.isQueensideCastle()) {
          swapIds(`a${from[1]}` as Square, `d${from[1]}` as Square);
        }
        const entry: HistoryEntry = {
          from,
          to,
          promotion,
          san: played.san,
          before: played.before,
          after: played.after,
          pieceIdsBefore: state.pieceIds,
          pieceIdsAfter: pieceIds,
        };
        set({
          chess,
          pieceIds,
          historyEntries: [...state.historyEntries, entry],
          historyIndex: state.historyIndex + 1,
          positionRevision: expectedRevision + 1,
          lastPlayedMove: played,
          selectedSquare: null,
          movePending: false,
          drag: null,
        });
      } finally {
        if (get().positionRevision === expectedRevision) {
          set({ movePending: false });
        }
      }
    },
    selectedSquare: null,
    selectSquare: async (square, revision) => {
      const state = get();
      if (
        !canPlay(state) ||
        state.drag ||
        (revision !== undefined && revision !== state.positionRevision)
      ) {
        return;
      }
      const { selectedSquare, chess, move } = state;
      if (chess.get(square)?.color === chess.turn()) {
        set({ selectedSquare: square });
        return;
      }
      if (!selectedSquare || square === selectedSquare) return;
      if (
        chess
          .moves({ verbose: true, square: selectedSquare })
          .some(({ to }) => to === square)
      ) {
        await move(selectedSquare, square, state.positionRevision);
      } else {
        set({ selectedSquare: null });
      }
    },
    beginDrag: (from, revision) => {
      const state = get();
      if (
        canPlay(state) &&
        !state.drag &&
        revision === state.positionRevision &&
        state.chess.get(from)?.color === state.chess.turn()
      ) {
        set({ drag: { from, revision }, selectedSquare: from });
      }
    },
    endDrag: async (from, to, revision) => {
      const { drag, chess, move, positionRevision } = get();
      if (!drag || drag.from !== from || drag.revision !== revision) return;
      try {
        if (
          revision === positionRevision &&
          to &&
          chess.moves({ square: from, verbose: true }).some((m) => m.to === to)
        ) {
          await move(from, to, revision);
        }
      } finally {
        if (get().drag === drag) {
          set({ drag: null, selectedSquare: to === from ? from : null });
        }
      }
    },
    orientation: 'w',
    setOrientation: (orientation) => {
      const state = get();
      if (orientation === state.orientation) return;
      set({
        orientation,
        transition: null,
        drag: null,
        selectedSquare: null,
        // A pending promotion still belongs to the same logical position.
        positionRevision: state.positionRevision + (state.movePending ? 0 : 1),
      });
    },
    goBack: () => navigate(-1),
    goForward: () => navigate(1),
    getHistoryState: () => selectHistoryState(get()),
    finishTransition: (id) => {
      if (get().transition?.id === id) set({ transition: null });
    },
    releaseInteractions: () => {
      usePromotionStore.getState().cancelModal();
      set({
        transition: null,
        drag: null,
        selectedSquare: null,
        movePending: false,
        positionRevision: get().positionRevision + 1,
      });
    },
  };
});
