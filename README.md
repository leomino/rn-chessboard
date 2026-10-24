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
| `onMove` | `(move: Move) => void` | Called after a completed move, including promotion. `Move` is the chess.js move object, with `san`, `from`, `to`, and `isCapture()`. |
| `onHistoryChange` | `(state: ChessBoardHistoryState) => void` | Receives the current history state on mount or callback replacement, then whenever the cursor, timeline length, or navigation availability changes. |

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
| `getHistoryState()` | Returns the current `ChessBoardHistoryState`. |

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
| `canSeek` | Direct seeking is allowed; false during a piece drag or pending move/promotion. |
| `canUndo` | There is a recorded move to undo and no piece drag or pending move/promotion. |
| `canGoBack`, `canGoForward` | Whether that action is currently available. |
| `isReviewing` | The displayed position is earlier than the latest position. |
| `isAnimating` | A history transition is in progress. |

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
played moves; use `onHistoryChange` to respond to navigation.

#### Undo and reset

`undo()` removes the latest recorded move even when reviewing an earlier position,
then returns to the new end of the game. The removed move cannot be replayed with
`goForward()`; once the undo animation completes, play can continue with a different
move. Undo can interrupt playback, but returns `false` for an empty game or while
dragging/choosing a promotion.

`reset()` also cancels playback, drags, square selection, and pending promotion.
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

Follow the [development setup](./CONTRIBUTING.md#development-workflow), then run
one of these commands from the repository root:

```sh
yarn example ios
# Or:
yarn example android
```

## Current limitations

The package is a work in progress.

- **One board per app:** board instances share game state; independent games are
  not yet supported.
- **Window-based sizing:** board dimensions are calculated from the window width
  when the module loads. Custom sizing is not yet supported.
- **Web is experimental:** iOS and Android are the primary targets.

## Roadmap

- Customizable board appearance and piece sets.

## Contributing and license

See [CONTRIBUTING.md](https://github.com/leomino/rn-chessboard/blob/main/CONTRIBUTING.md)
for development and release instructions. Licensed under the [MIT license](./LICENSE).
