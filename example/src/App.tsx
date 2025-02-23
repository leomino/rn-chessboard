import ChessBoard from 'rn-chessboard';
import type { ChessBoardRef } from 'rn-chessboard';
import { useRef, useState } from 'react';
import type { Color } from 'chess.js';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity } from 'react-native';

export default function App() {
  const chessBoardRef = useRef<ChessBoardRef>(null);
  const [orientation, setOrientation] = useState<Color>('w');

  const toggleOrientation = () => {
    if (orientation === 'w') {
      setOrientation('b');
      chessBoardRef?.current?.setOrientation('b');
      return;
    }
    setOrientation('w');
    chessBoardRef?.current?.setOrientation('w');
  };

  return (
    <SafeAreaView style={styles.main}>
      <ChessBoard initialOrientation={orientation} ref={chessBoardRef} />
      <TouchableOpacity style={styles.button} onPress={toggleOrientation}>
        <Text>Flip</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
  },
  button: {
    backgroundColor: '#fff',
    width: 160,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    alignSelf: 'center',
  },
});
