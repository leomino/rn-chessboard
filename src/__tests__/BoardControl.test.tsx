import { createRef } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Gesture } from 'react-native-gesture-handler';
import {
  withTiming,
  useAnimatedStyle,
  useAnimatedReaction,
} from 'react-native-reanimated';
import { View } from 'react-native';
import ChessBoard, { type ChessBoardRef, type PlayMoveResult } from '../index';
import Piece from '../components/Piece';
import { BoardContext } from '../store/BoardContext';

jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  View: 'View',
  Text: 'Text',
  Image: 'Image',
  Modal: 'Modal',
  Pressable: 'Pressable',
  useWindowDimensions: () => ({ width: 320 }),
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: 'GestureHandlerRootView',
  GestureDetector: 'GestureDetector',
  Gesture: {
    Tap: jest.fn(() => ({
      enabled: jest.fn().mockReturnThis(),
      onStart: jest.fn().mockReturnThis(),
    })),
    Pan: jest.fn(() => ({
      enabled: jest.fn().mockReturnThis(),
      minVelocity: jest.fn().mockReturnThis(),
      minDistance: jest.fn().mockReturnThis(),
      onBegin: jest.fn().mockReturnThis(),
      onStart: jest.fn().mockReturnThis(),
      onChange: jest.fn().mockReturnThis(),
      onEnd: jest.fn().mockReturnThis(),
      onFinalize: jest.fn().mockReturnThis(),
    })),
  },
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'AnimatedView' },
  clamp: (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value)),
  runOnJS: (callback: unknown) => callback,
  cancelAnimation: jest.fn(),
  Easing: { quad: 'quad', out: (easing: string) => `out-${easing}` },
  ReduceMotion: { System: 'system' },
  withTiming: jest.fn(() => 0),
  useSharedValue: function useSharedValue(value: unknown) {
    return jest.requireActual('react').useRef({ value }).current;
  },
  useDerivedValue: (update: () => unknown) => ({
    get value() {
      return update();
    },
  }),
  useAnimatedStyle: jest.fn((update: () => unknown) => update),
  useAnimatedReaction: jest.fn(function useMockReaction<T>(
    prepare: () => T,
    react: (current: T, previous: T | null) => void
  ) {
    const { useEffect, useRef } = jest.requireActual('react');
    const previous = useRef(null);
    const current = prepare();
    useEffect(() => {
      react(current, previous.current);
      previous.current = current;
    }, [current, react]);
  }),
}));

let renderer: ReactTestRenderer;
beforeEach(() => jest.clearAllMocks());
afterEach(() => act(() => renderer?.unmount()));

const fen = '7k/P7/8/8/8/8/8/7K w - - 0 23';

it('mounts independent boards, isolates callbacks and animations, and survives sibling unmount', async () => {
  const a = createRef<ChessBoardRef>();
  const b = createRef<ChessBoardRef>();
  const aChange = jest.fn();
  const bChange = jest.fn();
  act(() => {
    renderer = create(
      <>
        <ChessBoard
          key="a"
          ref={a}
          initialFen={fen}
          onPositionChange={aChange}
        />
        <ChessBoard key="b" ref={b} onPositionChange={bChange} />
      </>
    );
  });
  expect(a.current!.getFen()).toBe(fen);
  expect(b.current!.getFen()).not.toBe(fen);
  let pendingA: Promise<PlayMoveResult>;
  let pendingB: Promise<PlayMoveResult>;
  act(() => {
    pendingA = a.current!.playMove('a7a8n');
    pendingB = b.current!.playMove('e2e4');
  });
  expect(withTiming).toHaveBeenCalledTimes(2);
  const staleA = jest.mocked(withTiming).mock.calls[0]![2]!;
  const finishB = jest.mocked(withTiming).mock.calls[1]![2]!;
  expect(aChange).toHaveBeenCalledTimes(1);
  expect(bChange).toHaveBeenCalledTimes(1);
  act(() => {
    a.current!.setOrientation('b');
    a.current!.reset();
  });
  expect(a.current!.getHistoryState().length).toBe(0);
  expect(b.current!.getHistoryState()).toMatchObject({
    length: 1,
    isAnimating: true,
  });
  act(() => {
    renderer.update(
      <>
        <ChessBoard key="b" ref={b} onPositionChange={bChange} />
      </>
    );
  });
  act(() => {
    staleA(true);
    finishB(true);
  });
  await expect(pendingA!).resolves.toMatchObject({ animation: 'finished' });
  await expect(pendingB!).resolves.toMatchObject({ animation: 'finished' });
  await act(async () => {
    await b.current!.playMove('e7e5', { animated: false });
  });
  expect(bChange).toHaveBeenCalledTimes(2);
  expect(b.current!.getHistoryState().length).toBe(2);
  act(() => {
    expect(b.current!.undo()).toBe(true);
  });
  expect(b.current!.getHistoryState().length).toBe(1);
});

