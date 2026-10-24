import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Chess, type Color, type Square } from 'chess.js';
import { View } from 'react-native';
import SquareHighlights from '../components/SquareHighlights';
import { toCoordinates } from '../Constants';
import { useChessStore } from '../store/chessStore';

jest.mock('react-native', () => ({
  Dimensions: { get: () => ({ width: 320 }) },
  StyleSheet: { create: (styles: unknown) => styles },
  View: 'View',
}));
jest.mock('react-native-reanimated', () => ({
  clamp: (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value)),
}));

let renderer: ReactTestRenderer;

beforeEach(() => {
  useChessStore.setState({
    ...useChessStore.getInitialState(),
    chess: new Chess(),
  });
});

afterEach(() => {
  act(() => renderer.unmount());
});

it.each<Color>(['w', 'b'])(
  'highlights the viewed prefix and clears selection facing %s',
  async (orientation) => {
    useChessStore.setState({ orientation });
    act(() => {
      renderer = create(<SquareHighlights />);
    });
    await act(async () => {
      await useChessStore.getState().move('e2', 'e4');
      await useChessStore.getState().move('d7', 'd5');
      await useChessStore.getState().move('e4', 'd5');
    });
    function expectHighlights(from: Square, to: Square) {
      const views = renderer.root.findAllByType(View);
      expect(views).toHaveLength(2);
      for (const [index, square] of [from, to].entries()) {
        const { x, y } = toCoordinates(square, orientation);
        expect(views[index]!.props.style[1].transform).toEqual([
          { translateX: x },
          { translateY: y },
        ]);
      }
    }
    expectHighlights('e4', 'd5');
    act(() => {
      useChessStore.setState({ selectedSquare: 'g8' });
      useChessStore.getState().goBack();
    });
    expectHighlights('d7', 'd5');
    act(() => {
      for (let i = 0; i < 2; i++) {
        useChessStore
          .getState()
          .finishTransition(useChessStore.getState().transition!.id);
        useChessStore.getState().goBack();
      }
    });
    expect(renderer.root.findAllByType(View)).toHaveLength(0);
  }
);

it('reads the highlighted move directly without replaying the chess move stack', async () => {
  await useChessStore.getState().move('e2', 'e4');
  await useChessStore.getState().move('e7', 'e5');
  const history = jest.spyOn(Chess.prototype, 'history');
  try {
    act(() => {
      renderer = create(<SquareHighlights />);
    });
    act(() => {
      useChessStore.getState().seekTo(1);
    });
    expect(renderer.root.findAllByType(View)).toHaveLength(2);
    act(() => {
      useChessStore.getState().seekTo(0);
    });
    expect(renderer.root.findAllByType(View)).toHaveLength(0);
    expect(history).not.toHaveBeenCalled();
  } finally {
    history.mockRestore();
  }
});
