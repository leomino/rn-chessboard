import { createRef } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Chess } from 'chess.js';
import ChessBoard, { type ChessBoardRef } from '../index';
import { useChessStore } from '../store/chessStore';

jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  View: 'View',
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: 'GestureHandlerRootView',
  GestureDetector: 'GestureDetector',
  Gesture: { Tap: () => ({ onStart: jest.fn() }) },
}));
jest.mock('react-native-reanimated', () => ({ runOnJS: jest.fn() }));
jest.mock('../Constants', () => ({ SQUARE_SIZE: 40, toSquare: jest.fn() }));
jest.mock('../components/Background', () => 'Background');
jest.mock('../components/Piece', () => 'Piece');
jest.mock('../components/PromotionModal', () => 'PromotionModal');
jest.mock('../components/SquareHighlights', () => 'SquareHighlights');

let renderer: ReactTestRenderer;

beforeEach(() => {
  useChessStore.setState({
    chess: new Chess(),
    selectedSquare: null,
    orientation: 'w',
  });
});

afterEach(() => {
  act(() => renderer.unmount());
});

it('exposes board rotation through the ref without resetting it on a move', async () => {
  const ref = createRef<ChessBoardRef>();
  act(() => {
    renderer = create(<ChessBoard ref={ref} initialOrientation="w" />);
  });
  act(() => ref.current?.setOrientation('b'));
  await act(async () => {
    await useChessStore.getState().move('e2', 'e4');
  });

  expect(useChessStore.getState().orientation).toBe('b');
  expect(useChessStore.getState().chess.history()).toEqual(['e4']);
});

it('notifies onMove after a completed move, but not on mount or callback replacement', async () => {
  const onMove = jest.fn();
  act(() => {
    renderer = create(<ChessBoard onMove={onMove} />);
  });
  expect(onMove).not.toHaveBeenCalled();

  await act(async () => {
    await useChessStore.getState().selectSquare('e2');
    await useChessStore.getState().selectSquare('e4');
  });
  expect(onMove).toHaveBeenCalledTimes(1);
  expect(onMove).toHaveBeenCalledWith(
    expect.objectContaining({ from: 'e2', to: 'e4', san: 'e4' })
  );

  const replacement = jest.fn();
  act(() => {
    renderer.update(<ChessBoard onMove={replacement} />);
  });
  expect(replacement).not.toHaveBeenCalled();
  await act(async () => {
    await useChessStore.getState().move('e7', 'e5');
  });
  expect(replacement).toHaveBeenCalledTimes(1);
  expect(onMove).toHaveBeenCalledTimes(1);
});
