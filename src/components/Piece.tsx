import { type Color, type PieceSymbol, type Square } from 'chess.js';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useMemo } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Image, StyleSheet } from 'react-native';
import { useChessStore } from '../store/chessStore';
import { pieces, SQUARE_SIZE, toCoordinates, toSquare } from '../Constants';

const Piece = ({
  square,
  type,
  color,
}: {
  square: Square;
  type: PieceSymbol;
  color: Color;
}) => {
  const chess = useChessStore((state) => state.chess);
  const orientation = useChessStore((state) => state.orientation);
  const turn = useChessStore((state) => state.chess.turn());
  const selectSquare = useChessStore((state) => state.selectSquare);
  const coordinates = toCoordinates(square, orientation);

  const panGestureActive = useSharedValue(false);
  const position = useSharedValue(coordinates);
  const pointerOffset = useSharedValue({ x: 0, y: 0 });

  useAnimatedReaction(
    () => ({ square, orientation }),
    (current, previous) => {
      if (
        current.square !== previous?.square ||
        current.orientation !== previous?.orientation
      ) {
        position.value = toCoordinates(current.square, current.orientation);
      }
    }
  );

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
      chess
        .moves({
          verbose: true,
          square,
        })
        .map(({ to }) => to),
    [square, chess]
  );

  const pan = Gesture.Pan()
    .enabled(turn === color)
    .minVelocity(0)
    .minDistance(0)
    .onBegin(() => runOnJS(selectSquare)(square))
    .onStart(({ x, y }) => {
      position.value = coordinates;
      panGestureActive.value = true;
      pointerOffset.value = {
        x: x - SQUARE_SIZE / 2,
        y: y - SQUARE_SIZE,
      };
    })
    .onChange(({ translationX, translationY }) => {
      position.value = {
        x: coordinates.x + translationX,
        y: coordinates.y + translationY,
      };
    })
    .onEnd(({ translationX, translationY }) => {
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
      runOnJS(selectSquare)(destination);
    });

  const animatedStyles = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: position.value.x + pointerOffset.value.x,
      },
      {
        translateY: position.value.y + pointerOffset.value.y,
      },
      { scale: panGestureActive.value ? 2 : 1 },
    ],
    // Stay above a captured piece until React commits the new square.
    zIndex:
      panGestureActive.value ||
      position.value.x !== coordinates.x ||
      position.value.y !== coordinates.y
        ? 4
        : 1,
  }));

  const focusedSquareStyles = useAnimatedStyle(() => ({
    transform: [
      { translateX: focusedSquare.value.x },
      { translateY: focusedSquare.value.y },
      { scale: 2.2 },
    ],
    opacity: panGestureActive.value ? 1 : 0,
  }));

  return (
    <>
      <GestureDetector gesture={pan}>
        <Animated.View style={[animatedStyles, styles.piece]}>
          <Image
            style={styles.pieceSymbol}
            source={pieces[`${type}${color}`]}
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

export default Piece;
