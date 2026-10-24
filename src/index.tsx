import { StyleSheet, View, useWindowDimensions } from 'react-native';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type Color, type Move } from 'chess.js';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { shallow } from 'zustand/shallow';
import {
  canPlay,
  selectHistoryState,
  createChessStore,
} from './store/chessStore';
import {
  BoardContext,
  useBoardStore,
  useChessStore,
} from './store/BoardContext';
import type {
  BoardArrow,
  ChessBoardMove,
  MovableColor,
  MoveAttemptHandler,
  PlayMoveOptions,
  PlayMoveResult,
  PositionChangeEvent,
  SquareHighlight,
} from './types';
import { useHistoryAnimation } from './hooks/useHistoryAnimation';
import {
  getBoardPieces,
  type ChessBoardHistoryState,
  type ChessBoardSeekOptions,
} from './utils/history';
import { SquareSizeContext, toSquare } from './Constants';
import BoardAnnotations from './components/BoardAnnotations';
import SquareHighlights from './components/SquareHighlights';
import PromotionModal from './components/PromotionModal';
import Background from './components/Background';
import Piece from './components/Piece';

type ChessBoardRef = {
  /** Validate and replace the timeline origin. Throws without changing state on invalid FEN. */
  loadFen: (fen: string) => void;
  /** Full six-field FEN at the logical cursor, including the en passant target. */
  getFen: () => string;
  /** Commit UCI/structured input and resolve when animation finishes or is cancelled.
   * Competing moves return { accepted: false, reason: 'busy' }. */
  playMove: (
    move: string | ChessBoardMove,
    options?: PlayMoveOptions
  ) => Promise<PlayMoveResult>;
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
  /** Replace the game with a PGN at its final position. Throws on invalid input. */
  loadPgn: (pgn: string) => void;
  getHistoryState: () => ChessBoardHistoryState;
};

type ChessBoardProps = {
  /** Used only on mount. Use loadFen for subsequent positions. */
  initialFen?: string;
  /** Manual gestures only; programmatic moves remain available. Defaults to true. */
  interactionEnabled?: boolean;
  /** Restricts manual play to a color; defaults to 'both'. */
  movableColor?: MovableColor;
  /** Synchronous pre-commit user approval. False or an exception rejects the move. */
  onMoveAttempt?: MoveAttemptHandler;
  /** One notification per logical change; not fired on mount or animation completion. */
  onPositionChange?: (event: PositionChangeEvent) => void;
  highlightedSquares?: readonly SquareHighlight[];
  arrows?: readonly BoardArrow[];
  /** Board width/height in logical pixels. Defaults to available parent width. */
  size?: number;
  initialOrientation?: Color;
  /** Accepted user moves only. Use onPositionChange for programmatic moves. */
  onMove?: (move: Move) => void;
  onHistoryChange?: (state: ChessBoardHistoryState) => void;
};

