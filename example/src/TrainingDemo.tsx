import { useEffect, useRef, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import ChessBoard, { type ChessBoardRef } from 'rn-chessboard';
import { useAppTheme } from './theme';

// All answer/sequence logic belongs to this consuming application.
export const TRAINING_FEN =
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
const ANSWER = 'e7e5';
const RESPONSE = 'g1f3';

export default function TrainingDemo() {
  const { colors } = useAppTheme();
  const board = useRef<ChessBoardRef>(null);
  const generation = useRef(0);
  const phase = useRef<'answer' | 'response' | 'done'>('answer');
  const [fen, setFen] = useState(TRAINING_FEN);
  const [message, setMessage] = useState(
    'Black to move: play e7–e5. Other legal moves are rejected.'
  );

  useEffect(
    () => () => {
      generation.current++;
    },
    []
  );

  const reply = async () => {
    const version = generation.current;
    const handle = board.current;
    if (!handle) return;
    const result = await handle.playMove(RESPONSE, { duration: 350 });
    if (version !== generation.current || board.current !== handle) return;
    phase.current = 'done';
    setMessage(
      result.accepted && result.animation === 'finished'
        ? 'Correct! White replied Nf3. Reset to try again.'
        : 'Response interrupted. Reset to try again.'
    );
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: colors.text }]}>
        Training demo · independent second board
      </Text>
      <Text style={{ color: colors.text }}>{message}</Text>
      <ChessBoard
        ref={board}
        initialFen={TRAINING_FEN}
        initialOrientation="b"
        movableColor="b"
        highlightedSquares={[{ square: 'e5', color: 'rgba(34,197,94,0.45)' }]}
        arrows={[{ from: 'e7', to: 'e5', color: 'rgba(34,197,94,0.7)' }]}
        onMoveAttempt={(move) => {
          const accepted =
            phase.current === 'answer' &&
            move.from + move.to + (move.promotion ?? '') === ANSWER;
          if (!accepted)
            setMessage('Try again: advance the e-pawn two squares.');
          return accepted;
        }}
        onPositionChange={(event) => {
          setFen(event.fen);
          if (event.source === 'user') {
            phase.current = 'response';
            setMessage('Correct. Playing White’s response…');
            reply();
          }
        }}
      />
      <Text selectable style={{ color: colors.text }}>
        {fen}
      </Text>
      <Button
        title="Retry training demo"
        onPress={() => {
          generation.current++;
          phase.current = 'answer';
          board.current?.loadFen(TRAINING_FEN);
          board.current?.setOrientation('b');
          setMessage(
            'Black to move: play e7–e5. Other legal moves are rejected.'
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12, paddingVertical: 20 },
  heading: { fontSize: 20, fontWeight: '600' },
});
