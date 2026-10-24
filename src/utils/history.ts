import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';

export type PieceIds = Readonly<Record<Square, Square>>;

export type ChessBoardHistoryState = {
  /** Number of half-moves applied; zero is the initial position. */
  index: number;
  /** Total recorded half-moves, including moves ahead of the cursor. */
  length: number;
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
  after: BoardPiece[]
): PieceTransition[] {
  const pieces = new Map<Square, PieceTransition>();
  for (const piece of before) {
    pieces.set(piece.id, { id: piece.id, from: piece, to: null });
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
