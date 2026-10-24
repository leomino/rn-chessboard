import { Chess, type Color, type PieceSymbol } from 'chess.js';
import { useChessStore } from '../store/chessStore';
import { usePromotionStore } from '../store/promotionStore';
import { cloneChess } from '../utils/history';

beforeEach(() => {
  useChessStore.setState({
    ...useChessStore.getInitialState(),
    chess: new Chess(),
  });
  usePromotionStore.getState().cancelModal();
});

function finish() {
  const { transition, finishTransition } = useChessStore.getState();
  expect(transition).not.toBeNull();
  finishTransition(transition!.id);
}

async function play(san: string) {
  const state = useChessStore.getState();
  const expected = cloneChess(state.chess).move(san);
  const pending = state.move(expected.from, expected.to);
  if (expected.promotion) {
    expect(usePromotionStore.getState().modalOpen).toBe(true);
    usePromotionStore.getState().closeModal(expected.promotion);
  }
  await pending;
}

function snapshot() {
  const { chess, pieceIds } = useChessStore.getState();
  return {
    fen: chess.fen(),
    history: chess.history(),
    pieceIds,
    repetition: chess.isThreefoldRepetition(),
    gameOver: chess.isGameOver(),
    legalMoves: chess.moves().sort(),
  };
}

const fixtures: { name: string; fen?: string; moves: string[] }[] = [
  {
    name: 'captures and subsequent moves',
    moves: ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qd8'],
  },
  { name: 'white en passant', moves: ['e4', 'a6', 'e5', 'd5', 'exd6'] },
  { name: 'black en passant', moves: ['a3', 'e5', 'a4', 'e4', 'd4', 'exd3'] },
  {
    name: 'threefold repetition',
    moves: ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8'],
  },
  { name: 'checkmate', moves: ['f3', 'e5', 'g4', 'Qh4#'] },
];

for (const color of ['w', 'b'] as Color[]) {
  for (const san of ['O-O', 'O-O-O']) {
    fixtures.push({
      name: `${color} ${san}`,
      fen: `r3k2r/8/8/8/8/8/8/R3K2R ${color} KQkq - 0 1`,
      moves: [san],
    });
  }
  for (const piece of ['q', 'r', 'b', 'n'] as PieceSymbol[]) {
    for (const capture of [false, true]) {
      fixtures.push({
        name: `${color} ${capture ? 'capture-' : ''}promotion to ${piece}`,
        fen:
          color === 'w'
            ? `${capture ? '1r5k' : '7k'}/P7/8/8/8/8/8/7K w - - 0 1`
            : `7k/8/8/8/8/8/p7/${capture ? '1R5K' : '7K'} b - - 0 1`,
        moves: [
          `${capture ? 'axb' : 'a'}${color === 'w' ? '8' : '1'}=${piece.toUpperCase()}`,
        ],
      });
    }
  }
}

it.each(fixtures)(
  'round-trips every position and identity: $name',
  async ({ fen, moves }) => {
    if (fen) useChessStore.setState({ chess: new Chess(fen) });
    const positions = [snapshot()];
    for (const san of moves) {
      await play(san);
      positions.push(snapshot());
    }
    const timeline = useChessStore.getState().historyEntries;
    const played = useChessStore.getState().lastPlayedMove;
    for (let index = moves.length - 1; index >= 0; index--) {
      expect(useChessStore.getState().goBack()).toBe(true);
      expect(snapshot()).toEqual(positions[index]);
      expect(useChessStore.getState().getHistoryState()).toMatchObject({
        index,
        length: moves.length,
        isAnimating: true,
        canGoBack: false,
        canGoForward: false,
      });
      expect(useChessStore.getState().goBack()).toBe(false);
      expect(useChessStore.getState().goForward()).toBe(false);
      const pieces = useChessStore.getState().transition!.pieces;
      expect(new Set(pieces.map((piece) => piece.id)).size).toBe(pieces.length);
      finish();
    }
    expect(useChessStore.getState().goBack()).toBe(false);
    for (let index = 1; index <= moves.length; index++) {
      expect(useChessStore.getState().goForward()).toBe(true);
      expect(snapshot()).toEqual(positions[index]);
      expect(usePromotionStore.getState().modalOpen).toBe(false);
      finish();
    }
    expect(useChessStore.getState().goForward()).toBe(false);
    expect(useChessStore.getState().historyEntries).toBe(timeline);
    expect(useChessStore.getState().lastPlayedMove).toBe(played);
    expect(useChessStore.getState().getHistoryState()).toMatchObject({
      index: moves.length,
      length: moves.length,
      isReviewing: false,
      isAnimating: false,
    });
  }
);

