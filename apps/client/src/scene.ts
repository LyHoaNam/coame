import * as THREE from 'three';
import { OFFICE_MAP, type Body, type DomainEvent } from '@ga-com/game-core';
import type { InputAck, RoomInfo } from '@ga-com/protocol';
import type { GameSession } from './session';
import { MovementPrediction } from './prediction';

export const COLORS = ['#e68a45', '#4c9fa3', '#8b7ec3', '#df747e', '#7eaa65', '#d5b84c', '#6791c9', '#a87c60'];
export function createGameScene(container: HTMLElement, session: GameSession, options: { low: boolean; muted: () => boolean; follow: () => string }) {
  const room = session.room!;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#e7ece6');
  const renderer = new THREE.WebGLRenderer({ antialias: !options.low });
  renderer.setPixelRatio(Math.min(devicePixelRatio, options.low ? 1 : 1.5)); renderer.shadowMap.enabled = !options.low;
  renderer.outputColorSpace = THREE.SRGBColorSpace; container.append(renderer.domElement);
  const canvas = renderer.domElement; canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'Sân chơi 3D — WASD để chạy, chuột trái để đánh');
  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x719083, 2.5));
  const sun = new THREE.DirectionalLight(0xfff1d5, 3); sun.position.set(-6, 18, 8); sun.castShadow = !options.low; sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -16; sun.shadow.camera.right = 16; sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -16; scene.add(sun);
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  const material = (color: THREE.ColorRepresentation) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true }); materials.add(m); return m; };
  const mesh = (geometry: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = scene) => { geometries.add(geometry); const m = new THREE.Mesh(geometry, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const floor = material('#d7dcc9'), wood = material('#c9a982'), metal = material('#536b67'), screen = material('#273f46');
  mesh(new THREE.BoxGeometry(24, 0.25, 18), floor, 0, -0.125, 0);
  const grid = new THREE.GridHelper(24, 24, '#b5c1b0', '#c6cfbc'); grid.scale.z = 0.75; grid.position.y = 0.01; scene.add(grid); geometries.add(grid.geometry); if (!Array.isArray(grid.material)) materials.add(grid.material);
  const desks: THREE.Mesh[] = [];
  for (const o of OFFICE_MAP.obstacles) {
    const top = mesh(new THREE.BoxGeometry(o.width, 0.16, o.depth), wood.clone(), o.x, 0.85, o.z); materials.add(top.material); desks.push(top);
    for (const dx of [-1.2, 1.2]) for (const dz of [-0.55, 0.55]) mesh(new THREE.BoxGeometry(0.12, 0.8, 0.12), metal, o.x + dx, 0.4, o.z + dz);
    mesh(new THREE.BoxGeometry(0.7, 0.5, 0.1), screen, o.x, 1.18, o.z - 0.25);
    mesh(new THREE.BoxGeometry(0.45, 0.04, 0.17), metal, o.x, 0.96, o.z + 0.25);
  }
  mesh(new THREE.BoxGeometry(24, 1.4, 0.2), material('#a4b6a1'), 0, 0.7, -9);
  const label = (text: string, color = '#233d39') => {
    const c = document.createElement('canvas'); c.width = 384; c.height = 96;
    const ctx = c.getContext('2d')!; ctx.fillStyle = '#ffffffee'; ctx.beginPath(); ctx.roundRect(4, 4, 376, 88, 25); ctx.fill(); ctx.fillStyle = color; ctx.font = 'bold 32px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 192, 48, 360);
    const texture = new THREE.CanvasTexture(c); textures.add(texture); const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false }); materials.add(mat);
    const sprite = new THREE.Sprite(mat); sprite.scale.set(2.2, 0.55, 1); return sprite;
  };
  const entities = new Map<string, THREE.Group>();
  const items = new Map<string, THREE.Group>();
  const person = (id: string, color: string, name: string, npc = false) => {
    const group = new THREE.Group(); scene.add(group);
    const cloth = material(color), skin = material('#e7b98c'), dark = material('#3c3b40');
    mesh(new THREE.CapsuleGeometry(0.26, 0.38, 3, 8), cloth, 0, 0.7, 0, group);
    mesh(new THREE.IcosahedronGeometry(0.32, 1), skin, 0, 1.27, 0, group);
    mesh(new THREE.BoxGeometry(0.58, 0.16, 0.55), dark, 0, 1.5, -0.02, group);
    for (const side of [-1, 1]) { mesh(new THREE.CapsuleGeometry(0.1, 0.32, 2, 6), cloth, side * 0.34, 0.78, 0, group); mesh(new THREE.BoxGeometry(0.19, 0.34, 0.24), dark, side * 0.15, 0.2, 0, group); mesh(new THREE.SphereGeometry(0.035, 6, 4), dark, side * 0.11, 1.29, 0.29, group); }
    const ring = mesh(new THREE.RingGeometry(0.42, 0.49, 24), new THREE.MeshBasicMaterial({ color: npc ? '#d86856' : id === session.credential?.playerId ? '#f5b637' : '#ffffff', side: THREE.DoubleSide }), 0, 0.02, 0, group); materials.add(ring.material); ring.rotation.x = -Math.PI / 2;
    const tag = label(name, npc ? '#b24c3b' : '#233d39'); tag.position.y = 1.95; group.add(tag); entities.set(id, group); return group;
  };
  const prediction = new MovementPrediction();
  let seq = 0, attackSeq = 0, aimYaw = 0, matchId = '', disposed = false, focused = false, frameId = 0, lastTime = performance.now();
  let serverOffset = 0;
  const keys = new Set<string>();
  const remote = new Map<string, { at: number; body: Body }[]>();
  const clockNow = () => performance.now() + serverOffset;
  const onState = () => {
    serverOffset = room.state.serverTimeMs - performance.now();
    if (matchId !== room.state.matchId) { matchId = room.state.matchId; prediction.reset(); remote.clear(); }
    for (const [id, p] of room.state.players) {
      const samples = remote.get(id) ?? []; samples.push({ at: performance.now(), body: { x: p.x, z: p.z, yaw: p.yaw } }); while (samples[0] && performance.now() - samples[0].at > 1000) samples.shift(); remote.set(id, samples);
      if (id === session.credential?.playerId && !prediction.body) prediction.reset(p);
    }
  };
  room.onStateChange(onState); onState();
  const removeAck = room.onMessage('inputAck', (ack: InputAck) => { if (ack.generation === session.credential?.generation && ack.matchId === room.state.matchId) prediction.acknowledge(ack); });
  let audio: AudioContext | undefined; let lastEvent = 0;
  const removeEvent = room.onMessage('event', (event: DomainEvent) => {
    if (event.matchId !== matchId || event.eventSeq <= lastEvent) return; lastEvent = event.eventSeq;
    const entity = entities.get(event.entityId); if (entity && ['attack', 'hit', 'respawn'].includes(event.type)) entity.userData.flashUntil = performance.now() + 180;
    if (options.muted() || !audio || audio.state !== 'running') return;
    if (!['pickup', 'hit', 'match-ended'].includes(event.type)) return;
    const oscillator = audio.createOscillator(), gain = audio.createGain(); oscillator.type = 'sine'; oscillator.frequency.value = event.type === 'pickup' ? 660 : event.type === 'hit' ? 150 : 440;
    gain.gain.setValueAtTime(0.06, audio.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.15); oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + 0.16); oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  });
  const inputTick = () => {
    if (session.status !== 'connected' || room.state.phase !== 'playing' || !session.credential) return;
    const self = room.state.players.get(session.credential.playerId); if (!self) return;
    const input = { moveX: focused ? Number(keys.has('KeyD')) - Number(keys.has('KeyA')) : 0, moveZ: focused ? Number(keys.has('KeyS')) - Number(keys.has('KeyW')) : 0, aimYaw, attackSeq };
    room.send('input', { ...input, matchId: room.state.matchId, generation: session.credential.generation, seq: ++seq, clientTick: seq }); prediction.send(seq, input, self.hp > 0);
  };
  const neutral = () => { focused = false; keys.clear(); prediction.reset(); inputTick(); };
  const keydown = (event: KeyboardEvent) => { if (document.activeElement !== canvas || !['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) return; event.preventDefault(); focused = true; keys.add(event.code); };
  const keyup = (event: KeyboardEvent) => { keys.delete(event.code); };
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pointer = new THREE.Vector2(), hit = new THREE.Vector3();
  const pointermove = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); ray.setFromCamera(pointer, camera);
    const self = prediction.body; if (self && ray.ray.intersectPlane(plane, hit)) aimYaw = Math.atan2(hit.x - self.x, hit.z - self.z);
  };
  const pointerdown = (event: PointerEvent) => { canvas.focus(); focused = true; if (!audio) audio = new AudioContext(); void audio.resume(); if (event.button === 0 && session.status === 'connected') attackSeq++; };
  const visibility = () => { if (document.hidden) neutral(); };
  window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', neutral); canvas.addEventListener('blur', neutral); canvas.addEventListener('pointermove', pointermove); canvas.addEventListener('pointerdown', pointerdown); document.addEventListener('visibilitychange', visibility);
  const inputTimer = setInterval(inputTick, 1000 / 30);
  const resize = new ResizeObserver(() => { const { width, height } = container.getBoundingClientRect(); renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); }); resize.observe(container);
  function render(now: number) {
    if (disposed) return;
    const dt = Math.min((now - lastTime) / 1000, 0.1); lastTime = now;
    const info: RoomInfo | null = room.state.info ? JSON.parse(room.state.info) : null;
    for (const [id, p] of room.state.players) {
      const name = info?.members.find(m => m.playerId === id)?.displayName ?? info?.result?.roster.find(m => m.playerId === id)?.displayName ?? 'Người chơi';
      const group = entities.get(id) ?? person(id, COLORS[p.color]!, name);
      let body: Body = p;
      if (id === session.credential?.playerId && prediction.body) body = prediction.body;
      else { const samples = remote.get(id) ?? []; const at = now - 100; const before = samples.findLast(s => s.at <= at); const after = samples.find(s => s.at >= at); if (before && after) { const t = Math.min(1, Math.max(0, (at - before.at) / (after.at - before.at || 1))); body = { x: THREE.MathUtils.lerp(before.body.x, after.body.x, t), z: THREE.MathUtils.lerp(before.body.z, after.body.z, t), yaw: after.body.yaw }; } else if (before) body = before.body; }
      const target = new THREE.Vector3(body.x, 0, body.z); const delta = group.position.distanceTo(target); if (delta > 1 || p.hp === 0) group.position.copy(target); else group.position.lerp(target, 1 - Math.exp(-dt / 0.035));
      group.rotation.y = body.yaw; group.scale.y = p.hp === 0 ? 0.3 : now < (group.userData.flashUntil ?? 0) ? 1.12 : 1;
      group.visible = true;
    }
    for (const [id, p] of room.state.npcs) { const group = entities.get(id) ?? person(id, '#61766e', 'Bảo vệ', true); group.position.set(p.x, 0, p.z); group.rotation.y = p.yaw; group.scale.y = p.mode === 'windup' ? 1.15 : 1; }
    for (const [id, group] of entities) if (!room.state.players.has(id) && !room.state.npcs.has(id)) { scene.remove(group); entities.delete(id); }
    for (const [id, item] of room.state.items) {
      let group = items.get(id);
      if (!group) {
        group = new THREE.Group(); scene.add(group); items.set(id, group);
        const food = mesh(new THREE.OctahedronGeometry(0.23), material('#e5a449'), 0, 0.3, 0, group); food.name = 'food';
        const ring = mesh(new THREE.RingGeometry(0.4, 0.5, 24), new THREE.MeshBasicMaterial({ color: '#ed9945', side: THREE.DoubleSide }), 0, 0.025, 0, group); materials.add(ring.material); ring.rotation.x = -Math.PI / 2;
        const tag = label(info?.config.foods.find(f => f.id === item.foodId)?.name ?? item.foodId); tag.position.y = 0.9; group.add(tag);
      }
      group.position.set(item.x, 0, item.z); const food = group.getObjectByName('food')!; const warning = clockNow() < item.landedAt; food.position.y = warning ? 1.5 + (item.landedAt - clockNow()) / 1000 : 0.3; food.rotation.y = now / 600; group.scale.setScalar(warning ? 0.9 + Math.sin(now / 100) * 0.1 : 1);
    }
    for (const [id, group] of items) if (!room.state.items.has(id)) { scene.remove(group); items.delete(id); }
    const follow = entities.get(options.follow()) ?? entities.get(session.credential?.playerId ?? '') ?? entities.values().next().value;
    const target = follow?.position ?? new THREE.Vector3(); camera.position.lerp(new THREE.Vector3(target.x, 14, target.z + 13), 1 - Math.exp(-dt * 6)); camera.lookAt(target.x, 0, target.z);
    for (const desk of desks) { const near = follow && Math.abs(desk.position.x - target.x) < 2 && desk.position.z > target.z && desk.position.z - target.z < 2; const mat = desk.material as THREE.MeshStandardMaterial; mat.transparent = Boolean(near); mat.opacity = near ? 0.3 : 1; }
    renderer.render(scene, camera); frameId = requestAnimationFrame(render);
  }
  camera.position.set(0, 14, 13); frameId = requestAnimationFrame(render);
  return () => {
    disposed = true; clearInterval(inputTimer); cancelAnimationFrame(frameId); resize.disconnect(); room.onStateChange.remove(onState); removeAck(); removeEvent();
    window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', neutral); canvas.removeEventListener('blur', neutral); canvas.removeEventListener('pointermove', pointermove); canvas.removeEventListener('pointerdown', pointerdown); document.removeEventListener('visibilitychange', visibility);
    for (const texture of textures) texture.dispose(); for (const geometry of geometries) geometry.dispose(); for (const mat of materials) mat.dispose(); void audio?.close(); renderer.dispose(); canvas.remove();
  };
}
