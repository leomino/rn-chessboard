import {
  retargetPieceAnimations,
  samplePieceAnimation,
  type PieceAnimations,
} from '../utils/historyAnimation';

it('starts capture fades immediately and completes them in the first third', () => {
  const capture = {
    from: { x: 120, y: 120, opacity: 1 },
    to: { x: 120, y: 120, opacity: 0 },
  };
  expect(samplePieceAnimation(capture, 0).opacity).toBe(1);
  expect(samplePieceAnimation(capture, 0.1).opacity).toBeCloseTo(0.7);
  expect(samplePieceAnimation(capture, 1 / 3).opacity).toBe(0);
  expect(samplePieceAnimation(capture, 1).opacity).toBe(0);
});

it('does not postpone a capture fade when many seeks interrupt it early', () => {
  const targets: PieceAnimations = {
    d7: {
      from: { x: 120, y: 120, opacity: 1 },
      to: { x: 120, y: 120, opacity: 0 },
    },
  };
  let active = targets;
  for (let i = 0; i < 10; i++) {
    const visible = samplePieceAnimation(active.d7!, 0.2);
    active = retargetPieceAnimations(active, targets, 0.2);
    expect(samplePieceAnimation(active.d7!, 0)).toEqual(visible);
  }
  expect(active.d7!.from.opacity).toBeLessThan(0.001);
});

it('reverses a partial fade continuously and restores the piece quickly', () => {
  const capture: PieceAnimations = {
    d7: {
      from: { x: 120, y: 120, opacity: 1 },
      to: { x: 120, y: 120, opacity: 0 },
    },
  };
  const restored = retargetPieceAnimations(
    capture,
    {
      d7: {
        from: { x: 120, y: 40, opacity: 0 },
        to: { x: 120, y: 40, opacity: 1 },
      },
    },
    0.2
  );
  expect(samplePieceAnimation(restored.d7!, 0)).toEqual(
    samplePieceAnimation(capture.d7!, 0.2)
  );
  expect(samplePieceAnimation(restored.d7!, 0.1).opacity).toBeGreaterThan(
    restored.d7!.from.opacity
  );
  expect(samplePieceAnimation(restored.d7!, 1 / 3).opacity).toBe(1);
  expect(samplePieceAnimation(restored.d7!, 1)).toEqual({
    x: 120,
    y: 40,
    opacity: 1,
  });
});
