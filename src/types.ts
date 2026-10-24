import type { Color, Move, Square } from 'chess.js';
import type { ChessBoardSeekOptions } from './utils/history';

export type PromotionPiece = 'q' | 'r' | 'b' | 'n';
export type ChessBoardMove = {
  from: Square;
  to: Square;
  promotion?: PromotionPiece;
};
export type MovableColor = Color | 'both';
export type MoveAttemptHandler = (
  move: Readonly<ChessBoardMove>,
  position: Readonly<{ fen: string }>
) => boolean;
export type PlayMoveOptions = ChessBoardSeekOptions;
export type PlayMoveResult =
  | { accepted: true; move: Move; animation: 'finished' | 'cancelled' }
  | {
      accepted: false;
      reason: 'illegal' | 'invalid' | 'busy' | 'reviewing' | 'unmounted';
    };
export type PositionChangeSource =
  'user' | 'programmatic' | 'history' | 'load' | 'undo' | 'reset';
export type PositionChangeEvent = Readonly<{
  /** Logical result, even while rendered pieces are still animating. */
  fen: string;
  source: PositionChangeSource;
  move?: Move;
}>;
export type SquareHighlight = { square: Square; color: string };
export type BoardArrow = { from: Square; to: Square; color: string };
