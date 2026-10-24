import { useEffect } from 'react';
import {
  cancelAnimation,
  ReduceMotion,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useChessStore } from '../store/chessStore';

export type HistoryAnimation = {
  progress: SharedValue<number>;
  activeId: SharedValue<number>;
};

export function useHistoryAnimation(id: number | null): HistoryAnimation {
  const progress = useSharedValue(1);
  const activeId = useSharedValue(0);
  const finishTransition = useChessStore((state) => state.finishTransition);
  const releaseInteractions = useChessStore(
    (state) => state.releaseInteractions
  );

  useAnimatedReaction(
    () => id,
    (current, previous) => {
      if (current === previous) return;
      cancelAnimation(progress);
      if (current === null) {
        // Keep old render worklets at their destination during React's commit.
        progress.value = 1;
        return;
      }
      activeId.value = current;
      progress.value = 0;
      progress.value = withTiming(
        1,
        { duration: 200, reduceMotion: ReduceMotion.System },
        (finished) => {
          if (finished) runOnJS(finishTransition)(current);
        }
      );
    }
  );

  useEffect(
    () => () => {
      cancelAnimation(progress);
      releaseInteractions();
    },
    [progress, releaseInteractions]
  );

  return { progress, activeId };
}
