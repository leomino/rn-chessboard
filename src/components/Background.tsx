import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type Square } from 'chess.js';
import { useChessStore } from '../store/chessStore';
import { SQUARE_SIZE } from '../Constants';

const Background = memo(() => {
  const orientation = useChessStore((state) => state.orientation);

  return (
    <View style={styles.main} pointerEvents="none">
      {new Array(8).fill(null).map((_, rank) => (
        <View key={rank} style={styles.file}>
          {new Array(8).fill(null).map((__, file) => {
            const square: Square = (String.fromCharCode(
              orientation === 'w' ? 97 + file : 104 - file
            ) + (orientation === 'w' ? 8 - rank : 1 + rank)) as Square;
            return (
              <View
                key={square}
                style={[
                  styles.square,
                  (rank + file) % 2 === 0
                    ? styles.lightSquare
                    : styles.darkSquare,
                ]}
              >
                {rank === 7 && (
                  <Text
                    style={[
                      styles.designation,
                      styles.designationRank,
                      (rank + file) % 2 === 0
                        ? styles.lightSquare
                        : styles.darkSquare,
                    ]}
                  >
                    {square.substring(0, 1)}
                  </Text>
                )}
                {file === 0 && (
                  <Text
                    style={[
                      styles.designation,
                      (rank + file) % 2 === 0
                        ? styles.lightSquare
                        : styles.darkSquare,
                    ]}
                  >
                    {square.substring(1, 2)}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  main: {
    display: 'flex',
    aspectRatio: 1,
    justifyContent: 'space-between',
    backgroundColor: '#fff',
  },
  file: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  square: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column-reverse',
    justifyContent: 'space-between',
    width: SQUARE_SIZE,
    height: SQUARE_SIZE,
    aspectRatio: 1,
  },
  lightSquare: {
    backgroundColor: '#f3e4cf',
    color: '#ceb3a2',
  },
  darkSquare: {
    backgroundColor: '#ceb3a2',
    color: '#f3e4cf',
  },
  designationRank: {
    alignSelf: 'flex-end',
  },
  designation: {
    fontSize: 14,
    fontWeight: 'medium',
    userSelect: 'none',
    margin: 1,
  },
});

export default Background;
