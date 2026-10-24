# React Native Chessboard

An interactive chessboard for React Native with drag-and-drop play, legal move
validation, PGN import, and animated game review. Build chess apps, training tools,
and game viewers for iOS and Android.

<div align="center" markdown="1">
  <img src="https://raw.githubusercontent.com/leomino/rn-chessboard/main/media/chessboard-preview.gif" alt="React Native Chessboard preview">
</div>

[Installation](#installation) · [Usage](#usage) · [API reference](#props-and-ref) ·
[Example app](#example-app) · [Current limitations](#current-limitations)

## Features

### Play and interact

- **Drag-and-drop and tap-to-move** — move pieces with either gesture, with an
  enlarged piece and destination-square feedback while dragging.
- **Legal move validation** — powered by [chess.js](https://github.com/jhlywa/chess.js),
  including castling, en passant, and pawn promotion.
- **Built-in promotion chooser** — promote to a queen, rook, bishop, or knight.
- **Move highlighting** — see the selected square, legal destinations, and the
  last move's origin and destination.
- **White or Black orientation** — flip the board during play or review without
  resetting the game.

### Review and replay

- **[Animated history navigation](#animated-history-navigation)** — step backward
  or forward, or jump directly to any recorded position with `seekTo()`.
- **[Scrollable move history](#horizontal-history-seeker)** — use the optional
  `ChessBoardHistory` component to tap moves, drag to scrub through a game, or
  navigate with previous/next controls.
- **[PGN import](#importing-pgn-games)** — load a game's main line into the timeline,
  including games with custom starting positions specified by `SetUp`/`FEN` headers.
- **[Undo and reset](#undo-and-reset)** — take back the last half-move and continue
  playing, or start a fresh game while keeping the board orientation.
- **UI-thread playback animations** — Reanimated-powered transitions handle
  castling, captured-piece fades, en passant, and promotion in both directions,
  with support for system reduced-motion preferences.

### Integrate with your app

- **TypeScript API** — exported component, ref, and history types, plus `onMove`
  and `onHistoryChange` callbacks for connecting your own controls and feedback.
- **External control** — load FEN positions, await animated UCI moves, intercept
  user attempts, restrict interaction, and observe position changes.
- **Independent boards** — each mounted board owns its game, history, gestures,
  promotion chooser, orientation, and animation lifecycle.
- **Hints and layouts** — declarative square highlights and arrows, responsive
  parent-based sizing, and an optional explicit size.
- **[Optional haptics](#optional-haptics)** — connect your preferred haptics library
  to move and history-selection callbacks.
- **Expo and React Native CLI support** — documented setup for both workflows
  using the New Architecture.

## Installation

The supported dependency ranges follow the React Native 0.88 / Expo SDK 58 stable
baseline. React and React Native do not have formal LTS release lines.

| Dependency | Supported range |
| --- | --- |
| React | `^19.3.0` |
| React Native | `~0.88.0` |
| React Native Gesture Handler | `~3.3.0` |
| React Native Reanimated | `~4.7.1` |
| React Native Worklets | `~0.13.0` |

This baseline requires the New Architecture. Use Node 24 LTS for development.
TypeScript declarations are included; use TypeScript 5 or newer with
`moduleResolution: "bundler"` or `"node16"`. Zustand and chess.js are installed
automatically as internal dependencies. Expo is not required.

### React Native CLI

In an existing app with compatible React and React Native versions:

```sh
npm install rn-chessboard react-native-gesture-handler@~3.3.0 react-native-reanimated@~4.7.1 react-native-worklets@~0.13.0
# Or:
yarn add rn-chessboard react-native-gesture-handler@~3.3.0 react-native-reanimated@~4.7.1 react-native-worklets@~0.13.0
```

Add the Worklets plugin **last** in your app's `babel.config.js`:

```js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: ['react-native-worklets/plugin'],
};
```

Install iOS pods with `cd ios && bundle exec pod install`, rebuild the native app,
and restart Metro with `--reset-cache` after changing Babel configuration. Follow
the [Gesture Handler setup](https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/installation/)
and [Reanimated setup](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/getting-started/)
for your app. Keep Metro's package exports enabled and its `react-native` condition
when customizing resolution; the native entry preserves worklets for your app's Babel plugin.

### Expo SDK 58

Install the library and SDK-compatible native dependencies:

```sh
npm install rn-chessboard
npx expo install react-native-gesture-handler react-native-reanimated react-native-worklets
```

Keep `babel-preset-expo` in your Babel configuration; SDK 58 configures the
Worklets plugin automatically. Rebuild development builds with `npx expo run:ios`
or `npx expo run:android` after installing native dependencies.

## Usage

After completing the native dependency setup, render the board inside a
`GestureHandlerRootView`. A new game starts in the standard position with White
to move.

```tsx
import { useRef } from 'react';
import { Button, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ChessBoard, { type ChessBoardRef } from 'rn-chessboard';

export default function App() {
  const board = useRef<ChessBoardRef>(null);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <ChessBoard
          ref={board}
          initialOrientation="w"
          onMove={(move) => console.log(move.san)}
        />
        <Button
          title="Show Black's side"
          onPress={() => board.current?.setOrientation('b')}
        />
      </View>
    </GestureHandlerRootView>
  );
}
```

### Props and ref

`ChessBoardProps`, `ChessBoardRef`, and `ChessBoardHistoryState` are exported for
TypeScript consumers. All board props are optional.

| Prop | Type | Description |
| --- | --- | --- |
| `initialOrientation` | `'w' \| 'b'` | White faces the player by default. Also updates orientation when this prop changes. |
| `initialFen` | `string` | Full six-field FEN used only on mount. Defaults to the standard position. Invalid initial input throws during rendering. |
| `interactionEnabled` | `boolean` | Defaults to `true`. Disables drag, tap-to-move, and promotion input when false. |
| `movableColor` | `'w' \| 'b' \| 'both'` | Restricts manual play; defaults to `'both'`. Chess turn rules still apply. |
| `onMoveAttempt` | `MoveAttemptHandler` | Synchronous approval of a legal user move before commit; return `false` to reject. |
| `onMove` | `(move: Move) => void` | Called once after an accepted **user** move, including promotion. Unchanged for existing consumers. `Move` is the chess.js move object, with `san`, `from`, `to`, and `isCapture()`. |
| `onPositionChange` | `(event: PositionChangeEvent) => void` | Reports resulting FEN, source, and optional move at logical commit time. |
| `onHistoryChange` | `(state: ChessBoardHistoryState) => void` | Receives the current history state on mount or callback replacement, then whenever the cursor, timeline length, or navigation availability changes. |
| `highlightedSquares` | `readonly SquareHighlight[]` | Custom `{ square, color }` overlays. |
| `arrows` | `readonly BoardArrow[]` | Custom `{ from, to, color }` arrows. |
| `size` | `number` | Positive finite width/height in logical pixels. Otherwise uses parent width, up to 576 px. |

#### Ref methods

Call these methods through a `useRef<ChessBoardRef>(null)` attached to the board:

| Ref method | Result |
| --- | --- |
| `setOrientation('w' \| 'b')` | Shows White's or Black's side without resetting the game. |
| `goBack()` | Starts one animated step backward. Returns `true` if accepted. |
| `goForward()` | Starts one animated step forward. Returns `true` if accepted. |
| `seekTo(index, options?)` | Jumps to any recorded position. Animates by default; pass `{ animated: false }` for instant scrubbing. Returns `true` if accepted, including an already-selected position. |
| `undo()` | Permanently removes the last recorded half-move and animates to the new latest position. Returns `true` if accepted. |
| `reset()` | Immediately clears the game and history and restores the standard starting position. Preserves orientation. |
| `loadPgn(pgn)` | Replaces the game and history with a single PGN, showing its final position. Throws on empty or invalid input, leaving the current game intact. |
| `loadFen(fen)` | Replaces the position and clears history. Throws on invalid input, leaving the entire existing game and animation intact. Preserves orientation. |
| `getFen()` | Returns the full six-field FEN at the current logical history cursor, including the en passant target and counters. |
| `playMove(move, options?)` | Returns `Promise<PlayMoveResult>`. Accepts lowercase UCI or `{ from, to, promotion? }`. Defaults to animated, 200 ms. |
| `getHistoryState()` | Returns the current `ChessBoardHistoryState`. |

### FEN positions and programmatic moves

```tsx
import { useRef } from 'react';
import { Button, View } from 'react-native';
import ChessBoard, { type ChessBoardRef } from 'rn-chessboard';

const FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

export function ControlledBoard() {
  const board = useRef<ChessBoardRef>(null);
  const play = async () => {
    const handle = board.current;
    if (!handle) return;
    handle.loadFen(FEN);
    const first = await handle.playMove('e7e5', { duration: 250 });
    if (!first.accepted || first.animation !== 'finished' || board.current !== handle) return;
    const second = await handle.playMove({ from: 'g1', to: 'f3' });
    console.log(second, handle.getFen());
  };
  return (
    <View>
      <ChessBoard ref={board} initialFen={FEN} initialOrientation="b" />
      <Button title="Load and play" onPress={play} />
    </View>
  );
}
```

`initialFen` is an initializer, not a controlled prop: subsequent changes are
ignored. Use `loadFen()` to switch positions in a mounted board, or change its
React `key` to create a fresh board. Each load establishes a new timeline origin
at index 0 and cancels selections, drags, promotion requests, and animations.
Side to move, castling rights, en passant, halfmove clock, and fullmove number are
preserved. Validation uses chess.js; incomplete FEN strings are rejected.

Programmatic moves use chess.js and the existing Reanimated transition system,
including castling, capture fades, en passant, and promotions. Specify promotions
explicitly (`'a7a8q'`, `'a7a8n'`, or `{ from: 'a7', to: 'a8', promotion: 'r' }`);
programmatic promotion never opens the chooser. Moves respect the side to move
and may be played only at the latest history position.

```ts
type PlayMoveResult =
  | { accepted: true; move: Move; animation: 'finished' | 'cancelled' }
  | { accepted: false; reason: 'illegal' | 'invalid' | 'busy' | 'reviewing' | 'unmounted' };
```

`Move` above is the chess.js type. `ChessBoardMove`, `PromotionPiece`,
`PlayMoveOptions`, and `PlayMoveResult` are exported from `rn-chessboard`.

**Completion and competing commands:**

- Logical state, history, `getFen()`, and position events update immediately when
  a move is accepted. The promise resolves after the UI-thread animation completes.
  `{ animated: false }` commits immediately and resolves with `'finished'`.
- Await each move and check its result before playing the next. There is no queue:
  a competing move during animation, dragging, or promotion returns `'busy'`.
  Back/forward/seek/undo also return `false` during a programmatic animation.
- `loadFen`, `loadPgn`, `reset`, and unmount cancel outstanding animations and
  resolve accepted moves with `animation: 'cancelled'`. The accepted move was
  already committed; cancellation is not a rollback. Invalid loads cancel nothing.
- Rotation settles the accepted move at its target and resolves `'finished'`.
  Resizing retargets playback to the new geometry and clears pending user input.
- History-to-history seeking retains its existing interruptible behavior.
- `duration` must be finite and nonnegative. Malformed UCI/options return
  `'invalid'`; a well-formed illegal move returns `'illegal'`. Expected move
  failures resolve as results rather than throwing. FEN/PGN loading throws.
- Old completion callbacks cannot overwrite a replacement position. A retained
  handle's `playMove()` returns `'unmounted'` after its board unmounts.

### User interaction and move approval

```tsx
<ChessBoard
  interactionEnabled={true}
  movableColor="w"
  onMoveAttempt={(move, position) => {
    console.log(position.fen, move.from, move.to, move.promotion);
    return move.from === 'e2' && move.to === 'e4';
  }}
/>
```

`MoveAttemptHandler` receives a read-only `ChessBoardMove` and `{ fen: string }`
containing the **pre-move** position. It runs once for a legal manual attempt,
after any promotion selection, before the live game/history is committed.
Returning `false` or throwing rejects the move, clears selection, and returns a
dragged piece to its origin. Illegal gestures never reach the callback. Returning
`true` accepts. Approval is synchronous; do not return a promise.

Changing `interactionEnabled` or `movableColor` clears pending user input,
including promotion. Re-enabling interaction takes effect reactively.
Programmatic moves bypass both interaction restrictions and `onMoveAttempt`.
History remains usable when manual interaction is disabled.

### Position events

`PositionChangeEvent` is `{ fen, source, move? }`, where `source` is:

| Source | When emitted |
| --- | --- |
| `'user'` | Accepted manual move; includes the chess.js `move`. |
| `'programmatic'` | Accepted `playMove`; includes `move`. |
| `'history'` | Back/forward/seek changes the history cursor. |
| `'load'` | Successful FEN or PGN replacement, even if the resulting FEN is identical. |
| `'undo'` | Successful permanent removal of the last recorded move. |
| `'reset'` | Standard starting position is restored. |

Events fire once at logical commit, not again when animation finishes. They do
not fire on mount, callback replacement, orientation changes, same-index seeks,
rejected moves, invalid loads, or after unmount. Read the initial position using
`getFen()` or your initial FEN. The event FEN always describes its commit, even
if a host callback immediately issues another command.

`onMove` remains user-only; use `onPositionChange` to observe automatic moves and
position replacement. `onHistoryChange` also reports navigation-lock and animation
changes, so one operation can produce multiple history-state notifications.
Notifications are delivered in commit order, including reentrant host commands.
Exceptions in notification callbacks are logged without undoing a committed move.

### Independent boards, hints, and sizing

```tsx
<View style={{ flexDirection: 'row' }}>
  <View style={{ flex: 1 }}>
    <ChessBoard
      initialOrientation="w"
      highlightedSquares={[{ square: 'e4', color: 'rgba(34,197,94,0.4)' }]}
      arrows={[{ from: 'g1', to: 'f3', color: '#22c55e' }]}
    />
  </View>
  <View style={{ flex: 1 }}>
    <ChessBoard initialOrientation="b" interactionEnabled={false} />
  </View>
</View>
```

Boards share no mutable game or interaction state. Unmounting one cannot affect
another; remounting creates a fresh game. Attach a separate ref to each board.

Highlights render above backgrounds, below built-in last-move/selection overlays
and pieces. Legal-destination indicators retain their existing layer. Use
translucent colors when combining overlays; later custom highlights win on the
same square. Check indicators can be supplied as custom highlighted squares.
Arrows render above pieces and highlights, ignore touches, and scale with the
board. Same-square arrows are omitted. Both overlay props update reactively and
follow orientation; no additional rendering dependency is required.

The board measures its parent width, stays square, and defaults to a maximum of
576 logical pixels (the previous maximum). Window width is only a reactive
fallback before layout. Set `size={240}` for an explicit square; ensure it fits
your parent. Geometry, gestures, sprites, promotions, and overlays use the same
per-board square size. The board now occupies its square's height rather than
claiming all remaining vertical space; wrap it in a flex container if needed.

### External training controller

Keep solution logic in the consuming app. This minimal controller accepts Black's
expected move, plays White's reply, and invalidates asynchronous continuation when
retrying or unmounting:

```tsx
import { useEffect, useRef } from 'react';
import { Button, View } from 'react-native';
import ChessBoard, { type ChessBoardRef } from 'rn-chessboard';

const START = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

export function TrainingPosition() {
  const board = useRef<ChessBoardRef>(null);
  const generation = useRef(0);
  const answered = useRef(false);
  useEffect(() => () => { generation.current++; }, []);

  const respond = async () => {
    const version = generation.current;
    const handle = board.current;
    if (!handle) return;
    const result = await handle.playMove('g1f3');
    if (version !== generation.current || board.current !== handle) return;
    if (result.accepted && result.animation === 'finished') console.log('Complete');
  };

  return <View>
    <ChessBoard
      ref={board} initialFen={START} initialOrientation="b" movableColor="b"
      onMoveAttempt={(move) => !answered.current && move.from + move.to === 'e7e5'}
      onPositionChange={(event) => {
        if (event.source === 'user') {
          answered.current = true;
          respond();
        }
      }}
    />
    <Button title="Retry" onPress={() => {
      generation.current++;
      answered.current = false;
      board.current?.loadFen(START);
    }} />
  </View>;
}
```

The [example training section](./example/src/TrainingDemo.tsx) adds feedback,
highlights, and arrows alongside a separately controlled board.

### Animated history navigation

Connect your own buttons to the board ref:

```tsx
import { useRef, useState } from 'react';
import { Button, Text, View } from 'react-native';
import ChessBoard, {
  type ChessBoardHistoryState,
  type ChessBoardRef,
} from 'rn-chessboard';

export default function Game() {
  const board = useRef<ChessBoardRef>(null);
  const [history, setHistory] = useState<ChessBoardHistoryState | null>(null);

  return (
    <View style={{ flex: 1 }}>
      <ChessBoard ref={board} onHistoryChange={setHistory} />
      <Button
        title="Back"
        disabled={!history?.canGoBack}
        onPress={() => board.current?.goBack()}
      />
      <Text>
        Position {history?.index ?? 0} / {history?.length ?? 0}
      </Text>
      <Button
        title="Forward"
        disabled={!history?.canGoForward}
        onPress={() => board.current?.goForward()}
      />
    </View>
  );
}
```

#### History state

Each step is one half-move (one player's move). The history state contains:

| Field | Meaning |
| --- | --- |
| `index` | Applied half-moves; `0` is the initial position. |
| `length` | Total recorded half-moves, including those ahead of the cursor. |
| `moves` | Stable, read-only list of `{ index, san, moveNumber, color }` entries, including future moves. |
| `canSeek` | Direct seeking is allowed; false during a piece drag, pending move/promotion, or programmatic move animation. |
| `canUndo` | There is a recorded move to undo and no piece drag, pending move/promotion, or programmatic move animation. |
| `canGoBack`, `canGoForward` | Whether that action is currently available. |
| `isReviewing` | The displayed position is earlier than the latest position. |
| `isAnimating` | A history or programmatic move transition is in progress. |

#### Navigation behavior

The cursor updates to the target position when a step starts. Navigation becomes
available again after its animation finishes. Back/forward requests at a boundary, during an
animation, while dragging, or while choosing a promotion return `false`.

Direct seeks can interrupt an animation; the latest accepted target wins. Pieces
retarget from their current on-screen positions and opacity, including jumps
between nonadjacent positions. Seeking to the current index preserves playback;
passing `{ animated: false }` settles it immediately. Non-integer or out-of-range
indices return `false`. The initial position is index `0`.

Earlier positions are read-only: return to the latest position to continue play.
The complete timeline is preserved while browsing. `onMove` fires for newly
played user moves; use `onHistoryChange` or `onPositionChange` for navigation.

#### Undo and reset

`undo()` removes the latest recorded move even when reviewing an earlier position,
then returns to the new end of the game. The removed move cannot be replayed with
`goForward()`; once the undo animation completes, play can continue with a different
move. Undo can interrupt playback, but returns `false` for an empty game or while
dragging/choosing a promotion.

`reset()` also cancels playback, drags, square selection, and pending promotion.
It always restores the standard chess starting position, including when the board
started from a custom FEN. Use `loadFen(originalFen)` to retry that position, or
`seekTo(0)` to review it while preserving the timeline.
Both operations notify `onHistoryChange` without firing `onMove`. The
[example app](#example-app) includes **Undo** and **Reset** buttons.

#### Animation options

Playback defaults to synchronized 200 ms piece animations, including both pieces during
castling, captured-piece fades, en passant restoration, and promotion reversal.
Promotions replay the original selection. Animations respect system reduced-motion
preferences. Rotating during playback settles the step at its target and applies
the new orientation.

Pass `seekTo(index, { duration: 80 })` to use a shorter animation (milliseconds).
Durations below 200 ms use a fast-starting ease-out curve. Negative or non-finite
durations are rejected for animated seeks. Fades begin immediately in both directions.

### Importing PGN games

In the [example app](#example-app), tap **Import PGN**, paste a game into the text
field, and tap **Import game**. Invalid input shows an error so you can correct it
and try again.

For your own import UI, pass the pasted text to the board ref:

```tsx
try {
  board.current?.loadPgn(pgnText);
} catch {
  // Show a validation error and let the user edit the pasted text.
}
```

Import supports PGN headers, comments, annotations, and custom starting positions
specified by `SetUp`/`FEN` headers. Only the main line is added to the timeline;
variations are ignored. Paste one game at a time.

Successful imports preserve board orientation, cancel pending interactions and
animations, and notify `onHistoryChange` without firing `onMove`. Use the history
seeker or `seekTo(0)` to replay from the starting position. Undo and continued
play work at the end of the imported game, just as with moves played in the app.

### Horizontal history seeker

`ChessBoardHistory` is an optional controlled component with move names, a selected
move highlight, and previous/next chevrons. Tap a move to jump, or drag the strip
to scrub through positions at its center. Pieces animate between selected positions
while scrubbing. The strip uses normal native momentum and stops freely without
snapping; the nearest move remains selected. External navigation automatically
centers the selected move. **Start** selects the initial position.

Fast scrubbing coalesces intermediate targets into at most one update every 50 ms;
piece animations use an 80 ms ease-out on the UI thread between updates. The final selected
position is applied immediately when scrolling settles.

```tsx
import { useRef, useState } from 'react';
import { View } from 'react-native';
import ChessBoard, {
  ChessBoardHistory,
  type ChessBoardHistoryState,
  type ChessBoardRef,
} from 'rn-chessboard';

function Game() {
  const board = useRef<ChessBoardRef>(null);
  const [history, setHistory] = useState<ChessBoardHistoryState | null>(null);

  return (
    <View style={{ flex: 1 }}>
      <ChessBoard ref={board} onHistoryChange={setHistory} />
      <ChessBoardHistory
        history={history}
        onSeek={(index, options) => board.current?.seekTo(index, options)}
      />
    </View>
  );
}
```

The seeker accepts `history`, `onSeek`, an optional container `style`, and an
optional `onSelectionChange(index, move)` feedback callback. While scrubbing,
the callback fires for every crossed position in order, including positions
skipped by coalesced board updates. Taps/arrows report only their accepted
destination. `move` is undefined at index `0`. Programmatic centering, undo/reset,
and repeated scroll events within the same cell do not trigger this callback.
`ChessBoardHistoryProps`, `ChessBoardHistoryMove`, and `ChessBoardSeekOptions`
are exported for TypeScript consumers. Move numbering respects the starting
position, including games starting with Black to move.

### Optional haptics

Haptics are opt-in. For an Expo app, install `expo-haptics` using
`npx expo install expo-haptics`, then pass a callback:

```tsx
import * as Haptics from 'expo-haptics';

<ChessBoard
  onMove={(move) => {
    Haptics.impactAsync(
      move.isCapture()
        ? Haptics.ImpactFeedbackStyle.Heavy
        : Haptics.ImpactFeedbackStyle.Light
    ).catch(console.warn);
  }}
/>
```

React Native CLI apps can use their preferred haptics library in the same callback.
When upgrading from 0.1.15, add this callback if you want to retain haptic feedback.

For scrub, tap, and arrow navigation, use `onSelectionChange` for haptics.
This separates move-boundary feedback from the board's throttled updates. Keep
`onSeek` focused on navigation to avoid duplicate impacts. Feedback is delivered
immediately without a delayed queue; very rapid impacts may merge on the device.

```tsx
<ChessBoardHistory
  history={history}
  onSeek={(index, options) => board.current?.seekTo(index, options)}
  onSelectionChange={(_index, move) => {
    Haptics.impactAsync(
      /[x+#]/.test(move?.san ?? '')
        ? Haptics.ImpactFeedbackStyle.Heavy
        : Haptics.ImpactFeedbackStyle.Light
    ).catch(console.warn);
  }}
/>
```

## Example app

The [Expo example app](./example/src/App.tsx) includes interactive play, board
flipping, PGN import, the history seeker, undo/reset controls, and iOS haptics.
Its **Programmatic control** section demonstrates FEN loading, animated moves,
interaction toggling, and current-FEN display. The simultaneous **Training demo**
board rejects unexpected answers and automatically plays a reply.

Follow the [development setup](./CONTRIBUTING.md#development-workflow), then run
one of these commands from the repository root:

```sh
yarn example ios
# Or:
yarn example android
```

## Current limitations

The package is a work in progress.

- **Web is experimental:** iOS and Android are the primary targets.
- Earlier history positions remain read-only; branching analysis is not supported.
- Approval is synchronous; commands are not queued.

### Compatibility notes

Existing ref methods and manual `onMove` semantics are preserved. Boards no longer
share games or retain them across unmount/remount. Persist positions/history in
your app if you need to restore a screen. Sizing now follows the parent; see the
layout notes above. React Native, Expo, Gesture Handler, and Reanimated supported
versions are unchanged. The chess.js minimum is now 1.4.0 (already used by the
repository lockfile) for full en passant FEN serialization.

## Roadmap

- Customizable board appearance and piece sets.

## Contributing and license

See [CONTRIBUTING.md](https://github.com/leomino/rn-chessboard/blob/main/CONTRIBUTING.md)
for development and release instructions. Licensed under the [MIT license](./LICENSE).
