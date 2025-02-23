import { memo, useMemo } from 'react';
import { type Square } from 'chess.js';
import { StyleSheet, View } from 'react-native';
import { useChessStore } from '../store/chessStore';
import { SQUARE_SIZE, toCoordinates } from '../Constants';

const SquareHighlights = memo(() => {
  const chess = useChessStore((state) => state.chess);
  const selectedSquare = useChessStore((state) => state.selectedSquare);
  const orientation = useChessStore((state) => state.orientation);

  const lastMove = useMemo(() => {
    const history = chess.history({ verbose: true });
    if (history.length) {
      return history[history.length - 1];
    }
    return undefined;
  }, [chess]);

  const lastMoveOrigin = useMemo(() => {
    if (!lastMove) {
      return undefined;
    }
    return toCoordinates(lastMove.from, orientation);
  }, [lastMove, orientation]);

  const lastMoveDestination = useMemo(() => {
    if (!lastMove) {
      return undefined;
    }
    return toCoordinates(lastMove.to, orientation);
  }, [lastMove, orientation]);

  const selectedSquareCoordinates = useMemo(() => {
    if (!selectedSquare) {
      return undefined;
    }
    return toCoordinates(selectedSquare, orientation);
  }, [selectedSquare, orientation]);

  const destinations = useMemo(() => {
    if (!selectedSquare) {
      return [];
    }
    return [
      ...new Set<Square>(
        chess
          .moves({
            verbose: true,
            square: selectedSquare,
          })
          .map(({ to }) => to)
      ),
    ].map((square) => toCoordinates(square, orientation));
  }, [chess, selectedSquare, orientation]);

  return (
    <>
      {lastMoveOrigin && (
        <View
          style={[
            styles.lastMoveOrigin,
            {
              transform: [
                { translateX: lastMoveOrigin.x },
                { translateY: lastMoveOrigin.y },
              ],
            },
          ]}
        />
      )}
      {lastMoveDestination && (
        <View
          style={[
            styles.lastMoveDestination,
            {
              transform: [
                { translateX: lastMoveDestination.x ?? 0 },
                { translateY: lastMoveDestination.y ?? 0 },
              ],
            },
          ]}
        />
      )}
      {selectedSquareCoordinates && (
        <View
          style={[
            styles.selectedSquareCoordinates,
            {
              transform: [
                { translateX: selectedSquareCoordinates.x ?? 0 },
                { translateY: selectedSquareCoordinates.y ?? 0 },
              ],
            },
          ]}
        />
      )}
      {[...destinations].map(({ x, y }) => {
        return (
          <View
            key={`${x}-${y}`}
            style={[
              styles.destinations,
              {
                transform: [
                  { translateX: x },
                  { translateY: y },
                  { scale: 0.35 },
                ],
              },
            ]}
          />
        );
      })}
    </>
  );
});

const styles = StyleSheet.create({
  lastMoveOrigin: {
    width: SQUARE_SIZE,
    pointerEvents: 'none',
    position: 'absolute',
    backgroundColor: 'rgba(255,248,176,0.4)',
    aspectRatio: 1,
  },
  lastMoveDestination: {
    width: SQUARE_SIZE,
    pointerEvents: 'none',
    position: 'absolute',
    backgroundColor: '#fff8b0',
    aspectRatio: 1,
  },
  selectedSquareCoordinates: {
    width: SQUARE_SIZE,
    pointerEvents: 'none',
    position: 'absolute',
    backgroundColor: '#fff8b0',
    aspectRatio: 1,
  },
  destinations: {
    position: 'absolute',
    aspectRatio: 1,
    width: SQUARE_SIZE,
    borderRadius: 100,
    backgroundColor: 'rgba(0,0,0,0.25)',
    zIndex: 2,
    pointerEvents: 'none',
  },
});

export default SquareHighlights;
