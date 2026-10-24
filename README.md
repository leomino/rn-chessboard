# React Native Chessboard

A lightweight and customizable chessboard component for React Native. Ideal for building chess applications, training tools, or integrating chess features into your mobile app.
<div align="center" markdown="1">
  <img src="https://raw.githubusercontent.com/leomino/rn-chessboard/main/media/chessboard-preview.gif" alt="preview">
</div>

## Features

- Interactive chessboard with drag-and-drop, as well as tap to move
- Board rotation at any given time
- Move highlighting (e.g. last moves, legal moves...)
- Piece Promotion, Castling and every other legal chess move
- Animated move-history navigation with backward and forward controls

## Coming soon

- load games from pgn's
- Customizable board and pieces

## Disclaimer
This package is a work in progress, use it with caution.

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
        <Button title="Show Black's side" onPress={() => board.current?.setOrientation('b')} />
      </View>
    </GestureHandlerRootView>
  );
}
```

### Props and ref

`ChessBoardProps`, `ChessBoardRef`, and `ChessBoardHistoryState` are exported for TypeScript consumers.

| Prop | Type | Description |
| --- | --- | --- |
| `initialOrientation` | `'w' \| 'b'` | White faces the player by default. Also updates orientation when this prop changes. |
| `onMove` | `(move: Move) => void` | Called after a completed move, including promotion. `Move` is the chess.js move object, with `san`, `from`, `to`, and `isCapture()`. |
| `onHistoryChange` | `(state: ChessBoardHistoryState) => void` | Receives the current history state on mount or callback replacement, then whenever the cursor, timeline length, or navigation availability changes. |

`ref.current.setOrientation('w' | 'b')` rotates the board without resetting the game.
The board currently uses shared game state: mount one board per app. Board dimensions
are based on the window width at module load; custom sizing and independent games
are not yet supported. iOS and Android are the primary targets; web is experimental.

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
      <Text>Position {history?.index ?? 0} / {history?.length ?? 0}</Text>
      <Button
        title="Forward"
        disabled={!history?.canGoForward}
        onPress={() => board.current?.goForward()}
      />
    </View>
  );
}
```

| Ref method | Result |
| --- | --- |
| `goBack()` | Starts one animated step backward. Returns `true` if accepted. |
| `goForward()` | Starts one animated step forward. Returns `true` if accepted. |
| `getHistoryState()` | Returns the current `ChessBoardHistoryState`. |

Each step is one half-move (one player's move). The history state contains:

| Field | Meaning |
| --- | --- |
| `index` | Applied half-moves; `0` is the initial position. |
| `length` | Total recorded half-moves, including those ahead of the cursor. |
| `canGoBack`, `canGoForward` | Whether that action is currently available. |
| `isReviewing` | The displayed position is earlier than the latest position. |
| `isAnimating` | A history transition is in progress. |

The cursor updates to the target position when a step starts. Navigation becomes
available again after its animation finishes. Requests at a boundary, during an
animation, while dragging, or while choosing a promotion return `false`.

Earlier positions are read-only: return to the latest position to continue play.
The complete timeline is preserved while browsing. `onMove` fires for newly
played moves; use `onHistoryChange` to respond to navigation.

Playback uses synchronized 200 ms piece animations, including both pieces during
castling, captured-piece fades, en passant restoration, and promotion reversal.
Promotions replay the original selection. Animations respect system reduced-motion
preferences. Rotating during playback settles the step at its target and applies
the new orientation.

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

## Contributing and license

See [CONTRIBUTING.md](https://github.com/leomino/rn-chessboard/blob/main/CONTRIBUTING.md)
for development and release instructions. Licensed under the [MIT license](./LICENSE).
