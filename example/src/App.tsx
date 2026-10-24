import ChessBoard, { ChessBoardHistory } from 'rn-chessboard';
import type { ChessBoardHistoryState, ChessBoardRef } from 'rn-chessboard';
import { useRef, useState } from 'react';
import type { Color } from 'chess.js';
import {
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import PgnImportModal from './PgnImportModal';
import { useAppTheme } from './theme';

function playMoveHaptic(san = '') {
  if (Platform.OS !== 'ios') return;
  Haptics.impactAsync(
    /[x+#]/.test(san)
      ? Haptics.ImpactFeedbackStyle.Heavy
      : Haptics.ImpactFeedbackStyle.Light
  ).catch(console.warn);
}

export default function App() {
  const { scheme, colors } = useAppTheme();
  const buttonStyle = [styles.button, { backgroundColor: colors.surface }];
  const chessBoardRef = useRef<ChessBoardRef>(null);
  const [orientation, setOrientation] = useState<Color>('w');
  const [history, setHistory] = useState<ChessBoardHistoryState | null>(null);
  const [importOpen, setImportOpen] = useState(false);

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
    <SafeAreaView style={[styles.main, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
      />
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
          accessibilityLabel="Import PGN"
          style={buttonStyle}
          onPress={() => setImportOpen(true)}
        >
          <Text style={{ color: colors.text }}>Import PGN</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Undo last move"
          accessibilityState={{ disabled: !history?.canUndo }}
          disabled={!history?.canUndo}
          style={[buttonStyle, !history?.canUndo && styles.disabled]}
          onPress={() => chessBoardRef.current?.undo()}
        >
          <Text style={{ color: colors.text }}>Undo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Reset game"
          style={buttonStyle}
          onPress={() => chessBoardRef.current?.reset()}
        >
          <Text style={{ color: colors.text }}>Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Flip board"
          style={buttonStyle}
          onPress={toggleOrientation}
        >
          <Text style={{ color: colors.text }}>Flip</Text>
        </TouchableOpacity>
      </View>
      {importOpen && (
        <PgnImportModal
          onImport={(pgn) => chessBoardRef.current?.loadPgn(pgn)}
          onClose={() => setImportOpen(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  disabled: { opacity: 0.35 },
  button: {
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
