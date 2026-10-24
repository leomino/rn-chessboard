import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Button, TextInput } from 'react-native';
import PgnImportModal from '../PgnImportModal';
import { createChessStore } from '../../../src/store/chessStore';

const useChessStore = createChessStore();

jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  Platform: { OS: 'ios' },
  useColorScheme: () => 'light',
  Button: 'Button',
  Keyboard: { dismiss: jest.fn() },
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Modal: 'Modal',
  SafeAreaView: 'SafeAreaView',
  ScrollView: 'ScrollView',
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
}));

let renderer: ReactTestRenderer;
const onClose = jest.fn();

beforeEach(() => {
  onClose.mockClear();
  useChessStore.getState().reset();
  act(() => {
    renderer = create(
      <PgnImportModal
        onImport={useChessStore.getState().loadPgn}
        onClose={onClose}
      />
    );
  });
});

afterEach(() => act(() => renderer.unmount()));

const importButton = () =>
  renderer.root
    .findAllByType(Button)
    .find((button) => button.props.title === 'Import game')!;

it('enables import after pasting a PGN and closes after loading it', () => {
  expect(importButton().props.disabled).toBe(true);
  act(() =>
    renderer.root.findByType(TextInput).props.onChangeText('1. e4 e5 *')
  );
  expect(importButton().props.disabled).toBe(false);
  act(() => importButton().props.onPress());
  expect(useChessStore.getState().chess.history()).toEqual(['e4', 'e5']);
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('keeps invalid text editable, shows an error, and allows retrying', () => {
  useChessStore.getState().loadPgn('1. d4 *');
  act(() =>
    renderer.root.findByType(TextInput).props.onChangeText('1. e4 e5 2. Bh6')
  );
  act(() => importButton().props.onPress());
  expect(renderer.root.findByType(TextInput).props.value).toBe(
    '1. e4 e5 2. Bh6'
  );
  expect(
    renderer.root.findByProps({ accessibilityRole: 'alert' })
  ).toBeDefined();
  expect(useChessStore.getState().chess.history()).toEqual(['d4']);
  expect(onClose).not.toHaveBeenCalled();
  act(() =>
    renderer.root.findByType(TextInput).props.onChangeText('1. e4 e5 *')
  );
  expect(
    renderer.root.findAllByProps({ accessibilityRole: 'alert' })
  ).toHaveLength(0);
  act(() => importButton().props.onPress());
  expect(useChessStore.getState().chess.history()).toEqual(['e4', 'e5']);
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('cancels without loading the pasted game', () => {
  act(() => renderer.root.findByType(TextInput).props.onChangeText('1. e4 *'));
  act(() =>
    renderer.root
      .findAllByType(Button)
      .find((button) => button.props.title === 'Cancel')!
      .props.onPress()
  );
  expect(useChessStore.getState().chess.history()).toEqual([]);
  expect(onClose).toHaveBeenCalledTimes(1);
});
