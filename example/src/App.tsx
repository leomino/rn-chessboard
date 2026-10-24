import ChessBoard, { ChessBoardHistory } from 'rn-chessboard';
import type { ChessBoardHistoryState, ChessBoardRef } from 'rn-chessboard';
import { useEffect, useRef, useState } from 'react';
import type { Color } from 'chess.js';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  Button,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import PgnImportModal from './PgnImportModal';
import { useAppTheme } from './theme';
import TrainingDemo, { TRAINING_FEN } from './TrainingDemo';

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
  const [interactionEnabled, setInteractionEnabled] = useState(true);
  const [fen, setFen] = useState('');
  const [commandResult, setCommandResult] = useState('');
  useEffect(() => {
    setFen(chessBoardRef.current?.getFen() ?? '');
  }, []);

  const playAnimated = async () => {
    const handle = chessBoardRef.current;
    if (!handle) return;
    const move = handle.getFen().split(' ')[1] === 'w' ? 'e2e4' : 'e7e5';
    const result = await handle.playMove(move, { duration: 350 });
    if (chessBoardRef.current !== handle) return;
    setCommandResult(
      result.accepted
        ? `${move}: ${result.animation}`
        : `${move}: ${result.reason}`
    );
  };

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
      <ScrollView>
        <Text style={[styles.heading, { color: colors.text }]}>
          Programmatic control
        </Text>
        <ChessBoard
          initialOrientation={orientation}
          ref={chessBoardRef}
          onHistoryChange={setHistory}
          onMove={(move) => playMoveHaptic(move.san)}
          interactionEnabled={interactionEnabled}
          onPositionChange={(event) => setFen(event.fen)}
        />
        <Text selectable style={{ color: colors.text }}>
          {fen}
        </Text>
        <Text style={{ color: colors.text }}>{commandResult}</Text>
        <Button
          title="Load custom FEN (Black to move)"
          onPress={() => chessBoardRef.current?.loadFen(TRAINING_FEN)}
        />
        <Button title="Play animated e-pawn move" onPress={playAnimated} />
        <Button
          title={
            interactionEnabled ? 'Disable interaction' : 'Enable interaction'
          }
          onPress={() => setInteractionEnabled((enabled) => !enabled)}
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
        <TrainingDemo />
      </ScrollView>
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
  heading: { fontSize: 22, fontWeight: '600', paddingVertical: 12 },
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
