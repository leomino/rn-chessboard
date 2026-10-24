import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ScrollView, TouchableOpacity } from 'react-native';
import ChessBoardHistory from '../components/ChessBoardHistory';
import type { ChessBoardHistoryState } from '../utils/history';

jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  View: 'View',
  ScrollView: 'ScrollView',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
}));

let renderer: ReactTestRenderer;
const scrollTo = jest.fn();
const onSeek = jest.fn(() => true);
const history: ChessBoardHistoryState = {
  index: 2,
  length: 3,
  moves: [
    { index: 1, san: 'e4', moveNumber: 1, color: 'w' },
    { index: 2, san: 'e5', moveNumber: 1, color: 'b' },
    { index: 3, san: 'Nf3', moveNumber: 2, color: 'w' },
  ],
  canSeek: true,
  canGoBack: true,
  canGoForward: true,
  isReviewing: true,
  isAnimating: false,
};

function strip() {
  return renderer.root.findByType(ScrollView);
}
function item(label: string) {
  return renderer.root.findByProps({ accessibilityLabel: label });
}
function scrollEvent(x: number) {
  return { nativeEvent: { contentOffset: { x } } };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  onSeek.mockReturnValue(true);
  act(() => {
    renderer = create(<ChessBoardHistory history={history} onSeek={onSeek} />, {
      createNodeMock: () => ({ scrollTo }),
    });
  });
  act(() =>
    strip().props.onLayout({ nativeEvent: { layout: { width: 200 } } })
  );
  // Unequal widths exercise actual measured centers rather than fixed cells.
  const widths = [60, 80, 50, 100];
  let x = 100;
  act(() => {
    renderer.root
      .findAllByType(TouchableOpacity)
      .filter((node) => node.props.onLayout)
      .forEach((node, i) => {
        node.props.onLayout({
          nativeEvent: { layout: { x, width: widths[i] } },
        });
        x += widths[i]!;
      });
  });
});

afterEach(() => {
  act(() => renderer.unmount());
  jest.useRealTimers();
});

it('centers external navigation, ignores programmatic scrolling, and seeks on taps', () => {
  expect(scrollTo).toHaveBeenLastCalledWith({ x: 165, animated: false });
  act(() => strip().props.onScroll(scrollEvent(165)));
  expect(onSeek).not.toHaveBeenCalled();
  scrollTo.mockClear();
  act(() => strip().props.onContentSizeChange());
  expect(scrollTo).toHaveBeenLastCalledWith({ x: 165, animated: false });
  expect(item('Move 1, Black, e5').props.accessibilityState.selected).toBe(
    true
  );
  act(() => item('Move 2, White, Nf3').props.onPress());
  expect(onSeek).toHaveBeenLastCalledWith(3, { animated: true });
  act(() =>
    renderer.update(
      <ChessBoardHistory history={{ ...history, index: 0 }} onSeek={onSeek} />
    )
  );
  expect(scrollTo).toHaveBeenLastCalledWith({ x: 30, animated: false });
  act(() => item('Initial position').props.onPress());
  expect(onSeek).toHaveBeenLastCalledWith(0, { animated: true });
});

it('scrubs only on move changes, follows momentum, and snaps to the final move', () => {
  act(() => strip().props.onScrollBeginDrag());
  expect(onSeek).not.toHaveBeenCalled();
  act(() => strip().props.onScroll(scrollEvent(100)));
  expect(onSeek).toHaveBeenLastCalledWith(1, { animated: true, duration: 80 });
  act(() => strip().props.onScroll(scrollEvent(102)));
  expect(onSeek).toHaveBeenCalledTimes(1);
  act(() => strip().props.onScrollEndDrag(scrollEvent(102)));
  act(() => strip().props.onMomentumScrollBegin());
  act(() => strip().props.onScroll(scrollEvent(238)));
  act(() => jest.advanceTimersByTime(50));
  expect(onSeek).toHaveBeenLastCalledWith(3, { animated: true, duration: 80 });
  act(() => strip().props.onMomentumScrollEnd(scrollEvent(240)));
  expect(scrollTo).toHaveBeenLastCalledWith({ x: 240, animated: true });
  const count = onSeek.mock.calls.length;
  act(() => strip().props.onScroll(scrollEvent(165)));
  act(() => jest.runAllTimers());
  expect(onSeek).toHaveBeenCalledTimes(count);
});

