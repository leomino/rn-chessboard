import { useState } from 'react';
import {
  Button,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAppTheme } from './theme';

type Props = {
  onImport: (pgn: string) => void;
  onClose: () => void;
};

export default function PgnImportModal({ onImport, onClose }: Props) {
  const { scheme, colors } = useAppTheme();
  const [pgn, setPgn] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const importGame = () => {
    Keyboard.dismiss();
    try {
      onImport(pgn);
    } catch {
      setError(
        'Unable to import this PGN. Check the notation and paste one complete game.'
      );
      return;
    }
    onClose();
  };

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.main, { backgroundColor: colors.background }]}
      >
        <KeyboardAvoidingView
          style={styles.main}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.header}>
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: colors.text }]}
            >
              Import PGN
            </Text>
            {isEditing && (
              <Button
                title="Done"
                accessibilityLabel="Dismiss keyboard"
                onPress={Keyboard.dismiss}
              />
            )}
          </View>
          <View style={styles.actions}>
            <Button title="Cancel" onPress={onClose} />
            <Button
              title="Import game"
              disabled={!pgn.trim()}
              onPress={importGame}
            />
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={
              Platform.OS === 'ios' ? 'interactive' : 'on-drag'
            }
          >
            <Text style={[styles.description, { color: colors.secondaryText }]}>
              Paste a single game's PGN below. Importing replaces the current
              game and opens its final position. Use the history controls to
              replay it.
            </Text>
            <TextInput
              accessibilityLabel="PGN game"
              placeholder={'[Event "My game"]\n\n1. e4 e5 2. Nf3 Nc6 *'}
              placeholderTextColor={colors.placeholder}
              keyboardAppearance={scheme}
              value={pgn}
              onFocus={() => setIsEditing(true)}
              onBlur={() => setIsEditing(false)}
              onChangeText={(text) => {
                setPgn(text);
                setError(null);
              }}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              textAlignVertical="top"
              style={[
                styles.input,
                {
                  color: colors.text,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            />
            {error && (
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={[styles.error, { color: colors.error }]}
              >
                {error}
              </Text>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    minHeight: 56,
  },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 16 },
  title: { fontSize: 24, fontWeight: '600' },
  description: { fontSize: 16, lineHeight: 24 },
  input: {
    height: 220,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
  },
  error: { fontSize: 16 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
});
