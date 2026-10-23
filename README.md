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

## Coming soon

- Seek through game history (undo and redo operations)
- load games from pgn's
- Customizable board and pieces

## Disclaimer
This package is a work in progress, use it with caution.

## Installation

The currently supported dependency ranges are intentionally limited to the React
Native 0.76 / Expo SDK 52 baseline:

| Dependency | Supported range |
| --- | --- |
| React | `^18.3.1` |
| React Native | `~0.76.7` |
| React Native Gesture Handler | `~2.24.0` |
| React Native Reanimated | `~3.16.7` |

Reanimated 4 and newer React Native releases are not yet supported. TypeScript
declarations are included; use TypeScript 5 or newer. Zustand and chess.js are
installed automatically as internal dependencies. Expo is not required.

### React Native CLI

In an existing app with compatible React and React Native versions:

```sh
npm install rn-chessboard react-native-gesture-handler@~2.24.0 react-native-reanimated@~3.16.7
# Or:
yarn add rn-chessboard react-native-gesture-handler@~2.24.0 react-native-reanimated@~3.16.7
```

Add the Reanimated 3 plugin **last** in your app's `babel.config.js`:

```js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: ['react-native-reanimated/plugin'],
};
```

Install iOS pods with `cd ios && bundle exec pod install`, rebuild the native app,
and restart Metro with `--reset-cache` after changing Babel configuration. Follow
the [Gesture Handler setup](https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/installation/)
and [Reanimated 3 setup](https://docs.swmansion.com/react-native-reanimated/docs/3.x/fundamentals/getting-started/)
for your app. Keep `react-native` in Metro's `resolverMainFields` if you customize
resolution; the package's native entry preserves worklets for your app's Babel plugin.

### Expo SDK 52

Use an SDK 52 development build with the compatible versions above:

```sh
npm install rn-chessboard react-native-gesture-handler@~2.24.0 react-native-reanimated@~3.16.7
```

Keep `babel-preset-expo` in your Babel configuration; SDK 52 configures the
Reanimated plugin automatically. Rebuild with `npx expo run:ios` or
`npx expo run:android` after installing native dependencies. Expo Go has fixed
native dependency versions, so use a development build for this dependency set.

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

`ChessBoardProps` and `ChessBoardRef` are exported for TypeScript consumers.

| Prop | Type | Description |
| --- | --- | --- |
| `initialOrientation` | `'w' \| 'b'` | White faces the player by default. Also updates orientation when this prop changes. |
| `onMove` | `(move: Move) => void` | Called after a completed move, including promotion. `Move` is the chess.js move object, with `san`, `from`, `to`, and `isCapture()`. |

`ref.current.setOrientation('w' | 'b')` rotates the board without resetting the game.
The board currently uses shared game state: mount one board per app. Board dimensions
are based on the window width at module load; custom sizing and independent games
are not yet supported. iOS and Android are the primary targets; web is experimental.

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
