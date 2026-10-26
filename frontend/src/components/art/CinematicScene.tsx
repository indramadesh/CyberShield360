import { useId, useMemo } from "react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";

/**
 * Original brand artwork (inline SVG): an aurora night sky, a glowing shield
 * "portal" with HUD rings, rim-lit mountain ranges, a lake reflecting the glow
 * and a lone explorer on a rock ledge. Pure vector — no raster images and no
 * embedded text. It keeps its own dark palette in both themes (illustration).
 */
const DARK = {
  sky0: "#010806", sky1: "#03140F", sky2: "#06261D", sky3: "#0B3A2C", skyEnd: "#010806",
  emerald: "#19E6A0", teal: "#42F5C5", mint: "#B8FFE6", ray: "#B8FFE6",
  mid: "#071F19", near: "#030D0A", rock: "#020806", figure: "#010504",
  farTop: "#0D3A2E", farMid: "#082A21", midTop: "#09281F", midMid: "#051712",
  lake0: "#0D4434", lake1: "#062219", fog: "#06110F", star: "#E6FFF6", starO: 1, auroraO: 0.95,
};
/** Dawn version of the same scene for light mode. */
const LIGHT: typeof DARK = {
  sky0: "#BFE6D7", sky1: "#D9F1E7", sky2: "#EEF9F4", sky3: "#FFFFFF", skyEnd: "#E4F4EC",
  emerald: "#0FB57E", teal: "#22C997", mint: "#FFFFFF", ray: "#FFFFFF",
  mid: "#4E8F7B", near: "#2C6555", rock: "#1D463B", figure: "#12332A",
  farTop: "#B4DECF", farMid: "#93C9B6", midTop: "#78B4A0", midMid: "#5A9A86",
  lake0: "#D2EFE5", lake1: "#A3D5C4", fog: "#F4FAF7", star: "#0FB57E", starO: 0.18, auroraO: 0.55,
};

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

/** Alpine ridge: alternating peaks/valleys refined by midpoint displacement. */
function ridge(seed: number, base: number, amp: number, peaks = 9) {
  const rnd = rng(seed);
  const step = 1600 / (peaks * 2);
  let pts: [number, number][] = [];
  for (let i = 0; i <= peaks * 2; i++) {
    const x = i * step + (i % 2 ? (rnd() - 0.5) * step * 0.6 : 0);
    const y = i % 2 ? base - amp * (0.35 + rnd() * 0.65) : base - amp * (0.05 + rnd() * 0.35);
    pts.push([x, y]);
  }
  for (let l = 0; l < 5; l++) {
    const next: [number, number][] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const len = Math.hypot(x2 - x1, y2 - y1);
      next.push(pts[i], [(x1 + x2) / 2 + (rnd() - 0.5) * len * 0.1, (y1 + y2) / 2 + (rnd() - 0.5) * len * 0.34]);
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }
  return pts;
}
const line = (p: readonly (readonly [number, number])[]) =>
  p.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
const area = (p: readonly (readonly [number, number])[]) => `${line(p)} L1600 900 L0 900 Z`;

const spin = (dur: number, reverse = false): CSSProperties => ({
  transformBox: "fill-box", transformOrigin: "center",
  animation: `spin ${dur}s linear infinite${reverse ? " reverse" : ""}`,
});

