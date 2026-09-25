import React, { useEffect, useMemo, useRef, useState } from 'react';
import { POKEMON_ITEMS, POKEMON_META } from './pokemonPacks';
import { CLAW_ARM_L, CLAW_ARM_R, CLAW_BODY, CLAW_PIVOT } from './clawArt';

// ---- geometry (px inside the 380-wide machine area, calibrated to 200px height for ultra-compact viewport fit) ----
const GW = 380;
const GH = 200;
const RAIL_Y = 10;
const HOME_Y = 38;
const DROP_Y = 124;
const CLAW_MIN = 46;
const CLAW_MAX = 334;
const COIL_LEN = 26;
const GRAB_RADIUS = 36;
const GRIP_OFFSET = 38;
const TRAY = { cx: 232, cy: GH + 40, min: 150, max: 320 };

type Slot = {
  toy: string;
  w: number;
  x: number;
  b: number;
  z: number;
  rot: number;
  dropFrom: number;
  delay: number;
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);

const CONFETTI = [
  { dx: -44, dy: -54, dr: -150, c: '#00ff66', d: 0 },
  { dx: -30, dy: -66, dr: 120, c: '#ffd60a', d: 0.05 },
  { dx: -14, dy: -76, dr: -80, c: '#00e5ff', d: 0.02 },
  { dx: 2, dy: -80, dr: 60, c: '#34c759', d: 0.07 },
  { dx: 16, dy: -74, dr: -130, c: '#ffb340', d: 0.03 },
  { dx: 30, dy: -64, dr: 100, c: '#00ff66', d: 0.06 },
  { dx: 44, dy: -52, dr: -110, c: '#ff3366', d: 0.01 },
  { dx: -54, dy: -36, dr: 90, c: '#ffcc00', d: 0.09 },
  { dx: 54, dy: -34, dr: -70, c: '#00e5ff', d: 0.08 }
];

const easeInQuad = (p: number) => p * p;
const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);
const easeInOutCubic = (p: number) =>
  p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const clamp01 = (p: number) => Math.min(1, Math.max(0, p));

const T = {
  antic: 0.16,
  down: 0.78,
  dwell1: 0.18,
  close: 0.45,
  dwell2: 0.26,
  load: 0.24,
  up: 0.95,
  open: 0.4
};
const ANTIC_RISE = 8;
const DROP_G = 1150;
const ENTRANCE_G = 1500;

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function scatterPile(target: string, set: Array<{ toy: string; w: number }>): Slot[] {
  const order = shuffle(set);
  const rest = order.filter((t) => t.toy !== target);
  const tgt = order.find((t) => t.toy === target)!;

  const nB = Math.min(7, order.length - 1);
  const nTop = order.length - nB;
  const bottomIdx = 2 + Math.floor(Math.random() * (nB - 4));
  const slots: Slot[] = new Array(order.length);

  let r = 0;
  const frontW: number[] = [];
  const frontToy: Array<{ toy: string; w: number }> = [];
  for (let i = 0; i < nB; i++) {
    const isTarget = i === bottomIdx;
    const t = isTarget ? tgt : rest[r++];
    frontToy.push(t);
    frontW.push(t.w * (isTarget ? rand(0.98, 1.04) : rand(0.80, 0.88)));
  }
  const xs: number[] = [0];
  for (let i = 1; i < nB; i++) {
    xs.push(xs[i - 1] + ((frontW[i - 1] + frontW[i]) / 2) * rand(0.6, 0.66));
  }

  const span = xs[nB - 1];
  const ends = (frontW[0] + frontW[nB - 1]) / 2;
  const fit = Math.min(1, (GW - 16) / (span + ends));
  for (let i = 0; i < nB; i++) frontW[i] *= fit;
  const offset = (GW - (span + ends) * fit) / 2 + frontW[0] / 2;
  const centers: number[] = [];
  for (let i = 0; i < nB; i++) {
    const cx = offset + xs[i] * fit + rand(-3, 3);
    centers.push(cx);
    const isTarget = i === bottomIdx;
    slots[i] = {
      toy: frontToy[i].toy,
      w: frontW[i],
      x: Math.min(GW - 26, Math.max(26, cx)),
      b: rand(0, 2),
      z: isTarget ? 4 : 2,
      rot: rand(-7, 7),
      dropFrom: -rand(260, 340),
      delay: i * 0.04 + rand(0, 0.08)
    };
  }

  const gaps: number[] = [];
  for (let g = 0; g < nB - 1; g++) {
    if (g === bottomIdx - 1 || g === bottomIdx) continue;
    gaps.push(g);
  }
  if (gaps.length < nTop) gaps.push(bottomIdx - 1);
  const useGaps = shuffle(gaps).slice(0, nTop);
  let ti = 0;
  for (const g of useGaps) {
    const t = rest[r++];
    const cx = (centers[g] + centers[g + 1]) / 2 + rand(-3, 3);
    slots[nB + ti] = {
      toy: t.toy,
      w: t.w * rand(0.72, 0.80),
      x: Math.min(GW - 26, Math.max(26, cx)),
      b: rand(16, 26),
      z: 1,
      rot: rand(-8, 8),
      dropFrom: -rand(280, 360),
      delay: 0.35 + ti * 0.06 + rand(0, 0.08)
    };
    ti++;
  }

  const tip = slots[nB + Math.floor(Math.random() * nTop)];
  if (tip) {
    tip.rot = rand(10, 16) * (Math.random() < 0.5 ? -1 : 1);
  }

  return slots;
}

