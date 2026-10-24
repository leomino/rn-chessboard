import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type {
  ChessBoardHistoryState,
  ChessBoardHistoryMove,
  ChessBoardSeekOptions,
} from '../utils/history';

// Retarget at most 20 times/sec while native/UI-thread animation keeps running.
// Scroll events between updates replace the pending target instead of queuing it.
const SCRUB_INTERVAL = 50;
const SCRUB_DURATION = 80;
const EMPTY_MOVES: readonly ChessBoardHistoryMove[] = [];
type HistoryItem = {
  index: number;
  san: string;
  number: string;
  label: string;
};

export type ChessBoardHistoryProps = {
  history: ChessBoardHistoryState | null;
  onSeek: (
    index: number,
    options?: ChessBoardSeekOptions
  ) => boolean | undefined;
  /** Feedback for each crossed position while scrubbing, or one accepted tap/arrow selection.
   * Independent of throttled board updates. Move is undefined at the start. */
  onSelectionChange?: (
    index: number,
    move: ChessBoardHistoryMove | undefined
  ) => void;
  style?: StyleProp<ViewStyle>;
};

/** A controlled move strip: tap to jump, or drag moves through the center. */
export default function ChessBoardHistory({
  history,
  onSeek,
  onSelectionChange,
  style,
}: ChessBoardHistoryProps) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [width, setWidth] = useState(0);
  const [centers, setCenters] = useState<Record<number, number>>({});
  const userScrolling = useRef(false);
  const dragging = useRef(false);
  const momentum = useRef(false);
  const scrubbedIndex = useRef<number | null>(null);
  const offset = useRef(0);
  const lastRequested = useRef(0);
  const lastFocused = useRef(history?.index ?? 0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrubTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTarget = useRef<number | null>(null);
  const lastSeekAt = useRef(-Infinity);
  const seek = useRef(onSeek);
  const geometry = useRef({ width, centers });
  const index = history?.index ?? 0;
  const moves = history?.moves ?? EMPTY_MOVES;
  const canSeek = history?.canSeek ?? false;
  const previousMoves = useRef(moves);
  const feedback = useRef({ onSelectionChange, moves });

  useLayoutEffect(() => {
    seek.current = onSeek;
    geometry.current = { width, centers };
    feedback.current = { onSelectionChange, moves };
  }, [onSeek, width, centers, onSelectionChange, moves]);

  useLayoutEffect(() => {
    if (!userScrolling.current) lastFocused.current = index;
  }, [index]);

  const notifySelection = useCallback((target: number, crossed: boolean) => {
    const previous = lastFocused.current;
    lastFocused.current = target;
    const { onSelectionChange: notify, moves: timeline } = feedback.current;
    if (!notify || target === previous) return;
    if (!crossed) {
      notify(target, timeline[target - 1]);
      return;
    }
    // A native scroll event may span multiple cells. Report each boundary in
    // order, without replaying positions or queuing delayed haptic work.
    const direction = target > previous ? 1 : -1;
    for (
      let position = previous + direction;
      position !== target + direction;
      position += direction
    ) {
      notify(position, timeline[position - 1]);
    }
  }, []);

  const clearSettleTimer = useCallback(() => {
    if (settleTimer.current !== null) clearTimeout(settleTimer.current);
    settleTimer.current = null;
  }, []);

  const clearScrubTimer = useCallback(() => {
    if (scrubTimer.current !== null) clearTimeout(scrubTimer.current);
    scrubTimer.current = null;
  }, []);

  useLayoutEffect(() => {
    if (previousMoves.current === moves) return;
    previousMoves.current = moves;
    // Undo/reset may invalidate a deferred scrub target, including a target
    // that would still be in range but now belongs to a different game.
    clearSettleTimer();
    clearScrubTimer();
    pendingTarget.current = null;
    userScrolling.current = false;
    dragging.current = false;
    momentum.current = false;
    scrubbedIndex.current = null;
    lastRequested.current = index;
    lastFocused.current = index;
  }, [moves, index, clearSettleTimer, clearScrubTimer]);

  useEffect(
    () => () => {
      clearSettleTimer();
      clearScrubTimer();
    },
    [clearSettleTimer, clearScrubTimer]
  );

  const centerMove = useCallback((target: number, animated: boolean) => {
    const layout = geometry.current;
    const center = layout.centers[target];
    if (center === undefined || !layout.width) return;
    scroll.current?.scrollTo({
      x: Math.max(0, center - layout.width / 2),
      animated,
    });
  }, []);

  useEffect(() => {
    if (userScrolling.current || !width || centers[index] === undefined) return;
    // A controlled cursor update from scrubbing must not pull the native scroll
    // view back to a cell center after the finger/momentum has stopped.
    if (scrubbedIndex.current === index) return;
    scrubbedIndex.current = null;
    scroll.current?.scrollTo({
      x: Math.max(0, centers[index] - width / 2),
      animated: false,
    });
  }, [index, width, centers, moves]);

  const seekPending = useCallback(() => {
    const target = pendingTarget.current;
    pendingTarget.current = null;
    if (
      target !== null &&
      target !== lastRequested.current &&
      seek.current(target, { animated: true, duration: SCRUB_DURATION })
    ) {
      lastRequested.current = target;
      scrubbedIndex.current = target;
      lastSeekAt.current = Date.now();
    }
    return lastRequested.current;
  }, []);

  const scrub = () => {
    const target = nearestMove();
    notifySelection(target, true);
    pendingTarget.current = target;
    const delay = SCRUB_INTERVAL - (Date.now() - lastSeekAt.current);
    if (pendingTarget.current === lastRequested.current) {
      clearScrubTimer();
      pendingTarget.current = null;
    } else if (delay <= 0) {
      clearScrubTimer();
      seekPending();
    } else if (scrubTimer.current === null) {
      scrubTimer.current = setTimeout(() => {
        scrubTimer.current = null;
        seekPending();
      }, delay);
    }
  };

  const finishScroll = () => {
    clearSettleTimer();
    if (!userScrolling.current) return;
    clearScrubTimer();
    pendingTarget.current = nearestMove();
    seekPending();
    userScrolling.current = false;
    dragging.current = false;
    momentum.current = false;
  };

  // Some native drags end without a momentum-end event. Settle after the last
  // scroll event in that case; momentum events keep this fallback postponed.
  const scheduleSettle = () => {
    clearSettleTimer();
    settleTimer.current = setTimeout(finishScroll, 120);
  };

  const handleScroll = ({
    nativeEvent,
  }: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = nativeEvent.contentOffset.x;
    if (!userScrolling.current || !canSeek) return;
    scrub();
    if (!dragging.current && !momentum.current) scheduleSettle();
  };

  const jump = useCallback(
    (target: number) => {
      clearSettleTimer();
      clearScrubTimer();
      pendingTarget.current = null;
      userScrolling.current = false;
      dragging.current = false;
      momentum.current = false;
      scrubbedIndex.current = null;
      if (seek.current(target, { animated: true })) {
        notifySelection(target, false);
        centerMove(target, false);
      }
    },
    [clearSettleTimer, clearScrubTimer, centerMove, notifySelection]
  );

  const items = useMemo(
    () => [
      { index: 0, san: 'Start', number: '', label: 'Initial position' },
      ...moves.map((move) => ({
        index: move.index,
        san: move.san,
        number:
          move.color === 'w'
            ? `${move.moveNumber}.`
            : move.index === 1
              ? `${move.moveNumber}…`
              : '',
        label: `Move ${move.moveNumber}, ${move.color === 'w' ? 'White' : 'Black'}, ${move.san}`,
      })),
    ],
    [moves]
  );

  const measured = useMemo(
    () =>
      items.flatMap((item) => {
        const center = centers[item.index];
        return center === undefined
          ? []
          : [{ index: item.index, offset: Math.max(0, center - width / 2) }];
      }),
    [items, centers, width]
  );

  const nearestMove = () => {
    if (!measured.length) return index;
    let low = 0;
    let high = measured.length - 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (measured[middle]!.offset < offset.current) low = middle + 1;
      else high = middle;
    }
    const right = measured[low]!;
    const left = measured[Math.max(0, low - 1)]!;
    return offset.current - left.offset <= right.offset - offset.current
      ? left.index
      : right.index;
  };

  const measureItem = useCallback((target: number, center: number) => {
    setCenters((previous) =>
      previous[target] === center ? previous : { ...previous, [target]: center }
    );
  }, []);

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Previous move"
        accessibilityState={{ disabled: !history?.canGoBack }}
        disabled={!history?.canGoBack}
        onPress={() => jump(index - 1)}
        style={[styles.arrow, !history?.canGoBack && styles.disabled]}
      >
        <Text style={styles.chevron}>‹</Text>
      </TouchableOpacity>
      <ScrollView
        ref={scroll}
        horizontal
        style={styles.strip}
        contentContainerStyle={{ paddingHorizontal: width / 2 }}
        showsHorizontalScrollIndicator={false}
        scrollEnabled={canSeek}
        scrollEventThrottle={16}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onContentSizeChange={() => {
          if (!userScrolling.current && scrubbedIndex.current !== index)
            centerMove(index, false);
        }}
        onScroll={handleScroll}
        onScrollBeginDrag={() => {
          if (!canSeek) return;
          clearSettleTimer();
          clearScrubTimer();
          pendingTarget.current = null;
          lastSeekAt.current = -Infinity;
          if (!userScrolling.current) lastFocused.current = index;
          userScrolling.current = true;
          dragging.current = true;
          momentum.current = false;
          scrubbedIndex.current = index;
          lastRequested.current = index;
        }}
        onScrollEndDrag={(event) => {
          handleScroll(event);
          dragging.current = false;
          scheduleSettle();
        }}
        onMomentumScrollBegin={() => {
          if (!userScrolling.current) return;
          clearSettleTimer();
          momentum.current = true;
        }}
        onMomentumScrollEnd={(event) => {
          handleScroll(event);
          finishScroll();
        }}
      >
        {items.map((item) => (
          <HistoryMove
            key={item.index}
            item={item}
            selected={index === item.index}
            disabled={!canSeek}
            onJump={jump}
            onMeasure={measureItem}
          />
        ))}
      </ScrollView>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Next move"
        accessibilityState={{ disabled: !history?.canGoForward }}
        disabled={!history?.canGoForward}
        onPress={() => jump(index + 1)}
        style={[styles.arrow, !history?.canGoForward && styles.disabled]}
      >
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const HistoryMove = memo(function MoveItem({
  item,
  selected,
  disabled,
  onJump,
  onMeasure,
}: {
  item: HistoryItem;
  selected: boolean;
  disabled: boolean;
  onJump: (index: number) => void;
  onMeasure: (index: number, center: number) => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={() => onJump(item.index)}
      onLayout={({ nativeEvent: { layout } }) =>
        onMeasure(item.index, layout.x + layout.width / 2)
      }
      style={styles.item}
    >
      {item.number ? <Text style={styles.number}>{item.number}</Text> : null}
      <View style={[styles.move, selected && styles.selected]}>
        <Text style={styles.san}>{item.san}</Text>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#302d29',
    paddingVertical: 12,
  },
  strip: { flex: 1 },
  arrow: {
    width: 44,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: { color: '#ddd', fontSize: 40, lineHeight: 44 },
  disabled: { opacity: 0.3 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: 3,
  },
  number: { color: '#bbb', fontSize: 18, marginRight: 6 },
  move: {
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: 4,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  selected: { backgroundColor: '#45423e', borderBottomColor: '#bbb' },
  san: { color: '#fff', fontSize: 20, fontWeight: '600' },
});
