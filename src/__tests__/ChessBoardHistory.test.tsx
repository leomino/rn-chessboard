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
const onSelectionChange = jest.fn();
const history: ChessBoardHistoryState = {
  index: 2,
  length: 3,
  moves: [
    { index: 1, san: 'e4', moveNumber: 1, color: 'w' },
    { index: 2, san: 'e5', moveNumber: 1, color: 'b' },
    { index: 3, san: 'Nf3', moveNumber: 2, color: 'w' },
  ],
  canSeek: true,
  canUndo: true,
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
    renderer = create(
      <ChessBoardHistory
        history={history}
        onSeek={onSeek}
        onSelectionChange={onSelectionChange}
      />,
      {
        createNodeMock: () => ({ scrollTo }),
      }
    );
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

it('scrubs only on move changes and follows native momentum without snapping', () => {
  scrollTo.mockClear();
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
  expect(scrollTo).not.toHaveBeenCalled();
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
  expect(scrollTo).not.toHaveBeenCalled();
});

it('keeps the natural resting offset after controlled cursor and layout updates', () => {
  scrollTo.mockClear();
  act(() => strip().props.onScrollBeginDrag());
  act(() => strip().props.onScroll(scrollEvent(93)));
  act(() => strip().props.onScrollEndDrag(scrollEvent(93)));
  act(() => jest.advanceTimersByTime(120));
  expect(onSeek).toHaveBeenLastCalledWith(1, { animated: true, duration: 80 });
  act(() =>
    renderer.update(
      <ChessBoardHistory history={{ ...history, index: 1 }} onSeek={onSeek} />
    )
  );
  act(() => strip().props.onContentSizeChange());
  expect(scrollTo).not.toHaveBeenCalled();

  // Navigation originating outside the gesture still brings its move into view.
  act(() =>
    renderer.update(
      <ChessBoardHistory history={{ ...history, index: 3 }} onSeek={onSeek} />
    )
  );
  expect(scrollTo).toHaveBeenLastCalledWith({ x: 240, animated: false });
});

it('lets native momentum continue past the no-momentum fallback timeout', () => {
  scrollTo.mockClear();
  act(() => strip().props.onScrollBeginDrag());
  act(() => strip().props.onScroll(scrollEvent(100)));
  act(() => strip().props.onScrollEndDrag(scrollEvent(100)));
  act(() => strip().props.onMomentumScrollBegin());
  act(() => jest.advanceTimersByTime(500));
  act(() => strip().props.onScroll(scrollEvent(230)));
  expect(onSeek).toHaveBeenLastCalledWith(3, { animated: true, duration: 80 });
  act(() => strip().props.onMomentumScrollEnd(scrollEvent(232)));
  act(() =>
    renderer.update(
      <ChessBoardHistory history={{ ...history, index: 3 }} onSeek={onSeek} />
    )
  );
  expect(scrollTo).not.toHaveBeenCalled();
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
  expect(strip().props.snapToOffsets).toBeUndefined();
});

it('coalesces fast scrubbing to the latest target and flushes the final position immediately', () => {
  scrollTo.mockClear();
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
  expect(scrollTo).not.toHaveBeenCalled();
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

it.each([0, 2])(
  'cancels deferred scrubbing when the timeline is reset or shortened to %i moves',
  (length) => {
    act(() => strip().props.onScrollBeginDrag());
    act(() => strip().props.onScroll(scrollEvent(100)));
    act(() => strip().props.onScroll(scrollEvent(165)));
    expect(onSeek).toHaveBeenCalledTimes(1);
    act(() =>
      renderer.update(
        <ChessBoardHistory
          history={{
            ...history,
            index: length,
            length,
            moves: history.moves.slice(0, length),
          }}
          onSeek={onSeek}
        />
      )
    );
    act(() => jest.runAllTimers());
    // A stale native momentum event must not override the undo/reset either.
    act(() => strip().props.onMomentumScrollEnd(scrollEvent(30)));
    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenLastCalledWith({
      x: length === 0 ? 30 : 165,
      animated: false,
    });
  }
);

it('reports every crossed position even when native events and board updates skip moves', () => {
  act(() => strip().props.onScrollBeginDrag());
  act(() => strip().props.onScroll(scrollEvent(30)));
  expect(onSelectionChange.mock.calls).toEqual([
    [1, history.moves[0]],
    [0, undefined],
  ]);
  act(() => strip().props.onScroll(scrollEvent(240)));
  expect(onSelectionChange.mock.calls).toEqual([
    [1, history.moves[0]],
    [0, undefined],
    [1, history.moves[0]],
    [2, history.moves[1]],
    [3, history.moves[2]],
  ]);
  // The board still coalesces this burst to two seeks, but feedback isn't lost.
  expect(onSeek).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(50));
  expect(onSeek).toHaveBeenCalledTimes(2);
  expect(onSeek).toHaveBeenLastCalledWith(3, { animated: true, duration: 80 });
  act(() => strip().props.onMomentumScrollEnd(scrollEvent(240)));
  act(() => jest.runAllTimers());
  expect(onSelectionChange).toHaveBeenCalledTimes(5);
});

it('tracks reversals independently of the board cursor and deduplicates same-cell events', () => {
  act(() => strip().props.onScrollBeginDrag());
  act(() => strip().props.onScroll(scrollEvent(100)));
  act(() => strip().props.onScroll(scrollEvent(102)));
  act(() => strip().props.onScroll(scrollEvent(240)));
  act(() => strip().props.onScroll(scrollEvent(100)));
  expect(onSelectionChange.mock.calls.map(([index]) => index)).toEqual([
    1, 2, 3, 2, 1,
  ]);
  // Returning to the already-applied position cancels the pending seek.
  act(() => strip().props.onScrollEndDrag(scrollEvent(100)));
  act(() => jest.runAllTimers());
  expect(onSeek).toHaveBeenCalledTimes(1);
  expect(onSelectionChange).toHaveBeenCalledTimes(5);
});

it('only reports the destination of accepted taps/arrows and ignores programmatic centering', () => {
  act(() => strip().props.onScroll(scrollEvent(30)));
  expect(onSelectionChange).not.toHaveBeenCalled();
  act(() =>
    renderer.update(
      <ChessBoardHistory
        history={{ ...history, index: 0 }}
        onSeek={onSeek}
        onSelectionChange={onSelectionChange}
      />
    )
  );
  act(() => strip().props.onScroll(scrollEvent(30)));
  expect(onSelectionChange).not.toHaveBeenCalled();
  act(() => item('Move 2, White, Nf3').props.onPress());
  expect(onSelectionChange.mock.calls).toEqual([[3, history.moves[2]]]);
  act(() => item('Move 2, White, Nf3').props.onPress());
  expect(onSelectionChange).toHaveBeenCalledTimes(1);
  onSeek.mockReturnValue(false);
  act(() => item('Initial position').props.onPress());
  expect(onSelectionChange).toHaveBeenCalledTimes(1);
  onSeek.mockReturnValue(true);
  act(() =>
    renderer.update(
      <ChessBoardHistory
        history={{ ...history, index: 3 }}
        onSeek={onSeek}
        onSelectionChange={onSelectionChange}
      />
    )
  );
  act(() => item('Previous move').props.onPress());
  expect(onSelectionChange).toHaveBeenLastCalledWith(2, history.moves[1]);
});

it('uses the latest feedback callback without replaying earlier crossings', () => {
  act(() => strip().props.onScrollBeginDrag());
  act(() => strip().props.onScroll(scrollEvent(30)));
  const replacement = jest.fn();
  act(() =>
    renderer.update(
      <ChessBoardHistory
        history={{ ...history, index: 0 }}
        onSeek={onSeek}
        onSelectionChange={replacement}
      />
    )
  );
  act(() => strip().props.onScroll(scrollEvent(240)));
  expect(onSelectionChange.mock.calls.map(([index]) => index)).toEqual([1, 0]);
  expect(replacement.mock.calls.map(([index]) => index)).toEqual([1, 2, 3]);
});

it('does not emit feedback after reset or while seeking is disabled', () => {
  act(() => strip().props.onScrollBeginDrag());
  act(() => strip().props.onScroll(scrollEvent(100)));
  act(() => strip().props.onScroll(scrollEvent(240)));
  const count = onSelectionChange.mock.calls.length;
  act(() =>
    renderer.update(
      <ChessBoardHistory
        history={{ ...history, index: 0, length: 0, moves: [] }}
        onSeek={onSeek}
        onSelectionChange={onSelectionChange}
      />
    )
  );
  act(() => strip().props.onMomentumScrollEnd(scrollEvent(30)));
  act(() => jest.runAllTimers());
  expect(onSelectionChange).toHaveBeenCalledTimes(count);
  act(() =>
    renderer.update(
      <ChessBoardHistory
        history={{ ...history, canSeek: false }}
        onSeek={onSeek}
        onSelectionChange={onSelectionChange}
      />
    )
  );
  act(() => strip().props.onScrollBeginDrag());
  act(() => strip().props.onScroll(scrollEvent(100)));
  expect(onSelectionChange).toHaveBeenCalledTimes(count);
});
