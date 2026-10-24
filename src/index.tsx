import { StyleSheet, View } from 'react-native';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import { type Color, type Move } from 'chess.js';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { shallow } from 'zustand/shallow';
import { canPlay, selectHistoryState, useChessStore } from './store/chessStore';
import { useHistoryAnimation } from './hooks/useHistoryAnimation';
import {
  getBoardPieces,
  type ChessBoardHistoryState,
  type ChessBoardSeekOptions,
} from './utils/history';
import { SQUARE_SIZE, toSquare } from './Constants';
import SquareHighlights from './components/SquareHighlights';
import PromotionModal from './components/PromotionModal';
import Background from './components/Background';
import Piece from './components/Piece';

type ChessBoardRef = {
  setOrientation: (orientation: Color) => void;
  /** Returns true when an animated step is accepted. */
  goBack: () => boolean;
  /** Returns true when an animated step is accepted. */
  goForward: () => boolean;
  /** Seek directly, interrupting playback. Defaults to animated. */
  seekTo: (index: number, options?: ChessBoardSeekOptions) => boolean;
  /** Remove the last recorded half-move and animate to the new latest position. */
  undo: () => boolean;
  /** Clear the game and cancel interactions, preserving board orientation. */
  reset: () => void;
  getHistoryState: () => ChessBoardHistoryState;
};

type ChessBoardProps = {
  initialOrientation?: Color;
  onMove?: (move: Move) => void;
  onHistoryChange?: (state: ChessBoardHistoryState) => void;
};

const ChessBoard = forwardRef<ChessBoardRef, ChessBoardProps>(
  ({ initialOrientation, onMove, onHistoryChange }, ref) => {
    const chess = useChessStore((state) => state.chess);
    const pieceIds = useChessStore((state) => state.pieceIds);
    const orientation = useChessStore((state) => state.orientation);
    const setOrientation = useChessStore((state) => state.setOrientation);
    const selectSquare = useChessStore((state) => state.selectSquare);
    const transition = useChessStore((state) => state.transition);
    const revision = useChessStore((state) => state.positionRevision);
    const interactive = useChessStore(canPlay);
    const goBack = useChessStore((state) => state.goBack);
    const goForward = useChessStore((state) => state.goForward);
    const seekTo = useChessStore((state) => state.seekTo);
    const undo = useChessStore((state) => state.undo);
    const reset = useChessStore((state) => state.reset);
    const getHistoryState = useChessStore((state) => state.getHistoryState);
    const callbacks = useRef({ onMove, onHistoryChange });
    const clock = useHistoryAnimation(transition, orientation);
    const renderedPieces = useMemo(
      () =>
        transition
          ? transition.pieces.map((piece) => ({
              ...(piece.to ?? piece.from)!,
              transition: piece,
            }))
          : getBoardPieces(chess, pieceIds).map((piece) => ({
              ...piece,
              transition: undefined,
            })),
      [chess, pieceIds, transition]
    );

    useLayoutEffect(() => {
      callbacks.current = { onMove, onHistoryChange };
    }, [onMove, onHistoryChange]);

    useLayoutEffect(
      () =>
        useChessStore.subscribe((state, previous) => {
          const history = selectHistoryState(state);
          if (!shallow(history, selectHistoryState(previous))) {
            callbacks.current.onHistoryChange?.(history);
          }
          if (
            state.lastPlayedMove &&
            state.lastPlayedMove !== previous.lastPlayedMove
          ) {
            callbacks.current.onMove?.(state.lastPlayedMove);
          }
        }),
      []
    );

    useEffect(() => {
      if (initialOrientation) {
        setOrientation(initialOrientation);
      }
    }, [initialOrientation, setOrientation]);

    useEffect(() => {
      onHistoryChange?.(getHistoryState());
    }, [getHistoryState, onHistoryChange]);

    useImperativeHandle(ref, () => ({
      setOrientation,
      goBack,
      goForward,
      seekTo,
      undo,
      reset,
      getHistoryState,
    }));

    const tap = Gesture.Tap()
      .enabled(interactive)
      .onStart(({ x, y }) => {
        runOnJS(selectSquare)(toSquare({ x, y }, orientation), revision);
      });

    return (
      <GestureHandlerRootView style={styles.gestureHandler}>
        <GestureDetector gesture={tap}>
          <View style={styles.main}>
            <Background />
            <SquareHighlights />
            <PromotionModal />
            {renderedPieces.map(
              ({ id, square, type, color, transition: piece }) => (
                <Piece
                  key={id}
                  square={square}
                  type={type}
                  color={color}
                  playback={
                    piece && transition
                      ? { id: transition.id, piece, clock }
                      : undefined
                  }
                />
              )
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

export type { ChessBoardProps, ChessBoardRef, ChessBoardHistoryState };
export type {
  ChessBoardHistoryMove,
  ChessBoardSeekOptions,
} from './utils/history';
export { default as ChessBoardHistory } from './components/ChessBoardHistory';
export type { ChessBoardHistoryProps } from './components/ChessBoardHistory';
export default ChessBoard;
