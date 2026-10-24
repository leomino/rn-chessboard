import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { toCoordinates, useSquareSize } from '../Constants';
import { useChessStore } from '../store/BoardContext';
import type { BoardArrow, SquareHighlight } from '../types';

/** Native views suffice for static shafts and triangle heads; no graphics dependency. */
export default memo(function BoardAnnotations({
  highlightedSquares = [],
  arrows = [],
}: {
  highlightedSquares?: readonly SquareHighlight[];
  arrows?: readonly BoardArrow[];
}) {
  const orientation = useChessStore((state) => state.orientation);
  const size = useSquareSize();
  return (
    <>
      {highlightedSquares.map(({ square, color }, index) => {
        const { x, y } = toCoordinates(square, orientation, size);
        return (
          <View
            key={`square-${index}`}
            pointerEvents="none"
            style={{
              ...styles.absolute,
              left: x,
              top: y,
              width: size,
              height: size,
              backgroundColor: color,
            }}
          />
        );
      })}
      {arrows.map(({ from, to, color }, index) => {
        if (from === to) return null;
        const start = toCoordinates(from, orientation, size);
        const end = toCoordinates(to, orientation, size);
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy);
        const head = size * 0.3;
        const thickness = size * 0.12;
        return (
          <View
            key={`arrow-${index}`}
            pointerEvents="none"
            style={{
              ...styles.arrow,
              left: start.x + size / 2,
              top: start.y + size / 2 - head / 2,
              width: length,
              height: head,
              transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
            }}
          >
            <View
              style={{
                ...styles.shaft,
                top: (head - thickness) / 2,
                width: length - head,
                height: thickness,
                backgroundColor: color,
              }}
            />
            <View
              style={{
                ...styles.head,
                borderLeftWidth: head,
                borderLeftColor: color,
                borderTopWidth: head / 2,
                borderBottomWidth: head / 2,
              }}
            />
          </View>
        );
      })}
    </>
  );
});

const styles = StyleSheet.create({
  absolute: { position: 'absolute' },
  arrow: { position: 'absolute', zIndex: 5, transformOrigin: 'left center' },
  shaft: { position: 'absolute', left: 0 },
  head: {
    position: 'absolute',
    right: 0,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
});
