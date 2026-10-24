import { type Color, type PieceSymbol, type Square } from 'chess.js';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { memo, useMemo } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Image, StyleSheet } from 'react-native';
import { canPlay, useChessStore } from '../store/chessStore';
import { pieces, SQUARE_SIZE, toCoordinates, toSquare } from '../Constants';
import type { PieceTransition } from '../utils/history';
import type { HistoryAnimation } from '../hooks/useHistoryAnimation';
import { samplePieceAnimation } from '../utils/historyAnimation';

type PieceProps = {
  square: Square;
  type: PieceSymbol;
  color: Color;
  playback?: {
    id: number;
    piece: PieceTransition;
    clock: HistoryAnimation;
  };
};

const Piece = ({ square, type, color, playback }: PieceProps) => {
  // Playback is driven by shared values, not board subscriptions. In particular,
  // don't rebuild every piece's gestures on each history cursor revision.
  const chess = useChessStore((state) => (playback ? null : state.chess));
  const orientation = useChessStore((state) => state.orientation);
  const interactive = useChessStore((state) => !playback && canPlay(state));
  const revision = useChessStore((state) =>
    playback ? 0 : state.positionRevision
  );
  const beginDrag = useChessStore((state) => state.beginDrag);
  const endDrag = useChessStore((state) => state.endDrag);
  const coordinates = toCoordinates(square, orientation);
  const origin = toCoordinates(
    playback?.piece.from?.square ?? square,
    orientation
  );
  const target = toCoordinates(
    playback?.piece.to?.square ?? square,
    orientation
  );
  const displayType = playback?.piece.from?.type ?? type;

  const panGestureActive = useSharedValue(false);
  const gesturePosition = useSharedValue({ revision, orientation });
  const position = useSharedValue(coordinates);
  const pointerOffset = useSharedValue({ x: 0, y: 0 });

  useAnimatedReaction(
    () => ({ square, orientation, revision }),
    (current, previous) => {
      if (
        current.square !== previous?.square ||
        current.orientation !== previous?.orientation ||
        current.revision !== previous?.revision
      ) {
        gesturePosition.value = {
          revision: current.revision,
          orientation: current.orientation,
        };
        position.value = toCoordinates(current.square, current.orientation);
        pointerOffset.value = { x: 0, y: 0 };
        panGestureActive.value = false;
      }
    }
  );

  const isCurrentGesture = () => {
    'worklet';
    return (
      gesturePosition.value.revision === revision &&
      gesturePosition.value.orientation === orientation
    );
  };

  const focusedSquare = useDerivedValue(() => {
    if (!panGestureActive.value) {
      return { x: 0, y: 0 };
    }
    return toCoordinates(
      toSquare(
        {
          x: position.value.x + pointerOffset.value.x + SQUARE_SIZE / 2,
          y: position.value.y + pointerOffset.value.y + SQUARE_SIZE,
        },
        orientation
      ),
      orientation
    );
  });

  const destinations = useMemo(
    () =>
      chess && interactive && chess.turn() === color
        ? chess
            .moves({
              verbose: true,
              square,
            })
            .map(({ to }) => to)
        : [],
    [square, chess, interactive, color]
  );

  const pan = Gesture.Pan()
    .enabled(!playback && interactive && chess?.turn() === color)
    .minVelocity(0)
    .minDistance(0)
    .onBegin(() => runOnJS(beginDrag)(square, revision))
    .onStart(({ x, y }) => {
      if (!isCurrentGesture()) return;
      position.value = coordinates;
      panGestureActive.value = true;
      pointerOffset.value = {
        x: x - SQUARE_SIZE / 2,
        y: y - SQUARE_SIZE,
      };
    })
    .onChange(({ translationX, translationY }) => {
      if (!isCurrentGesture()) return;
      position.value = {
        x: coordinates.x + translationX,
        y: coordinates.y + translationY,
      };
    })
    .onEnd(({ translationX, translationY }, success) => {
      if (success === false || !isCurrentGesture()) return;
      const destination = toSquare(
        {
          x:
            coordinates.x +
            translationX +
            pointerOffset.value.x +
            SQUARE_SIZE / 2,
          y: coordinates.y + translationY + pointerOffset.value.y + SQUARE_SIZE,
        },
        orientation
      );
      // Finish the visual drop on the UI thread before scheduling the move.
      panGestureActive.value = false;
      if (destinations.includes(destination)) {
        position.value = toCoordinates(destination, orientation);
        pointerOffset.value = { x: 0, y: 0 };
      } else {
        position.value = withTiming(coordinates, { duration: 100 });
        pointerOffset.value = withTiming({ x: 0, y: 0 }, { duration: 100 });
      }
      runOnJS(endDrag)(square, destination, revision);
    })
    .onFinalize((_event, success) => {
      if (!isCurrentGesture()) return;
      if (!success) {
        panGestureActive.value = false;
        position.value = withTiming(coordinates, { duration: 100 });
        pointerOffset.value = withTiming({ x: 0, y: 0 }, { duration: 100 });
        runOnJS(endDrag)(square, null, revision);
      }
    });

  const animatedStyles = useAnimatedStyle(() => {
    if (playback) {
      const { clock, id, piece } = playback;
      // Before the new clock starts, sample the previous animation. After it
      // starts, even old render worklets follow the newly retargeted trajectory.
      const animation = clock.pieces.value[piece.id];
      const progress =
        clock.activeId.value === id
          ? clock.progress.value
          : clock.activeId.value < id
            ? 0
            : 1;
      const frame = samplePieceAnimation(
        animation ?? {
          from: { ...origin, opacity: piece.from ? 1 : 0 },
          to: { ...target, opacity: piece.to ? 1 : 0 },
        },
        animation ? clock.progress.value : progress
      );
      const from = animation?.from ?? origin;
      const to = animation?.to ?? target;
      return {
        transform: [
          { translateX: frame.x },
          { translateY: frame.y },
          { scale: 1 },
        ],
        opacity: frame.opacity,
        zIndex: from.x !== to.x || from.y !== to.y ? 4 : 1,
      };
    }
    return {
      transform: [
        { translateX: position.value.x + pointerOffset.value.x },
        { translateY: position.value.y + pointerOffset.value.y },
        { scale: panGestureActive.value ? 2 : 1 },
      ],
      opacity: 1,
      // Stay above a captured piece until React commits the new square.
      zIndex:
        panGestureActive.value ||
        position.value.x !== coordinates.x ||
        position.value.y !== coordinates.y
          ? 4
          : 1,
    };
  });

  const focusedSquareStyles = useAnimatedStyle(() => ({
    transform: [
      { translateX: focusedSquare.value.x },
      { translateY: focusedSquare.value.y },
      { scale: 2.2 },
    ],
    opacity: !playback && panGestureActive.value ? 1 : 0,
  }));

  return (
    <>
      <GestureDetector gesture={pan}>
        <Animated.View style={[animatedStyles, styles.piece]}>
          <Image
            style={styles.pieceSymbol}
            source={pieces[`${displayType}${color}`]}
          />
        </Animated.View>
      </GestureDetector>
      <Animated.View
        pointerEvents={'none'}
        style={[focusedSquareStyles, styles.focusedSquare]}
      />
    </>
  );
};

