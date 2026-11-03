/**
 * Compares a plan with its saved baseline ("Dagens planløsning"). Pure module (no DOM), shared by the 2D editor
 * (ghosts of removed walls), the TEK17 check and the project brief.
 *
 * Walls are compared as line segments: the parts of a baseline wall that no current wall covers are removed, and
 * the parts of a current wall that no baseline wall covers are new. Moving a wall therefore reads as one removed
 * and one new wall, which is what it is on site.
 */
import { deriveWalls, assignOpenings } from './scene-geometry.js';

const ON_LINE = 2;          // plan units (4 cm): drawing noise, not a moved wall
const MIN_PIECE = 10;       // plan units (0.2 m): shorter uncovered bits are ignored
const SAME_OPENING = 15;    // plan units (0.3 m): an opening this close to one of the same type is the same opening

/** The baseline as a plan of its own, or null when none is saved. */
export const baselinePlan = plan => plan?.baseline ? {rooms: plan.baseline.rooms || [], items: plan.baseline.items || [], walls: plan.baseline.walls || []} : null;

/** Pieces of `wall` that none of `others` covers, as sub-segments at least MIN_PIECE long. */
function uncovered(wall, others) {
  const dx = wall.x2 - wall.x, dy = wall.y2 - wall.y, length = Math.hypot(dx, dy);
  if (length < MIN_PIECE) return [];
  const ux = dx / length, uy = dy / length;
  const offLine = (x, y) => Math.abs((x - wall.x) * uy - (y - wall.y) * ux);
  const along = (x, y) => Math.max(0, Math.min(length, (x - wall.x) * ux + (y - wall.y) * uy));
  const covered = others
    .filter(other => offLine(other.x, other.y) <= ON_LINE && offLine(other.x2, other.y2) <= ON_LINE)
    .map(other => [along(other.x, other.y), along(other.x2, other.y2)].sort((a, b) => a - b))
    .filter(([a, b]) => b - a > 0)
    .sort((a, b) => a[0] - b[0]);
  const gaps = [];
  let at = 0;
  for (const [a, b] of covered) {
    if (a > at) gaps.push([at, a]);
    at = Math.max(at, b);
  }
  if (at < length) gaps.push([at, length]);
  return gaps.filter(([a, b]) => b - a >= MIN_PIECE).map(([a, b]) => ({x: wall.x + ux * a, y: wall.y + uy * a, x2: wall.x + ux * b, y2: wall.y + uy * b, length: b - a}));
}

/** Uncovered pieces grouped per wall key, so a wall drawn in several pieces is one change. */
function changedWalls(walls, others) {
  const byKey = new Map();
  for (const wall of walls) {
    const pieces = uncovered(wall, others);
    if (!pieces.length) continue;
    if (!byKey.has(wall.key)) byKey.set(wall.key, {key: wall.key, source: wall.source, roomIds: wall.roomIds, exterior: wall.exterior, loadBearing: wall.loadBearing, wall, pieces: [], length: 0});
    const entry = byKey.get(wall.key);
    entry.pieces.push(...pieces);
    entry.length += pieces.reduce((sum, piece) => sum + piece.length, 0);
  }
  return [...byKey.values()];
}

function changedOpenings(plan, other) {
  const candidates = (other.items || []).filter(item => item.type === 'door' || item.type === 'window');
  return assignOpenings(plan).filter(entry => !candidates.some(item => item.type === entry.item.type && Math.hypot(item.x - entry.item.x, item.y - entry.item.y) <= SAME_OPENING))
    .map(entry => ({item: entry.item, exterior: !entry.offWall && entry.exterior}));
}

const overlapArea = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/**
 * What changed since the baseline, or null without one:
 * removedWalls/newWalls ({key, roomIds, exterior, loadBearing, pieces, length}; removed walls carry the baseline's
 * room ids and load-bearing note), removedOpenings/newOpenings ({item, exterior}), and overlaps between baseline and
 * current rooms ({baseline, current, area}) for use and bathroom changes.
 */
export function compareToBaseline(plan) {
  const before = baselinePlan(plan);
  if (!before) return null;
  const after = {rooms: plan.rooms || [], items: plan.items || [], walls: plan.walls || []};
  const wallsBefore = deriveWalls(before), wallsAfter = deriveWalls(after);
  const overlaps = [];
  for (const baseline of before.rooms) {
    for (const current of after.rooms) {
      const area = overlapArea(baseline, current);
      if (area > 0) overlaps.push({baseline, current, area});
    }
  }
  return {
    savedAt: plan.baseline.savedAt,
    rooms: before.rooms,
    removedWalls: changedWalls(wallsBefore, wallsAfter),
    newWalls: changedWalls(wallsAfter, wallsBefore),
    removedOpenings: changedOpenings(before, after),
    newOpenings: changedOpenings(after, before),
    overlaps,
  };
}
