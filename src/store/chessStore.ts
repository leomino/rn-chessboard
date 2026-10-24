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
  getPieceIdsAfterMove,
  getPieceTransitions,
  type ChessBoardHistoryState,
  type ChessBoardHistoryMove,
  type ChessBoardSeekOptions,
  type HistoryEntry,
  type HistoryTransition,
  type PieceIds,
} from '../utils/history';

type Drag = { from: Square; revision: number };

type ChessStore = {
  chess: Chess;
  pieceIds: PieceIds;
  historyEntries: readonly HistoryEntry[];
  historyMoves: readonly ChessBoardHistoryMove[];
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
  seekTo: (index: number, options?: ChessBoardSeekOptions) => boolean;
  undo: () => boolean;
  reset: () => void;
  loadPgn: (pgn: string) => void;
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
    moves: state.historyMoves,
    canSeek: !state.movePending && !state.drag,
    canUndo:
      !state.movePending && !state.drag && state.historyEntries.length > 0,
    canGoBack: idle && state.historyIndex > 0,
    canGoForward: idle && state.historyIndex < state.historyEntries.length,
    isReviewing: state.historyIndex < state.historyEntries.length,
    isAnimating: state.transition !== null,
  };
}

// IDs remain unique even when a board unmounts or the store is reset.
let nextTransitionId = 0;

const initialPieceIds = (): PieceIds =>
  Object.fromEntries(SQUARES.map((square) => [square, square])) as Record<
    Square,
    Square
  >;

export const useChessStore = create<ChessStore>()((set, get) => {
  const seekTo = (
    index: number,
    { animated = true, duration = 200 }: ChessBoardSeekOptions = {}
  ): boolean => {
    const state = get();
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index > state.historyEntries.length ||
      (animated && (!Number.isFinite(duration) || duration < 0)) ||
      !selectHistoryState(state).canSeek
    ) {
      return false;
    }
    if (index === state.historyIndex) {
      if ((state.transition && !animated) || state.selectedSquare) {
        set({
          transition: animated ? state.transition : null,
          selectedSquare: null,
          positionRevision: state.positionRevision + 1,
        });
      }
      return true;
    }
    // Reuse the position already produced when this move was played. Replaying
    // PGN on every scroll event scales with game length and blocks the JS thread.
    // These instances retain their move stacks and repetition counts; move()
    // clones them before making any changes.
    const chess =
      index === 0
        ? state.historyEntries[0]!.chessBefore
        : state.historyEntries[index - 1]!.chessAfter;
    const pieceIds =
      index === 0
        ? state.historyEntries[0]!.pieceIdsBefore
        : state.historyEntries[index - 1]!.pieceIdsAfter;
    set({
      chess,
      pieceIds,
      historyIndex: index,
      positionRevision: state.positionRevision + 1,
      selectedSquare: null,
      transition: animated
        ? {
            id: ++nextTransitionId,
            duration,
            pieces: getPieceTransitions(
              getBoardPieces(state.chess, state.pieceIds),
              getBoardPieces(chess, pieceIds),
              state.transition?.pieces
            ),
          }
        : null,
    });
    return true;
  };

  return {
    chess: new Chess(),
    // Swap square IDs along with pieces so their React identity survives a move.
    pieceIds: initialPieceIds(),
    historyEntries: [],
    historyMoves: [],
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
        const pieceIds = getPieceIdsAfterMove(state.pieceIds, played);
        const entry: HistoryEntry = {
          from,
          to,
          promotion,
          san: played.san,
          before: played.before,
          after: played.after,
          chessBefore: state.chess,
          chessAfter: chess,
          pieceIdsBefore: state.pieceIds,
          pieceIdsAfter: pieceIds,
        };
        set({
          chess,
          pieceIds,
          historyEntries: [...state.historyEntries, entry],
          historyMoves: [
            ...state.historyMoves,
            {
              index: state.historyIndex + 1,
              san: played.san,
              moveNumber: Number(played.before.split(' ')[5]),
              color: played.color,
            },
          ],
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
    goBack: () =>
      selectHistoryState(get()).canGoBack && seekTo(get().historyIndex - 1),
    goForward: () =>
      selectHistoryState(get()).canGoForward && seekTo(get().historyIndex + 1),
    seekTo,
    undo: () => {
      const state = get();
      if (!selectHistoryState(state).canUndo) return false;
      const entry = state.historyEntries.at(-1)!;
      const chess = entry.chessBefore;
      const pieceIds = entry.pieceIdsBefore;
      set({
        chess,
        pieceIds,
        historyEntries: state.historyEntries.slice(0, -1),
        historyMoves: state.historyMoves.slice(0, -1),
        historyIndex: state.historyEntries.length - 1,
        positionRevision: state.positionRevision + 1,
        selectedSquare: null,
        lastPlayedMove: null,
        transition: {
          id: ++nextTransitionId,
          duration: 200,
          pieces: getPieceTransitions(
            getBoardPieces(state.chess, state.pieceIds),
            getBoardPieces(chess, pieceIds),
            state.transition?.pieces
          ),
        },
      });
      return true;
    },
    reset: () => {
      usePromotionStore.getState().cancelModal();
      set({
        chess: new Chess(),
        pieceIds: initialPieceIds(),
        historyEntries: [],
        historyMoves: [],
        historyIndex: 0,
        transition: null,
        selectedSquare: null,
        lastPlayedMove: null,
        movePending: false,
        drag: null,
        positionRevision: get().positionRevision + 1,
      });
    },
    loadPgn: (pgn) => {
      if (!pgn.trim()) throw new Error('Paste a PGN game to import.');

      // Validate and build the entire timeline before touching the live game.
      const chess = new Chess();
      chess.loadPgn(pgn.trim());
      const moves = chess.history({ verbose: true });
      const entries: HistoryEntry[] = [];
      let pieceIds = initialPieceIds();
      for (const move of moves) {
        const nextIds = getPieceIdsAfterMove(pieceIds, move);
        entries.push({
          from: move.from,
          to: move.to,
          promotion: move.promotion,
          san: move.san,
          before: move.before,
          after: move.after,
          // Filled below with complete move stacks, not just FEN positions.
          chessBefore: chess,
          chessAfter: chess,
          pieceIdsBefore: pieceIds,
          pieceIdsAfter: nextIds,
        });
        pieceIds = nextIds;
      }
      let position = chess;
      for (let index = entries.length - 1; index >= 0; index--) {
        const entry = entries[index]!;
        entry.chessAfter = position;
        position = cloneChess(position);
        position.undo();
        entry.chessBefore = position;
      }

      usePromotionStore.getState().cancelModal();
      set({
        chess,
        pieceIds,
        historyEntries: entries,
        historyMoves: moves.map((move, index) => ({
          index: index + 1,
          san: move.san,
          moveNumber: Number(move.before.split(' ')[5]),
          color: move.color,
        })),
        historyIndex: entries.length,
        transition: null,
        selectedSquare: null,
        lastPlayedMove: null,
        movePending: false,
        drag: null,
        positionRevision: get().positionRevision + 1,
      });
    },
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