const styles = StyleSheet.create({
  piece: {
    position: 'absolute',
    transformOrigin: 'bottom',
    width: SQUARE_SIZE,
    height: SQUARE_SIZE,
  },
  pieceSymbol: {
    width: '100%',
    height: '100%',
  },
  focusedSquare: {
    position: 'absolute',
    width: SQUARE_SIZE,
    aspectRatio: 1,
    borderRadius: 100,
    zIndex: 3,
    backgroundColor: 'rgba(0,0,0,0.13)',
  },
});

function samePiece(a: PieceTransition['from'], b: PieceTransition['from']) {
  return (
    a === b ||
    (!!a &&
      !!b &&
      a.id === b.id &&
      a.square === b.square &&
      a.type === b.type &&
      a.color === b.color)
  );
}

export default memo(Piece, (previous, next) => {
  if (
    previous.square !== next.square ||
    previous.type !== next.type ||
    previous.color !== next.color
  )
    return false;
  if (!previous.playback || !next.playback)
    return previous.playback === next.playback;
  // The transition ID changes on every seek, but unchanged pieces can keep their
  // existing worklets: those read the latest trajectory from the shared clock.
  return (
    previous.playback.clock === next.playback.clock &&
    samePiece(previous.playback.piece.from, next.playback.piece.from) &&
    samePiece(previous.playback.piece.to, next.playback.piece.to)
  );
});
