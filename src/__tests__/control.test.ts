import { Chess } from 'chess.js';
import { createChessStore } from '../store/chessStore';

const standard = new Chess().fen();
const promotion = '7k/P7/8/8/8/8/8/7K w - - 0 1';
const castle = 'r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 17 23';
const ep = '7k/8/8/3pP3/8/8/8/7K w - d6 0 23';

it.each([
  standard,
  promotion,
  castle,
  ep,
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 7 23',
])('loads all six FEN fields and replaces the timeline: %s', async (fen) => {
  const store = createChessStore();
  const api = store.getState();
  await api.playMove('e2e4', { animated: false });
  api.setOrientation('b');
  api.loadFen(fen);
  expect(api.getFen()).toBe(fen);
  expect(store.getState().chess.history()).toEqual([]);
  expect(api.getHistoryState()).toMatchObject({ index: 0, length: 0 });
  expect(store.getState().orientation).toBe('b');
  api.loadFen(standard);
  api.loadFen(fen);
  expect(api.getFen()).toBe(fen);
  expect(createChessStore(fen).getState().getFen()).toBe(fen);
});

it.each([
  '',
  'invalid',
  '8/8/8/8/8/8/8/8 w - - 0 1',
  '7k/8/8/8/8/8/8/7K w - -',
  '7k/8/8/8/8/8/8/7K x - - 0 1',
])('rejects invalid FEN atomically: %s', (fen) => {
  const store = createChessStore(promotion);
  store.getState().beginDrag('a7', 0);
  const before = store.getState();
  expect(() => before.loadFen(fen)).toThrow();
  expect(store.getState()).toBe(before);
  expect(() => createChessStore(fen)).toThrow();
});

it.each([
  { fen: standard, moves: ['e2e4', 'd7d5', 'e4d5'] },
  { fen: castle, moves: ['e8g8', 'e1c1'] },
  { fen: ep, moves: ['e5d6'] },
  ...['q', 'r', 'b', 'n'].map((piece) => ({
    fen: promotion,
    moves: [`a7a8${piece}`],
  })),
  { fen: '7k/8/8/8/8/8/p7/7K b - - 0 1', moves: ['a2a1n'] },
])('executes and navigates special moves: $moves', async ({ fen, moves }) => {
  const store = createChessStore(fen);
  const api = store.getState();
  const expected = new Chess(fen);
  for (const uci of moves) {
    expected.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4],
    });
    const pending = api.playMove(uci);
    const { transition } = store.getState();
    expect(transition).not.toBeNull();
    expect(api.getFen()).toBe(expected.fen({ forceEnpassantSquare: true }));
    expect(store.getState().promotionStore.getState().modalOpen).toBe(false);
    api.finishTransition(transition!.id);
    await expect(pending).resolves.toMatchObject({
      accepted: true,
      animation: 'finished',
    });
  }
  expect(api.getHistoryState().length).toBe(moves.length);
  api.seekTo(0, { animated: false });
  expect(api.getFen()).toBe(fen);
  expect(await api.playMove(moves[0]!)).toEqual({
    accepted: false,
    reason: 'reviewing',
  });
  api.seekTo(moves.length, { animated: false });
  expect(api.getFen()).toBe(expected.fen({ forceEnpassantSquare: true }));
});

it('rejects competing commands and resolves each sequential animation only at completion', async () => {
  const store = createChessStore();
  const api = store.getState();
  for (const move of ['e2e4', 'e7e5', 'g1f3']) {
    const done = jest.fn();
    const pending = api.playMove(move, { duration: 250 }).then(done);
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();
    expect(store.getState().transition?.duration).toBe(250);
    expect(await api.playMove('a2a3')).toEqual({
      accepted: false,
      reason: 'busy',
    });
    expect(api.goBack()).toBe(false);
    expect(api.seekTo(0)).toBe(false);
    expect(api.undo()).toBe(false);
    await api.selectSquare('a2');
    expect(store.getState().selectedSquare).toBeNull();
    api.finishTransition(store.getState().transition!.id);
    await pending;
    expect(done).toHaveBeenCalledWith(
      expect.objectContaining({ animation: 'finished' })
    );
  }
  expect(store.getState().chess.history()).toEqual(['e4', 'e5', 'Nf3']);
});

it.each(['reset', 'loadFen', 'loadPgn', 'dispose'] as const)(
  'settles promises and ignores stale completion after %s',
  async (operation) => {
    const store = createChessStore();
    const api = store.getState();
    const pending = api.playMove('e2e4');
    const oldId = store.getState().transition!.id;
    if (operation === 'loadFen') api.loadFen(promotion);
    else if (operation === 'loadPgn') api.loadPgn('1. d4 *');
    else api[operation]();
    await expect(pending).resolves.toMatchObject({
      accepted: true,
      animation: 'cancelled',
    });
    const before = store.getState();
    api.finishTransition(oldId);
    expect(store.getState()).toBe(before);
    if (operation === 'dispose')
      expect(await api.playMove('e7e5')).toEqual({
        accepted: false,
        reason: 'unmounted',
      });
  }
);

