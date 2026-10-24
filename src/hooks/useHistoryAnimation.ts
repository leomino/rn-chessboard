import { useEffect, useMemo } from 'react';
import type { Color } from 'chess.js';
import {
  cancelAnimation,
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useChessStore } from '../store/BoardContext';
import { toCoordinates } from '../Constants';
import type { HistoryTransition } from '../utils/history';
import {
  retargetPieceAnimations,
  type PieceAnimations,
} from '../utils/historyAnimation';

export type HistoryAnimation = {
  progress: SharedValue<number>;
  activeId: SharedValue<number>;
  pieces: SharedValue<PieceAnimations>;
};

export function useHistoryAnimation(
  transition: HistoryTransition | null,
  orientation: Color,
  squareSize: number
): HistoryAnimation {
  const id = transition?.id ?? null;
  const duration = transition?.duration ?? 200;
  const progress = useSharedValue(1);
  const activeId = useSharedValue(0);
  const pieces = useSharedValue<PieceAnimations>({});
  const targets = useMemo(() => {
    const animations: PieceAnimations = {};
    for (const piece of transition?.pieces ?? []) {
      const from = (piece.from ?? piece.to)!;
      const to = (piece.to ?? piece.from)!;
      animations[piece.id] = {
        from: {
          ...toCoordinates(from.square, orientation, squareSize),
          opacity: piece.from ? 1 : 0,
        },
        to: {
          ...toCoordinates(to.square, orientation, squareSize),
          opacity: piece.to ? 1 : 0,
        },
      };
    }
    return animations;
  }, [transition, orientation, squareSize]);
  const finishTransition = useChessStore((state) => state.finishTransition);
  const releaseInteractions = useChessStore(
    (state) => state.releaseInteractions
  );

  useAnimatedReaction(
    () => ({ id, orientation, targets, duration, squareSize }),
    (current, previous) => {
      if (
        current.id === previous?.id &&
        current.orientation === previous?.orientation &&
        current.squareSize === previous?.squareSize
      )
        return;
      cancelAnimation(progress);
      if (current.id === null) {
        // Keep old render worklets at their destination during React's commit.
        progress.value = 1;
        pieces.value = {};
        return;
      }
      // Sample the UI-thread clock before resetting it. Every piece starts the
      // next transition at its visible location/opacity, even during fast seeks.
      pieces.value = retargetPieceAnimations(
        current.orientation === previous?.orientation &&
          current.squareSize === previous?.squareSize
          ? pieces.value
          : {},
        current.targets,
        progress.value
      );
      activeId.value = current.id;
      progress.value = 0;
      progress.value = withTiming(
        1,
        {
          duration: current.duration,
          // Short scrub transitions should respond immediately, rather than
          // repeatedly restarting an ease-in as the finger changes direction.
          ...(current.duration < 200
            ? { easing: Easing.out(Easing.quad) }
            : {}),
          reduceMotion: ReduceMotion.System,
        },
        (finished) => {
          if (finished) runOnJS(finishTransition)(current.id!);
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

  return useMemo(
    () => ({ progress, activeId, pieces }),
    [progress, activeId, pieces]
  );
}
