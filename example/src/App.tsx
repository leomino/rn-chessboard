import ChessBoard from 'rn-chessboard';
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

export default function App() {
  const chessBoardRef = useRef<ChessBoardRef>(null);
  const [orientation, setOrientation] = useState<Color>('w');
  const [history, setHistory] = useState<ChessBoardHistoryState>({
    index: 0,
    length: 0,
    canGoBack: false,
    canGoForward: false,
    isReviewing: false,
    isAnimating: false,
  });

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
        onMove={(move) => {
          if (Platform.OS === 'ios') {
            Haptics.impactAsync(
              move.isCapture() ||
                move.san.includes('+') ||
                move.san.includes('#')
                ? Haptics.ImpactFeedbackStyle.Heavy
                : Haptics.ImpactFeedbackStyle.Light
            ).catch(console.warn);
          }
        }}
      />
      <View style={styles.historyControls}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Previous move"
          accessibilityState={{ disabled: !history.canGoBack }}
          disabled={!history.canGoBack}
          style={[styles.button, !history.canGoBack && styles.disabled]}
          onPress={() => chessBoardRef.current?.goBack()}
        >
          <Text>Back</Text>
        </TouchableOpacity>
        <View style={styles.historyStatus}>
          <Text>
            Position {history.index} / {history.length}
          </Text>
          <Text>{history.isReviewing ? 'Reviewing' : 'Latest position'}</Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Next move"
          accessibilityState={{ disabled: !history.canGoForward }}
          disabled={!history.canGoForward}
          style={[styles.button, !history.canGoForward && styles.disabled]}
          onPress={() => chessBoardRef.current?.goForward()}
        >
          <Text>Forward</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Flip board"
        style={styles.button}
        onPress={toggleOrientation}
      >
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
    minWidth: 80,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
  },
  historyControls: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  historyStatus: {
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.35,
  },
});
