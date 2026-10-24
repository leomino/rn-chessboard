import { type Color, type PieceSymbol, type Square } from 'chess.js';
import { clamp } from 'react-native-reanimated';
import { type ImageSourcePropType } from 'react-native';
import { createContext, useContext } from 'react';

type ChessPiece = `${PieceSymbol}${Color}`;
export const SQUARE_SIZE = 40;
export const SquareSizeContext = createContext(SQUARE_SIZE);
export const useSquareSize = () => useContext(SquareSizeContext);
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

export const isValidSquare = (value: string): value is Square => {
  'worklet';
  const regex = /^[a-h][1-8]$/;
  return regex.test(value);
};

export const toSquare = (
  { x, y }: { x: number; y: number },
  orientation: Color,
  squareSize = SQUARE_SIZE
): Square => {
  'worklet';
  const file = clamp(Math.floor(x / squareSize), 0, 7);
  const rank = clamp(Math.floor(y / squareSize), 0, 7);
  const square = `${String.fromCharCode(orientation === 'w' ? 97 + file : 104 - file)}${orientation === 'w' ? 8 - rank : 1 + rank}`;
  if (!isValidSquare(square)) {
    throw new Error('Invalid square after coordinate translation.');
  }
  return square;
};

export const toCoordinates = (
  square: Square,
  orientation: Color,
  squareSize = SQUARE_SIZE
): { x: number; y: number } => {
  'worklet';
  const fileIndex =
    orientation === 'w'
      ? square.charCodeAt(0) - 97
      : 104 - square.charCodeAt(0);
  const rankIndex =
    orientation === 'w' ? 8 - +square.charAt(1) : +square.charAt(1) - 1;
  const x = clamp(fileIndex * squareSize, 0, squareSize * 8);
  const y = clamp(rankIndex * squareSize, 0, squareSize * 8);
  return { x, y };
};
