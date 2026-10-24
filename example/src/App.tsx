import ChessBoard, { ChessBoardHistory } from 'rn-chessboard';
import type { ChessBoardHistoryState, ChessBoardRef } from 'rn-chessboard';
import { useRef, useState } from 'react';
import type { Color } from 'chess.js';
import {
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';

function playMoveHaptic(san = '') {
  if (Platform.OS !== 'ios') return;
  Haptics.impactAsync(
    /[x+#]/.test(san)
      ? Haptics.ImpactFeedbackStyle.Heavy
      : Haptics.ImpactFeedbackStyle.Light
  ).catch(console.warn);
}

export default function App() {
  const chessBoardRef = useRef<ChessBoardRef>(null);
  const [orientation, setOrientation] = useState<Color>('w');
  const [history, setHistory] = useState<ChessBoardHistoryState | null>(null);

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
      <ChessBoard
        initialOrientation={orientation}
        ref={chessBoardRef}
        onHistoryChange={setHistory}
        onMove={(move) => playMoveHaptic(move.san)}
      />
      <ChessBoardHistory
        history={history}
        onSeek={(index, options) =>
          chessBoardRef.current?.seekTo(index, options)
        }
        onSelectionChange={(_index, move) => playMoveHaptic(move?.san)}
      />
      <View style={styles.actions}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Undo last move"
          accessibilityState={{ disabled: !history?.canUndo }}
          disabled={!history?.canUndo}
          style={[styles.button, !history?.canUndo && styles.disabled]}
          onPress={() => chessBoardRef.current?.undo()}
        >
          <Text>Undo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Reset game"
          style={styles.button}
          onPress={() => chessBoardRef.current?.reset()}
        >
          <Text>Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Flip board"
          style={styles.button}
          onPress={toggleOrientation}
        >
          <Text>Flip</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  disabled: { opacity: 0.35 },
  button: {
    backgroundColor: '#fff',
    minWidth: 80,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
  },
});
