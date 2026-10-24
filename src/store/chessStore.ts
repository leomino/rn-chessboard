import {
  Chess,
  SQUARES,
  type Color,
  type Move,
  type PieceSymbol,
  type Square,
} from 'chess.js';
import { create } from 'zustand';
import { createPromotionStore } from './promotionStore';
import type {
  ChessBoardMove,
  MovableColor,
  MoveAttemptHandler,
  PlayMoveOptions,
  PlayMoveResult,
  PositionChangeEvent,
  PositionChangeSource,
} from '../types';
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
  promotionStore: ReturnType<typeof createPromotionStore>;
  interactionEnabled: boolean;
  movableColor: MovableColor;
  onMoveAttempt?: MoveAttemptHandler;
  positionEvent: PositionChangeEvent | null;
  programmaticPending: boolean;
  configureInteraction: (
    enabled: boolean,
    color: MovableColor,
    attempt?: MoveAttemptHandler
  ) => void;
  loadFen: (fen: string) => void;
  getFen: () => string;
  playMove: (
    move: string | ChessBoardMove,
    options?: PlayMoveOptions
  ) => Promise<PlayMoveResult>;
  activate: () => void;
  dispose: () => void;
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
  clearUserInteraction: () => void;
};

export function canPlay(state: ChessStore): boolean {
  return (
    state.interactionEnabled &&
    (state.movableColor === 'both' ||
      state.movableColor === state.chess.turn()) &&
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
    canSeek: !state.programmaticPending && !state.movePending && !state.drag,
    canUndo:
      !state.programmaticPending &&
      !state.movePending &&
      !state.drag &&
      state.historyEntries.length > 0,
    canGoBack: idle && state.historyIndex > 0,
    canGoForward: idle && state.historyIndex < state.historyEntries.length,
    isReviewing: state.historyIndex < state.historyEntries.length,
    isAnimating: state.transition !== null,
  };
}

const initialPieceIds = (): PieceIds =>
  Object.fromEntries(SQUARES.map((square) => [square, square])) as Record<
    Square,
    Square
  >;

function parseFen(fen: string): Chess {
  if (typeof fen !== 'string' || fen.trim().split(/\s+/).length !== 6) {
    throw new Error('Expected a full six-field FEN.');
  }
  return new Chess(fen.trim());
}

// Include the en passant target even when no capture is currently possible.
const fullFen = (chess: Chess) => chess.fen({ forceEnpassantSquare: true });