it('initializes once, loads repeatedly, reports each source, and reads the history cursor FEN', async () => {
  const ref = createRef<ChessBoardRef>();
  const changes = jest.fn();
  const onMove = jest.fn();
  act(() => {
    renderer = create(
      <ChessBoard
        ref={ref}
        initialFen={fen}
        onPositionChange={changes}
        onMove={onMove}
      />
    );
  });
  expect(changes).not.toHaveBeenCalled();
  act(() => {
    renderer.update(
      <ChessBoard
        ref={ref}
        initialFen="ignored after mount"
        onPositionChange={changes}
        onMove={onMove}
      />
    );
  });
  expect(ref.current!.getFen()).toBe(fen);
  await act(async () => {
    await ref.current!.playMove('a7a8n', { animated: false });
  });
  act(() => {
    ref.current!.seekTo(0, { animated: false });
  });
  expect(ref.current!.getFen()).toBe(fen);
  act(() => {
    ref.current!.undo();
    ref.current!.loadFen(fen);
    ref.current!.loadPgn('1. e4 *');
    ref.current!.reset();
  });
  expect(changes.mock.calls.map(([event]) => event.source)).toEqual([
    'programmatic',
    'history',
    'undo',
    'load',
    'load',
    'reset',
  ]);
  expect(onMove).not.toHaveBeenCalled();
  expect(() => ref.current!.loadFen('bad')).toThrow();
  expect(changes).toHaveBeenCalledTimes(6);
});

it('updates gesture enablement and allows programmatic play with interaction disabled', async () => {
  const ref = createRef<ChessBoardRef>();
  act(() => {
    renderer = create(<ChessBoard ref={ref} interactionEnabled={false} />);
  });
  expect(
    jest.mocked(Gesture.Tap).mock.results.at(-1)!.value.enabled
  ).toHaveBeenLastCalledWith(false);
  for (const result of jest.mocked(Gesture.Pan).mock.results)
    expect(result.value.enabled).toHaveBeenLastCalledWith(false);
  await act(async () => {
    await ref.current!.playMove('e2e4', { animated: false });
  });
  act(() => {
    renderer.update(
      <ChessBoard ref={ref} interactionEnabled movableColor="b" />
    );
  });
  expect(
    jest.mocked(Gesture.Tap).mock.results.at(-1)!.value.enabled
  ).toHaveBeenLastCalledWith(true);
  expect(
    jest
      .mocked(Gesture.Pan)
      .mock.results.some(
        (result) => result.value.enabled.mock.calls.at(-1)[0] === true
      )
  ).toBe(true);
});

it('rejects native tap attempts and accepts exactly one user event followed by an automatic response', async () => {
  const ref = createRef<ChessBoardRef>();
  const attempt = jest.fn(() => false);
  const onMove = jest.fn();
  const events: string[] = [];
  const onPositionChange = jest.fn((event) => {
    events.push(`${event.source}:${event.move?.san}`);
    if (event.source === 'user')
      ref.current!.playMove('e7e5', { animated: false });
  });
  act(() => {
    renderer = create(
      <ChessBoard
        ref={ref}
        onMoveAttempt={attempt}
        onMove={onMove}
        onPositionChange={onPositionChange}
      />
    );
  });
  const tap = (x: number, y: number) =>
    jest
      .mocked(Gesture.Tap)
      .mock.results.at(-1)!
      .value.onStart.mock.calls[0][0]({ x, y });
  await act(async () => {
    tap(180, 260);
    tap(180, 180);
  });
  expect(attempt).toHaveBeenCalledTimes(1);
  expect(onMove).not.toHaveBeenCalled();
  expect(ref.current!.getHistoryState().length).toBe(0);
  attempt.mockReturnValue(true);
  await act(async () => {
    tap(180, 260);
    tap(180, 180);
  });
  expect(attempt).toHaveBeenCalledTimes(2);
  expect(onMove).toHaveBeenCalledTimes(1);
  expect(events).toEqual(['user:e4', 'programmatic:e5']);
  expect(ref.current!.getHistoryState().length).toBe(2);
});

