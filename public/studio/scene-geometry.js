/** Geometry shared by the 2D editor and the 3D viewer. Coordinates are 50 units/m. */
import { FURNITURE, furnitureSize, furnitureOutline, placePolygon } from './furniture.js';

export const PLAN_UNITS_PER_METER = 50;
/** Default opening widths in plan units when an item has no explicit width (m). */
export const DEFAULT_OPENING_WIDTH = {door: 42, window: 70};
/** Openings farther than this from a wall are not attached to it (2D warning, 3D skip, checks). */
export const OPENING_ATTACH_DISTANCE = 24;
const EPS = 0.00001;
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const round = value => Math.round(value * 100000) / 100000;
// Cut parameters are deduped at high precision and only the resulting coordinates
// are rounded, so a split at e.g. t=160/430 lands exactly on the neighbour's corner.
const roundCut = value => Math.round(value * 1e9) / 1e9;
const roundCoord = value => Math.round(value * 1000) / 1000;
export const openingWidthUnits = item => Number.isFinite(item?.width) && item.width > 0 ? item.width * PLAN_UNITS_PER_METER : DEFAULT_OPENING_WIDTH[item?.type] ?? 70;
const cross = (ax, ay, bx, by) => ax * by - ay * bx;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
/** What a wall is doing in the project; 'existing' + 'unknown' is the unsaved default. */
export const WALL_STATUSES = ['existing', 'new', 'demolish'];
export const LOAD_BEARING = ['unknown', 'yes', 'no'];
const SIDE_TOLERANCE = 0.01;

function roomSide(room, wall) {
  if (!room) return '?';
  if (Math.abs(wall.y - wall.y2) < SIDE_TOLERANCE) {
    if (Math.abs(wall.y - room.y) < SIDE_TOLERANCE) return 'top';
    if (Math.abs(wall.y - (room.y + room.h)) < SIDE_TOLERANCE) return 'bottom';
  } else if (Math.abs(wall.x - wall.x2) < SIDE_TOLERANCE) {
    if (Math.abs(wall.x - room.x) < SIDE_TOLERANCE) return 'left';
    if (Math.abs(wall.x - (room.x + room.w)) < SIDE_TOLERANCE) return 'right';
  }
  return '?';
}

/**
 * A wall's identity for saved notes: the room sides that form it ("bed1:right|living:left"), or
 * "item:<id>" for a drawn partition wall. Unlike the coordinate id it survives resizing and moving
 * rooms. Pieces of one room side that face no other room share a key, and so share a note.
 */
function wallKey(wall, roomsById) {
  if (wall.itemIds.length) return `item:${wall.itemIds[0]}`;
  return wall.roomIds.map(id => `${id}:${roomSide(roomsById.get(id), wall)}`).join('|');
}

function addRectSegments(segments, room) {
  if (![room.x, room.y, room.w, room.h].every(Number.isFinite) || room.w <= 0 || room.h <= 0) return;
  const x = room.x, y = room.y, right = x + room.w, bottom = y + room.h;
  for (const [ax, ay, bx, by] of [[x, y, right, y], [right, y, right, bottom], [right, bottom, x, bottom], [x, bottom, x, y]]) {
    segments.push({x: ax, y: ay, x2: bx, y2: by, roomIds: [room.id], itemIds: [], source: 'room', cuts: [0, 1]});
  }
}

function addCut(segment, t) {
  if (t > EPS && t < 1 - EPS) segment.cuts.push(t);
}

function splitPair(a, b) {
  const ax = a.x2 - a.x, ay = a.y2 - a.y, bx = b.x2 - b.x, by = b.y2 - b.y;
  const dx = b.x - a.x, dy = b.y - a.y;
  const determinant = cross(ax, ay, bx, by);
  if (Math.abs(determinant) > EPS) {
    const t = cross(dx, dy, bx, by) / determinant;
    const u = cross(dx, dy, ax, ay) / determinant;
    if (t >= -EPS && t <= 1 + EPS && u >= -EPS && u <= 1 + EPS) {
      addCut(a, t); addCut(b, u);
    }
    return;
  }
  if (Math.abs(cross(dx, dy, ax, ay)) > EPS) return;
  const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by;
  if (a2 < EPS || b2 < EPS) return;
  addCut(a, (dx * ax + dy * ay) / a2);
  addCut(a, ((b.x2 - a.x) * ax + (b.y2 - a.y) * ay) / a2);
  addCut(b, ((a.x - b.x) * bx + (a.y - b.y) * by) / b2);
  addCut(b, ((a.x2 - b.x) * bx + (a.y2 - b.y) * by) / b2);
}

