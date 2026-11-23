// Straightening a photographed floor plan: rotate in quarter turns, and map four corners onto a flat rectangle.
// Pure functions on plain RGBA pixel arrays ({data, width, height}), so they run in tests without a browser.
export const MAX_EDGE = 2048;
export const MAX_PIXELS = 4_000_000;
const MIN_AREA = 64;

export const CORNER_NAMES = ['øverst til venstre', 'øverst til høyre', 'nederst til høyre', 'nederst til venstre'];

export function defaultCorners(width, height) {
  return [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }];
}

/** True when the corners still sit on the image's own corners, so straightening would change nothing. */
export function cornersUnchanged(corners, width, height) {
  return defaultCorners(width, height).every((point, index) => Math.hypot(point.x - corners[index].x, point.y - corners[index].y) < 0.5);
}

/** Puts four points in the order top-left, top-right, bottom-right, bottom-left, whatever order they were dragged into. */
export function orderCorners(points) {
  const cx = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const cy = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const sorted = [...points].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  let first = 0;
  sorted.forEach((point, index) => { if (point.x + point.y < sorted[first].x + sorted[first].y) first = index; });
  return [...sorted.slice(first), ...sorted.slice(0, first)].map(point => ({ x: point.x, y: point.y }));
}

const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** A usable outline: convex, not folded over itself, and big enough to read. */
export function validQuad(corners) {
  if (!Array.isArray(corners) || corners.length !== 4 || !corners.every(point => Number.isFinite(point?.x) && Number.isFinite(point?.y))) return false;
  const turns = corners.map((point, index) => cross(point, corners[(index + 1) % 4], corners[(index + 2) % 4]));
  if (!(turns.every(turn => turn > 0) || turns.every(turn => turn < 0))) return false;
  const area = Math.abs(corners.reduce((sum, point, index) => { const next = corners[(index + 1) % 4]; return sum + point.x * next.y - next.x * point.y; }, 0)) / 2;
  return area >= MIN_AREA;
}

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Output size: the average length of opposite sides, shrunk to the same pixel limits as an imported drawing. */
export function correctedSize(corners) {
  const [tl, tr, br, bl] = corners;
  const width = (distance(tl, tr) + distance(bl, br)) / 2, height = (distance(tl, bl) + distance(tr, br)) / 2;
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height), Math.sqrt(MAX_PIXELS / (width * height)));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** The 3×3 projective transform (row-major, last entry 1) that maps each `from` point onto the matching `to` point. */
export function homography(from, to) {
  const rows = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i], { x: u, y: v } = to[i];
    rows.push([x, y, 1, 0, 0, 0, -x * u, -y * u, u]);
    rows.push([0, 0, 0, x, y, 1, -x * v, -y * v, v]);
  }
  for (let column = 0; column < 8; column++) {
    let pivot = column;
    for (let row = column + 1; row < 8; row++) if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    if (Math.abs(rows[pivot][column]) < 1e-12) throw new Error('Hjørnene ligger på linje. Flytt dem til hjørnene av tegningen.');
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    for (let row = 0; row < 8; row++) {
      if (row === column) continue;
      const factor = rows[row][column] / rows[column][column];
      if (factor) for (let k = column; k < 9; k++) rows[row][k] -= factor * rows[column][k];
    }
  }
  return [...rows.map((row, index) => row[8] / row[index]), 1];
}

export function project(matrix, x, y) {
  const w = matrix[6] * x + matrix[7] * y + matrix[8];
  return { x: (matrix[0] * x + matrix[1] * y + matrix[2]) / w, y: (matrix[3] * x + matrix[4] * y + matrix[5]) / w };
}

/** Turns the pixels a quarter turn at a time; positive turns are clockwise. */
export function rotatePixels(source, quarterTurns) {
  const turns = ((Math.round(quarterTurns) % 4) + 4) % 4;
  const { width, height, data } = source;
  if (!turns) return { width, height, data: new Uint8ClampedArray(data) };
  const outWidth = turns % 2 ? height : width, outHeight = turns % 2 ? width : height;
  const out = new Uint8ClampedArray(outWidth * outHeight * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let nx, ny;
      if (turns === 1) { nx = height - 1 - y; ny = x; }
      else if (turns === 2) { nx = width - 1 - x; ny = height - 1 - y; }
      else { nx = y; ny = width - 1 - x; }
      const from = (y * width + x) * 4, to = (ny * outWidth + nx) * 4;
      out[to] = data[from]; out[to + 1] = data[from + 1]; out[to + 2] = data[from + 2]; out[to + 3] = data[from + 3];
    }
  }
  return { width: outWidth, height: outHeight, data: out };
}

/** Where a point in the image lands after `rotatePixels(…, quarterTurns)`. */
export function rotatePoint(point, width, height, quarterTurns) {
  const turns = ((Math.round(quarterTurns) % 4) + 4) % 4;
  if (turns === 1) return { x: height - point.y, y: point.x };
  if (turns === 2) return { x: width - point.x, y: height - point.y };
  if (turns === 3) return { x: point.y, y: width - point.x };
  return { x: point.x, y: point.y };
}

/**
 * Maps the area inside `corners` (top-left, top-right, bottom-right, bottom-left) onto a flat
 * rectangle with bilinear sampling. Anything that falls outside the photo becomes white paper.
 */
export function warpPixels(source, corners, size = correctedSize(corners)) {
  if (!validQuad(corners)) throw new Error('Hjørnene må danne en firkant rundt tegningen.');
  const { width: outWidth, height: outHeight } = size;
  const matrix = homography(defaultCorners(outWidth, outHeight), corners);
  const { width, height, data } = source;
  const out = new Uint8ClampedArray(outWidth * outHeight * 4);
  for (let v = 0; v < outHeight; v++) {
    for (let u = 0; u < outWidth; u++) {
      const point = project(matrix, u + 0.5, v + 0.5);
      const sx = point.x - 0.5, sy = point.y - 0.5, to = (v * outWidth + u) * 4;
      if (!(sx > -1 && sy > -1 && sx < width && sy < height)) { out[to] = out[to + 1] = out[to + 2] = out[to + 3] = 255; continue; }
      const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
      const xa = Math.max(0, x0), xb = Math.min(width - 1, x0 + 1), ya = Math.max(0, y0), yb = Math.min(height - 1, y0 + 1);
      const a = (ya * width + xa) * 4, b = (ya * width + xb) * 4, c = (yb * width + xa) * 4, d = (yb * width + xb) * 4;
      for (let channel = 0; channel < 4; channel++) {
        const top = data[a + channel] + (data[b + channel] - data[a + channel]) * fx;
        const bottom = data[c + channel] + (data[d + channel] - data[c + channel]) * fx;
        out[to + channel] = top + (bottom - top) * fy;
      }
    }
  }
  return { width: outWidth, height: outHeight, data: out };
}
