# React Native Chessboard

A lightweight and customizable chessboard component for React Native. Ideal for building chess applications, training tools, or integrating chess features into your mobile app.

<div align="center">
   <img src="https://github.com/user-attachments/assets/5077a64c-6ca0-4eda-b9f4-1eec5890c3be?raw=true" title="preview" alt="preview"/>
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
This package uses the following peer-dependencies (they have to be installed already):

- react-native-gesture-handler
- react-native-reanimated
- zustand

Open a Terminal in your project's folder and install the library using `yarn`:
```bash
yarn add rn-chessboard
```
or with `npm`
```bash
npm install rn-chessboard
```

## Usage
```typescript jsx
import ChessBoard from 'rn-chessboard';

const App = () => (
  <View>
    <ChessBoard/>
  </View>
)
```
