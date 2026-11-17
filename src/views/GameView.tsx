import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Volume2, VolumeX, Heart, Sparkles } from 'lucide-react';

type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';
type GameMode = 'gentle' | 'flow';

interface LanternEntity {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  kind: 'sage' | 'lavender' | 'peach' | 'starlight' | 'snag';
  wobblePhase: number;
  pulse: number;
}

interface RippleEntity {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
}

interface ParticleEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

const BEST_SCORE_KEY = 'my_world_stillwater_best_v1';

// Pentatonic chime frequencies in Hz for calming audio feedback
const CHIME_NOTES = [392.0, 440.0, 493.88, 587.33, 659.25, 783.99];

function loadBestScore(): number {
  try {
    return Number(localStorage.getItem(BEST_SCORE_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

function saveBestScore(score: number) {
  try {
    localStorage.setItem(BEST_SCORE_KEY, String(score));
  } catch {
    // ignore storage limits
  }
}

export const GameView: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [mode, setMode] = useState<GameMode>('gentle');
  const [muted, setMuted] = useState(false);

  const [hud, setHud] = useState({
    score: 0,
    bestScore: loadBestScore(),
    streak: 0,
    peakStreak: 0,
    hearts: 3,
    lanternsLit: 0,
    surgeActive: false,
  });

  // Mutable simulation state inside refs for 60fps loop without React re-render lag
  const stateRef = useRef<GameState>('TITLE_MENU');
  const modeRef = useRef<GameMode>('gentle');
  const mutedRef = useRef<boolean>(false);

  const simRef = useRef({
    width: 800,
    height: 520,
    boatX: 400,
    boatY: 420,
    boatVx: 0,
    boatVy: 0,
    boatScaleX: 1,
    boatScaleY: 1,
    targetPointerX: null as number | null,
    targetPointerY: null as number | null,
    score: 0,
    bestScore: loadBestScore(),
    streak: 0,
    peakStreak: 0,
    hearts: 3,
    lanternsLit: 0,
    surgeTimer: 0,
    hitstopTimer: 0,
    invulnTimer: 0,
    spawnTimer: 0,
    elapsed: 0,
    entitySeq: 1,
    lanterns: [] as LanternEntity[],
    ripples: [] as RippleEntity[],
    particles: [] as ParticleEntity[],
    stars: Array.from({ length: 42 }, (_, i) => ({
      x: ((i * 197) % 1000) / 1000,
      y: ((i * 313) % 1000) / 1000,
      r: 0.8 + (i % 3) * 0.55,
      twinkle: i * 0.7,
    })),
  });

  const heldKeysRef = useRef<Record<string, boolean>>({});
  const justPressedRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const playChime = useCallback((streakOrKind: number | 'snag' | 'surge') => {
    if (mutedRef.current) return;
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (streakOrKind === 'snag') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(68, now + 0.25);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
        return;
      }

      if (streakOrKind === 'surge') {
        [523.25, 659.25, 783.99].forEach((freq, idx) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(freq, now + idx * 0.06);
          g.gain.setValueAtTime(0.08, now + idx * 0.06);
          g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.5);
          o.connect(g);
          g.connect(ctx.destination);
          o.start(now + idx * 0.06);
          o.stop(now + idx * 0.06 + 0.52);
        });
        return;
      }

      const note = CHIME_NOTES[streakOrKind % CHIME_NOTES.length];
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note, now);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch {
      // Audio playback blocked or unsupported
    }
  }, []);

  const syncHud = useCallback(() => {
    const s = simRef.current;
    setHud({
      score: s.score,
      bestScore: s.bestScore,
      streak: s.streak,
      peakStreak: s.peakStreak,
      hearts: s.hearts,
      lanternsLit: s.lanternsLit,
      surgeActive: s.surgeTimer > 0,
    });
  }, []);

  const startNewRun = useCallback(() => {
    const s = simRef.current;
    s.boatX = s.width / 2;
    s.boatY = Math.max(120, s.height - 86);
    s.boatVx = 0;
    s.boatVy = 0;
    s.boatScaleX = 1;
    s.boatScaleY = 1;
    s.targetPointerX = null;
    s.targetPointerY = null;
    s.score = 0;
    s.streak = 0;
    s.peakStreak = 0;
    s.hearts = 3;
    s.lanternsLit = 0;
    s.surgeTimer = 0;
    s.hitstopTimer = 0;
    s.invulnTimer = 0;
    s.spawnTimer = 0.3;
    s.elapsed = 0;
    s.lanterns = [];
    s.ripples = [];
    s.particles = [];
    stateRef.current = 'PLAYING';
    setGameState('PLAYING');
    syncHud();
    playChime('surge');
  }, [playChime, syncHud]);

  const togglePause = useCallback(() => {
    if (stateRef.current === 'PLAYING') {
      stateRef.current = 'PAUSED';
      setGameState('PAUSED');
    } else if (stateRef.current === 'PAUSED') {
      stateRef.current = 'PLAYING';
      setGameState('PLAYING');
    }
  }, []);

  // Keyboard bindings & focus loss safety
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        if (stateRef.current === 'PLAYING' || stateRef.current === 'TITLE_MENU') {
          e.preventDefault();
        }
      }

      if (!heldKeysRef.current[e.key]) {
        justPressedRef.current[e.key] = true;
      }
      heldKeysRef.current[e.key] = true;

      if ((e.key === 'Enter' || e.key === ' ') && stateRef.current === 'TITLE_MENU') {
        startNewRun();
      } else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (stateRef.current === 'PLAYING' || stateRef.current === 'PAUSED') {
          togglePause();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      heldKeysRef.current[e.key] = false;
    };

    const onBlur = () => {
      heldKeysRef.current = {};
      justPressedRef.current = {};
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [startNewRun, togglePause]);

  // Responsive canvas sizing
  useEffect(() => {
    const updateSize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(320, Math.floor(rect.width));
      const h = Math.max(360, Math.floor(rect.height));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      simRef.current.width = w;
      simRef.current.height = h;
      simRef.current.boatX = Math.min(Math.max(32, simRef.current.boatX), w - 32);
      simRef.current.boatY = Math.min(Math.max(48, simRef.current.boatY), h - 42);
    };

    updateSize();
    const obs = new ResizeObserver(updateSize);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Main 60fps requestAnimationFrame loop
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();

    const spawnEntity = () => {
      const s = simRef.current;
      const isFlow = modeRef.current === 'flow';
      const difficulty = Math.min(2.2, 1 + s.elapsed / (isFlow ? 38 : 65));
      const roll = Math.random();
      const snagChance = isFlow ? 0.25 : 0.16;

      let kind: LanternEntity['kind'] = 'sage';
      if (roll < snagChance) {
        kind = 'snag';
      } else if (roll < snagChance + 0.08) {
        kind = 'starlight';
      } else {
        const colors: Array<'sage' | 'lavender' | 'peach'> = ['sage', 'lavender', 'peach'];
        kind = colors[Math.floor(Math.random() * colors.length)];
      }

      const margin = 38;
      const x = margin + Math.random() * Math.max(40, s.width - margin * 2);
      const baseSpeed = isFlow ? 132 : 95;
      const vy = (baseSpeed + Math.random() * 48) * difficulty * (kind === 'starlight' ? 1.18 : 1);

      s.lanterns.push({
        id: s.entitySeq++,
        x,
        y: -28,
        vx: (Math.random() - 0.5) * 26,
        vy,
        radius: kind === 'snag' ? 17 : kind === 'starlight' ? 14 : 16,
        kind,
        wobblePhase: Math.random() * Math.PI * 2,
        pulse: Math.random() * Math.PI * 2,
      });
    };

    const emitParticles = (x: number, y: number, color: string, count: number) => {
      const s = simRef.current;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
        const speed = 35 + Math.random() * 85;
        s.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.45 + Math.random() * 0.25,
          maxLife: 0.7,
          color,
          size: 2.2 + Math.random() * 2.4,
        });
      }
    };

    const step = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);
      const s = simRef.current;

      if (stateRef.current === 'PLAYING') {
        s.elapsed += dt;

        if (s.hitstopTimer > 0) {
          s.hitstopTimer = Math.max(0, s.hitstopTimer - dt);
        } else {
          if (s.surgeTimer > 0) s.surgeTimer = Math.max(0, s.surgeTimer - dt);
          if (s.invulnTimer > 0) s.invulnTimer = Math.max(0, s.invulnTimer - dt);

          // Input movement (keyboard + pointer drag)
          let moveX = 0;
          let moveY = 0;
          const keys = heldKeysRef.current;
          if (keys['ArrowLeft'] || keys['a'] || keys['A']) moveX -= 1;
          if (keys['ArrowRight'] || keys['d'] || keys['D']) moveX += 1;
          if (keys['ArrowUp'] || keys['w'] || keys['W']) moveY -= 1;
          if (keys['ArrowDown'] || keys['s'] || keys['S']) moveY += 1;

          const boatSpeed = 360;
          if (moveX !== 0 || moveY !== 0) {
            const len = Math.hypot(moveX, moveY) || 1;
            s.boatVx = (moveX / len) * boatSpeed;
            s.boatVy = (moveY / len) * boatSpeed;
            s.targetPointerX = null;
            s.targetPointerY = null;
          } else if (s.targetPointerX !== null && s.targetPointerY !== null) {
            const dx = s.targetPointerX - s.boatX;
            const dy = s.targetPointerY - s.boatY;
            const dist = Math.hypot(dx, dy);
            if (dist > 4) {
              const pull = Math.min(boatSpeed * 1.15, dist * 9);
              s.boatVx = (dx / dist) * pull;
              s.boatVy = (dy / dist) * pull;
            } else {
              s.boatVx *= 0.8;
              s.boatVy *= 0.8;
            }
          } else {
            s.boatVx *= 0.85;
            s.boatVy *= 0.85;
          }

          s.boatX = Math.min(Math.max(28, s.boatX + s.boatVx * dt), s.width - 28);
          s.boatY = Math.min(Math.max(48, s.boatY + s.boatVy * dt), s.height - 36);

          // Smooth squash & stretch recovery
          s.boatScaleX += (1 - s.boatScaleX) * Math.min(1, dt * 10);
          s.boatScaleY += (1 - s.boatScaleY) * Math.min(1, dt * 10);

          // Spawn cadence
          s.spawnTimer -= dt;
          if (s.spawnTimer <= 0) {
            spawnEntity();
            const isFlow = modeRef.current === 'flow';
            const minGap = isFlow ? 0.36 : 0.55;
            const maxGap = Math.max(minGap, (isFlow ? 0.88 : 1.15) - s.elapsed * 0.006);
            s.spawnTimer = minGap + Math.random() * (maxGap - minGap);
          }

          let hudDirty = false;
          const remaining: LanternEntity[] = [];

          for (const item of s.lanterns) {
            item.wobblePhase += dt * 2.2;
            item.pulse += dt * 3;
            item.x += (item.vx + Math.sin(item.wobblePhase) * 18) * dt;
            item.y += item.vy * (s.surgeTimer > 0 && item.kind === 'snag' ? 0.65 : 1) * dt;

            // Gentle magnet attraction during Serenity Surge
            if (s.surgeTimer > 0 && item.kind !== 'snag') {
              const dx = s.boatX - item.x;
              const dy = s.boatY - item.y;
              const d = Math.hypot(dx, dy);
              if (d < 165 && d > 1) {
                item.x += (dx / d) * 180 * dt;
                item.y += (dy / d) * 180 * dt;
              }
            }

            // Keep inside horizontal pond margins
            if (item.x < 24) {
              item.x = 24;
              item.vx = Math.abs(item.vx);
            } else if (item.x > s.width - 24) {
              item.x = s.width - 24;
              item.vx = -Math.abs(item.vx);
            }

            const distToBoat = Math.hypot(item.x - s.boatX, item.y - s.boatY);
            if (distToBoat < item.radius + 20) {
              if (item.kind === 'snag') {
                if (s.invulnTimer <= 0 && s.surgeTimer <= 0) {
                  s.hearts -= 1;
                  s.streak = 0;
                  s.invulnTimer = 1.15;
                  s.hitstopTimer = 0.07;
                  s.boatScaleX = 1.24;
                  s.boatScaleY = 0.78;
                  s.ripples.push({
                    x: item.x,
                    y: item.y,
                    radius: 8,
                    maxRadius: 68,
                    color: '#F2B8A2',
                    alpha: 0.7,
                  });
                  emitParticles(item.x, item.y, '#F2B8A2', 12);
                  playChime('snag');
                  hudDirty = true;

                  if (s.hearts <= 0) {
                    if (s.score > s.bestScore) {
                      s.bestScore = s.score;
                      saveBestScore(s.bestScore);
                    }
                    stateRef.current = 'GAME_OVER';
                    setGameState('GAME_OVER');
                    syncHud();
                  }
                }
              } else {
                s.lanternsLit += 1;
                s.streak += 1;
                if (s.streak > s.peakStreak) s.peakStreak = s.streak;

                const mult = 1 + Math.floor(s.streak / 5);
                const basePts = item.kind === 'starlight' ? 40 : 15;
                s.score += basePts * mult;

                if (s.score > s.bestScore) {
                  s.bestScore = s.score;
                  saveBestScore(s.bestScore);
                }

                s.boatScaleX = 0.86;
                s.boatScaleY = 1.18;

                const palette =
                  item.kind === 'sage'
                    ? '#9EC5AB'
                    : item.kind === 'lavender'
                      ? '#BEB4DC'
                      : item.kind === 'peach'
                        ? '#F2B8A2'
                        : '#FDE68A';

                s.ripples.push({
                  x: item.x,
                  y: item.y,
                  radius: 10,
                  maxRadius: item.kind === 'starlight' ? 92 : 64,
                  color: palette,
                  alpha: 0.75,
                });
                emitParticles(item.x, item.y, palette, item.kind === 'starlight' ? 16 : 10);

                if (item.kind === 'starlight' || (s.streak > 0 && s.streak % 5 === 0)) {
                  s.surgeTimer = 4.5;
                  playChime('surge');
                } else {
                  playChime(s.streak);
                }
                hudDirty = true;
              }
              continue;
            }

            if (item.y < s.height + 40) {
              remaining.push(item);
            }
          }
          s.lanterns = remaining;

          if (hudDirty && stateRef.current === 'PLAYING') {
            syncHud();
          }
        }
      } else {
        // Gentle idle pond animation on Title Menu
        s.elapsed += dt;
      }

      // Update ripples and particles smoothly across states
      s.ripples = s.ripples
        .map((r) => ({
          ...r,
          radius: r.radius + 78 * dt,
          alpha: r.alpha - 0.85 * dt,
        }))
        .filter((r) => r.alpha > 0.02 && r.radius < r.maxRadius);

      s.particles = s.particles
        .map((p) => ({
          ...p,
          x: p.x + p.vx * dt,
          y: p.y + p.vy * dt,
          vx: p.vx * 0.96,
          vy: p.vy * 0.96,
          life: p.life - dt,
        }))
        .filter((p) => p.life > 0);

      justPressedRef.current = {};

      // Render Canvas
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        const w = s.width;
        const h = s.height;

        // Calm nocturnal water gradient
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#0F131A');
        grad.addColorStop(0.55, '#131A24');
        grad.addColorStop(1, '#10151D');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Soft moonlight reflection
        const moonGrad = ctx.createRadialGradient(w * 0.5, h * 0.14, 8, w * 0.5, h * 0.14, w * 0.48);
        moonGrad.addColorStop(0, 'rgba(155, 196, 226, 0.14)');
        moonGrad.addColorStop(1, 'rgba(155, 196, 226, 0)');
        ctx.fillStyle = moonGrad;
        ctx.fillRect(0, 0, w, h);

        // Starlight reflections on water
        for (const st of s.stars) {
          const twinkle = 0.25 + 0.4 * Math.sin(s.elapsed * 1.4 + st.twinkle);
          ctx.fillStyle = `rgba(241, 243, 246, ${Math.max(0.08, twinkle)})`;
          ctx.beginPath();
          ctx.arc(st.x * w, st.y * h, st.r, 0, Math.PI * 2);
          ctx.fill();
        }

        // Ripples
        for (const r of s.ripples) {
          ctx.strokeStyle = r.color;
          ctx.globalAlpha = Math.max(0, r.alpha);
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // Lanterns & snags
        for (const item of s.lanterns) {
          if (item.kind === 'snag') {
            // Dark storm ripple / driftwood snag
            ctx.save();
            ctx.translate(item.x, item.y);
            ctx.rotate(Math.sin(item.wobblePhase) * 0.3);
            ctx.fillStyle = '#2A232B';
            ctx.strokeStyle = '#F2B8A2';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.strokeStyle = 'rgba(242, 184, 162, 0.55)';
            ctx.beginPath();
            ctx.moveTo(-6, -6);
            ctx.lineTo(6, 6);
            ctx.moveTo(6, -6);
            ctx.lineTo(-6, 6);
            ctx.stroke();
            ctx.restore();
            continue;
          }

          const color =
            item.kind === 'sage'
              ? '#9EC5AB'
              : item.kind === 'lavender'
                ? '#BEB4DC'
                : item.kind === 'peach'
                  ? '#F2B8A2'
                  : '#FDE68A';

          const glowR = item.radius * (2.1 + 0.25 * Math.sin(item.pulse));
          const glow = ctx.createRadialGradient(item.x, item.y, 2, item.x, item.y, glowR);
          glow.addColorStop(0, `${color}55`);
          glow.addColorStop(1, `${color}00`);
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(item.x, item.y, glowR, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.globalAlpha = 0.65;
          ctx.beginPath();
          ctx.arc(item.x - 3, item.y - 4, item.radius * 0.34, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        // Particles
        for (const p of s.particles) {
          ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        // Lotus Boat (player)
        if (stateRef.current !== 'TITLE_MENU') {
          ctx.save();
          ctx.translate(s.boatX, s.boatY);
          ctx.scale(s.boatScaleX, s.boatScaleY);

          if (s.invulnTimer > 0 && Math.floor(s.invulnTimer * 12) % 2 === 0) {
            ctx.globalAlpha = 0.45;
          }

          // Surge aura
          if (s.surgeTimer > 0) {
            ctx.strokeStyle = 'rgba(253, 230, 138, 0.55)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 30 + Math.sin(s.elapsed * 8) * 3, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Boat hull
          ctx.fillStyle = '#9BC4E2';
          ctx.beginPath();
          ctx.ellipse(0, 0, 22, 13, 0, 0, Math.PI * 2);
          ctx.fill();

          // Warm lantern flame center
          ctx.fillStyle = '#FDE68A';
          ctx.beginPath();
          ctx.arc(0, -1, 7, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [playChime, syncHud]);

  const handlePointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (stateRef.current !== 'PLAYING') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    simRef.current.targetPointerX = e.clientX - rect.left;
    simRef.current.targetPointerY = e.clientY - rect.top;
  };

  return (
    <div className="space-y-4">
      {/* Compact Perimeter HUD (No backdrop blur over canvas) */}
      <div className="rounded-2xl bg-[#171A21] border border-white/[0.08] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
          <div>
            <span className="text-[#98A2B3] mr-1.5">Score</span>
            <span className="font-mono-tabular font-semibold text-[#F1F3F6]">{hud.score}</span>
          </div>
          <div>
            <span className="text-[#98A2B3] mr-1.5">Streak</span>
            <span className="font-mono-tabular font-semibold text-[#9EC5AB]">{hud.streak}x</span>
          </div>
          <div>
            <span className="text-[#98A2B3] mr-1.5">Best</span>
            <span className="font-mono-tabular font-semibold text-[#BEB4DC]">{hud.bestScore}</span>
          </div>
          <div className="flex items-center gap-1" aria-label={`Serenity hearts: ${hud.hearts}`}>
            {[0, 1, 2].map((idx) => (
              <Heart
                key={idx}
                className={`w-4 h-4 ${
                  idx < hud.hearts ? 'text-[#F2B8A2] fill-[#F2B8A2]' : 'text-white/15'
                }`}
              />
            ))}
          </div>
          {hud.surgeActive && (
            <span className="text-xs font-medium text-[#FDE68A] inline-flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              Serenity Surge
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'Unmute game audio' : 'Mute game audio'}
            className="min-w-[44px] min-h-[44px] px-3 rounded-xl bg-[#1D212A] hover:bg-white/[0.08] text-[#D0D5DD] flex items-center justify-center"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
            <button
              type="button"
              onClick={togglePause}
              aria-label={gameState === 'PAUSED' ? 'Resume game' : 'Pause game'}
              className="min-w-[44px] min-h-[44px] px-3 rounded-xl bg-[#1D212A] hover:bg-white/[0.08] text-[#D0D5DD] flex items-center justify-center"
            >
              {gameState === 'PAUSED' ? (
                <Play className="w-4 h-4 text-[#9EC5AB]" />
              ) : (
                <Pause className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* >=85% Unobstructed Playfield */}
      <div
        ref={containerRef}
        className="relative w-full h-[calc(100dvh-13.5rem)] min-h-[460px] max-h-[760px] rounded-3xl overflow-hidden border border-white/[0.08] bg-[#0F131A] select-none touch-none"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointer}
          onPointerMove={(e) => {
            if (e.buttons > 0 || e.pointerType === 'touch') {
              handlePointer(e);
            }
          }}
          className="block w-full h-full cursor-crosshair"
        />

        {gameState === 'TITLE_MENU' && (
          <div className="absolute inset-0 flex items-center justify-center p-6 bg-[#0F1115]/70">
            <div className="max-w-md w-full rounded-3xl bg-[#171A21] border border-white/[0.1] p-7 text-center space-y-6 shadow-2xl">
              <div className="space-y-2">
                <p className="text-xs text-[#9EC5AB] tracking-wide">Zen Pond Arcade</p>
                <h1 className="font-display text-3xl sm:text-4xl font-medium text-[#F1F3F6]">
                  Stillwater Lanterns
                </h1>
                <p className="text-xs sm:text-sm text-[#98A2B3] leading-relaxed">
                  Steer your lotus boat to gather drifting paper lanterns, trigger Serenity Surges,
                  and glide past dark storm snags.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setMode('gentle')}
                  className={`min-h-[44px] px-3 rounded-2xl text-xs font-medium border transition-colors ${
                    mode === 'gentle'
                      ? 'bg-[#9EC5AB]/15 border-[#9EC5AB]/50 text-[#9EC5AB]'
                      : 'bg-[#1D212A] border-white/[0.06] text-[#98A2B3]'
                  }`}
                >
                  Gentle Drift
                </button>
                <button
                  type="button"
                  onClick={() => setMode('flow')}
                  className={`min-h-[44px] px-3 rounded-2xl text-xs font-medium border transition-colors ${
                    mode === 'flow'
                      ? 'bg-[#9BC4E2]/15 border-[#9BC4E2]/50 text-[#9BC4E2]'
                      : 'bg-[#1D212A] border-white/[0.06] text-[#98A2B3]'
                  }`}
                >
                  Current Flow
                </button>
              </div>

              <button
                type="button"
                onClick={startNewRun}
                className="w-full min-h-[48px] rounded-2xl bg-[#9EC5AB] hover:bg-[#8EB89D] text-[#0F1115] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
              >
                <Play className="w-4 h-4" />
                Start Game
              </button>

              <p className="text-[11px] text-[#98A2B3]">
                Move: Arrow Keys, WASD, or Drag · Pause: Esc
              </p>
            </div>
          </div>
        )}

        {gameState === 'PAUSED' && (
          <div className="absolute inset-0 flex items-center justify-center p-6 bg-[#0F1115]/75">
            <div className="max-w-xs w-full rounded-3xl bg-[#171A21] border border-white/[0.1] p-6 text-center space-y-4">
              <h2 className="font-display text-2xl font-medium text-[#F1F3F6]">Paused</h2>
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={togglePause}
                  className="w-full min-h-[44px] rounded-2xl bg-[#9EC5AB] text-[#0F1115] text-sm font-semibold"
                >
                  Resume
                </button>
                <button
                  type="button"
                  onClick={startNewRun}
                  className="w-full min-h-[44px] rounded-2xl bg-[#1D212A] text-[#F1F3F6] text-sm font-medium"
                >
                  Restart Run
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stateRef.current = 'TITLE_MENU';
                    setGameState('TITLE_MENU');
                  }}
                  className="w-full min-h-[44px] rounded-2xl bg-white/[0.04] text-[#98A2B3] text-xs"
                >
                  Title Menu
                </button>
              </div>
            </div>
          </div>
        )}

        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 flex items-center justify-center p-6 bg-[#0F1115]/80">
            <div className="max-w-sm w-full rounded-3xl bg-[#171A21] border border-white/[0.1] p-7 text-center space-y-5">
              <div>
                <p className="text-xs text-[#9BC4E2]">Pond Reflection</p>
                <h2 className="font-display text-2xl font-medium text-[#F1F3F6] mt-1">
                  Lanterns Rested
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="p-3.5 rounded-2xl bg-[#1D212A]">
                  <p className="text-[11px] text-[#98A2B3]">Final Score</p>
                  <p className="font-mono-tabular text-lg font-semibold text-[#F1F3F6]">
                    {hud.score}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#1D212A]">
                  <p className="text-[11px] text-[#98A2B3]">Best Score</p>
                  <p className="font-mono-tabular text-lg font-semibold text-[#BEB4DC]">
                    {hud.bestScore}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#1D212A]">
                  <p className="text-[11px] text-[#98A2B3]">Lanterns Lit</p>
                  <p className="font-mono-tabular text-lg font-semibold text-[#9EC5AB]">
                    {hud.lanternsLit}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#1D212A]">
                  <p className="text-[11px] text-[#98A2B3]">Peak Streak</p>
                  <p className="font-mono-tabular text-lg font-semibold text-[#F2B8A2]">
                    {hud.peakStreak}x
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={startNewRun}
                  className="w-full min-h-[46px] rounded-2xl bg-[#9EC5AB] hover:bg-[#8EB89D] text-[#0F1115] text-sm font-semibold inline-flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Play Again
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stateRef.current = 'TITLE_MENU';
                    setGameState('TITLE_MENU');
                  }}
                  className="w-full min-h-[44px] rounded-2xl bg-[#1D212A] text-[#98A2B3] text-xs font-medium"
                >
                  Return to Title Menu
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
