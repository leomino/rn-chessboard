import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';

export type PieceIds = Readonly<Record<Square, Square>>;

export type ChessBoardHistoryMove = Readonly<{
  /** Position after this half-move. */
  index: number;
  san: string;
  moveNumber: number;
  color: Color;
}>;

export type ChessBoardSeekOptions = {
  animated?: boolean;
  /** Animation duration in milliseconds; defaults to 200. */
  duration?: number;
};

export type ChessBoardHistoryState = {
  /** Number of half-moves applied; zero is the initial position. */
  index: number;
  /** Total recorded half-moves, including moves ahead of the cursor. */
  length: number;
  moves: readonly ChessBoardHistoryMove[];
  /** Seeking may interrupt playback, but not a piece drag or pending move. */
  canSeek: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  isReviewing: boolean;
  isAnimating: boolean;
};

export type HistoryEntry = {
  from: Square;
  to: Square;
  promotion?: PieceSymbol;
  san: string;
  before: string;
  after: string;
  /** Immutable published positions: moves always clone before modifying them. */
  chessBefore: Chess;
  chessAfter: Chess;
  pieceIdsBefore: PieceIds;
  pieceIdsAfter: PieceIds;
};

export type BoardPiece = {
  id: Square;
  square: Square;
  type: PieceSymbol;
  color: Color;
};

export type PieceTransition = {
  id: Square;
  from: BoardPiece | null;
  to: BoardPiece | null;
};

export type HistoryTransition = {
  id: number;
  duration: number;
  pieces: PieceTransition[];
};

export function cloneChess(chess: Chess): Chess {
  const copy = new Chess();
  // Preserve the initial FEN, move stack, and repetition counts.
  copy.loadPgn(chess.pgn());
  return copy;
}

export function getBoardPieces(chess: Chess, ids: PieceIds): BoardPiece[] {
  return chess
    .board()
    .flatMap((row) =>
      row.flatMap((piece) =>
        piece ? [{ ...piece, id: ids[piece.square] }] : []
      )
    );
}

/** Match identities rather than squares, including captured/restored pieces. */
export function getPieceTransitions(
  before: BoardPiece[],
  after: BoardPiece[],
  interrupted: PieceTransition[] = []
): PieceTransition[] {
  const pieces = new Map<Square, PieceTransition>();
  // Keep outgoing capture victims mounted until their fade completes, and
  // preserve the currently displayed sprite when interrupting a promotion.
  for (const piece of interrupted) {
    pieces.set(piece.id, {
      id: piece.id,
      from: (piece.from ?? piece.to)!,
      to: null,
    });
  }
  for (const piece of before) {
    const visible = pieces.get(piece.id)?.from;
    pieces.set(piece.id, {
      id: piece.id,
      from: visible ? { ...piece, type: visible.type } : piece,
      to: null,
    });
  }
  for (const piece of after) {
    const existing = pieces.get(piece.id);
    if (existing) {
      existing.to = piece;
    } else {
      pieces.set(piece.id, { id: piece.id, from: null, to: piece });
    }
  }
  return [...pieces.values()];
}
