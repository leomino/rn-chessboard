import { StyleSheet, View } from 'react-native';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { type Color, type Move } from 'chess.js';
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

type ChessBoardProps = {
  initialOrientation?: Color;
  onMove?: (move: Move) => void;
};

const ChessBoard = forwardRef<ChessBoardRef, ChessBoardProps>(
  ({ initialOrientation, onMove }, ref) => {
    const chess = useChessStore((state) => state.chess);
    const orientation = useChessStore((state) => state.orientation);
    const setOrientation = useChessStore((state) => state.setOrientation);
    const selectSquare = useChessStore((state) => state.selectSquare);
    const previousChess = useRef(chess);

    useEffect(() => {
      if (initialOrientation) {
        setOrientation(initialOrientation);
      }
    }, [initialOrientation, setOrientation]);

    useEffect(() => {
      if (previousChess.current === chess) return;
      previousChess.current = chess;
      const history = chess.history({ verbose: true });
      const move = history[history.length - 1];
      if (move) onMove?.(move);
    }, [chess, onMove]);

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

export type { ChessBoardProps, ChessBoardRef };
export default ChessBoard;
