import { createRef } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Chess, type Square } from 'chess.js';
import { cancelAnimation, withTiming } from 'react-native-reanimated';
import ChessBoard, { type ChessBoardRef } from '../index';
import { useChessStore } from '../store/chessStore';
import { usePromotionStore } from '../store/promotionStore';

jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  View: 'View',
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: 'GestureHandlerRootView',
  GestureDetector: 'GestureDetector',
  Gesture: {
    Tap: () => ({
      enabled: jest.fn().mockReturnThis(),
      onStart: jest.fn().mockReturnThis(),
    }),
  },
}));
jest.mock('react-native-reanimated', () => ({
  runOnJS: (callback: (...args: unknown[]) => unknown) => callback,
  cancelAnimation: jest.fn(),
  ReduceMotion: { System: 'system' },
  withTiming: jest.fn(() => 0),
  useSharedValue: function useSharedValue(value: unknown) {
    return jest.requireActual('react').useRef({ value }).current;
  },
  useAnimatedReaction: function useAnimatedReaction(
    prepare: () => number | null,
    react: (current: number | null, previous: number | null) => void
  ) {
    const { useEffect, useRef } = jest.requireActual('react');
    const previous = useRef(null);
    const current = prepare();
    useEffect(() => {
      react(current, previous.current);
      previous.current = current;
    }, [current, react]);
  },
}));
jest.mock('../Constants', () => ({ SQUARE_SIZE: 40, toSquare: jest.fn() }));
jest.mock('../components/Background', () => 'Background');
jest.mock('../components/Piece', () => 'Piece');
jest.mock('../components/PromotionModal', () => 'PromotionModal');
jest.mock('../components/SquareHighlights', () => 'SquareHighlights');

let renderer: ReactTestRenderer;

beforeEach(() => {
  jest.clearAllMocks();
  useChessStore.setState({
    ...useChessStore.getInitialState(),
    chess: new Chess(),
    selectedSquare: null,
    orientation: 'w',
  });
});

function completeAnimation() {
  const complete = jest.mocked(withTiming).mock.calls.at(-1)![2]!;
  act(() => complete(true));
}

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

it('exposes navigation state and reports new moves once even when React batches them', async () => {
  const ref = createRef<ChessBoardRef>();
  const onMove = jest.fn();
  const onHistoryChange = jest.fn();
  act(() => {
    renderer = create(
      <ChessBoard ref={ref} onMove={onMove} onHistoryChange={onHistoryChange} />
    );
  });
  expect(onHistoryChange).toHaveBeenLastCalledWith({
    index: 0,
    length: 0,
    canGoBack: false,
    canGoForward: false,
    isReviewing: false,
    isAnimating: false,
  });
  expect(ref.current?.goBack()).toBe(false);
  expect(ref.current?.goForward()).toBe(false);
  await act(async () => {
    await useChessStore.getState().move('e2', 'e4');
    await useChessStore.getState().move('e7', 'e5');
  });
  expect(onMove.mock.calls.map(([move]) => move.san)).toEqual(['e4', 'e5']);
  act(() => {
    expect(ref.current?.goBack()).toBe(true);
    expect(ref.current?.goBack()).toBe(false);
  });
  expect(onHistoryChange).toHaveBeenLastCalledWith({
    index: 1,
    length: 2,
    canGoBack: false,
    canGoForward: false,
    isReviewing: true,
    isAnimating: true,
  });
  expect(withTiming).toHaveBeenLastCalledWith(
    1,
    { duration: 200, reduceMotion: 'system' },
    expect.any(Function)
  );
  completeAnimation();
  expect(ref.current?.getHistoryState()).toMatchObject({
    index: 1,
    canGoBack: true,
    canGoForward: true,
    isAnimating: false,
  });
  act(() => {
    ref.current?.goForward();
  });
  completeAnimation();
  expect(onMove).toHaveBeenCalledTimes(2);
  expect(onHistoryChange).toHaveBeenLastCalledWith(
    ref.current?.getHistoryState()
  );
  await act(async () => {
    await useChessStore.getState().move('g1', 'f3');
  });
  expect(onMove).toHaveBeenCalledTimes(3);
});

