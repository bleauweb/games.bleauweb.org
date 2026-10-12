// Canvas-drawn text for the 3D scene: troop counts, gate labels, floating "+12" popups.
import * as THREE from 'three';

const FONT = '700 64px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export function makeTextTexture(text, { color = '#ffffff', stroke = 'rgba(0,0,0,0.65)', font = FONT, pad = 18 } = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = font;
  const w = Math.max(32, Math.ceil(ctx.measureText(text).width) + pad * 2);
  const h = 64 + pad * 2;
  canvas.width = w;
  canvas.height = h;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 10;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, w / 2, h / 2);
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.userData.aspect = w / h;
  return tex;
}

/** A billboard label. `height` is its world height; width follows the text. */
export function makeTextSprite(text, opts = {}, height = 1) {
  const tex = makeTextTexture(text, opts);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  sprite.renderOrder = 20;
  sprite.scale.set(height * tex.userData.aspect, height, 1);
  sprite.userData = { text, height, opts };
  return sprite;
}

export function updateTextSprite(sprite, text) {
  if (sprite.userData.text === text) return;
  sprite.material.map.dispose();
  const tex = makeTextTexture(text, sprite.userData.opts);
  sprite.material.map = tex;
  sprite.material.needsUpdate = true;
  sprite.scale.set(sprite.userData.height * tex.userData.aspect, sprite.userData.height, 1);
  sprite.userData.text = text;
}

/** Flat text that sits in a plane (used on gates, so it stays inside the gate). */
export function makeTextPlane(text, opts = {}, height = 1) {
  const tex = makeTextTexture(text, opts);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  );
  mesh.scale.set(height * tex.userData.aspect, height, 1);
  mesh.userData = { text, height, opts };
  mesh.renderOrder = 5;
  return mesh;
}

export function updateTextPlane(mesh, text) {
  if (mesh.userData.text === text) return;
  mesh.material.map.dispose();
  const tex = makeTextTexture(text, mesh.userData.opts);
  mesh.material.map = tex;
  mesh.material.needsUpdate = true;
  mesh.scale.set(mesh.userData.height * tex.userData.aspect, mesh.userData.height, 1);
  mesh.userData.text = text;
}

/** Health bar + label on one canvas, redrawn only when the fraction changes. */
export class BarSprite {
  constructor(width = 3.2, height = 0.55) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 96;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.generateMipmaps = false;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false }));
    this.sprite.renderOrder = 21;
    this.sprite.scale.set(width, height, 1);
    this.last = null;
  }

  set(frac, label) {
    const key = `${Math.round(frac * 200)}|${label}`;
    if (key === this.last) return;
    this.last = key;
    const ctx = this.canvas.getContext('2d');
    const { width: w, height: h } = this.canvas;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, 0, 0, w, h, 24);
    ctx.fill();
    ctx.fillStyle = frac > 0.5 ? '#ff5c5c' : frac > 0.25 ? '#ff9a3d' : '#ffd23d';
    roundRect(ctx, 10, 10, Math.max(0, (w - 20) * frac), h - 20, 16);
    ctx.fill();
    ctx.font = '700 48px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(label, w / 2, h / 2 + 2);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, w / 2, h / 2 + 2);
    this.tex.needsUpdate = true;
  }

  dispose() {
    this.tex.dispose();
    this.sprite.material.dispose();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