it('returns a rejected dragged piece visually to its origin', async () => {
  // Mount a single real piece with a scoped store to inspect its UI worklets.
  const { createChessStore } = jest.requireActual<
    typeof import('../store/chessStore')
  >('../store/chessStore');
  const store = createChessStore();
  const attempt = jest.fn(() => false);
  store.getState().configureInteraction(true, 'both', attempt);
  act(() => {
    renderer = create(
      <BoardContext.Provider value={store}>
        <Piece square="e2" type="p" color="w" />
      </BoardContext.Provider>
    );
  });
  const pan = jest.mocked(Gesture.Pan).mock.results[0]!.value;
  await act(async () => {
    pan.onBegin.mock.calls[0][0]();
    pan.onStart.mock.calls[0][0]({ x: 20, y: 40 });
    pan.onEnd.mock.calls[0][0]({ translationX: 0, translationY: -80 }, true);
  });
  expect(attempt).toHaveBeenCalledTimes(1);
  const style = jest.mocked(useAnimatedStyle).mock.calls.at(-2)![0];
  expect(style().transform).toEqual([
    { translateX: 160 },
    { translateY: 240 },
    { scale: 1 },
  ]);
  expect(store.getState().chess.get('e2')).toMatchObject({ type: 'p' });
  expect(useAnimatedReaction).toHaveBeenCalled();
});

it('resolves the real promotion chooser before approval and cancels it when input is disabled', async () => {
  const ref = createRef<ChessBoardRef>();
  const attempt = jest.fn(() => false);
  const onMove = jest.fn();
  act(() => {
    renderer = create(
      <ChessBoard
        ref={ref}
        initialFen={fen}
        onMoveAttempt={attempt}
        onMove={onMove}
      />
    );
  });
  const tap = (y: number) =>
    jest
      .mocked(Gesture.Tap)
      .mock.results.at(-1)!
      .value.onStart.mock.calls[0][0]({ x: 20, y });
  await act(async () => {
    tap(60);
    tap(20);
  });
  expect(attempt).not.toHaveBeenCalled();
  await act(async () => {
    renderer.root.findAllByType('Pressable' as never)[1]!.props.onPress();
  });
  expect(attempt).toHaveBeenCalledWith(
    { from: 'a7', to: 'a8', promotion: 'n' },
    { fen }
  );
  expect(onMove).not.toHaveBeenCalled();
  expect(ref.current!.getFen()).toBe(fen);
  attempt.mockReturnValue(true);
  await act(async () => {
    tap(60);
    tap(20);
  });
  await act(async () => {
    renderer.root.findAllByType('Pressable' as never)[1]!.props.onPress();
  });
  expect(onMove).toHaveBeenCalledTimes(1);
  expect(onMove).toHaveBeenCalledWith(
    expect.objectContaining({ promotion: 'n' })
  );
  expect(ref.current!.getFen().startsWith('N6k/')).toBe(true);
  act(() => ref.current!.loadFen(fen));
  await act(async () => {
    tap(60);
    tap(20);
  });
  const oldSelection = renderer.root.findAllByType('Pressable' as never)[0]!
    .props.onPress;
  await act(async () => {
    renderer.update(
      <ChessBoard
        ref={ref}
        interactionEnabled={false}
        onMoveAttempt={attempt}
        onMove={onMove}
      />
    );
  });
  await act(async () => oldSelection());
  expect(renderer.root.findAllByType('Modal' as never)).toHaveLength(0);
  expect(ref.current!.getFen()).toBe(fen);
  expect(attempt).toHaveBeenCalledTimes(2);
});

