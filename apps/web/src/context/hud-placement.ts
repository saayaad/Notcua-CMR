export interface HudBlockPosition {
  mode: 'dock' | 'floating';
  x: number;
  y: number;
  width: number;
  height: number;
}

const GAP = 0.5;
const clamp = (value: number, maximum: number) =>
  Math.max(0, Math.min(Number.isFinite(value) ? value : 0, maximum));

function inViewport(position: HudBlockPosition): HudBlockPosition {
  const width = Math.max(1, Math.min(Number.isFinite(position.width) ? position.width : 1, 100));
  const height = Math.max(1, Math.min(Number.isFinite(position.height) ? position.height : 1, 100));
  return {
    ...position,
    width,
    height,
    x: clamp(position.x, 100 - width),
    y: clamp(position.y, 100 - height),
  };
}

export function floatingBlocksOverlap(a: HudBlockPosition, b: HudBlockPosition, gap = 0): boolean {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y
  );
}

export function snapFloatingPosition(
  id: string,
  desired: HudBlockPosition,
  positions: Record<string, HudBlockPosition>,
): HudBlockPosition {
  if (desired.mode !== 'floating') return desired;
  const target = inViewport(desired);
  const occupied = Object.entries(positions)
    .filter(([otherId, position]) => otherId !== id && position.mode === 'floating')
    .map(([, position]) => inViewport(position));
  if (occupied.every((position) => !floatingBlocksOverlap(target, position, GAP))) return target;

  const maxX = 100 - target.width;
  const maxY = 100 - target.height;
  const xs = [target.x, 0, maxX];
  const ys = [target.y, 0, maxY];
  for (const position of occupied) {
    xs.push(position.x - target.width - GAP, position.x + position.width + GAP);
    ys.push(position.y - target.height - GAP, position.y + position.height + GAP);
  }
  let closest: HudBlockPosition | undefined;
  let distance = Infinity;
  for (const x of new Set(xs.filter((value) => value >= 0 && value <= maxX))) {
    for (const y of new Set(ys.filter((value) => value >= 0 && value <= maxY))) {
      const candidate = { ...target, x, y };
      if (occupied.some((position) => floatingBlocksOverlap(candidate, position, GAP))) continue;
      const nextDistance = (x - target.x) ** 2 + (y - target.y) ** 2;
      if (nextDistance < distance ||
        (nextDistance === distance && closest && (y < closest.y || (y === closest.y && x < closest.x)))) {
        closest = candidate;
        distance = nextDistance;
      }
    }
  }
  return closest ?? { ...target, mode: 'dock' };
}

export function normalizeFloatingPositions(
  positions: Record<string, HudBlockPosition>,
): Record<string, HudBlockPosition> {
  const result: Record<string, HudBlockPosition> = {};
  for (const id of Object.keys(positions).sort()) {
    result[id] = snapFloatingPosition(id, positions[id]!, result);
  }
  return result;
}