export function CinematicScene({
  variant = "hero",
  className,
}: {
  /** hero: portal top-right, explorer on a ledge. panel: auth background. */
  variant?: "hero" | "panel";
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const { theme } = useTheme();
  const C = theme === "dark" ? DARK : LIGHT;
  const u = (n: string) => `url(#${id}${n})`;
  const hero = variant === "hero";
  const cx = hero ? 1060 : 980;
  const cy = hero ? 290 : 250;
  const R = hero ? 1 : 0.8;

  const art = useMemo(() => {
    const rnd = rng(11);
    return {
      stars: Array.from({ length: 220 }, () => ({ x: rnd() * 1600, y: rnd() * 520, r: rnd() * 1.4 + 0.25, o: rnd() * 0.7 + 0.15 })),
      motes: Array.from({ length: 40 }, () => ({ a: rnd() * Math.PI * 2, d: 120 + rnd() * 260, r: rnd() * 2 + 0.6, o: rnd() * 0.7 + 0.2 })),
      far: ridge(5, 505, 215, 6),
      mid: ridge(9, 605, 130, 8),
      low: ridge(21, 700, 40, 14),
      shimmer: Array.from({ length: 34 }, () => ({ x: rnd(), y: rnd(), w: 20 + rnd() * 90, o: rnd() * 0.35 + 0.08 })),
      rays: Array.from({ length: 22 }, (_, i) => ({ a: (i / 22) * 360 + rnd() * 6, w: 1.5 + rnd() * 4, o: 0.05 + rnd() * 0.12 })),
    };
  }, []);

  // Horizontal position of the portal as a gradient fraction (for rim light).
  const fx = cx / 1600;

  return (
    <svg
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      className={cn("absolute inset-0 h-full w-full", className)}
      role="img"
      aria-label="Illustration: an explorer on a rocky ledge looks toward a glowing shield above mountains under an aurora"
    >
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.sky0} />
          <stop offset="0.35" stopColor={C.sky1} />
          <stop offset="0.6" stopColor={C.sky2} />
          <stop offset="0.72" stopColor={C.sky3} />
          <stop offset="1" stopColor={C.skyEnd} />
        </linearGradient>
        <radialGradient id={`${id}halo`} cx={fx} cy={cy / 900} r="0.55">
          <stop offset="0" stopColor={C.teal} stopOpacity="0.7" />
          <stop offset="0.18" stopColor={C.emerald} stopOpacity="0.32" />
          <stop offset="0.5" stopColor={C.emerald} stopOpacity="0.08" />
          <stop offset="1" stopColor={C.emerald} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}core`}>
          <stop offset="0" stopColor={C.mint} stopOpacity="0.95" />
          <stop offset="0.35" stopColor={C.teal} stopOpacity="0.55" />
          <stop offset="1" stopColor={C.emerald} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}aurA`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={C.emerald} stopOpacity="0" />
          <stop offset="0.25" stopColor={C.emerald} stopOpacity="0.75" />
          <stop offset="0.55" stopColor={C.teal} stopOpacity="0.9" />
          <stop offset="0.85" stopColor={C.emerald} stopOpacity="0.45" />
          <stop offset="1" stopColor={C.emerald} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}curtain`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.teal} stopOpacity="0" />
          <stop offset="0.45" stopColor={C.emerald} stopOpacity="0.5" />
          <stop offset="1" stopColor={C.emerald} stopOpacity="0" />
        </linearGradient>
        <pattern id={`${id}streaks`} width="9" height="900" patternUnits="userSpaceOnUse">
          <rect width="2.2" height="900" fill={C.mint} opacity="0.55" />
        </pattern>
        <mask id={`${id}curtainMask`}>
          <rect width="1600" height="900" fill={u("curtain")} />
        </mask>
        <linearGradient id={`${id}shieldFill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.mint} stopOpacity="0.85" />
          <stop offset="0.5" stopColor={C.teal} stopOpacity="0.6" />
          <stop offset="1" stopColor={C.emerald} stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id={`${id}ring`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={C.mint} />
          <stop offset="0.5" stopColor={C.teal} />
          <stop offset="1" stopColor={C.emerald} />
        </linearGradient>
        {/* Rim light along ridges: bright near the portal, fading out. */}
        <linearGradient id={`${id}rim`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={C.teal} stopOpacity="0.05" />
          <stop offset={Math.max(0, fx - 0.25)} stopColor={C.teal} stopOpacity="0.25" />
          <stop offset={fx} stopColor={C.mint} stopOpacity="0.95" />
          <stop offset={Math.min(1, fx + 0.25)} stopColor={C.teal} stopOpacity="0.3" />
          <stop offset="1" stopColor={C.teal} stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id={`${id}farFill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.farTop} />
          <stop offset="0.35" stopColor={C.farMid} />
          <stop offset="1" stopColor={C.mid} />
        </linearGradient>
        <linearGradient id={`${id}midFill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.midTop} />
          <stop offset="0.5" stopColor={C.midMid} />
          <stop offset="1" stopColor={C.near} />
        </linearGradient>
        <radialGradient id={`${id}lit`} cx={fx} cy="0.42" r="0.45">
          <stop offset="0" stopColor={C.teal} stopOpacity="0.28" />
          <stop offset="1" stopColor={C.teal} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}lake`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.lake0} />
          <stop offset="0.5" stopColor={C.lake1} />
          <stop offset="1" stopColor={C.near} />
        </linearGradient>
        <linearGradient id={`${id}fog`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.fog} stopOpacity="0" />
          <stop offset="1" stopColor={C.fog} stopOpacity="1" />
        </linearGradient>
        <linearGradient id={`${id}rockRim`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={C.teal} stopOpacity="0.15" />
          <stop offset="1" stopColor={C.teal} stopOpacity="0.7" />
        </linearGradient>
        <filter id={`${id}aurora`} x="-10%" y="-40%" width="120%" height="180%">
          <feTurbulence type="fractalNoise" baseFrequency="0.004 0.02" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="90" />
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <filter id={`${id}bigBlur`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="40" /></filter>
        <filter id={`${id}blur12`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="12" /></filter>
        <filter id={`${id}blur4`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" /></filter>
        <filter id={`${id}blur2`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" /></filter>
        <clipPath id={`${id}mountains`}>
          <path d={area(art.far)} />
        </clipPath>
      </defs>

      {/* ---------- Sky ---------- */}
      <rect width="1600" height="900" fill={u("sky")} />
      {art.stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={C.star} opacity={s.o * C.starO} />
      ))}

      {/* ---------- Aurora: flowing bands + vertical curtains ---------- */}
      <g filter={u("aurora")} opacity={C.auroraO}>
        <path d="M-100 170 C 220 60, 520 260, 820 140 S 1320 40, 1720 190" stroke={u("aurA")} strokeWidth="95" fill="none" />
        <path d="M-100 300 C 260 210, 560 360, 900 250 S 1400 210, 1720 320" stroke={u("aurA")} strokeWidth="55" fill="none" opacity="0.7" />
        <path d="M200 90 C 500 20, 900 160, 1250 60 S 1600 40, 1750 90" stroke={u("aurA")} strokeWidth="40" fill="none" opacity="0.5" />
      </g>
      <g mask={u("curtainMask")} opacity="0.45" filter={u("blur4")}>
        <path d="M-100 60 C 220 -30, 520 170, 820 50 S 1320 -50, 1720 100 L1720 420 C 1320 300, 900 420, 600 330 S 100 300, -100 360 Z"
              fill={u("streaks")} />
      </g>

      {/* ---------- Portal ---------- */}
      <rect width="1600" height="900" fill={u("halo")} />
      {hero && (
      <g transform={`translate(${cx} ${cy}) scale(${R})`}>
        {/* light rays */}
        <g filter={u("blur4")}>
          {art.rays.map((r, i) => (
            <path key={i} d={`M0 0 L${-r.w} -620 L${r.w} -620 Z`} fill={C.ray} opacity={r.o} transform={`rotate(${r.a})`} />
          ))}
        </g>
        {/* beam down to the lake */}
        <rect x="-10" y="0" width="20" height="420" fill={C.teal} opacity="0.18" filter={u("blur12")} />
        <circle r="200" fill={u("core")} filter={u("bigBlur")} />
        <circle r="90" fill={C.teal} opacity="0.35" filter={u("blur12")} />

        {/* HUD rings */}
        <g fill="none" stroke={u("ring")}>
          <circle r="300" strokeWidth="1" opacity="0.18" strokeDasharray="1.5 9" />
          <g style={spin(90)}>
            <circle r="252" strokeWidth="10" opacity="0.18" strokeDasharray="1.2 6" />
            <path d="M -252 0 A 252 252 0 0 1 -178 -178" strokeWidth="2.5" opacity="0.8" />
            <path d="M 252 0 A 252 252 0 0 1 178 178" strokeWidth="2.5" opacity="0.8" />
          </g>
          <circle r="215" strokeWidth="1.4" opacity="0.45" />
          <g style={spin(60, true)}>
            <circle r="180" strokeWidth="3" opacity="0.7" strokeDasharray="90 22 14 22" />
          </g>
          <circle r="150" strokeWidth="1.2" opacity="0.55" />
          <g style={spin(40)}>
            <circle r="128" strokeWidth="6" opacity="0.3" strokeDasharray="2 5" />
          </g>
        </g>
        {/* orbit nodes */}
        {[[-215, 0], [152, -152], [120, 172], [-60, -206], [210, 46], [-150, 154]].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="9" fill={C.teal} opacity="0.25" filter={u("blur4")} />
            <circle cx={x} cy={y} r="3.4" fill={C.mint} />
          </g>
        ))}
        {/* drifting motes */}
        {art.motes.map((m, i) => (
          <circle key={i} cx={Math.cos(m.a) * m.d} cy={Math.sin(m.a) * m.d} r={m.r} fill={C.mint} opacity={m.o * 0.7} />
        ))}

        {/* shield: bloom, body, inner line, check */}
        <g transform="translate(-80 -96) scale(5)">
          <path d="M16 2.5 5 6.6v8.1c0 6.9 4.6 12.2 11 14.8 6.4-2.6 11-7.9 11-14.8V6.6L16 2.5Z"
                fill={C.emerald} opacity="0.55" filter={u("blur2")} />
          <path d="M16 2.5 5 6.6v8.1c0 6.9 4.6 12.2 11 14.8 6.4-2.6 11-7.9 11-14.8V6.6L16 2.5Z"
                fill={u("shieldFill")} stroke={C.mint} strokeWidth="0.9" strokeLinejoin="round" />
          <path d="M16 5.2 7.6 8.4v6.4c0 5.5 3.6 9.7 8.4 11.8 4.8-2.1 8.4-6.3 8.4-11.8V8.4L16 5.2Z"
                fill="none" stroke={C.teal} strokeWidth="0.45" opacity="0.8" />
          <path d="m11.2 15.8 3.3 3.3 6.4-7" stroke="#04281D" strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
      )}

      {/* ---------- Mountains ---------- */}
      <path d={area(art.far)} fill={u("farFill")} />
      <rect width="1600" height="900" fill={u("lit")} clipPath={u("mountains")} />
      <path d={line(art.far)} stroke={u("rim")} strokeWidth="6" fill="none" filter={u("blur4")} opacity="0.6" />
      <path d={line(art.far)} stroke={u("rim")} strokeWidth="1.6" fill="none" />

      {/* mist between ranges */}
      <rect y="520" width="1600" height="60" fill={C.teal} opacity="0.08" filter={u("blur12")} />

      <path d={area(art.mid)} fill={u("midFill")} />
      <path d={line(art.mid)} stroke={u("rim")} strokeWidth="1.2" fill="none" opacity="0.7" />

      {/* ---------- Lake ---------- */}
      <rect y="600" width="1600" height="120" fill={u("lake")} />
      <ellipse cx={cx} cy="630" rx="300" ry="30" fill={C.teal} opacity="0.35" filter={u("blur12")} />
      <rect x={cx - 16} y="602" width="32" height="110" fill={C.mint} opacity="0.25" filter={u("blur4")} />
      {art.shimmer.map((s, i) => (
        <rect key={i} x={cx - 340 + s.x * 680} y={610 + s.y * 90} width={s.w} height="1.6" rx="1" fill={C.mint} opacity={s.o} />
      ))}
      <path d={area(art.low)} fill={C.near} />
      <path d={line(art.low)} stroke={C.teal} strokeOpacity="0.25" strokeWidth="1" fill="none" />

      {/* ---------- Foreground rocks ---------- */}
      <path d="M0 735 L70 705 L150 715 L230 690 L320 720 L380 760 L470 790 L560 820 L640 900 L0 900 Z" fill={C.rock} />
      <path d="M0 735 L70 705 L150 715 L230 690 L320 720 L380 760" stroke={u("rockRim")} strokeWidth="1.4" fill="none" opacity="0.6" />
      {hero ? (
        <g>
          <path d="M1080 900 L1110 760 L1160 720 L1205 700 L1285 698 L1330 712 L1390 690 L1460 705 L1530 680 L1600 690 L1600 900 Z" fill={C.rock} />
          <path d="M1110 760 L1160 720 L1205 700 L1285 698 L1330 712" stroke={u("rockRim")} strokeWidth="1.8" fill="none" />
          <path d="M1150 740 L1180 790 M1230 715 L1250 770 M1300 712 L1290 760" stroke={C.teal} strokeOpacity="0.1" strokeWidth="1.2" />
          <Explorer x={1246} y={699} id={id} color={C.figure} />
        </g>
      ) : (
        <g>
          <path d="M1230 900 L1260 790 L1320 750 L1390 735 L1460 742 L1530 720 L1600 730 L1600 900 Z" fill={C.rock} />
          <path d="M1260 790 L1320 750 L1390 735 L1460 742" stroke={u("rockRim")} strokeWidth="1.6" fill="none" />
          <Explorer x={1392} y={736} id={id} color={C.figure} />
        </g>
      )}

      {/* ground fog into the page */}
      <rect y="740" width="1600" height="160" fill={u("fog")} />
    </svg>
  );
}

/** Lone explorer with backpack, facing the portal, rim-lit on the left side. */
function Explorer({ x, y, id, color }: { x: number; y: number; id: string; color: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="0" rx="22" ry="4" fill="#000" opacity="0.6" />
      <g fill={color}>
        {/* legs */}
        <path d="M-6 -36 L-9 -1 L-4 -1 L-1 -26 L2 -1 L7 -1 L5 -36 Z" />
        {/* torso / jacket */}
        <path d="M-10 -66 Q0 -72 10 -66 L12 -34 L-11 -34 Z" />
        {/* backpack */}
        <rect x="6" y="-68" width="12" height="28" rx="4" />
        <rect x="8" y="-74" width="8" height="8" rx="2" />
        {/* arm */}
        <path d="M-10 -63 L-15 -44 L-12 -42 L-7 -58 Z" />
        {/* head + hood */}
        <circle cx="-1" cy="-77" r="7.5" />
      </g>
      {/* rim light from the portal (upper left) */}
      <path d="M-9 -84 Q-9.5 -76 -6 -70 M-11 -65 L-15 -45 M-8 -36 L-9 -2" stroke={`url(#${id}ring)`}
            strokeWidth="1.1" fill="none" opacity="0.85" />
    </g>
  );
}
