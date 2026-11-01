/**
 * A short burst of paper confetti on a small 2D canvas: two cannons shoot from the bottom corners, the pieces
 * tumble down and the canvas removes itself. Cheap (about 90 rectangles) and skipped with reduced motion.
 */

const COLORS = ['#ffb938', '#93b58c', '#fff1d0', '#e0553f', '#7cc4f0', '#f28ac4'];
const LIFE = 2.6;
const FADE = 0.7;

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  w: number;
  h: number;
  color: string;
}

/** Starts a burst inside `host` (which should be positioned). Returns a function that stops it early. */
export function startConfetti(host: HTMLElement, count = 90): () => void {
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return () => undefined;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const width = host.clientWidth;
  const height = host.clientHeight;
  const ctx2d = width > 0 && height > 0 ? document.createElement('canvas').getContext('2d') : null;
  if (!ctx2d) return () => undefined;
  const canvas = ctx2d.canvas;
  canvas.className = 'pz-confetti';
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);

  const unit = Math.min(width, height * 1.9) / 100; // px per scene percent
  const pieces: Piece[] = [];
  for (let i = 0; i < count; i++) {
    const fromLeft = i % 2 === 0;
    const aim = (fromLeft ? 1 : -1) * (0.25 + Math.random() * 0.6);
    const power = (0.55 + Math.random() * 0.7) * height * 1.15;
    pieces.push({
      x: fromLeft ? width * 0.04 : width * 0.96,
      y: height * 0.95,
      vx: aim * power * 0.6,
      vy: -power,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 14,
      w: (0.9 + Math.random() * 0.9) * unit,
      h: (0.5 + Math.random() * 0.6) * unit,
      color: COLORS[i % COLORS.length] ?? '#ffb938',
    });
  }

  let raf = 0;
  let last = 0;
  let age = 0;
  const gravity = height * 1.9;

  function stop(): void {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    canvas.remove();
  }
  function tick(ms: number): void {
    const dt = last ? Math.min((ms - last) / 1000, 0.05) : 0;
    last = ms;
    age += dt;
    if (age > LIFE || !host.isConnected) return stop();
    ctx2d!.setTransform(1, 0, 0, 1, 0, 0);
    ctx2d!.clearRect(0, 0, canvas.width, canvas.height);
    const alpha = age > LIFE - FADE ? Math.max(0, (LIFE - age) / FADE) : 1;
    ctx2d!.globalAlpha = alpha;
    for (const p of pieces) {
      p.vy += gravity * dt;
      p.vx *= 1 - 0.9 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      ctx2d!.setTransform(Math.cos(p.rot) * dpr, Math.sin(p.rot) * dpr, -Math.sin(p.rot) * dpr, Math.cos(p.rot) * dpr, p.x * dpr, p.y * dpr);
      ctx2d!.fillStyle = p.color;
      ctx2d!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    }
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
  return stop;
}
