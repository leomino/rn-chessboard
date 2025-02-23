import { StyleSheet, View } from 'react-native';
import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { type Color } from 'chess.js';
import { SQUARE_SIZE, toSquare } from '@/src/Constants';
import { useChessStore } from '@/src/store/chessStore';
import { Background } from '@/src/components/Background';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { SquareHighlights } from '@/src/components/SquareHighlights';
import { Piece } from '@/src/components/Piece';
import { PromotionModal } from '@/src/components/PromotionModal';

export type ChessBoardRef = {
  setOrientation: (orientation: Color) => void;
};

export const ChessBoard = forwardRef(
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
    );
  }
);

const styles = StyleSheet.create({
  main: {
    aspectRatio: 1,
    width: SQUARE_SIZE * 8,
  },
});