it('preserves active animation on invalid load, and settles rotation successfully', async () => {
  const store = createChessStore();
  const api = store.getState();
  const pending = api.playMove('e2e4');
  const before = store.getState();
  expect(() => api.loadFen('bad')).toThrow();
  expect(store.getState()).toBe(before);
  api.setOrientation('b');
  await expect(pending).resolves.toMatchObject({ animation: 'finished' });
  expect(api.getHistoryState().length).toBe(1);
});

it('returns clear errors without modifying the position and accepts structured moves', async () => {
  const store = createChessStore();
  const api = store.getState();
  for (const move of ['e2e5', 'e7e5', 'a7a8q'])
    expect(await api.playMove(move)).toEqual({
      accepted: false,
      reason: 'illegal',
    });
  for (const move of ['e4', 'e2e4x', 'e2e4qq', 'i2e4'])
    expect(await api.playMove(move)).toEqual({
      accepted: false,
      reason: 'invalid',
    });
  for (const duration of [-1, NaN, Infinity])
    expect(await api.playMove('e2e4', { duration })).toEqual({
      accepted: false,
      reason: 'invalid',
    });
  expect(api.getFen()).toBe(standard);
  expect(
    await api.playMove({ from: 'e2', to: 'e4' }, { animated: false })
  ).toMatchObject({ accepted: true });
});

it.each(['tap', 'drag', 'promotion'] as const)(
  'intercepts %s exactly once after legal/promotion resolution',
  async (gesture) => {
    const store = createChessStore(
      gesture === 'promotion' ? promotion : standard
    );
    const api = store.getState();
    const attempt = jest.fn(() => false);
    api.configureInteraction(true, 'both', attempt);
    const before = api.getFen();
    if (gesture === 'tap') {
      await api.selectSquare('e2');
      await api.selectSquare('e4');
    } else if (gesture === 'drag') {
      api.beginDrag('e2', 0);
      await api.endDrag('e2', 'e4', 0);
    } else {
      const pending = api.move('a7', 'a8');
      expect(attempt).not.toHaveBeenCalled();
      api.promotionStore.getState().closeModal('n');
      await pending;
    }
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(attempt).toHaveBeenCalledWith(
      expect.objectContaining(
        gesture === 'promotion'
          ? { from: 'a7', to: 'a8', promotion: 'n' }
          : { from: 'e2', to: 'e4' }
      ),
      { fen: before }
    );
    expect(api.getFen()).toBe(before);
    expect(api.getHistoryState().length).toBe(0);
    expect(store.getState()).toMatchObject({
      drag: null,
      selectedSquare: null,
      movePending: false,
      positionEvent: null,
    });
    expect(store.getState().positionRevision).toBeGreaterThan(0);
    attempt.mockReturnValue(true);
    await api.playMove(gesture === 'promotion' ? 'a7a8n' : 'e2e4', {
      animated: false,
    });
    expect(attempt).toHaveBeenCalledTimes(1);
  }
);

it('accepts user moves, safely rejects callback exceptions, and guards reentrant loads', async () => {
  const store = createChessStore();
  const api = store.getState();
  api.configureInteraction(true, 'both', () => {
    throw new Error('host error');
  });
  await api.move('e2', 'e4');
  expect(api.getFen()).toBe(standard);
  api.configureInteraction(true, 'both', () => {
    api.loadFen(promotion);
    return true;
  });
  await api.move('e2', 'e4');
  expect(api.getFen()).toBe(promotion);
  api.loadFen(standard);
  api.configureInteraction(true, 'both', () => true);
  await api.move('e2', 'e4');
  expect(store.getState().positionEvent?.source).toBe('user');
});

it('disables and restores user input, restricts color, and cancels pending promotion', async () => {
  const store = createChessStore();
  const api = store.getState();
  await api.selectSquare('e2');
  api.configureInteraction(false, 'both');
  expect(store.getState().selectedSquare).toBeNull();
  api.beginDrag('e2', store.getState().positionRevision);
  await api.selectSquare('e2');
  await api.move('e2', 'e4');
  expect(api.getFen()).toBe(standard);
  expect(store.getState().drag).toBeNull();
  await api.playMove('e2e4', { animated: false });
  api.configureInteraction(true, 'w');
  await api.selectSquare('e7');
  expect(store.getState().selectedSquare).toBeNull();
  await api.playMove('e7e5', { animated: false });
  await api.move('g1', 'f3');
  expect(api.getHistoryState().length).toBe(3);
  api.loadFen(promotion);
  const pending = api.move('a7', 'a8');
  api.configureInteraction(false, 'both');
  await pending;
  expect(api.promotionStore.getState().modalOpen).toBe(false);
  expect(api.getFen()).toBe(promotion);
  api.configureInteraction(true, 'both');
  await api.selectSquare('a7');
  expect(store.getState().selectedSquare).toBe('a7');
});

it('keeps promotion, history, drag and animation resources independent', async () => {
  const first = createChessStore(promotion);
  const second = createChessStore();
  const pendingPromotion = first.getState().move('a7', 'a8');
  const pendingMove = second.getState().playMove('e2e4');
  first.getState().dispose();
  await pendingPromotion;
  expect(second.getState().transition).not.toBeNull();
  second.getState().finishTransition(second.getState().transition!.id);
  await expect(pendingMove).resolves.toMatchObject({ animation: 'finished' });
  expect(second.getState().getHistoryState().length).toBe(1);
});