/** Split overlapping/shared boundaries once, including T-junctions and diagonal partitions. */
export function deriveWalls(state = {}) {
  const segments = [];
  for (const room of state.rooms || []) addRectSegments(segments, room);
  for (const item of state.items || []) {
    if (item.type !== 'wall') continue;
    const x = finite(item.x), y = finite(item.y), x2 = finite(item.x2, x + 90), y2 = finite(item.y2, y);
    if (Math.hypot(x2 - x, y2 - y) < EPS) continue;
    segments.push({x, y, x2, y2, roomIds: [], itemIds: [item.id], source: 'item', cuts: [0, 1]});
  }
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) splitPair(segments[i], segments[j]);
  }
  const unique = new Map();
  for (const segment of segments) {
    const cuts = [...new Set(segment.cuts.map(roundCut))].sort((a, b) => a - b);
    for (let i = 1; i < cuts.length; i++) {
      const t = cuts[i - 1], u = cuts[i];
      let a = {x: roundCoord(segment.x + (segment.x2 - segment.x) * t), y: roundCoord(segment.y + (segment.y2 - segment.y) * t)};
      let b = {x: roundCoord(segment.x + (segment.x2 - segment.x) * u), y: roundCoord(segment.y + (segment.y2 - segment.y) * u)};
      if (distance(a, b) < EPS) continue;
      if (a.x > b.x || (a.x === b.x && a.y > b.y)) [a, b] = [b, a];
      const id = `${a.x},${a.y}:${b.x},${b.y}`;
      if (!unique.has(id)) unique.set(id, {id, x: a.x, y: a.y, x2: b.x, y2: b.y, roomIds: new Set(), itemIds: new Set()});
      const wall = unique.get(id);
      for (const roomId of segment.roomIds) wall.roomIds.add(roomId);
      for (const itemId of segment.itemIds) wall.itemIds.add(itemId);
    }
  }
  const roomsById = new Map((state.rooms || []).map(room => [room.id, room]));
  const notes = new Map((state.walls || []).map(note => [note.key, note]));
  return [...unique.values()].map(wall => {
    const derived = {
      ...wall,
      roomIds: [...wall.roomIds].sort(),
      itemIds: [...wall.itemIds].sort(),
      source: wall.itemIds.size ? 'item' : 'room',
      exterior: wall.roomIds.size === 1,
      length: Math.hypot(wall.x2 - wall.x, wall.y2 - wall.y),
    };
    derived.key = wallKey(derived, roomsById);
    const note = notes.get(derived.key);
    derived.status = WALL_STATUSES.includes(note?.status) ? note.status : 'existing';
    derived.loadBearing = LOAD_BEARING.includes(note?.loadBearing) ? note.loadBearing : 'unknown';
    return derived;
  });
}

export function getSceneBounds(state = {}) {
  const points = [];
  for (const room of state.rooms || []) {
    if ([room.x, room.y, room.w, room.h].every(Number.isFinite)) points.push([room.x, room.y], [room.x + room.w, room.y + room.h]);
  }
  const ref = state.reference;
  if (ref && [ref.x, ref.y, ref.w, ref.h].every(Number.isFinite)) points.push([ref.x, ref.y], [ref.x + ref.w, ref.y + ref.h]);
  for (const item of state.items || []) {
    if (Number.isFinite(item.x) && Number.isFinite(item.y)) {
      const extent = item.type === 'wall' ? 0 : 45;
      points.push([item.x - extent, item.y - extent], [item.x + extent, item.y + extent]);
      if (item.type === 'wall') points.push([finite(item.x2, item.x + 90), finite(item.y2, item.y)]);
    }
  }
  if (!points.length) points.push([0, 0], [500, 400]);
  const minX = Math.min(...points.map(p => p[0])), minY = Math.min(...points.map(p => p[1]));
  const maxX = Math.max(...points.map(p => p[0])), maxY = Math.max(...points.map(p => p[1]));
  const width = Math.max(1, maxX - minX), height = Math.max(1, maxY - minY);
  return {minX, minY, maxX: minX + width, maxY: minY + height, width, height, centerX: minX + width / 2, centerY: minY + height / 2};
}