type Soft = {
  dx: number;
  dy: number;
  rot: number;
  sq: number;
  vdx: number;
  vdy: number;
  vrot: number;
  vsq: number;
  ey: number;
  evy: number;
  delay: number;
  landed: boolean;
};

type Phase = 'idle' | 'seq' | 'carry' | 'toTray' | 'celebrate' | 'deny' | 'return' | 'done';

export interface ClawCaptchaProps {
  target?: string;
  onVerify?: () => void;
  title?: string;
  className?: string;
}

export const ClawCaptcha: React.FC<ClawCaptchaProps> = ({
  target: targetProp,
  onVerify,
  title = 'PILOT CLAW // EXTRACT TARGET POKÉMON',
  className
}) => {
  const [reduce] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  const SET = useMemo(() => POKEMON_ITEMS.map((it) => ({ toy: it.id, w: it.w })), []);
  const META = POKEMON_META;

  const [autoTarget] = useState<string>(
    () => POKEMON_ITEMS[Math.floor(Math.random() * POKEMON_ITEMS.length)].id
  );
  const target = targetProp ?? autoTarget;

  const [phase, setPhase] = useState<Phase>('idle');
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [overTray, setOverTray] = useState(false);
  const [trayMode, setTrayMode] = useState<'' | 'open' | 'win' | 'no'>('');
  const [telemetryX, setTelemetryX] = useState<number>(GW / 2);
  const [telemetrySway, setTelemetrySway] = useState<number>(0);

  const pile = useMemo(() => scatterPile(target, SET), [target, SET]);

  const rigEl = useRef<SVGSVGElement>(null);
  const clawEl = useRef<SVGGElement>(null);
  const coilEl = useRef<SVGSVGElement>(null);
  const fingerL = useRef<SVGSVGElement>(null);
  const fingerR = useRef<SVGSVGElement>(null);
  const carriedEl = useRef<HTMLImageElement>(null);
  const carryLayerEl = useRef<HTMLDivElement>(null);
  const stickEl = useRef<HTMLDivElement>(null);
  const joyEl = useRef<HTMLDivElement>(null);
  const trolleyEl = useRef<HTMLDivElement>(null);
  const shadowEl = useRef<HTMLDivElement>(null);
  const machineEl = useRef<HTMLDivElement>(null);
  const trayEl = useRef<HTMLDivElement>(null);
  const pileEls = useRef<Array<HTMLImageElement | null>>([]);

  const dir = useRef(0);
  const phaseRef = useRef<Phase>('idle');
  const onVerifyRef = useRef(onVerify);
  onVerifyRef.current = onVerify;

  const sim = useRef({
    x: GW / 2,
    y: HOME_Y,
    vx: 0,
    drive: 0,
    sway: 0,
    swayV: 0,
    breeze: 0,
    close: 0,
    gripClose: 1,
    carried: -1,
    candidate: -1,
    pickup: { x: 0, y: 0 },
    carry: { x: 0, y: 0 },
    stage: '' as '' | 'antic' | 'down' | 'dwell1' | 'close' | 'dwell2' | 'load' | 'up' | 'open' | 'beat' | 'shine',
    st: 0,
    depthY: DROP_Y,
    fallV: 0,
    stretch: 0,
    xrot: 0,
    swallow: 0,
    released: false,
    mouthY: 288,
    trayX: TRAY.cx,
    trayMin: TRAY.min,
    trayMax: TRAY.max,
    returnStart: { x: 0, y: 0 },
    returnTilt: 0,
    rejectY: GH + 26
  });

  const softRef = useRef<Soft[] | null>(null);
  if (softRef.current === null) {
    softRef.current = pile.map((s) => ({
      dx: 0,
      dy: 0,
      rot: 0,
      sq: 0,
      vdx: 0,
      vdy: 0,
      vrot: 0,
      vsq: 0,
      ey: s.dropFrom,
      evy: 0,
      delay: s.delay,
      landed: false
    }));
  }

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };
  const api = useRef({ setPhaseBoth, setMessage, setVerified, setOverTray, setTrayMode });
  api.current = { setPhaseBoth, setMessage, setVerified, setOverTray, setTrayMode };

  const targetIdx = useMemo(() => pile.findIndex((p) => p.toy === target), [pile, target]);

  useEffect(() => {
    const s = sim.current;
    const soft = softRef.current as Soft[];
    let raf = 0;
    let wasOverTray = false;
    let prevNow = 0;
    const speedMul = reduce ? 2.4 : 1;
    let lastTelemetryTime = 0;

    const measureTray = () => {
      const m = machineEl.current;
      const tr = trayEl.current?.getBoundingClientRect();
      if (!m || !tr) return;
      const rect = m.getBoundingClientRect();
      const scale = rect.width / m.offsetWidth || 1;
      s.trayX = (tr.left + tr.width / 2 - rect.left) / scale - 8;
      s.trayMin = (tr.left - rect.left) / scale - 8;
      s.trayMax = (tr.right - rect.left) / scale - 8;
      s.mouthY = (tr.top + tr.height - 10 * scale - rect.top) / scale - 6;
      s.rejectY = (tr.top - rect.top) / scale - 6 + 4;
    };
    measureTray();
    const resize = new ResizeObserver(measureTray);
    if (machineEl.current) resize.observe(machineEl.current);

    if (reduce) {
      soft.forEach((b) => {
        b.ey = 0;
        b.landed = true;
      });
    }

    const toyHeight = (i: number) => {
      const el = pileEls.current[i];
      return el?.naturalWidth ? (pile[i].w * el.naturalHeight) / el.naturalWidth : pile[i].w;
    };
    const toyCenter = (i: number) => {
      const p = pile[i];
      const b = soft[i];
      const halfHeight = (toyHeight(i) / 2) * (1 + b.sq);
      const angle = ((p.rot + b.rot) * Math.PI) / 180;
      return {
        x: p.x + b.dx + Math.sin(angle) * halfHeight,
        y: GH - p.b + b.dy + b.ey - Math.cos(angle) * halfHeight
      };
    };

    const ripple = (x: number, power: number, except = -1) => {
      pile.forEach((p, i) => {
        if (i === except || i === s.carried) return;
        const d = Math.abs(p.x - x);
        if (d < 80) {
          const f = (1 - d / 80) * power;
          const side = p.x < x ? -1 : 1;
          const b = soft[i];
          b.vdx += side * f * 1.6;
          b.vdy -= f * 1.1;
          b.vrot += side * f * 2;
          b.vsq += f * 0.02;
        }
      });
    };

    const pend = () => {
      const len = Math.max(2, s.y - RAIL_Y);
      const rad = reduce ? 0 : ((s.sway + s.breeze) * Math.PI) / 180;
      return { ex: s.x - Math.sin(rad) * len, ey: RAIL_Y + Math.cos(rad) * len };
    };

    const grip = () => {
      const { ex, ey } = pend();
      const rad = reduce ? 0 : ((s.sway + s.breeze) * Math.PI) / 180;
      const offset = GRIP_OFFSET + (s.carried >= 0 ? toyHeight(s.carried) : 74) / 2;
      return { x: ex - Math.sin(rad) * offset, y: ey + Math.cos(rad) * offset };
    };

    const candidateAt = (x: number) => {
      let best = -1;
      let bestDistance = Infinity;
      pile.forEach((q, i) => {
        if (!soft[i].landed) return;
        const d = Math.abs(toyCenter(i).x - x);
        const radius = Math.min(GRAB_RADIUS, Math.max(22, q.w * 0.42));
        if (d <= radius) {
          const head = toyCenter(i);
          head.y -= q.w * 0.24;
          const covered = pile.some((front, j) => {
            if (j === i || !soft[j].landed || front.z < q.z || (front.z === q.z && j < i)) return false;
            const c = toyCenter(j);
            return ((head.x - c.x) / (front.w * 0.43)) ** 2 + ((head.y - c.y) / (front.w * 0.48)) ** 2 < 1;
          });
          if (covered) return;
          if (d < bestDistance) {
            bestDistance = d;
            best = i;
          }
        }
      });
      return best;
    };

    const render = () => {
      joyEl.current?.setAttribute(
        'aria-valuenow',
        String(Math.round(((s.x - CLAW_MIN) / (CLAW_MAX - CLAW_MIN)) * 100))
      );
      const sway = reduce ? 0 : s.sway + s.breeze;
      const len = Math.max(2, s.y - RAIL_Y);

      if (trolleyEl.current) trolleyEl.current.style.transform = `translateX(${(s.x - 14).toFixed(2)}px)`;

      if (shadowEl.current) {
        const rad = (sway * Math.PI) / 180;
        const ex = s.x - Math.sin(rad) * len;
        const bottomY = s.carried >= 0 ? s.carry.y + toyHeight(s.carried) / 2 : s.y + 50;
        const t = clamp01(1 - (GH - bottomY) / 160);
        shadowEl.current.style.transform = `translateX(${(ex - 45).toFixed(2)}px) scaleX(${(1.25 - 0.5 * t).toFixed(3)})`;
        shadowEl.current.style.opacity = (0.1 + 0.3 * t).toFixed(3);
      }

      if (rigEl.current) {
        const rig = rigEl.current;
        const totalH = len + 64;
        rig.setAttribute('viewBox', `0 0 36 ${totalH.toFixed(1)}`);
        rig.setAttribute('height', totalH.toFixed(1));
        rig.style.transform = `translateX(${s.x.toFixed(2)}px) rotate(${sway.toFixed(2)}deg)`;
      }
      coilEl.current?.setAttribute('transform', `translate(9 0) scale(1 ${(len / 90).toFixed(4)})`);
      clawEl.current?.setAttribute('transform', `translate(18 ${len.toFixed(2)}) scale(2.3) translate(-20.6 -8.9)`);

      const pinch = 15 * s.close;
      fingerL.current?.setAttribute('transform', `rotate(${pinch.toFixed(2)} ${CLAW_PIVOT.x} ${CLAW_PIVOT.y})`);
      fingerR.current?.setAttribute('transform', `rotate(${(-pinch).toFixed(2)} ${CLAW_PIVOT.x} ${CLAW_PIVOT.y})`);

      for (let i = 0; i < pile.length; i++) {
        const el = pileEls.current[i];
        if (!el) continue;
        const b = soft[i];
        el.style.transform = `translate(${b.dx.toFixed(2)}px, ${(b.dy + b.ey).toFixed(2)}px) rotate(${(pile[i].rot + b.rot).toFixed(2)}deg) scale(${(1 - b.sq * 0.6).toFixed(3)}, ${(1 + b.sq).toFixed(3)})`;
      }

      if (s.carried >= 0 && carriedEl.current) {
        const w = pile[s.carried].w;
        const sc = 1 - s.swallow * 0.78;
        const sx = (sc * (1 - s.stretch * 0.55)).toFixed(3);
        const sy = (sc * (1 + s.stretch)).toFixed(3);
        const angle = phaseRef.current === 'deny' ? s.xrot : sway + s.xrot;
        carriedEl.current.style.transform = `translate(${s.carry.x - w / 2}px, ${s.carry.y - toyHeight(s.carried) / 2}px) rotate(${angle.toFixed(2)}deg) scale(${sx}, ${sy})`;
        if (s.swallow > 0) carriedEl.current.style.opacity = (1 - s.swallow).toFixed(2);
      }
    };

    const stageP = (dur: number, dt: number) => {
      s.st += dt;
      return clamp01(s.st / dur);
    };
    const nextStage = (st: typeof s.stage) => {
      s.stage = st;
      s.st = 0;
    };

    const step = (now: number) => {
      const dtRaw = prevNow ? Math.min(0.04, Math.max(0.004, (now - prevNow) / 1000)) : 1 / 60;
      prevNow = now;
      const dt = dtRaw * speedMul;
      const f = dt * 60;
      const ph = phaseRef.current;
      const a = api.current;

      if (!reduce) {
        const lean = ph === 'idle' || ph === 'carry' ? -s.vx * 0.042 : 0;
        s.swayV += (lean - s.sway) * 0.05 * f;
        s.swayV *= Math.pow(0.93, f);
        s.sway += s.swayV * f;
        s.breeze = Math.sin(now / 1500) * 0.45 + Math.sin(now / 521) * 0.12;
      }

      for (let i = 0; i < soft.length; i++) {
        const b = soft[i];
        if (!b.landed) {
          if (b.delay > 0) {
            b.delay -= dt;
          } else {
            b.evy += ENTRANCE_G * dt;
            b.ey += b.evy * dt;
            if (b.ey >= 0) {
              b.ey = 0;
              b.landed = true;
              b.vsq += Math.min(0.055, b.evy * 0.00006);
              b.vrot += rand(-0.8, 0.8);
              ripple(pile[i].x, Math.min(0.22, b.evy * 0.0002), i);
            }
          }
        }
        b.vdx += -b.dx * 0.055 * f;
        b.vdy += -b.dy * 0.055 * f;
        b.vrot += -b.rot * 0.05 * f;
        b.vsq += -b.sq * 0.13 * f;
        const damp = Math.pow(0.9, f);
        b.vdx *= damp;
        b.vdy *= damp;
        b.vrot *= Math.pow(0.91, f);
        b.vsq *= Math.pow(0.84, f);
        b.dx += b.vdx * f;
        b.dy += b.vdy * f;
        b.rot += b.vrot * f;
        b.sq += b.vsq * f;
      }

      if (ph === 'idle' || ph === 'carry') {
        s.drive += (dir.current - s.drive) * (1 - Math.exp(-13 * dt));
        s.vx += s.drive * 720 * dt;
        s.vx *= Math.exp(-5.5 * dt);
        s.x = Math.min(CLAW_MAX, Math.max(CLAW_MIN, s.x + s.vx * dt));
        if (!stickDrag.current && stickEl.current) {
          stickEl.current.style.transform = Math.abs(s.drive) > 0.02 ? `rotate(${(s.drive * 16).toFixed(1)}deg)` : '';
        }
        if (ph === 'carry') {
          s.xrot += (s.sway * 0.5 - s.xrot) * (1 - Math.exp(-6 * dt));
          s.carry = grip();
          const over = s.carry.x >= s.trayMin && s.carry.x <= s.trayMax;
          if (over !== wasOverTray) {
            wasOverTray = over;
            a.setOverTray(over);
            if (over) a.setMessage(null);
          }
        }
      } else if (ph === 'seq') {
        if (s.stage === 'antic') {
          const p = stageP(T.antic, dt);
          s.y = HOME_Y - ANTIC_RISE * easeOutCubic(p);
          s.close = -0.55 * easeOutCubic(p);
          if (p >= 1) {
            const cand = candidateAt(pend().ex);
            s.candidate = cand;
            s.gripClose = cand >= 0 ? Math.max(0.58, Math.min(1, 1.4 - pile[cand].w / 110)) : 1.12;
            if (cand >= 0) {
              const c = toyCenter(cand);
              s.depthY = Math.min(GH - 36, Math.max(HOME_Y + 36, c.y - GRIP_OFFSET - toyHeight(cand) / 2));
            } else {
              s.depthY = DROP_Y;
            }
            nextStage('down');
          }
        } else if (s.stage === 'down') {
          const p = stageP(T.down, dt);
          s.y = HOME_Y - ANTIC_RISE + (s.depthY - HOME_Y + ANTIC_RISE) * easeInQuad(p);
          if (s.y > 110 && !reduce) {
            pile.forEach((q, i) => {
              const d = Math.abs(q.x - s.x);
              if (d < 56) {
                const push = (1 - d / 56) * 7 * dt;
                const side = q.x < s.x ? -1 : 1;
                soft[i].vdx += side * push;
                soft[i].vsq += push * 0.012;
              }
            });
          }
          if (p >= 1) nextStage('dwell1');
        } else if (s.stage === 'dwell1') {
          const p = stageP(T.dwell1, dt);
          s.y = s.depthY + (reduce ? 0 : 3.5 * Math.sin(Math.PI * p));
          if (p >= 1) {
            s.y = s.depthY;
            nextStage('close');
          }
        } else if (s.stage === 'close') {
          const p = stageP(T.close, dt);
          s.close = -0.55 + (s.gripClose + 0.55) * easeInOutCubic(p);
          if (s.candidate >= 0 && p > 0.55) {
            soft[s.candidate].sq = 0.055 * easeOutCubic((p - 0.55) / 0.45);
          }
          if (p >= 1) {
            const best = s.candidate;
            s.carried = best;
            if (best >= 0) {
              s.carry = { ...toyCenter(best) };
              s.pickup = { ...s.carry };
              s.xrot = pile[best].rot + soft[best].rot;
              const el = pileEls.current[best];
              if (el) el.style.visibility = 'hidden';
              ripple(pile[best].x, 0.35, best);
              if (carriedEl.current) {
                carriedEl.current.src = el?.src ?? carriedEl.current.src;
                carriedEl.current.style.width = `${pile[best].w}px`;
                carriedEl.current.style.visibility = 'visible';
                carriedEl.current.style.opacity = '';
              }
            } else {
              ripple(s.x, 0.2);
            }
            nextStage('dwell2');
          }
        } else if (s.stage === 'dwell2') {
          const p = stageP(T.dwell2, dt);
          if (s.carried >= 0) {
            s.xrot += -s.xrot * (1 - Math.exp(-3.5 * dt));
            const held = grip();
            const settle = easeInOutCubic(p);
            s.carry.x = s.pickup.x + (held.x - s.pickup.x) * settle;
            s.carry.y = s.pickup.y + (held.y - s.pickup.y) * settle;
          }
          if (p >= 1) nextStage(s.carried >= 0 && !reduce ? 'load' : 'up');
        } else if (s.stage === 'load') {
          const p = stageP(T.load, dt);
          const bell = Math.sin(Math.PI * p);
          s.y = s.depthY + 5 * bell;
          s.close = s.gripClose + 0.08 * bell;
          s.xrot += -s.xrot * (1 - Math.exp(-3.5 * dt));
          s.carry = grip();
          if (p >= 1) {
            s.y = s.depthY;
            nextStage('up');
          }
        } else if (s.stage === 'up') {
          const p = stageP(T.up, dt);
          s.y = s.depthY + (HOME_Y - s.depthY) * easeInOutCubic(p);
          if (s.carried >= 0) {
            s.xrot += -s.xrot * (1 - Math.exp(-3.5 * dt));
            s.carry = grip();
          }
          if (p >= 1) {
            if (s.carried >= 0) {
              a.setPhaseBoth('carry');
              a.setMessage(null);
            } else {
              a.setPhaseBoth('idle');
              a.setMessage('NO TARGET GRIPPED // REALIGN CLAW AND RETRY');
            }
          }
        }
      } else if (ph === 'toTray') {
        const right = s.carried === targetIdx;
        if (s.stage === 'open') {
          const p = stageP(T.open, dt);
          s.close = s.gripClose * (1 - easeInOutCubic(p));
          if (s.st > 0.12 && !s.released) {
            s.released = true;
            if (right) {
              a.setTrayMode('open');
              if (reduce) {
                if (carriedEl.current) carriedEl.current.style.visibility = 'hidden';
                s.carried = -1;
                a.setOverTray(false);
                a.setTrayMode('win');
                nextStage('beat');
                a.setPhaseBoth('celebrate');
              } else {
                measureTray();
                if (carryLayerEl.current) {
                  carryLayerEl.current.style.clipPath = `polygon(0 0, 100% 0, 100% ${s.mouthY}px, 0 ${s.mouthY}px)`;
                }
                s.fallV = 30;
              }
            } else {
              s.fallV = 40;
            }
          }
        }
        if (right && s.released && s.carried >= 0) {
          s.fallV = Math.min(s.fallV + DROP_G * dt, 460);
          s.carry.y += s.fallV * dt;
          s.carry.x += (s.trayX - s.carry.x) * (1 - Math.exp(-5 * dt));
          s.xrot += -s.xrot * (1 - Math.exp(-4 * dt));
          s.stretch = (Math.abs(s.fallV) / 460) * 0.09;
          const w = toyHeight(s.carried);
          const sunk = s.carry.y + w / 2 - s.mouthY;
          if (sunk >= w + 4) {
            if (carriedEl.current) {
              carriedEl.current.style.visibility = 'hidden';
              carriedEl.current.style.clipPath = '';
              carriedEl.current.style.filter = '';
            }
            s.carried = -1;
            a.setOverTray(false);
            a.setTrayMode('win');
            nextStage('beat');
            a.setPhaseBoth('celebrate');
          }
        }

        if (!right && s.fallV !== 0) {
          s.fallV = Math.min(s.fallV + DROP_G * dt, 360);
          s.carry.y += s.fallV * dt;
          s.carry.x += (s.trayX - s.carry.x) * (1 - Math.exp(-4 * dt));
          s.xrot += -s.xrot * (1 - Math.exp(-3 * dt));
          s.stretch = (Math.abs(s.fallV) / 460) * 0.09;
          const landingY = s.rejectY - toyHeight(s.carried) / 2;
          if (s.fallV > 0 && s.carry.y >= landingY) {
            if (s.fallV > 200) {
              s.carry.y = landingY;
              s.fallV = -s.fallV * 0.12;
              s.xrot += rand(-2, 2);
            } else {
              s.carry.y = landingY;
              s.fallV = 0;
              s.stretch = 0;
              s.returnStart = { ...s.carry };
              s.returnTilt = s.xrot + (reduce ? 0 : s.sway + s.breeze);
              a.setOverTray(false);
              a.setTrayMode('no');
              a.setMessage(
                `TARGET MISMATCH: ${META[pile[s.carried].toy].label.toUpperCase()}! RETRIEVE ${META[target].label.toUpperCase()}.`
              );
              nextStage('beat');
              a.setPhaseBoth('deny');
            }
          }
        }
      } else if (ph === 'celebrate') {
        if (s.stage === 'beat') {
          if (stageP(reduce ? 0.28 : 0.55, dt) >= 1) {
            nextStage('shine');
            api.current.setVerified(true);
            onVerifyRef.current?.();
          }
        } else if (s.stage === 'shine') {
          if (stageP(0.7, dt) >= 1) api.current.setPhaseBoth('done');
        }
      } else if (ph === 'deny') {
        if (s.stage === 'beat') {
          stageP(1.25, dt);
          const p = clamp01((s.st - 0.2) / 1.05);
          const travel = easeInOutCubic(p);
          const destination = toyCenter(s.carried);
          const clearance = Math.min(s.returnStart.y, destination.y) - 18;
          const u = 1 - travel;
          s.carry.x =
            (u ** 3 + 3 * u * u * travel) * s.returnStart.x +
            (3 * u * travel * travel + travel ** 3) * destination.x;
          s.carry.y = reduce
            ? s.returnStart.y + (destination.y - s.returnStart.y) * travel
            : u ** 3 * s.returnStart.y + 3 * u * travel * clearance + travel ** 3 * destination.y;
          s.xrot = s.returnTilt + (pile[s.carried].rot + soft[s.carried].rot - s.returnTilt) * travel;
          if (p >= 1) {
            const idx = s.carried;
            api.current.setTrayMode('');
            const el = pileEls.current[idx];
            if (el) el.style.visibility = '';
            if (carriedEl.current) {
              carriedEl.current.style.visibility = 'hidden';
              carriedEl.current.style.opacity = '';
              carriedEl.current.style.clipPath = '';
              carriedEl.current.style.filter = '';
            }
            s.swallow = 0;
            const b = soft[idx];
            b.vsq += 0.05;
            b.vrot += rand(-1, 1);
            ripple(pile[idx].x, 0.25, idx);
            s.carried = -1;
            a.setPhaseBoth('idle');
          }
        }
      }

      if (now - lastTelemetryTime > 120) {
        lastTelemetryTime = now;
        setTelemetryX(s.x);
        setTelemetrySway(s.sway + s.breeze);
      }

      render();
      raf = requestAnimationFrame(step);
    };

    render();
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
    };
  }, [reduce, targetIdx, target, pile, META]);

  const action = () => {
    const s = sim.current;
    if (verified) return;
    if (phaseRef.current === 'idle') {
      setMessage(null);
      s.close = 0;
      s.stage = 'antic';
      s.st = 0;
      s.vx = 0;
      s.drive = 0;
      setPhaseBoth('seq');
    } else if (phaseRef.current === 'carry') {
      if (s.carry.x >= s.trayMin && s.carry.x <= s.trayMax) {
        if (carryLayerEl.current) carryLayerEl.current.style.clipPath = '';
        if (carriedEl.current) {
          carriedEl.current.style.visibility = 'visible';
          carriedEl.current.style.opacity = '';
          carriedEl.current.style.clipPath = '';
          carriedEl.current.style.filter = '';
        }
        s.stage = 'open';
        s.st = 0;
        s.fallV = 0;
        s.swallow = 0;
        s.stretch = 0;
        s.released = false;
        setOverTray(false);
        setPhaseBoth('toTray');
      } else {
        setMessage('NAVIGATE OVER EXTRACTION CHUTE BEFORE DROPPING');
      }
    }
  };

  const stickDrag = useRef<{ id: number; startX: number } | null>(null);
  const heldKeys = useRef(new Set<string>());
  const stopControls = () => {
    heldKeys.current.clear();
    stickDrag.current = null;
    dir.current = 0;
    sim.current.drive = 0;
    sim.current.vx = 0;
    if (stickEl.current) stickEl.current.style.transform = '';
  };

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) stopControls();
    };
    window.addEventListener('blur', stopControls);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', stopControls);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const onStickDown = (e: React.PointerEvent) => {
    if (verified || (phaseRef.current !== 'idle' && phaseRef.current !== 'carry')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    (e.currentTarget as HTMLElement).focus();
    stickDrag.current = { id: e.pointerId, startX: e.clientX };
    if (stickEl.current) stickEl.current.style.transition = 'none';
  };

  const onStickMove = (e: React.PointerEvent) => {
    const d = stickDrag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = Math.max(-26, Math.min(26, e.clientX - d.startX));
    dir.current = dx / 26;
    if (stickEl.current) stickEl.current.style.transform = `rotate(${(dx * 1.05).toFixed(1)}deg)`;
  };

  const onStickUp = (e: React.PointerEvent) => {
    if (stickDrag.current?.id !== e.pointerId) return;
    stickDrag.current = null;
    dir.current = 0;
    if (stickEl.current) {
      stickEl.current.style.transition = 'transform 0.25s cubic-bezier(0.2, 1.6, 0.4, 1)';
      stickEl.current.style.transform = '';
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (verified) return;
    const k = e.key.toLowerCase();
    if ((e.key === ' ' || e.key === 'Enter') && e.target instanceof HTMLElement && e.target.closest('button')) {
      return;
    }
    if (e.key === 'ArrowLeft' || k === 'a') {
      e.preventDefault();
      heldKeys.current.add(k);
      dir.current = -1;
    } else if (e.key === 'ArrowRight' || k === 'd') {
      e.preventDefault();
      heldKeys.current.add(k);
      dir.current = 1;
    } else if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      action();
    }
  };

  const onKeyUp = (e: React.KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'a', 'd'].includes(k)) {
      heldKeys.current.delete(k);
      const keys = heldKeys.current;
      dir.current =
        Number(keys.has('arrowright') || keys.has('d')) -
        Number(keys.has('arrowleft') || keys.has('a'));
    }
  };

  const t = META[target];
  const busy = phase !== 'idle' && phase !== 'carry';
  const stepNo =
    verified || phase === 'carry' || phase === 'toTray' || phase === 'celebrate'
      ? 3
      : phase === 'seq'
      ? 2
      : 1;
  const carried = sim.current.carried;
  const carriedW = carried >= 0 ? pile[carried].w : 76;

  return (
    <div
      className={`tactical-claw-wrapper font-mono ${className || ''}`}
      role="group"
      aria-label="Tactical Pokémon Claw Machine Human Check"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) stopControls();
      }}
    >
      {/* Compact Mission & Target Banner */}
      <div className="clawcap-mission-bar">
        <div className="mission-left">
          <span className="mission-tag">[MISSION_OBJECTIVE]</span>
          <span className="mission-instruction">
            {verified ? 'CLEARANCE CONFIRMED // ACCESS GRANTED' : title}
          </span>
        </div>
        <div className="target-pill" style={{ borderColor: t.accent }}>
          <img
            src={`/pokemon/${target}.png`}
            alt={t.label}
            className="target-mini-sprite"
            onError={(e) => {
              e.currentTarget.src = `https://feralui.dev/pokemon/${target}.png`;
            }}
          />
          <div className="target-meta">
            <span className="target-name" style={{ color: t.accent }}>
              {t.label.toUpperCase()}
            </span>
            <span className="target-type">[{t.type}]</span>
          </div>
        </div>
      </div>

      {message && <div className="clawcap-system-alert font-mono">{message}</div>}

      {/* Compact 3-Step Protocol Progress */}
      <div className="clawcap-phase-steps">
        <div className={`phase-step ${stepNo >= 1 ? 'is-active' : ''} ${stepNo > 1 ? 'is-done' : ''}`}>
          <span className="phase-num">[01]</span>
          <span className="phase-name">ALIGN</span>
        </div>
        <div className="phase-arrow">→</div>
        <div className={`phase-step ${stepNo >= 2 ? 'is-active' : ''} ${stepNo > 2 ? 'is-done' : ''}`}>
          <span className="phase-num">[02]</span>
          <span className="phase-name">GRAB</span>
        </div>
        <div className="phase-arrow">→</div>
        <div className={`phase-step ${stepNo >= 3 ? 'is-active' : ''} ${verified ? 'is-done' : ''}`}>
          <span className="phase-num">[03]</span>
          <span className="phase-name">DROP</span>
        </div>
      </div>

      {/* Machine Arcade Chassis with CRT Aesthetics */}
      <div ref={machineEl} className="clawcap-machine">
        <div className="clawcap-case">
          <div className={`clawcap-glass ${verified ? 'clawcap-glass--dim' : ''}`}>
            {/* Crosshairs in corners of the glass chamber */}
            <div className="crosshair ch-tl">+</div>
            <div className="crosshair ch-tr">+</div>
            <div className="crosshair ch-bl">+</div>
            <div className="crosshair ch-br">+</div>

            <div className="cc-rail" />
            <div ref={trolleyEl} className="cc-trolley" aria-hidden="true" />
            <div ref={shadowEl} className="cc-claw-shadow" aria-hidden="true" />

            {/* Scattered Pokémon Prize Pool */}
            {pile.map((p, i) => (
              <img
                key={p.toy}
                ref={(el) => {
                  pileEls.current[i] = el;
                }}
                className="cc-toy"
                src={`/pokemon/${p.toy}.png`}
                alt={p.toy}
                draggable={false}
                onError={(e) => {
                  e.currentTarget.src = `https://feralui.dev/pokemon/${p.toy}.png`;
                }}
                style={{
                  left: p.x - p.w / 2,
                  bottom: p.b,
                  width: p.w,
                  zIndex: p.z,
                  transform: `translateY(${p.dropFrom}px)`,
                  transformOrigin: '50% 100%'
                }}
              />
            ))}
            <div className="cc-pile-shadow" />

            {/* Mechanical Cable & Claw Rig */}
            <svg
              ref={rigEl}
              className="cc-rig"
              width="36"
              height={COIL_LEN + 64}
              viewBox={`0 0 36 ${COIL_LEN + 64}`}
              aria-hidden="true"
            >
              <g ref={coilEl} transform={`translate(9 0) scale(1 ${COIL_LEN / 90})`}>
                <path
                  d="M9 0 L9 5 C 15 7.5 15 9.5 9 12 C 3 14.5 3 16.5 9 19 C 15 21.5 15 23.5 9 26 C 3 28.5 3 30.5 9 33 C 15 35.5 15 37.5 9 40 C 3 42.5 3 44.5 9 47 C 15 49.5 15 51.5 9 54 C 3 56.5 3 58.5 9 61 C 15 63.5 15 65.5 9 68 C 3 70.5 3 72.5 9 75 C 15 77.5 15 79.5 9 82 C 3 84.5 3 86.5 9 89 C 15 91.5 15 93.5 9 95 L 9 100"
                  fill="none"
                  stroke="#9A9FA8"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
              <g ref={clawEl} transform={`translate(18 ${COIL_LEN}) scale(2.3) translate(-20.6 -8.9)`}>
                <g ref={fingerL}>
                  {CLAW_ARM_L.map((p, i) => (
                    <path key={i} fill={p.fill} d={p.d} />
                  ))}
                </g>
                <g ref={fingerR}>
                  {CLAW_ARM_R.map((p, i) => (
                    <path key={i} fill={p.fill} d={p.d} />
                  ))}
                </g>
                {CLAW_BODY.map((p, i) => (
                  <path key={i} fill={p.fill} d={p.d} />
                ))}
              </g>
            </svg>

            {/* CRT chamber gloss effect */}
            <div className="cc-glass-shine" />
          </div>

          {/* Tactical Control Console */}
          <div className="clawcap-panel">
            {/* 3D Pop-Out Arcade Pilot Stick */}
            <div className="joystick-control-group">
              <div className="joystick-axis-legend font-mono">
                <span className={dir.current < 0 ? 'axis-active' : ''}>[◄ A]</span>
                <span className={dir.current > 0 ? 'axis-active' : ''}>[D ►]</span>
              </div>
              <div
                ref={joyEl}
                className="cc-joy"
                role="slider"
                tabIndex={0}
                aria-label="Move the claw along rail"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(((sim.current.x - CLAW_MIN) / (CLAW_MAX - CLAW_MIN)) * 100)}
                onPointerDown={onStickDown}
                onPointerMove={onStickMove}
                onPointerUp={onStickUp}
                onPointerCancel={onStickUp}
                onLostPointerCapture={onStickUp}
              >
                <div className="cc-joy-base" />
                <div ref={stickEl} className="cc-joy-stick">
                  <div className="cc-joy-shaft" />
                  <div className="cc-joy-ball" />
                </div>
              </div>
              <span className="control-label">PILOT_STICK</span>
            </div>

            {/* Extraction Chute / Tray */}
            <div
              ref={trayEl}
              className={
                'cc-tray' +
                (phase === 'toTray' || phase === 'deny' ? ' cc-tray--receiving' : '') +
                (trayMode === 'open'
                  ? ' cc-tray--open'
                  : trayMode === 'win'
                  ? ' cc-tray--win'
                  : trayMode === 'no'
                  ? ' cc-tray--no'
                  : overTray
                  ? ' cc-tray--hot'
                  : '')
              }
            >
              <span className="cc-tray-hatch" aria-hidden="true">
                <span className="cc-tray-mouth" />
                <span className="cc-tray-door cc-tray-door--l" />
                <span className="cc-tray-skin" />
              </span>
              <span className="cc-tray-lip" aria-hidden="true" />
              {trayMode === 'win' && !reduce && (
                <span className="cc-confetti" aria-hidden="true">
                  {CONFETTI.map((p, i) => (
                    <i
                      key={i}
                      style={
                        {
                          background: p.c,
                          animationDelay: `${p.d}s`,
                          '--dx': `${p.dx}px`,
                          '--dy': `${p.dy}px`,
                          '--dr': `${p.dr}deg`
                        } as React.CSSProperties
                      }
                    />
                  ))}
                </span>
              )}
              <span className="cc-tray-label font-mono">
                {trayMode === 'win' ? (
                  <>
                    <span className="chute-icon">✓</span>
                    <span>VERIFIED</span>
                  </>
                ) : trayMode === 'no' ? (
                  <>
                    <span className="chute-icon">✕</span>
                    <span>MISMATCH</span>
                  </>
                ) : overTray ? (
                  <>
                    <span className="chute-icon">▼</span>
                    <span>DROP_READY</span>
                  </>
                ) : (
                  <>
                    <span className="chute-icon">⬚</span>
                    <span>EXTRACTION</span>
                  </>
                )}
              </span>
            </div>

            {/* Pokéball Action Button */}
            <div className="action-button-group">
              <button
                type="button"
                className={
                  'cc-action cc-action--ball' +
                  (phase === 'carry' && overTray ? ' cc-action--ready' : '')
                }
                onClick={action}
                disabled={busy || verified}
                aria-label={phase === 'carry' ? 'Drop Pokémon in chute' : 'Deploy claw to grab Pokémon'}
                title={
                  verified
                    ? 'CLEARANCE CONFIRMED'
                    : phase === 'carry'
                    ? overTray
                      ? 'PRESS TO DROP IN CHUTE'
                      : 'NAVIGATE OVER CHUTE FIRST'
                    : 'PRESS TO ENGAGE CLAW [SPACE]'
                }
              >
                <span className="sr-only">
                  {verified ? 'Verified' : phase === 'carry' ? 'Drop' : 'Grab'}
                </span>
              </button>
              <span className="control-label">
                {phase === 'carry' ? '[DROP/SPACE]' : '[GRAB/SPACE]'}
              </span>
            </div>
          </div>
        </div>

        {/* Floating Cargo Carry Layer */}
        <div ref={carryLayerEl} className="cc-carry-layer">
          <img
            ref={carriedEl}
            className="cc-carried"
            src={carried >= 0 ? `/pokemon/${pile[carried].toy}.png` : `/pokemon/${target}.png`}
            alt="Carried target"
            draggable={false}
            onError={(e) => {
              const src = carried >= 0 ? pile[carried].toy : target;
              e.currentTarget.src = `https://feralui.dev/pokemon/${src}.png`;
            }}
            style={{
              width: carriedW,
              visibility: carried >= 0 && phase !== 'idle' ? 'visible' : 'hidden'
            }}
          />
        </div>
      </div>

      {/* Compact Telemetry Strip */}
      <div className="clawcap-hud-strip font-mono">
        <div className="hud-metric">
          <span className="hm-label">AXIS_X:</span>
          <span className="hm-val">{telemetryX.toFixed(0)}px</span>
        </div>
        <div className="hud-metric">
          <span className="hm-label">SWAY:</span>
          <span className="hm-val">{telemetrySway.toFixed(1)}°</span>
        </div>
        <div className="hud-metric">
          <span className="hm-label">CARGO:</span>
          <span className="hm-val">
            {carried >= 0 ? `[${META[pile[carried].toy].label.toUpperCase()}]` : '[EMPTY]'}
          </span>
        </div>
      </div>

      {/* Keyboard navigation helper */}
      <div className="clawcap-keyboard-hint font-mono">
        [INPUT: ◄ / ► OR A / D TO STEER // SPACE TO ENGAGE EXTRACTOR]
      </div>
    </div>
  );
};
