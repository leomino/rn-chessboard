import { Chess } from 'chess.js';
import { useChessStore } from '../store/chessStore';
import { usePromotionStore } from '../store/promotionStore';

beforeEach(() => {
  useChessStore.setState({
    ...useChessStore.getInitialState(),
    chess: new Chess(),
    selectedSquare: null,
    orientation: 'w',
  });
  usePromotionStore.setState({ modalOpen: false, modalResolver: null });
});

it('moves a selected piece legally and clears the selection', async () => {
  await useChessStore.getState().selectSquare('e2');
  await useChessStore.getState().selectSquare('e4');

  const { chess, selectedSquare } = useChessStore.getState();
  expect(chess.get('e2')).toBeUndefined();
  expect(chess.get('e4')).toMatchObject({ type: 'p', color: 'w' });
  expect(chess.turn()).toBe('b');
  expect(selectedSquare).toBeNull();
});

it('ignores illegal destinations without changing the position', async () => {
  const before = useChessStore.getState().chess.fen();
  await useChessStore.getState().selectSquare('e2');
  await useChessStore.getState().selectSquare('e5');

  expect(useChessStore.getState().chess.fen()).toBe(before);
  expect(useChessStore.getState().selectedSquare).toBeNull();
});

it('does not select the opponent’s pieces', async () => {
  await useChessStore.getState().selectSquare('e7');
  expect(useChessStore.getState().selectedSquare).toBeNull();
});

it('preserves move history across turns and captures', async () => {
  const { move } = useChessStore.getState();
  await move('e2', 'e4');
  await move('d7', 'd5');
  await move('e4', 'd5');

  expect(useChessStore.getState().chess.history()).toEqual([
    'e4',
    'd5',
    'exd5',
  ]);
  expect(useChessStore.getState().chess.get('d5')).toMatchObject({
    color: 'w',
  });
});

it('waits for the selected promotion piece before completing a move', async () => {
  useChessStore.setState({
    chess: new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1'),
  });
  const pawnId = useChessStore.getState().pieceIds.a7;
  const pendingMove = useChessStore.getState().move('a7', 'a8');

  expect(usePromotionStore.getState().modalOpen).toBe(true);
  expect(useChessStore.getState().chess.get('a7')).toMatchObject({ type: 'p' });

  usePromotionStore.getState().closeModal('n');
  await pendingMove;

  expect(useChessStore.getState().chess.get('a8')).toMatchObject({ type: 'n' });
  expect(useChessStore.getState().pieceIds.a8).toBe(pawnId);
  expect(usePromotionStore.getState().modalOpen).toBe(false);
  expect(usePromotionStore.getState().modalResolver).toBeNull();
});

it('rotates the board without resetting the game', async () => {
  await useChessStore.getState().move('e2', 'e4');
  const position = useChessStore.getState().chess.fen();
  useChessStore.getState().setOrientation('b');

  expect(useChessStore.getState().orientation).toBe('b');
  expect(useChessStore.getState().chess.fen()).toBe(position);
});