export function projectToWall(wall, point) {
  const dx = wall.x2 - wall.x, dy = wall.y2 - wall.y, squared = dx * dx + dy * dy;
  const t = squared ? Math.max(0, Math.min(1, ((point.x - wall.x) * dx + (point.y - wall.y) * dy) / squared)) : 0;
  const x = wall.x + t * dx, y = wall.y + t * dy;
  return {x, y, t, distance: Math.hypot(point.x - x, point.y - y)};
}

/**
 * Door hinge side and swing in wall-local terms, matching the 2D symbol: hinge at local -x (or +x when the
 * door is `mirrored`), leaf along local +y.
 */
function doorSwing(wall, item) {
  const mirror = result => item.mirrored ? {...result, hinge: result.hinge === 'start' ? 'end' : 'start'} : result;
  if (!Number.isFinite(item.rotation)) return mirror({hinge: 'start', swing: -1});
  const r = item.rotation * Math.PI / 180, ux = Math.cos(r), uy = Math.sin(r);
  const dx = (wall.x2 - wall.x) / wall.length, dy = (wall.y2 - wall.y) / wall.length;
  const along = ux * dx + uy * dy;
  if (Math.abs(along) < 0.9) return mirror({hinge: 'start', swing: -1});
  const side = -Math.sin(r) * -dy + Math.cos(r) * dx;
  return mirror({hinge: along > 0 ? 'start' : 'end', swing: side >= 0 ? 1 : -1});
}

/** The floor a door leaf sweeps, as a polygon: a quarter circle around the hinge, on the side the door opens to. */
export function doorSweep(item) {
  const span = openingWidthUnits(item), hinge = item.mirrored ? span / 2 : -span / 2, toward = item.mirrored ? Math.PI : 0;
  const arc = Array.from({length: 7}, (_, i) => {
    const angle = toward + (item.mirrored ? -1 : 1) * i * Math.PI / 12;
    return [hinge + Math.cos(angle) * span, Math.sin(angle) * span];
  });
  return placePolygon([[hinge, 0], ...arc], item);
}

function openingOnWall(wall, item, synthetic = false) {
  const point = projectToWall(wall, item);
  const width = Math.min(openingWidthUnits(item), wall.length - 10);
  if (width < 18) return null;
  const center = Math.max(width / 2 + 3, Math.min(wall.length - width / 2 - 3, point.t * wall.length));
  const opening = {id: item.id, type: item.type, start: (center - width / 2) / 50, end: (center + width / 2) / 50, bottom: 0, top: 2.12, synthetic};
  if (item.type === 'window') {
    opening.bottom = Number.isFinite(item.sillHeight) ? Math.max(0, Math.min(2, item.sillHeight)) : 0.9;
    opening.top = Math.min(2.4, opening.bottom + (Number.isFinite(item.height) && item.height > 0 ? item.height : 1.25));
  } else if (!synthetic) Object.assign(opening, doorSwing(wall, item));
  return opening;
}

/** Attach every door/window to its nearest wall. Shared by 3D, the 2D warnings and the TEK17 check. */
export function assignOpenings(state = {}, walls = deriveWalls(state)) {
  return (state.items || []).filter(item => item.type === 'door' || item.type === 'window').map(item => {
    const candidate = walls.map(wall => ({wall, projection: projectToWall(wall, item)}))
      .filter(entry => entry.projection.distance <= OPENING_ATTACH_DISTANCE && entry.wall.length > 28)
      .sort((a, b) => a.projection.distance - b.projection.distance || b.wall.length - a.wall.length)[0];
    return candidate
      ? {item, wall: candidate.wall, projection: candidate.projection, exterior: candidate.wall.exterior, roomIds: candidate.wall.roomIds, offWall: false}
      : {item, wall: null, projection: null, exterior: false, roomIds: [], offWall: true};
  });
}

