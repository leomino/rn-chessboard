import { StyleSheet, View } from 'react-native';
import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { type Color } from 'chess.js';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useChessStore } from './store/chessStore';
import { SQUARE_SIZE, toSquare } from './Constants';
import SquareHighlights from './components/SquareHighlights';
import PromotionModal from './components/PromotionModal';
import Background from './components/Background';
import Piece from './components/Piece';

type ChessBoardRef = {
  setOrientation: (orientation: Color) => void;
};

const ChessBoard = forwardRef(
  ({ initialOrientation }: { initialOrientation?: Color }, ref) => {
    const chess = useChessStore((state) => state.chess);
    const orientation = useChessStore((state) => state.orientation);
    const setOrientation = useChessStore((state) => state.setOrientation);
    const selectSquare = useChessStore((state) => state.selectSquare);

    useEffect(() => {
      if (initialOrientation) {
        setOrientation(initialOrientation);
      }
    });

    useImperativeHandle(ref, () => ({
      setOrientation,
    }));

    const tap = Gesture.Tap().onStart(({ x, y }) => {
      runOnJS(selectSquare)(toSquare({ x, y }, orientation));
    });

    return (
      <GestureHandlerRootView style={styles.gestureHandler}>
        <GestureDetector gesture={tap}>
          <View style={styles.main}>
            <Background />
            <SquareHighlights />
            <PromotionModal />
            {chess.board().map((row) =>
              row.map((el) => {
                if (el != null) {
                  const { square, type, color } = el;
                  return (
                    <Piece
                      key={square}
                      square={square}
                      type={type}
                      color={color}
                    />
                  );
                }
                return null;
              })
            )}
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    );
  }
);

const styles = StyleSheet.create({
  gestureHandler: {
    flex: 1,
  },
  main: {
    aspectRatio: 1,
    width: SQUARE_SIZE * 8,
  },
});

export type { ChessBoardRef };
export default ChessBoard;
