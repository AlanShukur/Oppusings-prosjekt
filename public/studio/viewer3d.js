import {
  ACESFilmicToneMapping, BoxGeometry, CanvasTexture, Color, CylinderGeometry,
  DirectionalLight, DoubleSide, Group, HemisphereLight, Mesh, MeshStandardMaterial,
  PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, Raycaster, RepeatWrapping,
  Scene, SphereGeometry, SRGBColorSpace, TextureLoader, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { deriveSceneSpec } from './scene-geometry.js';

const PALETTE = {
  wall: '#f6f2e9', innerWall: '#f3eee3', wood: '#c7a77c', oak: '#d7bd95',
  paleWood: '#ded0b4', dark: '#3e4943', cream: '#f8f5ec', sage: '#b6c5a6',
  cushion: '#d8e0ce', metal: '#8d958e', water: '#c5dadd', rug: '#ded7c8',
};

function woodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = '#efe3cb'; context.fillRect(0, 0, 256, 256);
  let seed = 34;
  const random = () => {seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296;};
  for (let x = 0; x < 256; x += 32) {
    context.fillStyle = `rgba(135,102,58,${0.025 + random() * 0.04})`;
    context.fillRect(x, 0, 32, 256);
    context.strokeStyle = 'rgba(138,108,72,0.16)'; context.lineWidth = 0.8;
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 256); context.stroke();
    const joint = Math.floor(random() * 220);
    context.beginPath(); context.moveTo(x, joint); context.lineTo(x + 32, joint); context.stroke();
  }
  for (let i = 0; i < 230; i++) {
    const x = random() * 256, y = random() * 256;
    context.strokeStyle = `rgba(128,99,64,${random() * 0.07})`;
    context.beginPath(); context.moveTo(x, y); context.bezierCurveTo(x + 2, y + 10, x - 2, y + 24, x + 1, y + 45); context.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}

function tileTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  context.fillStyle = '#e6ecea'; context.fillRect(0, 0, 128, 128);
  context.strokeStyle = '#bdcbc8'; context.lineWidth = 1.5;
  context.strokeRect(0.75, 0.75, 126.5, 126.5);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}