/**
 * True when two convex polygons share area (separating-axis test). A two-point polygon is a wall line; it adds
 * its own direction as an axis, so a piece just past the end of a wall doesn't count as crossing it.
 */
function polygonsOverlap(a, b) {
  const axes = [];
  for (const polygon of [a, b]) {
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i], q = polygon[(i + 1) % polygon.length];
      axes.push([q.y - p.y, p.x - q.x]);
      if (polygon.length === 2) axes.push([q.x - p.x, q.y - p.y]);
    }
  }
  return axes.every(([nx, ny]) => {
    if (!nx && !ny) return true;
    const pa = a.map(point => point.x * nx + point.y * ny), pb = b.map(point => point.x * nx + point.y * ny);
    return Math.max(...pa) > Math.min(...pb) + EPS && Math.max(...pb) > Math.min(...pa) + EPS;
  });
}

/** Rooms holding furniture the user placed. Their automatic furniture steps aside; kitchen and bathroom fittings stay. */
export function furnishedRoomIds(state = {}) {
  const ids = new Set();
  for (const item of state.items || []) {
    if (!FURNITURE[item.type]) continue;
    const room = (state.rooms || []).find(room => item.x >= room.x && item.x <= room.x + room.w && item.y >= room.y && item.y <= room.y + room.h);
    if (room) ids.add(room.id);
  }
  return ids;
}
const FIXTURES = new Set(['kitchen', 'island', 'bath', 'sink', 'toilet']);

// Pieces that may share floor: a chair pushed under a table, and a plant on or beside any furniture.
const TABLES = new Set(['table', 'round-table', 'desk', 'low-table']);
const sharesFloor = (a, b) => a === 'plant' || b === 'plant' || (a === 'chair' && TABLES.has(b)) || (b === 'chair' && TABLES.has(a));

/**
 * Furniture that crosses a wall, stands where a door swings, or overlaps other furniture.
 * Returns a Map from item id to a list of {kind: 'wall' | 'door' | 'furniture', id}. A door lists the furniture in
 * its way. Pieces that only touch are fine, and so is crossing a wall marked for demolition.
 */
export function furnitureConflicts(state = {}, walls = deriveWalls(state)) {
  const conflicts = new Map();
  const add = (id, entry) => { if (!conflicts.has(id)) conflicts.set(id, []); conflicts.get(id).push(entry); };
  const pieces = (state.items || []).filter(item => FURNITURE[item.type]).map(item => ({item, kind: FURNITURE[item.type].kind, outline: furnitureOutline(item, 1)}));
  if (!pieces.length) return conflicts;
  const standing = walls.filter(wall => wall.status !== 'demolish').map(wall => [{x: wall.x, y: wall.y}, {x: wall.x2, y: wall.y2}]);
  const doors = assignOpenings(state, walls).filter(entry => entry.item.type === 'door' && !entry.offWall).map(entry => ({id: entry.item.id, sweep: doorSweep(entry.item)}));
  for (const piece of pieces) {
    if (standing.some(line => polygonsOverlap(piece.outline, line))) add(piece.item.id, {kind: 'wall'});
    for (const door of doors) {
      if (!polygonsOverlap(piece.outline, door.sweep)) continue;
      add(piece.item.id, {kind: 'door', id: door.id});
      add(door.id, {kind: 'furniture', id: piece.item.id});
    }
  }
  for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
    const a = pieces[i], b = pieces[j];
    if (sharesFloor(a.kind, b.kind) || !polygonsOverlap(a.outline, b.outline)) continue;
    add(a.item.id, {kind: 'furniture', id: b.item.id});
    add(b.item.id, {kind: 'furniture', id: a.item.id});
  }
  return conflicts;
}