it('settles drags without momentum and does not recenter while a user is dragging', () => {
  act(() => strip().props.onScrollBeginDrag());
  scrollTo.mockClear();
  act(() => strip().props.onScroll(scrollEvent(98)));
  act(() =>
    renderer.update(
      <ChessBoardHistory history={{ ...history, index: 1 }} onSeek={onSeek} />
    )
  );
  expect(scrollTo).not.toHaveBeenCalled();
  act(() => strip().props.onScrollEndDrag(scrollEvent(98)));
  act(() => jest.advanceTimersByTime(120));
  expect(scrollTo).toHaveBeenLastCalledWith({ x: 100, animated: true });
});

it('disables input while the board is busy and handles an empty timeline', () => {
  act(() =>
    renderer.update(
      <ChessBoardHistory
        history={{
          ...history,
          canSeek: false,
          canGoBack: false,
          canGoForward: false,
        }}
        onSeek={onSeek}
      />
    )
  );
  expect(strip().props.scrollEnabled).toBe(false);
  expect(item('Move 1, White, e4').props.disabled).toBe(true);
  expect(item('Previous move').props.disabled).toBe(true);
  expect(item('Next move').props.disabled).toBe(true);
  act(() =>
    renderer.update(<ChessBoardHistory history={null} onSeek={onSeek} />)
  );
  expect(item('Initial position').props.accessibilityState.selected).toBe(true);
  expect(strip().props.snapToOffsets).toHaveLength(1);
});

it('coalesces fast scrubbing to the latest target and flushes the final position immediately', () => {
  act(() => strip().props.onScrollBeginDrag());
  act(() => strip().props.onScroll(scrollEvent(100)));
  expect(onSeek).toHaveBeenCalledTimes(1);
  act(() => {
    strip().props.onScroll(scrollEvent(30));
    strip().props.onScroll(scrollEvent(165));
    strip().props.onScroll(scrollEvent(240));
  });
  expect(onSeek).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(50));
  expect(onSeek).toHaveBeenNthCalledWith(2, 3, {
    animated: true,
    duration: 80,
  });
  act(() => strip().props.onScroll(scrollEvent(165)));
  // Releasing on Start flushes it now, replacing the pending middle position.
  act(() => strip().props.onMomentumScrollEnd(scrollEvent(30)));
  expect(onSeek).toHaveBeenNthCalledWith(3, 0, {
    animated: true,
    duration: 80,
  });
  act(() => jest.runAllTimers());
  expect(onSeek).toHaveBeenCalledTimes(3);
  expect(scrollTo).toHaveBeenLastCalledWith({ x: 30, animated: true });
});

it('cancels pending scrub work on taps and unmount', () => {
  act(() => strip().props.onScrollBeginDrag());
  act(() => strip().props.onScroll(scrollEvent(100)));
  act(() => strip().props.onScroll(scrollEvent(240)));
  act(() => item('Initial position').props.onPress());
  act(() => jest.runAllTimers());
  expect(onSeek).toHaveBeenCalledTimes(2);
  expect(onSeek).toHaveBeenLastCalledWith(0, { animated: true });
  act(() => strip().props.onScrollBeginDrag());
  act(() => strip().props.onScroll(scrollEvent(100)));
  act(() => strip().props.onScroll(scrollEvent(240)));
  const count = onSeek.mock.calls.length;
  act(() => renderer.unmount());
  act(() => jest.runAllTimers());
  expect(onSeek).toHaveBeenCalledTimes(count);
});

it('uses the latest seek callback for deferred work and leaves unchanged move cells intact', () => {
  const unchanged = item('Move 2, White, Nf3').props;
  const replacement = jest.fn(() => true);
  act(() => strip().props.onScrollBeginDrag());
  act(() => strip().props.onScroll(scrollEvent(100)));
  act(() => strip().props.onScroll(scrollEvent(240)));
  act(() =>
    renderer.update(
      <ChessBoardHistory
        history={{ ...history, index: 1 }}
        onSeek={replacement}
      />
    )
  );
  expect(item('Move 2, White, Nf3').props.onLayout).toBe(unchanged.onLayout);
  act(() => jest.advanceTimersByTime(50));
  expect(replacement).toHaveBeenCalledWith(3, { animated: true, duration: 80 });
  expect(onSeek).toHaveBeenCalledTimes(1);
});
