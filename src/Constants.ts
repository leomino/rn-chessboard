import { type Color, type PieceSymbol, type Square } from 'chess.js';
import { clamp } from 'react-native-reanimated';
import { Dimensions } from 'react-native';
import { type ImageSourcePropType } from 'react-native/Libraries/Image/Image';
import { createContext } from 'react';

type ChessPiece = `${PieceSymbol}${Color}`;
export const SQUARE_SIZE = clamp(
  Math.floor(Dimensions.get('window').width / 8),
  10,
  72
);
export const pieces: Record<ChessPiece, ImageSourcePropType> = {
  kw: require('./assets/images/kingwhite.png'),
  qw: require('./assets/images/queenwhite.png'),
  bw: require('./assets/images/bishopwhite.png'),
  nw: require('./assets/images/knightwhite.png'),
  pw: require('./assets/images/pawnwhite.png'),
  rw: require('./assets/images/rookwhite.png'),
  kb: require('./assets/images/kingblack.png'),
  qb: require('./assets/images/queenblack.png'),
  bb: require('./assets/images/bishopblack.png'),
  nb: require('./assets/images/knightblack.png'),
  pb: require('./assets/images/pawnblack.png'),
  rb: require('./assets/images/rookblack.png'),
};

export const PromotionModalContext = createContext<() => Promise<PieceSymbol>>(
  () => new Promise<PieceSymbol>(() => {})
);

export const isValidSquare = (value: string): value is Square => {
  'worklet';
  const regex = /^[a-h][1-8]$/;
  return regex.test(value);
};

export const toSquare = (
  { x, y }: { x: number; y: number },
  orientation: Color
): Square => {
  'worklet';
  const file = clamp(Math.floor(x / SQUARE_SIZE), 0, 7);
  const rank = clamp(Math.floor(y / SQUARE_SIZE), 0, 7);
  const square = `${String.fromCharCode(orientation === 'w' ? 97 + file : 104 - file)}${orientation === 'w' ? 8 - rank : 1 + rank}`;
  if (!isValidSquare(square)) {
    throw new Error('Invalid square after coordinate translation.');
  }
  return square;
};

export const toCoordinates = (
  square: Square,
  orientation: Color
): { x: number; y: number } => {
  'worklet';
  const fileIndex =
    orientation === 'w'
      ? square.charCodeAt(0) - 97
      : 104 - square.charCodeAt(0);
  const rankIndex =
    orientation === 'w' ? 8 - +square.charAt(1) : +square.charAt(1) - 1;
  const x = clamp(fileIndex * SQUARE_SIZE, 0, SQUARE_SIZE * 8);
  const y = clamp(rankIndex * SQUARE_SIZE, 0, SQUARE_SIZE * 8);
  return { x, y };
};
