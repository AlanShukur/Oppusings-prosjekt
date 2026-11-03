// The furniture you can place, with typical sizes in metres. Width runs along the back of the piece and
// depth from the back (local -y) to the front (local +y). 2D, 3D and the overlap check read sizes from here.
export const FURNITURE = {
  sofa: {name: 'Sofa, 3 seter', group: 'Stue', width: 2.1, depth: 0.9, kind: 'sofa', icon: 'sofa'},
  armchair: {name: 'Lenestol', group: 'Stue', width: 0.8, depth: 0.8, kind: 'sofa', icon: 'sofa'},
  'coffee-table': {name: 'Salongbord', group: 'Stue', width: 1.1, depth: 0.6, kind: 'low-table', icon: 'table'},
  'tv-bench': {name: 'TV-benk', group: 'Stue', width: 1.6, depth: 0.4, kind: 'cabinet', height: 0.45, icon: 'cabinet'},
  bookshelf: {name: 'Bokhylle', group: 'Stue', width: 0.8, depth: 0.3, kind: 'cabinet', height: 1.9, icon: 'cabinet'},
  plant: {name: 'Plante', group: 'Stue', width: 0.45, depth: 0.45, kind: 'plant', icon: 'plant'},
  bed: {name: 'Dobbeltseng', group: 'Soverom', width: 1.6, depth: 2, kind: 'bed', icon: 'bed'},
  'single-bed': {name: 'Enkeltseng', group: 'Soverom', width: 0.9, depth: 2, kind: 'bed', icon: 'bed'},
  wardrobe: {name: 'Garderobeskap', group: 'Soverom', width: 1, depth: 0.6, kind: 'closet', icon: 'cabinet'},
  dresser: {name: 'Kommode', group: 'Soverom', width: 0.8, depth: 0.45, kind: 'cabinet', height: 0.8, icon: 'cabinet'},
  table: {name: 'Spisebord', group: 'Spise og arbeid', width: 1.6, depth: 0.9, kind: 'table', icon: 'table'},
  'round-table': {name: 'Rundt bord', group: 'Spise og arbeid', width: 1, depth: 1, kind: 'round-table', icon: 'table'},
  chair: {name: 'Stol', group: 'Spise og arbeid', width: 0.45, depth: 0.5, kind: 'chair', icon: 'chair'},
  desk: {name: 'Skrivebord', group: 'Spise og arbeid', width: 1.4, depth: 0.7, kind: 'desk', icon: 'table'},
  washer: {name: 'Vaskemaskin', group: 'Vaskerom', width: 0.6, depth: 0.6, kind: 'appliance', icon: 'washer'},
  dryer: {name: 'Tørketrommel', group: 'Vaskerom', width: 0.6, depth: 0.6, kind: 'appliance', icon: 'washer'},
};
export const FURNITURE_GROUPS = ['Stue', 'Soverom', 'Spise og arbeid', 'Vaskerom'];
/** The smallest and largest width or depth a piece can have, in metres. */
export const FURNITURE_LIMITS = [0.2, 4];
/** Sizes from before plan format 4, when every piece of a type was drawn the same; migration 3→4 keeps them. */
export const LEGACY_SIZES = {bed: [1.28, 1.76], sofa: [1.68, 0.88], table: [1.32, 0.88], plant: [0.45, 0.45]};

const UNITS = 50;
export const isFurniture = type => Object.hasOwn(FURNITURE, type);

/** A piece's size in metres: its own when set, otherwise the catalogue's. */
export function furnitureSize(item) {
  const piece = FURNITURE[item?.type];
  if (!piece) return null;
  const own = value => Number.isFinite(value) && value > 0;
  return {width: own(item.width) ? item.width : piece.width, depth: own(item.depth) ? item.depth : piece.depth};
}

/**
 * The piece's outline on the plan, in plan units, as a convex polygon of {x, y} points.
 * Round pieces get an octagon. inset shrinks the outline, so pieces that only touch don't count as overlapping.
 */
export function furnitureOutline(item, inset = 0) {
  const size = furnitureSize(item);
  if (!size) return [];
  const w = Math.max(0.5, size.width * UNITS / 2 - inset), d = Math.max(0.5, size.depth * UNITS / 2 - inset);
  const round = ['plant', 'round-table'].includes(FURNITURE[item.type].kind);
  const local = round
    ? Array.from({length: 8}, (_, i) => [Math.cos((i + 0.5) * Math.PI / 4) * w, Math.sin((i + 0.5) * Math.PI / 4) * d])
    : [[-w, -d], [w, -d], [w, d], [-w, d]];
  return placePolygon(local, item);
}

/** Turns local points around the item's centre by its rotation (degrees, clockwise on screen) and moves them onto the plan. */
export function placePolygon(local, item) {
  const r = (Number.isFinite(item.rotation) ? item.rotation : 0) * Math.PI / 180, cos = Math.cos(r), sin = Math.sin(r);
  return local.map(([x, y]) => ({x: item.x + x * cos - y * sin, y: item.y + x * sin + y * cos}));
}