it('keeps earlier positions read-only and allows continuing at the latest position', async () => {
  await play('e4');
  await play('e5');
  useChessStore.setState({ selectedSquare: 'g1' });
  useChessStore.getState().goBack();
  expect(useChessStore.getState().selectedSquare).toBeNull();
  finish();
  const before = snapshot();
  await useChessStore.getState().selectSquare('d7');
  await useChessStore.getState().move('d7', 'd5');
  expect(snapshot()).toEqual(before);
  expect(useChessStore.getState().selectedSquare).toBeNull();
  useChessStore.getState().goForward();
  finish();
  await play('Nf3');
  expect(useChessStore.getState().chess.history()).toEqual(['e4', 'e5', 'Nf3']);
  expect(useChessStore.getState().historyEntries).toHaveLength(3);
});

it('holds the navigation lock through a drag and ignores obsolete gesture callbacks', async () => {
  await play('e4');
  const {
    positionRevision: revision,
    beginDrag,
    endDrag,
  } = useChessStore.getState();
  beginDrag('e7', revision);
  expect(useChessStore.getState().getHistoryState().canGoBack).toBe(false);
  expect(useChessStore.getState().goBack()).toBe(false);
  await useChessStore.getState().move('e7', 'e5');
  expect(useChessStore.getState().chess.history()).toEqual(['e4']);
  await endDrag('e7', 'e5', revision);
  expect(useChessStore.getState().chess.history()).toEqual(['e4', 'e5']);
  expect(useChessStore.getState().drag).toBeNull();
  useChessStore.getState().goBack();
  finish();
  useChessStore.getState().goForward();
  finish();
  beginDrag('g1', revision);
  await endDrag('e7', 'e6', revision);
  await useChessStore.getState().selectSquare('g1', revision);
  expect(useChessStore.getState().drag).toBeNull();
  expect(useChessStore.getState().selectedSquare).toBeNull();
  expect(useChessStore.getState().chess.history()).toEqual(['e4', 'e5']);
});

it('releases a cancelled drag', async () => {
  await play('e4');
  const { beginDrag, endDrag, positionRevision } = useChessStore.getState();
  beginDrag('e7', positionRevision);
  await endDrag('e7', null, positionRevision);
  expect(useChessStore.getState().drag).toBeNull();
  expect(useChessStore.getState().getHistoryState().canGoBack).toBe(true);
});

