export type PieceFrame = { x: number; y: number; opacity: number };

export type PieceAnimation = { from: PieceFrame; to: PieceFrame };

export type PieceAnimations = Record<string, PieceAnimation>;

/** Shared by playback and retargeting so interruptions sample the exact frame. */
export function samplePieceAnimation(
  { from, to }: PieceAnimation,
  progress: number
): PieceFrame {
  'worklet';
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
    // Start both fade directions immediately. Delaying fade-out until the end
    // leaves captured pieces visible indefinitely when scrubbing retargets it.
    opacity:
      from.opacity + (to.opacity - from.opacity) * Math.min(1, progress * 3),
  };
}

export function retargetPieceAnimations(
  previous: PieceAnimations,
  targets: PieceAnimations,
  progress: number
): PieceAnimations {
  'worklet';
  const next: PieceAnimations = {};
  for (const id of Object.keys(targets)) {
    const target = targets[id]!;
    const active = previous[id];
    next[id] = {
      from: active ? samplePieceAnimation(active, progress) : target.from,
      to: target.to,
    };
  }
  return next;
}