it('invalidates old gesture coordinates when resized and uses the new hitboxes', async () => {
  const ref = createRef<ChessBoardRef>();
  act(() => {
    renderer = create(<ChessBoard ref={ref} size={320} />);
  });
  const staleTap = jest.mocked(Gesture.Tap).mock.results.at(-1)!.value.onStart
    .mock.calls[0][0];
  act(() => {
    renderer.update(<ChessBoard ref={ref} size={240} />);
  });
  await act(async () => {
    staleTap({ x: 180, y: 260 });
    staleTap({ x: 180, y: 180 });
  });
  expect(ref.current!.getHistoryState().length).toBe(0);
  const tap = (y: number) =>
    jest
      .mocked(Gesture.Tap)
      .mock.results.at(-1)!
      .value.onStart.mock.calls[0][0]({ x: 135, y });
  await act(async () => {
    tap(195);
    tap(135);
  });
  expect(ref.current!.getHistoryState().moves.map((move) => move.san)).toEqual([
    'e4',
  ]);
});

it('sizes overlays and gestures reactively with the parent and orientation', () => {
  const ref = createRef<ChessBoardRef>();
  act(() => {
    renderer = create(
      <ChessBoard
        ref={ref}
        highlightedSquares={[{ square: 'e4', color: 'red' }]}
        arrows={[{ from: 'g1', to: 'f3', color: 'green' }]}
      />
    );
  });
  const root = renderer.root.findByType('GestureHandlerRootView' as never);
  act(() => root.props.onLayout({ nativeEvent: { layout: { width: 240 } } }));
  const square = renderer.root.find(
    (node) => node.type === View && node.props.style?.backgroundColor === 'red'
  );
  expect(square.props.style).toMatchObject({
    width: 30,
    height: 30,
    left: 120,
    top: 120,
    backgroundColor: 'red',
  });
  const arrow = renderer.root.find(
    (node) =>
      node.type === View && node.props.style?.transformOrigin === 'left center'
  );
  expect(arrow.props.pointerEvents).toBe('none');
  expect(arrow.props.style.width).toBeCloseTo(Math.hypot(30, 60));
  act(() => ref.current!.setOrientation('b'));
  expect(square.props.style).toMatchObject({ left: 90, top: 90 });
  act(() => {
    renderer.update(
      <ChessBoard
        ref={ref}
        size={400}
        highlightedSquares={[{ square: 'a1', color: 'blue' }]}
        arrows={[]}
      />
    );
  });
  const next = renderer.root.find(
    (node) => node.type === View && node.props.style?.backgroundColor === 'blue'
  );
  expect(next.props.style).toMatchObject({
    width: 50,
    left: 350,
    top: 0,
    backgroundColor: 'blue',
  });
  expect(
    renderer.root.findAll(
      (node) =>
        node.type === View &&
        node.props.style?.transformOrigin === 'left center'
    )
  ).toHaveLength(0);
});

it('settles pending promises on unmount without emitting late events, and remounts fresh', async () => {
  const ref = createRef<ChessBoardRef>();
  const onPositionChange = jest.fn();
  const onHistoryChange = jest.fn();
  act(() => {
    renderer = create(
      <ChessBoard
        ref={ref}
        onPositionChange={onPositionChange}
        onHistoryChange={onHistoryChange}
      />
    );
  });
  const handle = ref.current!;
  let pending: Promise<PlayMoveResult>;
  act(() => {
    pending = handle.playMove('e2e4');
  });
  const finish = jest.mocked(withTiming).mock.calls.at(-1)![2]!;
  onHistoryChange.mockClear();
  act(() => renderer.unmount());
  act(() => finish(true));
  await expect(pending!).resolves.toMatchObject({ animation: 'cancelled' });
  expect(onPositionChange).toHaveBeenCalledTimes(1);
  expect(onHistoryChange).not.toHaveBeenCalled();
  expect(await handle.playMove('e7e5')).toEqual({
    accepted: false,
    reason: 'unmounted',
  });
  act(() => {
    renderer = create(<ChessBoard ref={ref} />);
  });
  expect(ref.current!.getHistoryState().length).toBe(0);
});
