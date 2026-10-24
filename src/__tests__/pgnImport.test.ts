import { Chess } from 'chess.js';
import { useChessStore, usePromotionStore } from '../__fixtures__/store';

beforeEach(() => {
  useChessStore.setState({
    ...useChessStore.getInitialState(),
    chess: new Chess(),
  });
  usePromotionStore.getState().cancelModal();
});

it('imports an annotated main line and replaces the existing game atomically', async () => {
  await useChessStore.getState().move('d2', 'd4');
  useChessStore.getState().setOrientation('b');
  const changes = jest.fn();
  const unsubscribe = useChessStore.subscribe(changes);
  const pgn =
    '\uFEFF[Event "Pasted game"]\r\n[Result "*"]\r\n\r\n1. e4 {Hello} e5 2. Nf3 $1 (2. Bc4 Nc6) Nc6 *';

  useChessStore.getState().loadPgn(pgn);
  unsubscribe();

  const state = useChessStore.getState();
  expect(changes).toHaveBeenCalledTimes(1);
  expect(state.orientation).toBe('b');
  expect(state.chess.history()).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
  expect(state.chess.getHeaders().Event).toBe('Pasted game');
  expect(state.chess.getComments()).toEqual([
    expect.objectContaining({ comment: 'Hello' }),
  ]);
  expect(state.getHistoryState()).toMatchObject({
    index: 4,
    length: 4,
    canGoBack: true,
    isAnimating: false,
  });
  expect(state.lastPlayedMove).toBeNull();

  state.seekTo(0, { animated: false });
  expect(useChessStore.getState().chess.fen()).toBe(new Chess().fen());
  state.seekTo(2, { animated: false });
  expect(useChessStore.getState().chess.history()).toEqual(['e4', 'e5']);
  expect(state.historyEntries[1]!.chessAfter).toBe(
    state.historyEntries[2]!.chessBefore
  );
  state.seekTo(4, { animated: false });
  await state.move('f1', 'b5');
  expect(useChessStore.getState().chess.history()).toEqual([
    'e4',
    'e5',
    'Nf3',
    'Nc6',
    'Bb5',
  ]);
  expect(state.undo()).toBe(true);
  expect(useChessStore.getState().chess.fen()).toBe(state.chess.fen());
});

it.each([
  '',
  '   \n',
  'not a chess game',
  '1. e4 e5 2. Bh6',
  '[SetUp "1"]\n[FEN "invalid"]\n\n*',
  '1. e4 *\n\n[Event "Second game"]\n\n1. d4 *',
])('preserves the entire live state when import fails: %s', async (pgn) => {
  await useChessStore.getState().move('d2', 'd4');
  useChessStore.getState().goBack();
  const before = useChessStore.getState();
  expect(() => before.loadPgn(pgn)).toThrow();
  expect(useChessStore.getState()).toBe(before);
});

it('preserves a custom initial position and black move numbering', () => {
  const fen = 'r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 23';
  const { loadPgn, seekTo } = useChessStore.getState();
  loadPgn(`[SetUp "1"]\n[FEN "${fen}"]\n\n23... O-O 24. O-O-O *`);
  const end = useChessStore.getState();
  expect(end.historyMoves).toEqual([
    { index: 1, san: 'O-O', moveNumber: 23, color: 'b' },
    { index: 2, san: 'O-O-O', moveNumber: 24, color: 'w' },
  ]);
  expect(end.pieceIds).toMatchObject({
    g8: 'e8',
    f8: 'h8',
    c1: 'e1',
    d1: 'a1',
  });
  seekTo(0, { animated: false });
  expect(useChessStore.getState().chess.fen()).toBe(fen);
  seekTo(2);
  expect(useChessStore.getState().transition?.pieces).toContainEqual(
    expect.objectContaining({
      id: 'h8',
      from: expect.objectContaining({ square: 'h8' }),
      to: expect.objectContaining({ square: 'f8' }),
    })
  );
});

it('replays en passant and underpromotion without prompting', () => {
  const { loadPgn, seekTo } = useChessStore.getState();
  loadPgn('1. e4 a6 2. e5 d5 3. exd6 *');
  expect(useChessStore.getState().chess.get('d5')).toBeUndefined();
  expect(useChessStore.getState().pieceIds.d6).toBe('e2');
  seekTo(4, { animated: false });
  expect(useChessStore.getState().chess.get('d5')).toMatchObject({
    color: 'b',
  });

  loadPgn('[SetUp "1"]\n[FEN "7k/P7/8/8/8/8/8/7K w - - 0 1"]\n\n1. a8=N *');
  expect(useChessStore.getState().chess.get('a8')).toMatchObject({ type: 'n' });
  expect(useChessStore.getState().pieceIds.a8).toBe('a7');
  seekTo(0, { animated: false });
  expect(useChessStore.getState().chess.get('a7')).toMatchObject({ type: 'p' });
  seekTo(1, { animated: false });
  expect(useChessStore.getState().chess.get('a8')).toMatchObject({ type: 'n' });
  expect(usePromotionStore.getState().modalOpen).toBe(false);
});

it('retains repetition counts after importing and navigating', () => {
  const { loadPgn, seekTo } = useChessStore.getState();
  loadPgn('1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1 Ng8 *');
  expect(useChessStore.getState().chess.isThreefoldRepetition()).toBe(true);
  seekTo(7, { animated: false });
  expect(useChessStore.getState().chess.isThreefoldRepetition()).toBe(false);
  seekTo(8, { animated: false });
  expect(useChessStore.getState().chess.isThreefoldRepetition()).toBe(true);
});

it('cancels pending promotion and ignores stale drags and animation callbacks', async () => {
  const { loadPgn, move, beginDrag, endDrag, finishTransition } =
    useChessStore.getState();
  await move('d2', 'd4');
  useChessStore.getState().goBack();
  const transitionId = useChessStore.getState().transition!.id;
  loadPgn('1. e4 *');
  finishTransition(transitionId);
  expect(useChessStore.getState().transition).toBeNull();

  const revision = useChessStore.getState().positionRevision;
  beginDrag('e7', revision);
  loadPgn('1. d4 *');
  await endDrag('e7', 'e5', revision);
  expect(useChessStore.getState().chess.history()).toEqual(['d4']);
  expect(useChessStore.getState().drag).toBeNull();

  loadPgn('[SetUp "1"]\n[FEN "7k/P7/8/8/8/8/8/7K w - - 0 1"]\n\n*');
  const pending = move('a7', 'a8');
  expect(usePromotionStore.getState().modalOpen).toBe(true);
  const before = useChessStore.getState();
  expect(() => loadPgn('invalid')).toThrow();
  expect(useChessStore.getState()).toBe(before);
  expect(usePromotionStore.getState().modalOpen).toBe(true);
  loadPgn('1. e4 e5 *');
  await pending;
  expect(usePromotionStore.getState().modalOpen).toBe(false);
  expect(useChessStore.getState()).toMatchObject({
    movePending: false,
    selectedSquare: null,
    lastPlayedMove: null,
  });
  expect(useChessStore.getState().chess.history()).toEqual(['e4', 'e5']);
});

it('imports a zero-move game and can continue from its starting position', async () => {
  const { loadPgn, move } = useChessStore.getState();
  await move('e2', 'e4');
  loadPgn('[Event "New game"]\n\n*');
  expect(useChessStore.getState().getHistoryState()).toMatchObject({
    index: 0,
    length: 0,
  });
  await move('d2', 'd4');
  expect(useChessStore.getState().chess.history()).toEqual(['d4']);
});
