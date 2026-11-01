import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveWalls, getSceneBounds, deriveSceneSpec, wallPanels } from '../public/studio/scene-geometry.js';

function room(id, x, y, w, h, type = 'room') {
  return {id, name: id, x, y, w, h, type, color: '#e8dfcc', width: w / 50, height: h / 50, area: w * h / 2500};
}

test('adjacent rooms share one physical wall instead of overlapping wall meshes', () => {
  const walls = deriveWalls({rooms: [room('a', 0, 0, 200, 250), room('b', 200, 0, 150, 250)], items: []});
  assert.equal(walls.reduce((sum, wall) => sum + wall.length, 0), 1450);
  const shared = walls.filter(wall => wall.roomIds.length === 2);
  assert.equal(shared.length, 1);
  assert.deepEqual(shared[0].roomIds, ['a', 'b']);
  assert.equal(shared[0].exterior, false);
  assert.equal(shared[0].length, 250);
});

test('T-junctions split a long wall into correctly owned adjacent boundaries', () => {
  const walls = deriveWalls({rooms: [room('left', 0, 0, 100, 200), room('upper', 100, 0, 100, 100), room('lower', 100, 100, 100, 100)], items: []});
  assert.equal(walls.reduce((sum, wall) => sum + wall.length, 0), 1100);
  const shared = walls.filter(wall => wall.x === 100 && wall.x2 === 100);
  assert.equal(shared.length, 2);
  assert.ok(shared.every(wall => wall.length === 100 && wall.roomIds.length === 2));
});

test('crossing custom partitions split at their actual intersection', () => {
  const walls = deriveWalls({rooms: [], items: [{id: 'one', type: 'wall', x: 0, y: 0, x2: 100, y2: 100}, {id: 'two', type: 'wall', x: 0, y: 100, x2: 100, y2: 0}]});
  assert.equal(walls.length, 4);
  assert.ok(walls.every(wall => (wall.x === 50 && wall.y === 50) || (wall.x2 === 50 && wall.y2 === 50)));
});

test('an added partition on an existing room boundary does not duplicate it', () => {
  const walls = deriveWalls({rooms: [room('a', 0, 0, 200, 200)], items: [{id: 'w', type: 'wall', x: 50, y: 0, x2: 150, y2: 0}]});
  assert.equal(walls.reduce((sum, wall) => sum + wall.length, 0), 800);
  const merged = walls.find(wall => wall.itemIds.includes('w'));
  assert.deepEqual(merged.roomIds, ['a']);
});

test('door openings remove the correct elevation area without a closing floor-level wall', () => {
  const panels = wallPanels(4, [{start: 1, end: 1.8, bottom: 0, top: 2.1}]);
  const area = panels.reduce((sum, panel) => sum + (panel.end - panel.start) * (panel.top - panel.bottom), 0);
  assert.ok(Math.abs(area - (4 * 2.5 - 0.8 * 2.1)) < 0.00001);
  assert.ok(panels.filter(panel => panel.start >= 1 && panel.end <= 1.8).every(panel => panel.bottom >= 2.1));
});

test('custom plans use real room dimensions and only explicitly placed openings', () => {
  const plan = {variant: 'custom', rooms: [room('own', 1500, -500, 300, 200, 'bedroom')], items: [{id: 'door', type: 'door', x: 1600, y: -500, rotation: 0}]};
  const scene = deriveSceneSpec(plan);
  assert.equal(scene.floors[0].width, 6);
  assert.equal(scene.floors[0].depth, 4);
  assert.equal(scene.floors[0].x, 33);
  assert.equal(scene.floors[0].z, -8);
  assert.equal(scene.walls.flatMap(wall => wall.openings).length, 1);
  assert.equal(scene.walls.flatMap(wall => wall.openings)[0].type, 'door');
});

test('empty imported floorplans fit the reference instead of the old example apartment', () => {
  const reference = {x: -200, y: 400, w: 1500, h: 900};
  const bounds = getSceneBounds({rooms: [], items: [], reference});
  assert.deepEqual(bounds, {minX: -200, minY: 400, maxX: 1300, maxY: 1300, width: 1500, height: 900, centerX: 550, centerY: 850});
  const spec = deriveSceneSpec({variant: 'custom', rooms: [], items: [], reference});
  assert.equal(spec.walls.length, 0);
  assert.equal(spec.furniture.length, 0);
});

test('the furnished 3D camera fits traced rooms without the reference image margins', () => {
  const scene = deriveSceneSpec({variant: 'custom', rooms: [room('own', 200, 300, 150, 200)], items: [], reference: {x: 0, y: 0, w: 2000, h: 2000}});
  assert.equal(scene.bounds.width, 150);
  assert.equal(scene.bounds.height, 200);
  assert.equal(scene.bounds.centerX, 275);
});