/** Subtract opening rectangles from a wall's elevation without a boolean-mesh library. */
export function wallPanels(length, openings = [], wallHeight = 2.5) {
  const cuts = [0, length];
  for (const opening of openings) cuts.push(Math.max(0, opening.start), Math.min(length, opening.end));
  const sorted = [...new Set(cuts.map(round))].sort((a, b) => a - b);
  const panels = [];
  for (let i = 1; i < sorted.length; i++) {
    const start = sorted[i - 1], end = sorted[i];
    if (end - start < EPS) continue;
    const center = (start + end) / 2;
    const holes = openings.filter(o => o.start < center && o.end > center).map(o => [Math.max(0, o.bottom), Math.min(wallHeight, o.top)]).sort((a, b) => a[0] - b[0]);
    let cursor = 0;
    for (const [bottom, top] of holes) {
      if (bottom > cursor + EPS) panels.push({start, end, bottom: cursor, top: bottom});
      cursor = Math.max(cursor, top);
    }
    if (cursor < wallHeight - EPS) panels.push({start, end, bottom: cursor, top: wallHeight});
  }
  return panels;
}

function defaultsForRooms(rooms) {
  const furniture = [];
  for (const room of rooms) {
    const x = room.x / 50, z = room.y / 50, w = room.w / 50, d = room.h / 50;
    const min = Math.min(w, d);
    if (min < 1.1) continue;
    if (room.type === 'bedroom' && w >= 1.7 && d >= 2.3) {
      const width = Math.min(1.55, w * 0.53), depth = Math.min(2, d * 0.7);
      furniture.push({type: 'bed', x: x + w * 0.58, z: z + d * 0.46, width, depth, rotation: 0, roomId: room.id});
      if (w > 2.8) furniture.push({type: 'wardrobe', x: x + 0.42, z: z + d * 0.4, width: 0.55, depth: Math.min(1.7, d * 0.6), rotation: 0, roomId: room.id});
    } else if (room.type === 'living' || room.type === 'kitchen' || room.type === 'dining') {
      if (w >= 3 && d >= 3 && room.type !== 'dining') {
        furniture.push({type: 'sofa', x: x + Math.min(0.7, w * 0.2), z: z + d * 0.63, width: Math.min(2.4, d * 0.5), depth: 0.88, rotation: 90, roomId: room.id});
        furniture.push({type: 'coffee', x: x + w * 0.4, z: z + d * 0.64, width: Math.min(1.05, w * 0.25), depth: Math.min(0.72, d * 0.2), rotation: 0, roomId: room.id});
        furniture.push({type: 'rug', x: x + w * 0.3, z: z + d * 0.65, width: Math.min(2.7, w * 0.68), depth: Math.min(2.8, d * 0.55), rotation: 0, roomId: room.id});
      }
      if ((room.type === 'living' || room.type === 'kitchen') && w >= 3 && d >= 3.7) {
        furniture.push({type: 'kitchen', x: x + w / 2, z: z + 0.42, width: Math.max(1.5, w - 0.25), depth: 0.6, rotation: 0, roomId: room.id});
        if (w >= 4) furniture.push({type: 'island', x: x + w * 0.5, z: z + Math.min(2.15, d * 0.3), width: Math.min(2.1, w * 0.46), depth: 0.78, rotation: 0, roomId: room.id});
      }
      if ((room.type === 'dining' || w >= 5) && min >= 2) furniture.push({type: 'table', x: x + w * (room.type === 'dining' ? 0.5 : 0.77), z: z + d * (room.type === 'dining' ? 0.5 : 0.54), width: Math.min(1.25, w * 0.3), depth: Math.min(1.55, d * 0.4), rotation: 0, roomId: room.id});
      if (min > 2.3) furniture.push({type: 'plant', x: x + 0.42, z: z + d - 0.42, width: 0.42, depth: 0.42, rotation: 0, roomId: room.id});
    } else if (room.type === 'bath' && min >= 1.5) {
      furniture.push({type: 'bath', x: x + 0.5, z: z + Math.min(1, d / 2), width: 0.72, depth: Math.min(1.65, d - 0.2), rotation: 0, roomId: room.id});
      furniture.push({type: 'sink', x: x + w - 0.4, z: z + 0.4, width: 0.6, depth: 0.5, rotation: 0, roomId: room.id});
      furniture.push({type: 'toilet', x: x + w - 0.45, z: z + d - 0.5, width: 0.42, depth: 0.62, rotation: 0, roomId: room.id});
    } else if (room.type === 'office' && min >= 1.8) {
      furniture.push({type: 'desk', x: x + w / 2, z: z + 0.5, width: Math.min(1.5, w * 0.7), depth: 0.65, rotation: 0, roomId: room.id});
    }
  }
  return furniture;
}