const Board = forwardRef<ChessBoardRef, ChessBoardProps>(
  (
    {
      initialOrientation,
      onMove,
      onHistoryChange,
      onPositionChange,
      onMoveAttempt,
      interactionEnabled = true,
      movableColor = 'both',
      highlightedSquares,
      arrows,
      size,
    },
    ref
  ) => {
    const store = useBoardStore();
    const { width } = useWindowDimensions();
    const [parentWidth, setParentWidth] = useState<number | null>(null);
    const boardSize = size ?? Math.min(parentWidth ?? width, 576);
    if (!Number.isFinite(boardSize) || boardSize <= 0)
      throw new Error('Board size must be a positive finite number.');
    const squareSize = boardSize / 8;
    const previousSize = useRef(squareSize);
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
    const loadPgn = useChessStore((state) => state.loadPgn);
    const getHistoryState = useChessStore((state) => state.getHistoryState);
    const callbacks = useRef({ onMove, onHistoryChange, onPositionChange });
    const clock = useHistoryAnimation(transition, orientation, squareSize);
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
      callbacks.current = { onMove, onHistoryChange, onPositionChange };
    }, [onMove, onHistoryChange, onPositionChange]);

    useLayoutEffect(() => {
      store
        .getState()
        .configureInteraction(interactionEnabled, movableColor, onMoveAttempt);
    }, [store, interactionEnabled, movableColor, onMoveAttempt]);

    useLayoutEffect(() => {
      if (previousSize.current !== squareSize) {
        previousSize.current = squareSize;
        store.getState().clearUserInteraction();
      }
    }, [store, squareSize]);

    useLayoutEffect(() => {
      store.getState().activate();
      let active = true;
      let notifying = false;
      const notifications: (() => void)[] = [];
      const unsubscribe = store.subscribe((state, previous) => {
        const history = selectHistoryState(state);
        if (!shallow(history, selectHistoryState(previous))) {
          notifications.push(() =>
            callbacks.current.onHistoryChange?.(history)
          );
        }
        if (
          state.lastPlayedMove &&
          state.lastPlayedMove !== previous.lastPlayedMove
        ) {
          notifications.push(() =>
            callbacks.current.onMove?.(state.lastPlayedMove!)
          );
        }
        if (
          state.positionEvent &&
          state.positionEvent !== previous.positionEvent
        ) {
          notifications.push(() =>
            callbacks.current.onPositionChange?.(state.positionEvent!)
          );
        }
        // Reentrant host commands append notifications in commit order.
        if (notifying) return;
        notifying = true;
        try {
          while (active && notifications.length) {
            try {
              notifications.shift()!();
            } catch (error) {
              console.error(error);
            }
          }
        } finally {
          notifying = false;
        }
      });
      return () => {
        active = false;
        notifications.length = 0;
        unsubscribe();
        store.getState().dispose();
      };
    }, [store]);

    useEffect(() => {
      if (initialOrientation) {
        setOrientation(initialOrientation);
      }
    }, [initialOrientation, setOrientation]);

    useEffect(() => {
      onHistoryChange?.(getHistoryState());
    }, [getHistoryState, onHistoryChange]);

    useImperativeHandle(ref, () => ({
      loadFen: store.getState().loadFen,
      getFen: store.getState().getFen,
      playMove: store.getState().playMove,
      setOrientation,
      goBack,
      goForward,
      seekTo,
      undo,
      reset,
      loadPgn,
      getHistoryState,
    }));

    const tap = Gesture.Tap()
      .enabled(interactive)
      .onStart(({ x, y }) => {
        runOnJS(selectSquare)(
          toSquare({ x, y }, orientation, squareSize),
          revision
        );
      });

    return (
      <GestureHandlerRootView
        style={[
          styles.gestureHandler,
          size === undefined ? undefined : { width: size },
        ]}
        onLayout={({ nativeEvent: { layout } }) => {
          if (layout.width > 0) setParentWidth(layout.width);
        }}
      >
        <SquareSizeContext.Provider value={squareSize}>
          <GestureDetector gesture={tap}>
            <View style={[styles.main, { width: boardSize }]}>
              <Background />
              <BoardAnnotations highlightedSquares={highlightedSquares} />
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
              <BoardAnnotations arrows={arrows} />
            </View>
          </GestureDetector>
        </SquareSizeContext.Provider>
      </GestureHandlerRootView>
    );
  }
);

const ChessBoard = forwardRef<ChessBoardRef, ChessBoardProps>((props, ref) => {
  const [store] = useState(() =>
    createChessStore(props.initialFen, {
      interactionEnabled: props.interactionEnabled,
      movableColor: props.movableColor,
      onMoveAttempt: props.onMoveAttempt,
      orientation: props.initialOrientation,
    })
  );
  return (
    <BoardContext.Provider value={store}>
      <Board {...props} ref={ref} />
    </BoardContext.Provider>
  );
});

const styles = StyleSheet.create({
  gestureHandler: {
    alignSelf: 'stretch',
  },
  main: {
    aspectRatio: 1,
  },
});

export type { ChessBoardProps, ChessBoardRef, ChessBoardHistoryState };
export type {
  BoardArrow,
  ChessBoardMove,
  MovableColor,
  MoveAttemptHandler,
  PlayMoveOptions,
  PlayMoveResult,
  PositionChangeEvent,
  PositionChangeSource,
  PromotionPiece,
  SquareHighlight,
} from './types';
export type {
  ChessBoardHistoryMove,
  ChessBoardSeekOptions,
} from './utils/history';
export { default as ChessBoardHistory } from './components/ChessBoardHistory';
export type { ChessBoardHistoryProps } from './components/ChessBoardHistory';
export default ChessBoard;
