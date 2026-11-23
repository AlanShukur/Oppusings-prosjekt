import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultCorners, cornersUnchanged, orderCorners, validQuad, correctedSize, homography, project, rotatePixels, rotatePoint, warpPixels, MAX_EDGE } from '../public/studio/photo-correct.js';

function image(width, height, paint) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const value = paint(x, y), at = (y * width + x) * 4;
    data[at] = data[at + 1] = data[at + 2] = value; data[at + 3] = 255;
  }
  return { width, height, data };
}
const grey = (pixels, x, y) => pixels.data[(y * pixels.width + x) * 4];
const close = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not ${expected}`);

test('corners are put in reading order, whichever order they were dragged into', () => {
  const ordered = orderCorners([{ x: 90, y: 85 }, { x: 8, y: 4 }, { x: 4, y: 92 }, { x: 95, y: 10 }]);
  assert.deepEqual(ordered, [{ x: 8, y: 4 }, { x: 95, y: 10 }, { x: 90, y: 85 }, { x: 4, y: 92 }]);
  assert.ok(cornersUnchanged(defaultCorners(120, 80), 120, 80));
  assert.ok(!cornersUnchanged([{ x: 2, y: 0 }, ...defaultCorners(120, 80).slice(1)], 120, 80));
});

test('only a convex outline of a readable size can be straightened', () => {
  assert.ok(validQuad([{ x: 10, y: 5 }, { x: 90, y: 15 }, { x: 85, y: 95 }, { x: 5, y: 80 }]));
  assert.ok(!validQuad([{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 0 }, { x: 0, y: 100 }]), 'a bow tie folds over itself');
  assert.ok(!validQuad([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 1 }]), 'three corners on one line');
  assert.ok(!validQuad([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 }]), 'too small to read');
  assert.ok(!validQuad([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: NaN, y: 5 }, { x: 0, y: 5 }]));
});

test('the straightened size averages opposite sides and keeps the import pixel limits', () => {
  assert.deepEqual(correctedSize([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 110, y: 60 }, { x: -10, y: 60 }]), { width: 110, height: 61 });
  const huge = correctedSize(defaultCorners(6000, 3000));
  assert.equal(huge.width, MAX_EDGE);
  assert.ok(huge.width * huge.height <= 4_000_000);
});

test('the projective transform maps each corner exactly and keeps straight lines straight', () => {
  const from = defaultCorners(60, 40), to = [{ x: 10, y: 5 }, { x: 90, y: 15 }, { x: 85, y: 95 }, { x: 5, y: 80 }];
  const matrix = homography(from, to);
  from.forEach((point, index) => { const mapped = project(matrix, point.x, point.y); close(mapped.x, to[index].x); close(mapped.y, to[index].y); });
  // The middle of the top edge lands on the line between the two top corners.
  const middle = project(matrix, 30, 0), t = (middle.x - 10) / 80;
  close(middle.y, 5 + 10 * t, 1e-9);
  assert.throws(() => homography(from, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }]), /linje/);
});

test('quarter turns move every pixel and point to the same place, and four turns change nothing', () => {
  const source = image(3, 2, (x, y) => 10 * (y * 3 + x));
  const right = rotatePixels(source, 1);
  assert.equal(right.width, 2); assert.equal(right.height, 3);
  for (const turns of [1, 2, 3, -1]) {
    const turned = rotatePixels(source, turns);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 3; x++) {
      const centre = rotatePoint({ x: x + 0.5, y: y + 0.5 }, 3, 2, turns);
      assert.equal(grey(turned, centre.x - 0.5, centre.y - 0.5), grey(source, x, y), `turns ${turns}, pixel ${x},${y}`);
    }
  }
  assert.deepEqual(rotatePixels(rotatePixels(source, 1), 3).data, source.data);
  assert.deepEqual(rotatePixels(source, 4).data, source.data);
});

test('straightening the whole image, or a crop of it, returns those pixels unchanged', () => {
  const source = image(16, 16, (x, y) => (x * 31 + y * 7) % 256);
  assert.deepEqual(warpPixels(source, defaultCorners(16, 16)).data, source.data);
  const crop = warpPixels(source, [{ x: 2, y: 3 }, { x: 10, y: 3 }, { x: 10, y: 11 }, { x: 2, y: 11 }]);
  assert.equal(crop.width, 8); assert.equal(crop.height, 8);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) assert.equal(grey(crop, x, y), grey(source, x + 2, y + 3));
});

test('a plan photographed at an angle comes back flat', () => {
  // A 60 × 40 plan of 10-pixel squares, "photographed" so it appears as a skewed outline in a 100 × 100 picture.
  const flat = image(60, 40, (x, y) => ((Math.floor(x / 10) + Math.floor(y / 10)) % 2 ? 0 : 255));
  const outline = [{ x: 10, y: 5 }, { x: 90, y: 15 }, { x: 85, y: 95 }, { x: 5, y: 80 }];
  const toFlat = homography(outline, defaultCorners(60, 40));
  const photo = image(100, 100, (x, y) => {
    const point = project(toFlat, x + 0.5, y + 0.5);
    return point.x >= 0 && point.y >= 0 && point.x < 60 && point.y < 40 ? grey(flat, Math.floor(point.x), Math.floor(point.y)) : 128;
  });
  const straightened = warpPixels(photo, outline, { width: 60, height: 40 });
  let wrong = 0;
  for (let y = 0; y < 40; y++) for (let x = 0; x < 60; x++) if (Math.abs(grey(straightened, x, y) - grey(flat, x, y)) > 100) wrong++;
  assert.ok(wrong < 60 * 40 * 0.05, `${wrong} of 2400 pixels differ`);
});

test('parts of the outline outside the photo become white paper, and a folded outline is refused', () => {
  const source = image(10, 10, () => 0);
  const out = warpPixels(source, [{ x: -10, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: -10, y: 10 }], { width: 20, height: 10 });
  assert.equal(grey(out, 0, 5), 255);
  assert.equal(grey(out, 15, 5), 0);
  assert.throws(() => warpPixels(source, [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 0 }, { x: 0, y: 10 }]), /firkant/);
});