export function deriveSceneSpec(state = {}) {
  const rooms = (state.rooms || []).filter(room => [room.x, room.y, room.w, room.h].every(Number.isFinite) && room.w > 0 && room.h > 0);
  const walls = deriveWalls(state).map(wall => ({...wall, openings: []}));
  for (const entry of assignOpenings(state, walls)) {
    if (entry.offWall) continue;
    const opening = openingOnWall(entry.wall, entry.item);
    if (opening) entry.wall.openings.push(opening);
  }
  // Legacy example plans saved before openings became items get implicit ones,
  // per type, so explicit items are never duplicated by synthetic openings.
  // Imported plans only use the user's traced geometry and explicit openings.
  if (state.variant !== 'custom' && !state.reference) {
    const hasDoors = (state.items || []).some(item => item.type === 'door');
    const hasWindows = (state.items || []).some(item => item.type === 'window');
    for (const room of hasDoors ? [] : rooms) {
      if (room.type === 'living') continue;
      const candidates = walls.filter(wall => wall.roomIds.includes(room.id) && wall.roomIds.length > 1 && wall.length >= 50 && !wall.openings.some(o => o.type === 'door'));
      candidates.sort((a, b) => {
        const score = wall => wall.roomIds.some(id => rooms.find(r => r.id === id)?.type === (room.type === 'bath' ? 'hall' : 'living')) ? 1 : 0;
        return score(b) - score(a) || b.length - a.length;
      });
      if (candidates[0]) {
        const wall = candidates[0], opening = openingOnWall(wall, {id: `default-door-${room.id}`, type: 'door', x: (wall.x + wall.x2) / 2, y: (wall.y + wall.y2) / 2}, true);
        if (opening) wall.openings.push(opening);
      }
    }
    for (const room of hasWindows ? [] : rooms.filter(room => ['bedroom', 'living'].includes(room.type))) {
      const wall = walls.filter(wall => wall.exterior && wall.roomIds.includes(room.id) && wall.length >= 65 && !wall.openings.length).sort((a, b) => b.length - a.length)[0];
      if (!wall) continue;
      const opening = openingOnWall(wall, {id: `default-window-${room.id}`, type: 'window', x: (wall.x + wall.x2) / 2, y: (wall.y + wall.y2) / 2}, true);
      if (opening) wall.openings.push(opening);
    }
  }
  const furnished = furnishedRoomIds(state);
  const furniture = defaultsForRooms(rooms).filter(entry => !furnished.has(entry.roomId) || FIXTURES.has(entry.type));
  for (const item of state.items || []) {
    const piece = FURNITURE[item.type];
    if (!piece) continue;
    furniture.push({id: item.id, type: piece.kind, height: piece.height, x: item.x / 50, z: item.y / 50, ...furnitureSize(item), rotation: finite(item.rotation), explicit: true});
  }
  return {
    bounds: getSceneBounds(rooms.length ? {...state, reference: null} : state),
    floors: rooms.map(room => ({id: room.id, name: room.name, type: room.type, color: /^#[0-9a-f]{6}$/i.test(room.color || '') ? room.color : '#e8e2d5', x: (room.x + room.w / 2) / 50, z: (room.y + room.h / 2) / 50, width: room.w / 50, depth: room.h / 50})),
    walls: walls.map(wall => ({...wall, height: 2.5, thickness: wall.exterior ? 0.16 : 0.12, panels: wallPanels(wall.length / 50, wall.openings)})),
    furniture,
    reference: state.reference || null,
  };
}
