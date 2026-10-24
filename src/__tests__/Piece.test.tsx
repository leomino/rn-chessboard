import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Chess, type Color, type Square } from 'chess.js';
import { Gesture } from 'react-native-gesture-handler';
import { Image } from 'react-native';
import type { ComponentProps } from 'react';
import {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Piece from '../components/Piece';
import { pieces, SQUARE_SIZE, toCoordinates } from '../Constants';
import { useChessStore } from '../store/chessStore';

jest.mock('react-native', () => ({
  Dimensions: { get: () => ({ width: 320 }) },
  StyleSheet: { create: (styles: unknown) => styles },
  Image: 'Image',
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureDetector: 'GestureDetector',
  Gesture: {
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
  // Leave JS work pending to verify that the visual drop doesn't depend on it.
  runOnJS: jest.fn(() => jest.fn()),
  useSharedValue: function useSharedValue(value: unknown) {
    return jest.requireActual('react').useRef({ value }).current;
  },
  useAnimatedReaction: jest.fn(),
  useDerivedValue: (updater: () => unknown) => ({
    get value() {
      return updater();
    },
  }),
  useAnimatedStyle: jest.fn((updater: () => unknown) => updater),
  withTiming: jest.fn((value: unknown) => value),
}));

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

afterEach(() => {
  act(() => renderer.unmount());
});

it.each<{ orientation: Color; destination: Square; valid: boolean }>([
  { orientation: 'w', destination: 'e4', valid: true },
  { orientation: 'b', destination: 'e4', valid: true },
  { orientation: 'w', destination: 'e5', valid: false },
  { orientation: 'b', destination: 'e5', valid: false },
])(
  'finishes a drop on $destination with orientation $orientation before JS runs',
  ({ orientation, destination, valid }) => {
    useChessStore.setState({ orientation });
    act(() => {
      renderer = create(<Piece square="e2" type="p" color="w" />);
    });
    const pan = jest.mocked(Gesture.Pan).mock.results[0]!.value;
    const pieceStyle = jest.mocked(useAnimatedStyle).mock.calls[0]![0];
    const focusStyle = jest.mocked(useAnimatedStyle).mock.calls[1]![0];
    const origin = toCoordinates('e2', orientation);
    const target = toCoordinates(destination, orientation);
    const translation = {
      translationX: target.x - origin.x,
      translationY: target.y - origin.y,
    };

    pan.onStart.mock.calls[0][0]({ x: 10, y: SQUARE_SIZE / 2 });
    pan.onChange.mock.calls[0][0](translation);
    expect(pieceStyle().transform).toContainEqual({ scale: 2 });

    pan.onEnd.mock.calls[0][0](translation);

    const expected = valid ? target : origin;
    expect(pieceStyle()).toMatchObject({
      transform: [
        { translateX: expected.x },
        { translateY: expected.y },
        { scale: 1 },
      ],
      zIndex: valid ? 4 : 1,
    });
    expect(focusStyle()).toMatchObject({ opacity: 0 });
    expect(withTiming).toHaveBeenCalledTimes(valid ? 0 : 2);
    expect(runOnJS).toHaveBeenCalledWith(useChessStore.getState().endDrag);
    expect(jest.mocked(runOnJS).mock.results[0]!.value).toHaveBeenCalledWith(
      'e2',
      destination,
      0
    );
    expect(useChessStore.getState().chess.history()).toEqual([]);
  }
);

type Playback = NonNullable<ComponentProps<typeof Piece>['playback']>;

function clock() {
  return {
    progress: { value: 1 } as SharedValue<number>,
    activeId: { value: 0 } as SharedValue<number>,
  };
}

it.each<Color>(['w', 'b'])(
  'interpolates reverse playback without a startup jump facing %s',
  (orientation) => {
    useChessStore.setState({ orientation });
    const playback: Playback = {
      id: 10,
      clock: clock(),
      piece: {
        id: 'e2',
        from: { id: 'e2', square: 'e4', type: 'p', color: 'w' },
        to: { id: 'e2', square: 'e2', type: 'p', color: 'w' },
      },
    };
    act(() => {
      renderer = create(
        <Piece square="e2" type="p" color="w" playback={playback} />
      );
    });
    const style = jest.mocked(useAnimatedStyle).mock.calls[0]![0];
    const from = toCoordinates('e4', orientation);
    const to = toCoordinates('e2', orientation);
    // The previous clock is already at 1, but this transition hasn't started.
    expect(style().transform).toEqual([
      { translateX: from.x },
      { translateY: from.y },
      { scale: 1 },
    ]);
    playback.clock.activeId.value = 10;
    playback.clock.progress.value = 0.5;
    expect(style()).toMatchObject({
      transform: [
        { translateX: (from.x + to.x) / 2 },
        { translateY: (from.y + to.y) / 2 },
        { scale: 1 },
      ],
      zIndex: 4,
      opacity: 1,
    });
    // An old render remains at its destination when a newer clock starts.
    playback.clock.activeId.value = 11;
    playback.clock.progress.value = 0;
    expect(style().transform).toEqual([
      { translateX: to.x },
      { translateY: to.y },
      { scale: 1 },
    ]);
    expect(
      jest.mocked(Gesture.Pan).mock.results[0]!.value.enabled
    ).toHaveBeenCalledWith(false);
  }
);

it.each([false, true])('fades a capture (restoring: %s)', (restoring) => {
  const victim = {
    id: 'd7' as const,
    square: 'd5' as const,
    type: 'p' as const,
    color: 'b' as const,
  };
  const playback: Playback = {
    id: 1,
    clock: clock(),
    piece: {
      id: 'd7',
      from: restoring ? null : victim,
      to: restoring ? victim : null,
    },
  };
  playback.clock.activeId.value = 1;
  playback.clock.progress.value = 0;
  act(() => {
    renderer = create(
      <Piece square="d5" type="p" color="b" playback={playback} />
    );
  });
  const style = jest.mocked(useAnimatedStyle).mock.calls[0]![0];
  expect(style().opacity).toBe(restoring ? 0 : 1);
  playback.clock.progress.value = 1;
  expect(style().opacity).toBe(restoring ? 1 : 0);
});

it.each([false, true])(
  'changes the promotion sprite at completion (reversing: %s)',
  (reversing) => {
    const pawn = {
      id: 'a7' as const,
      square: 'a7' as const,
      type: 'p' as const,
      color: 'w' as const,
    };
    const queen = { ...pawn, square: 'a8' as const, type: 'q' as const };
    const from = reversing ? queen : pawn;
    const to = reversing ? pawn : queen;
    const playback: Playback = {
      id: 1,
      clock: clock(),
      piece: { id: 'a7', from, to },
    };
    act(() => {
      renderer = create(
        <Piece
          square={to.square}
          type={to.type}
          color="w"
          playback={playback}
        />
      );
    });
    const image = renderer.root.findByType(Image);
    expect(image.props.source).toBe(pieces[`${from.type}w`]);
    act(() => {
      renderer.update(<Piece square={to.square} type={to.type} color="w" />);
    });
    expect(renderer.root.findByType(Image)).toBe(image);
    expect(image.props.source).toBe(pieces[`${to.type}w`]);
  }
);

it('ignores UI-thread gesture finalization from before a rotation', () => {
  act(() => {
    renderer = create(<Piece square="e2" type="p" color="w" />);
  });
  const pan = jest.mocked(Gesture.Pan).mock.results[0]!.value;
  pan.onStart.mock.calls[0][0]({ x: 10, y: SQUARE_SIZE / 2 });
  act(() => useChessStore.getState().setOrientation('b'));
  const [prepare, react] = jest.mocked(useAnimatedReaction).mock.calls.at(-1)!;
  react(prepare(), { square: 'e2', orientation: 'w', revision: 0 });
  pan.onFinalize.mock.calls[0][0]({}, false);
  const style = jest.mocked(useAnimatedStyle).mock.calls.at(-2)![0];
  const target = toCoordinates('e2', 'b');
  expect(style().transform).toEqual([
    { translateX: target.x },
    { translateY: target.y },
    { scale: 1 },
  ]);
  expect(withTiming).not.toHaveBeenCalled();
});

it.each<Color>(['w', 'b'])(
  'keeps the image and dropped position through the move commit facing %s',
  async (orientation) => {
    useChessStore.setState({ orientation });
    act(() => {
      renderer = create(<Piece square="e2" type="p" color="w" />);
    });
    const image = renderer.root.findByType(Image);
    const pan = jest.mocked(Gesture.Pan).mock.results[0]!.value;
    const origin = toCoordinates('e2', orientation);
    const target = toCoordinates('e4', orientation);
    pan.onStart.mock.calls[0][0]({ x: 10, y: SQUARE_SIZE / 2 });
    pan.onEnd.mock.calls[0][0]({
      translationX: target.x - origin.x,
      translationY: target.y - origin.y,
    });
    const droppedStyle = jest.mocked(useAnimatedStyle).mock.calls[0]![0]();

    await act(async () => {
      await useChessStore.getState().move('e2', 'e4');
      renderer.update(<Piece square="e4" type="p" color="w" />);
    });
    const pieceStyle = jest
      .mocked(useAnimatedStyle)
      .mock.calls.slice(-2)[0]![0];
    expect(pieceStyle()).toEqual({ ...droppedStyle, zIndex: 1 });
    expect(renderer.root.findByType(Image)).toBe(image);

    // Updating the authoritative square must not apply the drag offset twice.
    const [prepare, react] = jest
      .mocked(useAnimatedReaction)
      .mock.calls.at(-1)!;
    react(prepare(), { square: 'e2', orientation });
    expect(pieceStyle()).toEqual({ ...droppedStyle, zIndex: 1 });

    // A subsequent tap move and board rotation still update this same piece.
    await act(async () => {
      await useChessStore.getState().move('a7', 'a6');
      await useChessStore.getState().move('e4', 'e5');
      useChessStore.getState().setOrientation(orientation === 'w' ? 'b' : 'w');
      renderer.update(<Piece square="e5" type="p" color="w" />);
    });
    const [nextPrepare, nextReact] = jest
      .mocked(useAnimatedReaction)
      .mock.calls.at(-1)!;
    nextReact(nextPrepare(), { square: 'e4', orientation });
    const nextTarget = toCoordinates('e5', orientation === 'w' ? 'b' : 'w');
    const nextStyle = jest.mocked(useAnimatedStyle).mock.calls.slice(-2)[0]![0];
    expect(nextStyle().transform).toEqual([
      { translateX: nextTarget.x },
      { translateY: nextTarget.y },
      { scale: 1 },
    ]);
    expect(renderer.root.findByType(Image)).toBe(image);
  }
);