export const createChessStore = (
  initialFen?: string,
  interaction: Partial<
    Pick<
      ChessStore,
      'interactionEnabled' | 'movableColor' | 'onMoveAttempt' | 'orientation'
    >
  > = {}
) =>
  create<ChessStore>()((set, get) => {
    const promotionStore = createPromotionStore();
    let nextTransitionId = 0;
    let mounted = true;
    let completion: {
      id: number;
      move: Move;
      resolve: (result: PlayMoveResult) => void;
    } | null = null;
    const settle = (animation: 'finished' | 'cancelled') => {
      const pending = completion;
      completion = null;
      pending?.resolve({ accepted: true, move: pending.move, animation });
    };
    const event = (
      chess: Chess,
      source: PositionChangeSource,
      move?: Move
    ): PositionChangeEvent => ({ fen: fullFen(chess), source, move });
    const replacePosition = (chess: Chess, source: 'load' | 'reset') => {
      if (!mounted) return;
      promotionStore.getState().cancelModal();
      settle('cancelled');
      set({
        chess,
        pieceIds: initialPieceIds(),
        historyEntries: [],
        historyMoves: [],
        historyIndex: 0,
        transition: null,
        selectedSquare: null,
        lastPlayedMove: null,
        movePending: false,
        programmaticPending: false,
        drag: null,
        positionRevision: get().positionRevision + 1,
        positionEvent: event(chess, source),
      });
    };
    const commit = (
      state: ChessStore,
      chess: Chess,
      played: Move,
      source: 'user' | 'programmatic',
      options: PlayMoveOptions = {}
    ) => {
      const pieceIds = getPieceIdsAfterMove(state.pieceIds, played);
      const transition =
        source === 'programmatic' && options.animated !== false
          ? {
              id: ++nextTransitionId,
              duration: options.duration ?? 200,
              pieces: getPieceTransitions(
                getBoardPieces(state.chess, state.pieceIds),
                getBoardPieces(chess, pieceIds)
              ),
            }
          : null;
      const result = new Promise<PlayMoveResult>((resolve) => {
        if (transition)
          completion = { id: transition.id, move: played, resolve };
        else resolve({ accepted: true, move: played, animation: 'finished' });
      });
      set({
        chess,
        pieceIds,
        historyEntries: [
          ...state.historyEntries,
          {
            from: played.from,
            to: played.to,
            promotion: played.promotion,
            san: played.san,
            before: played.before,
            after: played.after,
            chessBefore: state.chess,
            chessAfter: chess,
            pieceIdsBefore: state.pieceIds,
            pieceIdsAfter: pieceIds,
          },
        ],
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
        positionRevision: state.positionRevision + 1,
        lastPlayedMove: source === 'user' ? played : null,
        selectedSquare: null,
        movePending: false,
        drag: null,
        transition,
        programmaticPending: !!transition,
        positionEvent: event(chess, source, played),
      });
      return result;
    };
    const seekTo = (
      index: number,
      { animated = true, duration = 200 }: ChessBoardSeekOptions = {}
    ): boolean => {
      const state = get();
      if (
        !mounted ||
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
        positionEvent: event(chess, 'history'),
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
      promotionStore,
      interactionEnabled: interaction.interactionEnabled ?? true,
      movableColor: interaction.movableColor ?? 'both',
      onMoveAttempt: interaction.onMoveAttempt,
      positionEvent: null,
      programmaticPending: false,
      activate: () => {
        mounted = true;
      },
      dispose: () => {
        mounted = false;
        get().releaseInteractions();
      },
      configureInteraction: (
        interactionEnabled,
        movableColor,
        onMoveAttempt
      ) => {
        const state = get();
        if (
          state.interactionEnabled !== interactionEnabled ||
          state.movableColor !== movableColor
        ) {
          promotionStore.getState().cancelModal();
          set({
            interactionEnabled,
            movableColor,
            onMoveAttempt,
            selectedSquare: null,
            drag: null,
            movePending: false,
            positionRevision: state.positionRevision + 1,
          });
        } else set({ onMoveAttempt });
      },
      loadFen: (fen) => replacePosition(parseFen(fen), 'load'),
      getFen: () => fullFen(get().chess),
      playMove: (input, options = {}) => {
        const state = get();
        const reject = (
          reason: Extract<PlayMoveResult, { accepted: false }>['reason']
        ) => Promise.resolve<PlayMoveResult>({ accepted: false, reason });
        if (!mounted) return reject('unmounted');
        if (state.transition || state.movePending || state.drag)
          return reject('busy');
        if (state.historyIndex !== state.historyEntries.length)
          return reject('reviewing');
        if (
          options.duration !== undefined &&
          (!Number.isFinite(options.duration) || options.duration < 0)
        )
          return reject('invalid');
        let move: ChessBoardMove;
        if (typeof input === 'string') {
          if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(input))
            return reject('invalid');
          move = {
            from: input.slice(0, 2) as Square,
            to: input.slice(2, 4) as Square,
            promotion: input[4] as ChessBoardMove['promotion'],
          };
        } else {
          if (
            !input ||
            !/^[a-h][1-8]$/.test(input.from) ||
            !/^[a-h][1-8]$/.test(input.to) ||
            (input.promotion !== undefined && !/^[qrbn]$/.test(input.promotion))
          )
            return reject('invalid');
          move = input;
        }
        const chess = cloneChess(state.chess);
        let played: Move;
        try {
          played = chess.move(move);
        } catch {
          return reject('illegal');
        }
        return commit(state, chess, played, 'programmatic', options);
      },
      chess: initialFen === undefined ? new Chess() : parseFen(initialFen),
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
          !mounted ||
          !canPlay(state) ||
          expectedRevision !== state.positionRevision ||
          (state.drag &&
            (state.drag.from !== from || state.drag.revision !== revision))
        ) {
          return;
        }
        set({ movePending: true });
        try {
          if (!mounted || get().positionRevision !== expectedRevision) return;
          const chess = cloneChess(state.chess);
          const piece = chess.get(from);
          if (!piece) {
            throw new Error('No piece found at square to be moved.');
          }
          let promotion: PieceSymbol | undefined;
          if (
            piece.type === 'p' &&
            to.charAt(1) === (piece.color === 'w' ? '8' : '1') &&
            chess
              .moves({ square: from, verbose: true })
              .some((m) => m.to === to)
          ) {
            promotion = await promotionStore.getState().openModal();
            if (!promotion) return;
          }
          if (get().positionRevision !== expectedRevision) return;
          const played = chess.move({ from, to, promotion });
          try {
            if (
              get().onMoveAttempt?.(
                {
                  from,
                  to,
                  promotion: played.promotion as ChessBoardMove['promotion'],
                },
                { fen: fullFen(state.chess) }
              ) === false
            )
              return;
          } catch {
            return;
          }
          // Host callbacks may synchronously load/reset the board.
          if (!mounted || get().positionRevision !== expectedRevision) return;
          commit(get(), chess, played, 'user');
        } finally {
          if (get().positionRevision === expectedRevision) {
            set({
              movePending: false,
              drag: null,
              selectedSquare: null,
              positionRevision: expectedRevision + 1,
            });
          }
        }
      },
      selectedSquare: null,
      selectSquare: async (square, revision) => {
        const state = get();
        if (
          !mounted ||
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
          mounted &&
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
            chess
              .moves({ square: from, verbose: true })
              .some((m) => m.to === to)
          ) {
            await move(from, to, revision);
          }
        } finally {
          if (get().drag === drag) {
            set({ drag: null, selectedSquare: to === from ? from : null });
          }
        }
      },
      orientation: interaction.orientation ?? 'w',
      setOrientation: (orientation) => {
        const state = get();
        if (!mounted || orientation === state.orientation) return;
        settle('finished');
        set({
          programmaticPending: false,
          orientation,
          transition: null,
          drag: null,
          selectedSquare: null,
          // A pending promotion still belongs to the same logical position.
          positionRevision:
            state.positionRevision + (state.movePending ? 0 : 1),
        });
      },
      goBack: () =>
        selectHistoryState(get()).canGoBack && seekTo(get().historyIndex - 1),
      goForward: () =>
        selectHistoryState(get()).canGoForward &&
        seekTo(get().historyIndex + 1),
      seekTo,
      undo: () => {
        const state = get();
        if (!mounted || !selectHistoryState(state).canUndo) return false;
        const entry = state.historyEntries.at(-1)!;
        const chess = entry.chessBefore;
        const pieceIds = entry.pieceIdsBefore;
        set({
          chess,
          positionEvent: event(chess, 'undo'),
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
      reset: () => replacePosition(new Chess(), 'reset'),
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

        if (!mounted) return;
        promotionStore.getState().cancelModal();
        settle('cancelled');
        set({
          chess,
          programmaticPending: false,
          positionEvent: event(chess, 'load'),
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
        if (!mounted || get().transition?.id !== id) return;
        // Resolve before notifying: a subscriber can synchronously start a new move.
        if (completion?.id === id) settle('finished');
        set({ transition: null, programmaticPending: false });
      },
      releaseInteractions: () => {
        promotionStore.getState().cancelModal();
        settle('cancelled');
        set({
          programmaticPending: false,
          transition: null,
          drag: null,
          selectedSquare: null,
          movePending: false,
          positionRevision: get().positionRevision + 1,
        });
      },
      clearUserInteraction: () => {
        promotionStore.getState().cancelModal();
        set({
          drag: null,
          selectedSquare: null,
          movePending: false,
          positionRevision: get().positionRevision + 1,
        });
      },
    };
  });
