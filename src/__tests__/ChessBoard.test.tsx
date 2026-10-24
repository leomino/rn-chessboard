import { createRef } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Chess, type Square } from 'chess.js';
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
    ...useChessStore.getInitialState(),
    chess: new Chess(),
    selectedSquare: null,
    orientation: 'w',
  });
});

it('keeps the moving piece mounted across ranks and captures', async () => {
  act(() => {
    renderer = create(<ChessBoard />);
  });
  const pawn = renderer.root.findByProps({ square: 'e2' });
  const capturedPawn = renderer.root.findByProps({ square: 'd7' });
  await act(async () => {
    await useChessStore.getState().move('e2', 'e4');
  });
  expect(renderer.root.findByProps({ square: 'e4' })).toBe(pawn);
  await act(async () => {
    await useChessStore.getState().move('d7', 'd5');
  });
  expect(renderer.root.findByProps({ square: 'd5' })).toBe(capturedPawn);
  await act(async () => {
    await useChessStore.getState().move('e4', 'd5');
  });
  expect(renderer.root.findByProps({ square: 'd5' })).toBe(pawn);
  expect(renderer.root.findAllByProps({ type: 'p' })).not.toContain(
    capturedPawn
  );
});

it.each<{ from: Square; to: Square; rookFrom: Square; rookTo: Square }>([
  { from: 'e1', to: 'g1', rookFrom: 'h1', rookTo: 'f1' },
  { from: 'e1', to: 'c1', rookFrom: 'a1', rookTo: 'd1' },
  { from: 'e8', to: 'g8', rookFrom: 'h8', rookTo: 'f8' },
  { from: 'e8', to: 'c8', rookFrom: 'a8', rookTo: 'd8' },
])(
  'keeps both pieces mounted when castling $from to $to',
  async ({ from, to, rookFrom, rookTo }) => {
    const turn = from === 'e1' ? 'w' : 'b';
    useChessStore.setState({
      chess: new Chess(`r3k2r/8/8/8/8/8/8/R3K2R ${turn} KQkq - 0 1`),
    });
    act(() => {
      renderer = create(<ChessBoard />);
    });
    const king = renderer.root.findByProps({ square: from });
    const rook = renderer.root.findByProps({ square: rookFrom });
    await act(async () => {
      await useChessStore.getState().move(from, to);
    });
    expect(renderer.root.findByProps({ square: to })).toBe(king);
    expect(renderer.root.findByProps({ square: rookTo })).toBe(rook);
  }
);

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
