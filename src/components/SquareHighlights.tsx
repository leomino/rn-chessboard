import { memo, useMemo } from 'react';
import { type Square } from 'chess.js';
import { StyleSheet, View } from 'react-native';
import { useChessStore } from '../store/BoardContext';
import { useSquareSize, toCoordinates } from '../Constants';

const SquareHighlights = memo(() => {
  const squareSize = useSquareSize();
  const chess = useChessStore((state) => state.chess);
  const selectedSquare = useChessStore((state) => state.selectedSquare);
  const orientation = useChessStore((state) => state.orientation);

  const lastMove = useChessStore(
    (state) => state.historyEntries[state.historyIndex - 1]
  );

  const lastMoveOrigin = useMemo(() => {
    if (!lastMove) {
      return undefined;
    }
    return toCoordinates(lastMove.from, orientation, squareSize);
  }, [lastMove, orientation, squareSize]);

  const lastMoveDestination = useMemo(() => {
    if (!lastMove) {
      return undefined;
    }
    return toCoordinates(lastMove.to, orientation, squareSize);
  }, [lastMove, orientation, squareSize]);

  const selectedSquareCoordinates = useMemo(() => {
    if (!selectedSquare) {
      return undefined;
    }
    return toCoordinates(selectedSquare, orientation, squareSize);
  }, [selectedSquare, orientation, squareSize]);

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
    ].map((square) => toCoordinates(square, orientation, squareSize));
  }, [chess, selectedSquare, orientation, squareSize]);

  return (
    <>
      {lastMoveOrigin && (
        <View
          style={[
            styles.lastMoveOrigin,
            { width: squareSize },
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
            { width: squareSize },
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
            { width: squareSize },
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
              { width: squareSize },
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
    pointerEvents: 'none',
    position: 'absolute',
    backgroundColor: 'rgba(255,248,176,0.4)',
    aspectRatio: 1,
  },
  lastMoveDestination: {
    pointerEvents: 'none',
    position: 'absolute',
    backgroundColor: '#fff8b0',
    aspectRatio: 1,
  },
  selectedSquareCoordinates: {
    pointerEvents: 'none',
    position: 'absolute',
    backgroundColor: '#fff8b0',
    aspectRatio: 1,
  },
  destinations: {
    position: 'absolute',
    aspectRatio: 1,
    borderRadius: 100,
    backgroundColor: 'rgba(0,0,0,0.25)',
    zIndex: 2,
    pointerEvents: 'none',
  },
});

export default SquareHighlights;