class Plan3DViewer {
  constructor(container, state, options = {}) {
    this.container = container;
    this.options = options;
    this.layers = {furniture: true, reference: true, ...options.layers};
    this.referenceImage = options.referenceImage || null;
    this.disposed = false;
    this.frame = null;
    this.frameCount = 0;
    this.zoom = 100;
    this.fullWalls = false;
    this.materials = new Map();
    this.geometries = new Map();
    this.floorTextures = [];
    this.referenceTexture = null;
    this.pickable = [];
    this.wallGroups = [];
    this.root = document.createElement('div');
    Object.assign(this.root.style, {position: 'absolute', inset: '0', overflow: 'hidden', background: '#f5f6f3'});
    this.root.setAttribute('aria-label', 'Interaktiv 3D-modell. Dra for å rotere, rull for å zoome.');
    this.root.dataset.viewer3d = 'true';
    this.container.replaceChildren(this.root);
    try {
      this.renderer = new WebGLRenderer({antialias: true, alpha: false, powerPreference: 'low-power'});
    } catch {
      this.root.remove();
      throw new Error('3D-visningen krever WebGL i nettleseren. Du kan fortsette å redigere i 2D.');
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.98;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    Object.assign(this.renderer.domElement.style, {display: 'block', width: '100%', height: '100%', touchAction: 'none', cursor: 'grab'});
    this.renderer.domElement.setAttribute('aria-label', '3D-visning av plantegningen');
    this.renderer.domElement.setAttribute('role', 'img');
    this.root.appendChild(this.renderer.domElement);
    this.scene = new Scene();
    this.scene.background = new Color('#f5f6f3');
    this.camera = new PerspectiveCamera(38, 1, 0.05, 2000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;
    this.controls.minPolarAngle = 0.12;
    this.controls.maxPolarAngle = Math.PI * 0.485;
    this.controls.rotateSpeed = 0.65;
    this.controls.zoomSpeed = 0.8;
    this.controls.panSpeed = 0.65;
    this.onControlsChange = () => this.requestRender();
    this.controls.addEventListener('change', this.onControlsChange);
    this.controls.addEventListener('start', () => {this.renderer.domElement.style.cursor = 'grabbing';});
    this.controls.addEventListener('end', () => {this.renderer.domElement.style.cursor = 'grab';});
    this.scene.add(new HemisphereLight('#fffdf2', '#c7cdc0', 1.8));
    this.sun = new DirectionalLight('#fff4df', 2.1);
    this.sun.position.set(-7, 16, 9);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.bias = -0.00035;
    this.sun.shadow.normalBias = 0.025;
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 100;
    this.scene.add(this.sun);
    this.content = new Group();
    this.scene.add(this.content);
    this.raycaster = new Raycaster();
    this.pointer = new Vector2();
    this.onPointerDown = event => {this.pointerStart = {x: event.clientX, y: event.clientY};};
    this.onPointerUp = event => this.pickRoom(event);
    this.onContextLost = event => {
      if (this.disposed) return;
      event.preventDefault();
      this.emptyHint.hidden = false;
      this.emptyHint.textContent = 'Grafikktilkoblingen ble avbrutt. Bytt til 2D og prøv 3D igjen.';
      options.onError?.(new Error('3D-visningen mistet grafikktilkoblingen. Bytt til 2D og prøv igjen.'));
    };
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.makeControls();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.root);
    try {
      this.update(state, options);
      this.resize();
      this.resetView();
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  material(color, extra = {}) {
    const key = color + JSON.stringify(extra);
    if (!this.materials.has(key)) this.materials.set(key, new MeshStandardMaterial({color, roughness: 0.8, metalness: 0, ...extra}));
    return this.materials.get(key);
  }

  boxGeometry(w, h, d) {
    const key = `box:${w.toFixed(4)},${h.toFixed(4)},${d.toFixed(4)}`;
    if (!this.geometries.has(key)) this.geometries.set(key, new BoxGeometry(w, h, d));
    return this.geometries.get(key);
  }

  box(parent, w, h, d, x, y, z, material, cast = true) {
    if (Math.min(w, h, d) <= 0) return null;
    const mesh = new Mesh(this.boxGeometry(w, h, d), typeof material === 'string' ? this.material(material) : material);
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  cylinder(parent, top, bottom, height, x, y, z, color, segments = 20) {
    const key = `cylinder:${top},${bottom},${height},${segments}`;
    if (!this.geometries.has(key)) this.geometries.set(key, new CylinderGeometry(top, bottom, height, segments));
    const mesh = new Mesh(this.geometries.get(key), this.material(color));
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  ellipsoid(parent, x, y, z, sx, sy, sz, color, segments = 12) {
    const key = `sphere:${segments}`;
    if (!this.geometries.has(key)) this.geometries.set(key, new SphereGeometry(1, segments, 8));
    const mesh = new Mesh(this.geometries.get(key), this.material(color));
    mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  }

  makeControls() {
    const bar = document.createElement('div');
    Object.assign(bar.style, {position: 'absolute', left: '12px', right: '12px', bottom: '9px', display: 'flex', alignItems: 'center', gap: '7px', pointerEvents: 'none', flexWrap: 'wrap'});
    const hint = document.createElement('span');
    hint.textContent = 'Dra for å rotere · Rull for å zoome';
    Object.assign(hint.style, {font: '10px "DM Sans",sans-serif', color: '#7a7f78', background: '#ffffffdf', padding: '7px 9px', borderRadius: '6px', border: '1px solid #e5e8df', pointerEvents: 'auto'});
    bar.appendChild(hint);
    const button = (label, title, click) => {
      const element = document.createElement('button'); element.type = 'button'; element.textContent = label; element.title = title;
      Object.assign(element.style, {font: '10px "DM Sans",sans-serif', color: '#6d637f', background: '#fff', padding: '7px 9px', borderRadius: '6px', border: '1px solid #e3dceb', cursor: 'pointer', pointerEvents: 'auto'});
      element.onclick = click; bar.appendChild(element); return element;
    };
    this.wallToggle = button('Hele vegger', 'Vis alle vegger i full høyde', () => {
      this.fullWalls = !this.fullWalls;
      this.wallToggle.setAttribute('aria-pressed', String(this.fullWalls));
      this.wallToggle.textContent = this.fullWalls ? 'Åpne modellen' : 'Hele vegger';
      this.requestRender();
    });
    this.wallToggle.setAttribute('aria-pressed', 'false');
    button('Tilpass', 'Tilpass hele modellen i vinduet', () => this.resetView());
    this.root.appendChild(bar);
    this.emptyHint = document.createElement('div');
    Object.assign(this.emptyHint.style, {position: 'absolute', top: '13px', left: '50%', transform: 'translateX(-50%)', maxWidth: 'calc(100% - 32px)', textAlign: 'center', color: '#77668c', background: '#fffdf5ed', border: '1px solid #e9e2d6', borderRadius: '8px', padding: '9px 12px', font: '11px/1.5 "DM Sans",sans-serif', pointerEvents: 'none'});
    this.root.appendChild(this.emptyHint);
  }

  update(state, options = {}) {
    if (this.disposed) return;
    const signature = JSON.stringify(state);
    const image = 'referenceImage' in options ? options.referenceImage : this.referenceImage;
    if (signature === this.stateSignature && image === this.referenceImage) {
      if (options.layers) this.setLayers(options.layers);
      return;
    }
    this.stateSignature = signature;
    this.state = state;
    if (options.layers) this.layers = {...this.layers, ...options.layers};
    if ('referenceImage' in options) this.referenceImage = options.referenceImage;
    this.spec = deriveSceneSpec(state);
    if (this.spec.walls.length > 3000) throw new Error('Modellen har for mange veggkryss for 3D-visningen. Forenkle skilleveggene og prøv igjen.');
    this.clearContent();
    const bounds = this.spec.bounds;
    this.content.position.set(-bounds.centerX / 50, 0, -bounds.centerY / 50);
    this.pickable = []; this.wallGroups = [];
    this.emptyHint.hidden = this.spec.floors.length > 0;
    this.emptyHint.textContent = this.spec.reference ? 'Underlaget er importert. Tegn rom i 2D for å bygge 3D-modellen.' : 'Tegn rom i 2D for å bygge en 3D-modell.';
    this.addGround();
    this.addReference();
    for (const floor of this.spec.floors) this.addFloor(floor);
    for (const wall of this.spec.walls) this.addWall(wall);
    this.furnitureGroup = new Group();
    this.content.add(this.furnitureGroup);
    for (const furniture of this.spec.furniture) this.addFurniture(furniture);
    this.furnitureGroup.visible = this.layers.furniture !== false;
    const half = Math.max(bounds.width, bounds.height) / 100 + 4;
    Object.assign(this.sun.shadow.camera, {left: -half, right: half, top: half, bottom: -half});
    this.sun.shadow.camera.updateProjectionMatrix();
    this.renderer.shadowMap.needsUpdate = true;
    this.requestRender();
  }

  addGround() {
    const bounds = this.spec.bounds;
    const ground = this.box(this.content, bounds.width / 50 + 6, 0.04, bounds.height / 50 + 6, bounds.centerX / 50, -0.23, bounds.centerY / 50, '#f1f2ed', false);
    ground.receiveShadow = true;
  }

  addReference() {
    const reference = this.spec.reference;
    if (!reference || !this.referenceImage || this.spec.floors.length) return;
    const geometry = new PlaneGeometry(reference.w / 50, reference.h / 50);
    const material = new MeshStandardMaterial({color: '#ffffff', roughness: 1, side: DoubleSide});
    const mesh = new Mesh(geometry, material);
    mesh.visible = this.layers.reference !== false;
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((reference.x + reference.w / 2) / 50, -0.105, (reference.y + reference.h / 2) / 50);
    mesh.receiveShadow = true;
    this.content.add(mesh);
    const generation = this.contentGeneration;
    const texture = new TextureLoader().load(this.referenceImage, () => {
      if (this.disposed || generation !== this.contentGeneration) {texture.dispose(); return;}
      texture.colorSpace = SRGBColorSpace;
      material.map = texture; material.needsUpdate = true;
      this.requestRender();
    }, undefined, () => {
      if (!this.disposed && generation === this.contentGeneration) this.emptyHint.textContent = 'Underlaget kunne ikke vises i 3D. Bytt til 2D for å åpne det på nytt.';
    });
    this.referenceTexture = texture;
    this.referenceMesh = mesh;
  }

  addFloor(floor) {
    const map = floor.type === 'bath' ? tileTexture() : woodTexture();
    map.repeat.set(Math.max(1, floor.width / (floor.type === 'bath' ? 0.55 : 2)), Math.max(1, floor.depth / (floor.type === 'bath' ? 0.55 : 2)));
    this.floorTextures.push(map);
    const material = new MeshStandardMaterial({color: floor.color, map, roughness: 0.86, metalness: 0});
    const mesh = this.box(this.content, floor.width, 0.12, floor.depth, floor.x, -0.06, floor.z, material, false);
    mesh.userData.roomId = floor.id;
    this.pickable.push(mesh);
  }

  addWall(wall) {
    const group = new Group();
    group.position.set(wall.x / 50, 0, wall.y / 50);
    group.rotation.y = -Math.atan2(wall.y2 - wall.y, wall.x2 - wall.x);
    // A wall marked for demolition stays as a faint red ghost, so the opened-up space reads in 3D.
    const demolish = wall.status === 'demolish';
    const normal = demolish ? this.material('#d98a78', {transparent: true, opacity: 0.28, depthWrite: false}) : this.material(wall.exterior ? PALETTE.wall : PALETTE.innerWall);
    const ghost = this.material(wall.exterior ? PALETTE.wall : PALETTE.innerWall, {transparent: true, opacity: 0.13, depthWrite: false});
    for (const panel of wall.panels) {
      this.box(group, panel.end - panel.start, panel.top - panel.bottom, wall.thickness, (panel.start + panel.end) / 2, (panel.bottom + panel.top) / 2, 0, normal);
      if (panel.bottom === 0 && !demolish) this.box(group, panel.end - panel.start, 0.075, wall.thickness + 0.014, (panel.start + panel.end) / 2, 0.0375, 0, '#dcd3c1', false);
    }
    for (const opening of wall.openings) this.addOpening(group, opening, wall.thickness);
    this.content.add(group);
    let outward = null;
    if (wall.exterior) {
      const room = (this.state.rooms || []).find(room => room.id === wall.roomIds[0]);
      if (room) {
        const dx = wall.x2 - wall.x, dy = wall.y2 - wall.y;
        const length = Math.hypot(dx, dy) || 1;
        let nx = -dy / length, nz = dx / length;
        const centerX = room.x + room.w / 2 - (wall.x + wall.x2) / 2;
        const centerZ = room.y + room.h / 2 - (wall.y + wall.y2) / 2;
        if (nx * centerX + nz * centerZ > 0) {nx = -nx; nz = -nz;}
        outward = {x: nx, z: nz};
      }
    }
    const opaque = [];
    group.traverse(mesh => {if (mesh.isMesh && !mesh.material.transparent) opaque.push({mesh, original: mesh.material});});
    this.wallGroups.push({group, normal, ghost, opaque, outward, middle: {x: (wall.x + wall.x2) / 100 - this.spec.bounds.centerX / 50, z: (wall.y + wall.y2) / 100 - this.spec.bounds.centerY / 50}, faded: false});
  }

  addOpening(parent, opening, thickness) {
    const width = opening.end - opening.start, height = opening.top - opening.bottom;
    const x = (opening.start + opening.end) / 2, y = (opening.bottom + opening.top) / 2;
    const frame = PALETTE.cream, depth = thickness + 0.025;
    this.box(parent, 0.045, height, depth, opening.start + 0.0225, y, 0, frame);
    this.box(parent, 0.045, height, depth, opening.end - 0.0225, y, 0, frame);
    this.box(parent, width, 0.045, depth, x, opening.top - 0.0225, 0, frame);
    if (opening.type === 'window') {
      this.box(parent, width, 0.045, depth + 0.08, x, opening.bottom + 0.0225, 0, frame);
      this.box(parent, 0.032, height - 0.06, depth, x, y, 0, frame, false);
      this.box(parent, width - 0.075, height - 0.075, 0.012, x, y, 0, this.material('#aecfd1', {transparent: true, opacity: 0.3, roughness: 0.28, depthWrite: false}), false);
    } else {
      // Hinge side and swing follow the 2D door symbol (see doorSwing in scene-geometry.js).
      const hinge = new Group(), swing = opening.swing ?? -1;
      if (opening.hinge === 'end') {hinge.position.set(opening.end - 0.04, 0, 0); hinge.rotation.y = Math.PI + 0.7 * swing;}
      else {hinge.position.set(opening.start + 0.04, 0, 0); hinge.rotation.y = -0.7 * swing;}
      const leafWidth = width - 0.075;
      this.box(hinge, leafWidth, height - 0.06, 0.035, leafWidth / 2, (height - 0.06) / 2, 0, '#dfd0b4');
      this.ellipsoid(hinge, leafWidth - 0.085, 1.03, 0.04, 0.03, 0.025, 0.025, '#b9a477', 8);
      parent.add(hinge);
    }
  }

  addFurniture(spec) {
    const group = new Group(); group.position.set(spec.x, 0, spec.z); group.rotation.y = -(spec.rotation || 0) * Math.PI / 180;
    group.userData.roomId = spec.roomId;
    const w = spec.width || 1, d = spec.depth || 1;
    const box = (bw, bh, bd, x, y, z, color, cast = true) => this.box(group, bw, bh, bd, x, y, z, color, cast);
    const legs = (height, inset = 0.1) => {for (const x of [-w / 2 + inset, w / 2 - inset]) for (const z of [-d / 2 + inset, d / 2 - inset]) box(0.055, height, 0.055, x, height / 2, z, PALETTE.wood);};
    switch (spec.type) {
      case 'sofa':
        box(w, 0.31, d, 0, 0.3, 0, PALETTE.sage);
        box(w, 0.54, 0.17, 0, 0.61, -d / 2 + 0.08, PALETTE.sage);
        for (const x of [-w / 2 + 0.08, w / 2 - 0.08]) box(0.16, 0.43, d, x, 0.51, 0, PALETTE.sage);
      {
        const seats = Math.max(1, Math.round((w - 0.36) / 0.6)), seat = (w - 0.36) / seats;
        for (let i = 0; i < seats; i++) box(seat - 0.025, 0.16, d - 0.21, -w / 2 + 0.18 + (i + 0.5) * seat, 0.54, 0.055, PALETTE.cushion);
        if (seats > 1) {
          box(0.36, 0.35, 0.15, -w * 0.29, 0.75, -d * 0.21, '#f2e8d6');
          box(0.32, 0.32, 0.14, w * 0.3, 0.74, -d * 0.21, '#c4b591');
        }
        legs(0.15); break;
      }
      case 'bed':
        box(w + 0.05, 0.26, d + 0.05, 0, 0.17, 0, PALETTE.paleWood);
        box(w, 0.22, d, 0, 0.4, 0, PALETTE.cream);
        box(w + 0.07, 0.85, 0.1, 0, 0.43, -d / 2 - 0.025, PALETTE.paleWood);
        box(w * 0.98, 0.075, d * 0.72, 0, 0.54, d * 0.14, '#c1cfb2');
        for (const x of w < 1.1 ? [0] : [-w * 0.25, w * 0.25]) box(w < 1.1 ? w * 0.7 : w * 0.42, 0.1, 0.33, x, 0.56, -d / 2 + 0.25, '#faf7ef');
        break;
      case 'low-table':
        box(w, 0.05, d, 0, 0.42, 0, PALETTE.oak); legs(0.4, 0.06); break;
      case 'cabinet': {
        const height = spec.height || 0.8;
        box(w, height, d, 0, height / 2, 0, '#e2d9c6');
        box(w + 0.01, 0.012, 0.012, 0, height - 0.06, d / 2, '#c4b99f', false);
        if (height > 1.2) for (let shelf = 1; shelf < Math.round(height / 0.38); shelf++) box(w - 0.04, 0.02, 0.012, 0, shelf * 0.38, d / 2, '#c4b99f', false);
        break;
      }
      case 'closet': {
        box(w, 2.02, d, 0, 1.01, 0, '#ddd4c1');
        const doors = Math.max(2, Math.round(w / 0.5));
        for (let i = 1; i < doors; i++) box(0.014, 1.94, 0.012, -w / 2 + i * w / doors, 1.02, d / 2, '#c4b99f', false);
        break;
      }
      case 'round-table': {
        const top = this.cylinder(group, 0.5, 0.5, 0.05, 0, 0.76, 0, PALETTE.oak, 40); top.scale.set(w, 1, d);
        this.cylinder(group, 0.05, 0.05, 0.72, 0, 0.37, 0, PALETTE.wood, 12);
        this.cylinder(group, 0.22, 0.25, 0.03, 0, 0.015, 0, PALETTE.wood, 24);
        break;
      }
      case 'chair':
        this.addChair(group, 0, 0, Math.PI); break;
      case 'appliance': {
        box(w, 0.85, d, 0, 0.425, 0, '#f4f5f1');
        const door = this.cylinder(group, Math.min(w, 0.85) * 0.3, Math.min(w, 0.85) * 0.3, 0.02, 0, 0.45, d / 2, '#d5dedc', 28);
        door.rotation.x = Math.PI / 2;
        box(w * 0.9, 0.06, 0.012, 0, 0.78, d / 2, '#dfe3df', false);
        break;
      }
      case 'wardrobe':
        box(w, 2.02, d, 0, 1.01, 0, '#ddd4c1');
        for (let i = 0; i < Math.max(2, Math.round(d / 0.55)); i++) box(w + 0.012, 1.94, 0.014, 0, 1.02, -d / 2 + (i + 0.5) * d / Math.max(2, Math.round(d / 0.55)), '#c4b99f', false);
        break;
      case 'rug':
        box(w, 0.016, d, 0, 0.012, 0, PALETTE.rug, false); break;
      case 'coffee': {
        const top = this.cylinder(group, 0.5, 0.5, 0.055, 0, 0.36, 0, PALETTE.oak, 32); top.scale.set(w, 1, d);
        for (const x of [-w * 0.3, w * 0.3]) box(0.055, 0.32, 0.055, x, 0.16, 0, PALETTE.wood);
        this.cylinder(group, 0.14, 0.15, 0.025, 0.05, 0.405, 0, PALETTE.cream, 20);
        break;
      }
      case 'table':
        box(w, 0.075, d, 0, 0.78, 0, PALETTE.oak); legs(0.74);
        for (const x of [-w / 2 - 0.24, w / 2 + 0.24]) for (const z of [-d * 0.28, d * 0.28]) this.addChair(group, x, z, x < 0 ? -Math.PI / 2 : Math.PI / 2);
        this.cylinder(group, 0.11, 0.08, 0.15, 0, 0.9, 0, '#eae6d9');
        break;
      case 'kitchen': {
        const count = Math.max(2, Math.round(w / 0.6));
        for (let i = 0; i < count; i++) box(w / count - 0.012, 0.86, d, -w / 2 + (i + 0.5) * w / count, 0.45, 0, '#e6e5da');
        box(w + 0.025, 0.045, d + 0.025, 0, 0.905, 0, '#f8f5ec');
        const sinkX = -w * 0.24, stoveX = w * 0.26;
        box(0.58, 0.018, 0.4, sinkX, 0.937, 0, '#aebcb8');
        box(0.47, 0.022, 0.3, sinkX, 0.948, 0, '#c7d2cc');
        this.cylinder(group, 0.015, 0.015, 0.23, sinkX, 1.06, -0.19, '#99a39d', 8);
        box(0.12, 0.025, 0.025, sinkX + 0.05, 1.17, -0.19, '#99a39d');
        box(0.61, 0.012, 0.43, stoveX, 0.935, 0, PALETTE.dark);
        for (const sx of [-0.16, 0.16]) for (const sz of [-0.1, 0.1]) this.cylinder(group, 0.07, 0.07, 0.008, stoveX + sx, 0.945, sz, '#aeb5aa', 16);
        break;
      }
      case 'island':
        box(w - 0.08, 0.84, d - 0.07, 0, 0.43, 0, '#ece8dc');
        box(w + 0.07, 0.06, d + 0.08, 0, 0.89, 0, PALETTE.oak);
        for (let i = 0; i < 3; i++) {
          const x = (i - 1) * w * 0.31, z = d / 2 + 0.32;
          this.cylinder(group, 0.15, 0.15, 0.06, x, 0.64, z, PALETTE.paleWood);
          for (const lx of [-0.1, 0.1]) for (const lz of [-0.1, 0.1]) box(0.035, 0.6, 0.035, x + lx, 0.3, z + lz, PALETTE.wood);
        }
        break;
      case 'plant':
        this.cylinder(group, 0.17, 0.12, 0.34, 0, 0.17, 0, '#d9cab3');
        this.cylinder(group, 0.018, 0.024, 0.65, 0, 0.64, 0, '#9a9f7b', 8);
        for (let i = 0; i < 8; i++) {
          const angle = i * 2.39996;
          const leaf = this.ellipsoid(group, Math.cos(angle) * 0.18, 0.63 + i * 0.055, Math.sin(angle) * 0.18, 0.17, 0.1, 0.09, i % 2 ? '#a0b18a' : '#8fa77e', 8);
          leaf.rotation.y = -angle; leaf.rotation.z = Math.cos(angle) * 0.4;
        }
        break;
      case 'bath':
        box(w, 0.57, d, 0, 0.29, 0, '#faf9f0');
        box(w - 0.13, 0.04, d - 0.13, 0, 0.585, 0, '#c7dcd9');
        for (const x of [-w / 2 + 0.035, w / 2 - 0.035]) box(0.07, 0.075, d, x, 0.61, 0, '#fcfaf4');
        for (const z of [-d / 2 + 0.035, d / 2 - 0.035]) box(w, 0.075, 0.07, 0, 0.61, z, '#fcfaf4');
        break;
      case 'sink':
        box(w, 0.76, d, 0, 0.38, 0, '#d2c1a0');
        box(w + 0.02, 0.07, d + 0.02, 0, 0.8, 0, '#fcfbf6');
        box(w * 0.68, 0.02, d * 0.55, 0, 0.842, 0, '#bfceca');
        this.cylinder(group, 0.018, 0.018, 0.17, 0, 0.91, -d * 0.3, '#9da8a1', 8);
        break;
      case 'toilet':
        box(w * 0.6, 0.36, d * 0.56, 0, 0.2, 0.06, '#f9f8f1');
        this.ellipsoid(group, 0, 0.44, 0.07, w * 0.52, 0.08, d * 0.46, '#fcfbf5');
        box(w * 0.85, 0.54, 0.18, 0, 0.5, -d * 0.38, '#f9f8f1');
        break;
      case 'desk':
        box(w, 0.06, d, 0, 0.76, 0, PALETTE.oak); legs(0.73);
        box(0.48, 0.32, 0.035, 0, 1, -d * 0.25, PALETTE.dark);
        box(0.05, 0.15, 0.05, 0, 0.84, -d * 0.25, '#6b746c');
        this.addChair(group, 0, d / 2 + 0.32, 0);
        break;
    }
    this.furnitureGroup.add(group);
  }

  addChair(parent, x, z, rotation) {
    const chair = new Group(); chair.position.set(x, 0, z); chair.rotation.y = rotation;
    this.box(chair, 0.42, 0.07, 0.42, 0, 0.45, 0, '#d9d1bf');
    this.box(chair, 0.42, 0.43, 0.055, 0, 0.7, 0.18, '#d9d1bf');
    for (const cx of [-0.15, 0.15]) for (const cz of [-0.15, 0.15]) this.box(chair, 0.035, 0.43, 0.035, cx, 0.215, cz, PALETTE.wood);
    parent.add(chair);
  }

  clearContent() {
    this.contentGeneration = (this.contentGeneration || 0) + 1;
    const sharedMaterials = new Set(this.materials.values());
    const sharedGeometry = new Set(this.geometries.values());
    this.content.traverse(mesh => {
      if (mesh.geometry && !sharedGeometry.has(mesh.geometry)) mesh.geometry.dispose();
      if (mesh.material && !sharedMaterials.has(mesh.material)) mesh.material.dispose();
    });
    this.content.clear();
    for (const texture of this.floorTextures) texture.dispose();
    this.floorTextures = [];
    this.referenceTexture?.dispose(); this.referenceTexture = null; this.referenceMesh = null;
  }

  resize() {
    if (this.disposed) return;
    const width = Math.floor(this.root.clientWidth), height = Math.floor(this.root.clientHeight);
    if (width < 2 || height < 2) return;
    const previousAspect = this.camera.aspect;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.spec && Math.abs(previousAspect - this.camera.aspect) > 0.01) this.fitCamera(false);
    this.requestRender();
  }

  fitCamera(reset = true) {
    const bounds = this.spec.bounds;
    const radius = Math.max(1.5, Math.hypot(bounds.width / 50, bounds.height / 50, 2.5) / 2);
    const fov = this.camera.fov * Math.PI / 360;
    const direction = reset ? new Vector3(0.92, 0.95, 1.08).normalize() : this.camera.position.clone().sub(this.controls.target).normalize();
    if (direction.lengthSq() === 0) direction.set(0.92, 0.95, 1.08).normalize();
    if (reset) this.controls.target.set(0, 0.8, 0);
    const right = new Vector3().crossVectors(new Vector3(0, 1, 0), direction).normalize();
    const up = new Vector3().crossVectors(direction, right).normalize();
    const halfWidth = bounds.width / 100 + 0.15, halfDepth = bounds.height / 100 + 0.15;
    let distance = 3;
    for (const x of [-halfWidth, halfWidth]) for (const y of [-0.15, 2.65]) for (const z of [-halfDepth, halfDepth]) {
      const corner = new Vector3(x, y, z).sub(this.controls.target);
      const horizontal = Math.abs(corner.dot(right)) / (Math.tan(fov) * this.camera.aspect * 0.9);
      const vertical = Math.abs(corner.dot(up)) / (Math.tan(fov) * 0.9);
      distance = Math.max(distance, corner.dot(direction) + Math.max(horizontal, vertical));
    }
    const oldDistance = this.baseDistance || distance;
    this.baseDistance = distance;
    this.controls.minDistance = Math.max(0.8, radius * 0.16);
    this.controls.maxDistance = Math.max(25, distance * 4);
    if (reset) {
      this.camera.position.copy(this.controls.target).addScaledVector(direction, distance * 100 / this.zoom);
    } else {
      const offset = this.camera.position.clone().sub(this.controls.target);
      const currentDistance = offset.length();
      if (currentDistance > 0) this.camera.position.copy(this.controls.target).addScaledVector(offset.normalize(), currentDistance * distance / oldDistance);
    }
    this.controls.update(); this.requestRender();
  }

  resetView() {
    if (this.disposed) return;
    this.zoom = 100; this.fitCamera(true);
  }

  setZoom(percent) {
    if (this.disposed) return;
    this.zoom = Math.max(50, Math.min(180, Number(percent) || 100));
    const offset = this.camera.position.clone().sub(this.controls.target).normalize();
    this.camera.position.copy(this.controls.target).addScaledVector(offset, this.baseDistance * 100 / this.zoom);
    this.controls.update(); this.requestRender();
  }

  setLayers(layers) {
    if (this.disposed) return;
    Object.assign(this.layers, layers);
    if (this.furnitureGroup) this.furnitureGroup.visible = this.layers.furniture !== false;
    if (this.referenceMesh) this.referenceMesh.visible = this.layers.reference !== false;
    this.renderer.shadowMap.needsUpdate = true;
    this.requestRender();
  }

  pickRoom(event) {
    if (this.disposed || !this.pointerStart || event.button !== 0) return;
    const moved = Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y);
    this.pointerStart = null;
    if (moved > 5) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.pickable, false)[0];
    if (hit?.object.userData.roomId) this.options.onRoomSelect?.(hit.object.userData.roomId);
  }

  updateCutaway() {
    for (const wall of this.wallGroups) {
      const towardCamera = wall.outward && (wall.outward.x * (this.camera.position.x - wall.middle.x) + wall.outward.z * (this.camera.position.z - wall.middle.z)) > 0;
      const faded = !this.fullWalls && Boolean(towardCamera);
      if (faded === wall.faded) continue;
      wall.faded = faded;
      for (const {mesh, original} of wall.opaque) mesh.material = faded ? wall.ghost : original;
    }
  }

  requestRender() {
    if (this.disposed || this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      if (this.disposed) return;
      this.updateCutaway();
      this.renderer.render(this.scene, this.camera);
      this.frameCount++;
    });
  }

  getStats() {
    return {frames: this.frameCount, rooms: this.spec.floors.length, walls: this.spec.walls.length, objects: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, camera: this.camera.position.toArray().map(n => Math.round(n * 1000) / 1000), disposed: this.disposed};
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.controls.removeEventListener('change', this.onControlsChange);
    this.controls.dispose();
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.clearContent();
    for (const geometry of this.geometries.values()) geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    this.geometries.clear(); this.materials.clear();
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.root.remove();
  }
}

/** This module is bundled locally and imported only when the user opens 3D. */
export async function createPlan3D(container, state, options = {}) {
  return new Plan3DViewer(container, state, options);
}