it('keeps the moving piece mounted and renders a capture victim until playback completes', async () => {
  act(() => {
    renderer = create(<ChessBoard />);
  });
  await act(async () => {
    await useChessStore.getState().move('e2', 'e4');
    await useChessStore.getState().move('d7', 'd5');
    await useChessStore.getState().move('e4', 'd5');
  });
  const attacker = renderer.root.findByProps({ square: 'd5' });
  act(() => {
    useChessStore.getState().goBack();
  });
  expect(renderer.root.findByProps({ square: 'e4' })).toBe(attacker);
  const victim = renderer.root.findByProps({ square: 'd5', color: 'b' });
  expect(victim.props.playback.piece.from).toBeNull();
  completeAnimation();
  act(() => {
    useChessStore.getState().goForward();
  });
  expect(renderer.root.findByProps({ square: 'd5', color: 'w' })).toBe(
    attacker
  );
  expect(renderer.root.findByProps({ square: 'd5', color: 'b' })).toBe(victim);
  expect(victim.props.playback.piece.to).toBeNull();
  completeAnimation();
  expect(
    renderer.root.findAllByProps({ square: 'd5', color: 'b' })
  ).toHaveLength(0);
});

it('animates both castling pieces on the same clock without remounting them', async () => {
  useChessStore.setState({
    chess: new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'),
  });
  act(() => {
    renderer = create(<ChessBoard />);
  });
  await act(async () => {
    await useChessStore.getState().move('e1', 'g1');
  });
  const king = renderer.root.findByProps({ square: 'g1' });
  const rook = renderer.root.findByProps({ square: 'f1' });
  act(() => {
    useChessStore.getState().goBack();
  });
  expect(renderer.root.findByProps({ square: 'e1' })).toBe(king);
  expect(renderer.root.findByProps({ square: 'h1' })).toBe(rook);
  expect(king.props.playback.clock).toBe(rook.props.playback.clock);
  expect(withTiming).toHaveBeenCalledTimes(1);
  completeAnimation();
});

it('settles an interrupted animation and ignores its callback after a new step starts', async () => {
  const ref = createRef<ChessBoardRef>();
  act(() => {
    renderer = create(<ChessBoard ref={ref} />);
  });
  await act(async () => {
    await useChessStore.getState().move('e2', 'e4');
  });
  act(() => {
    ref.current?.goBack();
  });
  const staleCompletion = jest.mocked(withTiming).mock.calls.at(-1)![2]!;
  act(() => {
    ref.current?.setOrientation('b');
  });
  expect(cancelAnimation).toHaveBeenCalled();
  expect(ref.current?.getHistoryState().isAnimating).toBe(false);
  act(() => {
    ref.current?.goForward();
  });
  act(() => staleCompletion(true));
  expect(ref.current?.getHistoryState().isAnimating).toBe(true);
  completeAnimation();
});

it('releases an animation on unmount and remounts at its target position', async () => {
  act(() => {
    renderer = create(<ChessBoard />);
  });
  await act(async () => {
    await useChessStore.getState().move('e2', 'e4');
  });
  act(() => {
    useChessStore.getState().goBack();
  });
  const staleCompletion = jest.mocked(withTiming).mock.calls.at(-1)![2]!;
  act(() => renderer.unmount());
  expect(useChessStore.getState().transition).toBeNull();
  expect(useChessStore.getState().chess.history()).toEqual([]);
  const ref = createRef<ChessBoardRef>();
  act(() => {
    renderer = create(<ChessBoard ref={ref} />);
  });
  act(() => {
    ref.current?.goForward();
  });
  act(() => staleCompletion(true));
  expect(ref.current?.getHistoryState().isAnimating).toBe(true);
  completeAnimation();
  expect(useChessStore.getState().chess.history()).toEqual(['e4']);
});

it('emits a promotion move only after selection and keeps replay silent', async () => {
  useChessStore.setState({ chess: new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1') });
  const onMove = jest.fn();
  act(() => {
    renderer = create(<ChessBoard onMove={onMove} />);
  });
  let pending: Promise<void>;
  act(() => {
    pending = useChessStore.getState().move('a7', 'a8');
  });
  expect(onMove).not.toHaveBeenCalled();
  await act(async () => {
    usePromotionStore.getState().closeModal('n');
    await pending;
  });
  expect(onMove).toHaveBeenCalledTimes(1);
  expect(onMove).toHaveBeenCalledWith(
    expect.objectContaining({ promotion: 'n' })
  );
  act(() => {
    useChessStore.getState().goBack();
  });
  completeAnimation();
  act(() => {
    useChessStore.getState().goForward();
  });
  completeAnimation();
  expect(onMove).toHaveBeenCalledTimes(1);
});