it('blocks navigation and concurrent moves while promotion is pending', async () => {
  useChessStore.setState({ chess: new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1') });
  await play('Kg1');
  await play('Kg8');
  const pending = useChessStore.getState().move('a7', 'a8');
  expect(useChessStore.getState().goBack()).toBe(false);
  expect(useChessStore.getState().getHistoryState().canGoBack).toBe(false);
  await useChessStore.getState().move('g1', 'f1');
  expect(useChessStore.getState().historyEntries).toHaveLength(2);
  usePromotionStore.getState().closeModal('n');
  await pending;
  expect(useChessStore.getState().historyEntries).toHaveLength(3);
  expect(useChessStore.getState().getHistoryState().canGoBack).toBe(true);
});

it('cancels an outstanding promotion when the board releases its interactions', async () => {
  useChessStore.setState({ chess: new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1') });
  const pending = useChessStore.getState().move('a7', 'a8');
  useChessStore.getState().releaseInteractions();
  await pending;
  expect(useChessStore.getState().chess.get('a7')).toMatchObject({ type: 'p' });
  expect(useChessStore.getState().historyEntries).toHaveLength(0);
  expect(useChessStore.getState().movePending).toBe(false);
  expect(usePromotionStore.getState().modalOpen).toBe(false);
});

it('settles rotation at the target and rejects a stale animation completion', async () => {
  await play('e4');
  useChessStore.getState().goBack();
  const previousId = useChessStore.getState().transition!.id;
  useChessStore.getState().setOrientation('b');
  expect(useChessStore.getState().transition).toBeNull();
  expect(useChessStore.getState().chess.history()).toEqual([]);
  expect(useChessStore.getState().orientation).toBe('b');
  useChessStore.getState().goForward();
  const next = useChessStore.getState().transition;
  useChessStore.getState().finishTransition(previousId);
  expect(useChessStore.getState().transition).toBe(next);
  finish();
});

it('releases the move lock after an illegal move', async () => {
  await play('e4');
  const before = snapshot();
  await expect(useChessStore.getState().move('e7', 'e4')).rejects.toThrow();
  expect(snapshot()).toEqual(before);
  expect(useChessStore.getState().getHistoryState().canGoBack).toBe(true);
});

it('describes both castling pieces and the en passant victim by identity', async () => {
  useChessStore.setState({
    chess: new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'),
  });
  await play('O-O');
  useChessStore.getState().goBack();
  const moved = useChessStore
    .getState()
    .transition!.pieces.filter(
      (piece) => piece.from?.square !== piece.to?.square
    );
  expect(moved).toMatchObject([
    { id: 'h1', from: { square: 'f1' }, to: { square: 'h1' } },
    { id: 'e1', from: { square: 'g1' }, to: { square: 'e1' } },
  ]);
  useChessStore.setState({
    ...useChessStore.getInitialState(),
    chess: new Chess(),
  });
  for (const san of ['e4', 'a6', 'e5', 'd5', 'exd6']) await play(san);
  useChessStore.getState().goBack();
  expect(useChessStore.getState().transition!.pieces).toContainEqual({
    id: 'd7',
    from: null,
    to: { id: 'd7', square: 'd5', type: 'p', color: 'b' },
  });
});

it.each(fixtures)(
  'seeks directly without losing chess state: $name',
  async ({ fen, moves }) => {
    if (fen) useChessStore.setState({ chess: new Chess(fen) });
    const positions = [snapshot()];
    for (const san of moves) {
      await play(san);
      positions.push(snapshot());
    }
    const entries = useChessStore.getState().historyEntries;
    const publicMoves = useChessStore.getState().getHistoryState().moves;
    const lastPlayed = useChessStore.getState().lastPlayedMove;
    for (const index of [
      0,
      moves.length,
      0,
      1,
      Math.floor(moves.length / 2),
      moves.length,
    ]) {
      expect(useChessStore.getState().seekTo(index, { animated: false })).toBe(
        true
      );
      expect(snapshot()).toEqual(positions[index]);
      expect(useChessStore.getState().historyEntries).toBe(entries);
      expect(useChessStore.getState().getHistoryState().moves).toBe(
        publicMoves
      );
      expect(useChessStore.getState().transition).toBeNull();
      expect(useChessStore.getState().lastPlayedMove).toBe(lastPlayed);
      expect(usePromotionStore.getState().modalOpen).toBe(false);
    }
  }
);

it('accepts the latest seek during playback and ignores obsolete completions', async () => {
  for (const san of ['e4', 'e5', 'Nf3', 'Nc6']) await play(san);
  const { seekTo, finishTransition } = useChessStore.getState();
  seekTo(0);
  const firstId = useChessStore.getState().transition!.id;
  seekTo(3);
  const secondId = useChessStore.getState().transition!.id;
  finishTransition(firstId);
  expect(useChessStore.getState().transition?.id).toBe(secondId);
  seekTo(1, { animated: false });
  finishTransition(secondId);
  expect(useChessStore.getState().chess.history()).toEqual(['e4']);
  expect(useChessStore.getState().transition).toBeNull();
  seekTo(4);
  // Beginning a scrub at the current destination settles the animation.
  expect(seekTo(4, { animated: false })).toBe(true);
  expect(useChessStore.getState().transition).toBeNull();
  await play('Bb5');
  expect(useChessStore.getState().historyEntries).toHaveLength(5);
  useChessStore.setState({ selectedSquare: 'a7' });
  seekTo(5, { animated: false });
  expect(useChessStore.getState().selectedSquare).toBeNull();
});

it('rejects invalid seek indices and respects drag and promotion locks', async () => {
  await play('e4');
  const before = snapshot();
  for (const index of [-1, 2, 0.5, NaN, Infinity]) {
    expect(useChessStore.getState().seekTo(index)).toBe(false);
    expect(snapshot()).toEqual(before);
  }
  const { beginDrag, endDrag, positionRevision } = useChessStore.getState();
  beginDrag('e7', positionRevision);
  expect(useChessStore.getState().getHistoryState().canSeek).toBe(false);
  expect(useChessStore.getState().seekTo(0)).toBe(false);
  await endDrag('e7', null, positionRevision);
  expect(useChessStore.getState().getHistoryState().canSeek).toBe(true);
  useChessStore.setState({
    ...useChessStore.getInitialState(),
    chess: new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1'),
  });
  const pending = useChessStore.getState().move('a7', 'a8');
  expect(useChessStore.getState().getHistoryState().canSeek).toBe(false);
  expect(useChessStore.getState().seekTo(0)).toBe(false);
  usePromotionStore.getState().cancelModal();
  await pending;
});

it('numbers public moves from a custom starting position, including Black to move', async () => {
  useChessStore.setState({ chess: new Chess('7k/8/8/8/8/8/8/7K b - - 0 23') });
  await play('Kg8');
  await play('Kg1');
  expect(useChessStore.getState().getHistoryState().moves).toEqual([
    { index: 1, san: 'Kg8', color: 'b', moveNumber: 23 },
    { index: 2, san: 'Kg1', color: 'w', moveNumber: 24 },
  ]);
});

it('seeks in a long game without parsing, replaying, or mutating recorded positions', async () => {
  for (let i = 0; i < 120; i++)
    await play(['Nf3', 'Nf6', 'Ng1', 'Ng8'][i % 4]!);
  const entries = useChessStore.getState().historyEntries;
  const initial = entries[0]!.chessBefore;
  const latest = entries.at(-1)!.chessAfter;
  const snapshots = [initial, ...entries.map((entry) => entry.chessAfter)];
  const fens = snapshots.map((chess) => chess.fen());
  const expensive = [
    jest.spyOn(Chess.prototype, 'pgn'),
    jest.spyOn(Chess.prototype, 'loadPgn'),
    jest.spyOn(Chess.prototype, 'move'),
    jest.spyOn(Chess.prototype, 'undo'),
  ];
  try {
    for (let i = 0; i < 240; i++) {
      const target = (i * 37) % 121;
      expect(useChessStore.getState().seekTo(target)).toBe(true);
      expect(useChessStore.getState().chess).toBe(snapshots[target]);
    }
    for (const spy of expensive) expect(spy).not.toHaveBeenCalled();
  } finally {
    for (const spy of expensive) spy.mockRestore();
  }
  useChessStore.getState().seekTo(120, { animated: false });
  await play('e4');
  expect(useChessStore.getState().chess).not.toBe(latest);
  expect(snapshots.map((chess) => chess.fen())).toEqual(fens);
  expect(latest.history()).toHaveLength(120);
  expect(latest.isThreefoldRepetition()).toBe(true);
  expect(initial.history()).toEqual([]);
});

it('rejects invalid animation durations without changing the position', async () => {
  await play('e4');
  const before = snapshot();
  for (const duration of [-1, NaN, Infinity]) {
    expect(useChessStore.getState().seekTo(0, { duration })).toBe(false);
    expect(snapshot()).toEqual(before);
  }
  expect(useChessStore.getState().seekTo(0, { duration: 0 })).toBe(true);
  expect(useChessStore.getState().transition?.duration).toBe(0);
});

it.each(fixtures)(
  'permanently undoes each half-move: $name',
  async ({ fen, moves }) => {
    if (fen) useChessStore.setState({ chess: new Chess(fen) });
    const positions = [snapshot()];
    for (const san of moves) {
      await play(san);
      positions.push(snapshot());
    }
    for (let index = moves.length - 1; index >= 0; index--) {
      expect(useChessStore.getState().undo()).toBe(true);
      expect(snapshot()).toEqual(positions[index]);
      expect(useChessStore.getState().historyEntries).toHaveLength(index);
      expect(useChessStore.getState().getHistoryState()).toMatchObject({
        index,
        length: index,
        canUndo: index > 0,
        isReviewing: false,
      });
      finish();
      expect(useChessStore.getState().goForward()).toBe(false);
      expect(useChessStore.getState().seekTo(index + 1)).toBe(false);
    }
    expect(useChessStore.getState().undo()).toBe(false);
  }
);

it('undo removes the last recorded move while reviewing, then permits a replacement move', async () => {
  for (const san of ['e4', 'e5', 'Nf3']) await play(san);
  useChessStore.getState().seekTo(0);
  const oldTransition = useChessStore.getState().transition!.id;
  expect(useChessStore.getState().undo()).toBe(true);
  useChessStore.getState().finishTransition(oldTransition);
  expect(useChessStore.getState().transition).not.toBeNull();
  expect(useChessStore.getState().chess.history()).toEqual(['e4', 'e5']);
  expect(useChessStore.getState().getHistoryState()).toMatchObject({
    index: 2,
    length: 2,
    isReviewing: false,
  });
  finish();
  await play('Nc3');
  expect(
    useChessStore
      .getState()
      .getHistoryState()
      .moves.map((move) => move.san)
  ).toEqual(['e4', 'e5', 'Nc3']);
  useChessStore.getState().seekTo(0, { animated: false });
  useChessStore.getState().seekTo(3, { animated: false });
  expect(useChessStore.getState().chess.history()).toEqual(['e4', 'e5', 'Nc3']);
});

it('blocks undo during a drag, and reset invalidates stale gesture callbacks', async () => {
  await play('e4');
  const { beginDrag, endDrag, positionRevision } = useChessStore.getState();
  beginDrag('e7', positionRevision);
  expect(useChessStore.getState().getHistoryState().canUndo).toBe(false);
  expect(useChessStore.getState().undo()).toBe(false);
  useChessStore.getState().reset();
  await endDrag('e7', 'e5', positionRevision);
  await useChessStore.getState().move('e2', 'e4', positionRevision);
  expect(useChessStore.getState().chess.fen()).toBe(new Chess().fen());
  expect(useChessStore.getState().drag).toBeNull();
  expect(useChessStore.getState().selectedSquare).toBeNull();
  await play('d4');
  expect(useChessStore.getState().chess.history()).toEqual(['d4']);
});

it('reset cancels pending promotion and prevents it from writing into the new game', async () => {
  useChessStore.setState({ chess: new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1') });
  await play('Kg1');
  await play('Kg8');
  const promotion = useChessStore.getState().move('a7', 'a8');
  expect(useChessStore.getState().undo()).toBe(false);
  useChessStore.getState().reset();
  await play('e4');
  usePromotionStore.getState().closeModal('q');
  await promotion;
  expect(usePromotionStore.getState().modalOpen).toBe(false);
  expect(useChessStore.getState().movePending).toBe(false);
  expect(useChessStore.getState().chess.history()).toEqual(['e4']);
  expect(useChessStore.getState().historyEntries).toHaveLength(1);
});

it('reset clears history, identities and playback while preserving orientation', async () => {
  const initial = snapshot();
  for (const san of ['e4', 'd5', 'exd5']) await play(san);
  useChessStore.getState().setOrientation('b');
  useChessStore.getState().seekTo(0);
  const oldTransition = useChessStore.getState().transition!.id;
  useChessStore.getState().reset();
  expect(snapshot()).toEqual(initial);
  expect(useChessStore.getState().orientation).toBe('b');
  expect(useChessStore.getState().lastPlayedMove).toBeNull();
  expect(useChessStore.getState().getHistoryState()).toMatchObject({
    index: 0,
    length: 0,
    moves: [],
    canUndo: false,
    isAnimating: false,
  });
  await play('d4');
  useChessStore.getState().goBack();
  const transition = useChessStore.getState().transition;
  useChessStore.getState().finishTransition(oldTransition);
  expect(useChessStore.getState().transition).toBe(transition);
});
