import { useId } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Illustrated thumbnails for lessons and news (inline SVG, no text). Each topic
 * gets its own colour scene: a glowing hero object and, for lessons, a person at
 * a laptop. Stylised and friendly — deliberately not "hooded hacker" imagery.
 */
export type Topic =
  | "phishing" | "upi" | "qr" | "passwords" | "jobs" | "investment" | "social_engineering"
  | "privacy" | "social" | "law" | "alert" | "scam" | "advisory" | "tip" | "news";

const SCENE: Record<Topic, { a: string; b: string; glow: string }> = {
  phishing: { a: "#1B2B5E", b: "#0B1230", glow: "#FFB347" },
  upi: { a: "#5A2A12", b: "#1E0E08", glow: "#FFC36B" },
  qr: { a: "#0E3D4A", b: "#061A20", glow: "#42F5C5" },
  passwords: { a: "#3A1E5C", b: "#140A24", glow: "#C49BFF" },
  jobs: { a: "#18405A", b: "#081A26", glow: "#7FD1FF" },
  investment: { a: "#204A2A", b: "#0A1C10", glow: "#9BFF7A" },
  social_engineering: { a: "#5C1E3A", b: "#22091A", glow: "#FF8FB1" },
  privacy: { a: "#123A5C", b: "#071726", glow: "#7FD1FF" },
  social: { a: "#4A1E5C", b: "#1A0A24", glow: "#FF9BE0" },
  law: { a: "#2C3E1E", b: "#10180A", glow: "#E8D27A" },
  alert: { a: "#4A1414", b: "#1C0606", glow: "#FF6B6B" },
  scam: { a: "#4A2A10", b: "#1C0F06", glow: "#FFB347" },
  advisory: { a: "#0E2F55", b: "#061424", glow: "#63B8FF" },
  tip: { a: "#3D3A10", b: "#171606", glow: "#FFE27A" },
  news: { a: "#0E3D33", b: "#061A16", glow: "#42F5C5" },
};

/** Map backend categories to a topic scene. */
export function topicFor(category: string): Topic {
  const c = category.toLowerCase();
  if (c in SCENE) return c as Topic;
  if (/fraud|scam/.test(c)) return "scam";
  if (/law|legal|policy/.test(c)) return "law";
  if (/authentication|password/.test(c)) return "passwords";
  if (/vulnerab|ransomware|breach/.test(c)) return "alert";
  if (/web|network|cloud|application/.test(c)) return "privacy";
  if (/mobile/.test(c)) return "upi";
  if (/ai_security|social/.test(c)) return "social";
  if (/incident/.test(c)) return "advisory";
  if (/awareness/.test(c)) return "tip";
  if (/advis|guideline/.test(c)) return "advisory";
  if (/alert|threat|breach|malware/.test(c)) return "alert";
  if (/tip|guide/.test(c)) return "tip";
  return "news";
}

function Obj({ topic, glow }: { topic: Topic; glow: string }) {
  const s = { stroke: glow, strokeWidth: 3, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const panel = "rgba(255,255,255,0.10)";
  const items: Partial<Record<Topic, ReactNode>> = {
    phishing: <g><rect x="-30" y="-20" width="60" height="40" rx="5" {...s} fill={panel} /><path d="M-30 -18 L0 4 L30 -18" {...s} /><path d="M18 -48 V-22 C18 -12 6 -10 3 -17" {...s} /></g>,
    upi: <g><rect x="-20" y="-36" width="40" height="70" rx="7" {...s} fill={panel} /><path d="M-8 -16 H8 M-8 -9 H8 M-8 -16 C4 -16 4 -2 -8 -2 L6 12" {...s} /></g>,
    qr: <g><rect x="-32" y="-32" width="64" height="64" rx="6" {...s} fill={panel} />{[[-22, -22], [8, -22], [-22, 8]].map(([x, y]) => <rect key={`${x}${y}`} x={x} y={y} width="14" height="14" rx="2" {...s} />)}<path d="M10 10 H22 V22 M10 22 H14" {...s} /></g>,
    passwords: <g><rect x="-24" y="-6" width="48" height="38" rx="6" {...s} fill={panel} /><path d="M-14 -6 V-16 A14 14 0 0 1 14 -16 V-6" {...s} /><circle cx="0" cy="12" r="5" {...s} /></g>,
    jobs: <g><rect x="-30" y="-18" width="60" height="44" rx="6" {...s} fill={panel} /><path d="M-10 -18 V-26 H10 V-18 M-30 0 H30" {...s} /></g>,
    investment: <g><path d="M-34 26 H34 M-28 16 L-10 -2 L4 8 L28 -20" {...s} /><path d="M16 -20 H28 V-8" {...s} /></g>,
    social_engineering: <g><circle cx="-12" cy="-10" r="10" {...s} /><circle cx="14" cy="-4" r="8" {...s} /><path d="M-30 24 C-28 6 4 6 6 24 M4 24 C6 12 28 12 30 24" {...s} /></g>,
    privacy: <g><path d="M0 -34 L26 -24 V0 C26 18 12 28 0 34 C-12 28 -26 18 -26 0 V-24 Z" {...s} fill={panel} /><circle cx="0" cy="-2" r="7" {...s} /><path d="M0 5 V14" {...s} /></g>,
    social: <g><circle cx="0" cy="0" r="30" {...s} fill={panel} /><path d="M-12 6 C-6 14 6 14 12 6 M-10 -8 H-8 M8 -8 H10" {...s} /></g>,
    law: <g><path d="M0 -32 V28 M-22 28 H22 M-30 -18 H30 M-30 -18 L-40 4 H-20 Z M30 -18 L20 4 H40 Z" {...s} /></g>,
    alert: <g><path d="M0 -32 L32 26 H-32 Z" {...s} fill={panel} /><path d="M0 -10 V8 M0 16 V17" {...s} /></g>,
    scam: <g><rect x="-20" y="-36" width="40" height="70" rx="7" {...s} fill={panel} /><path d="M0 -14 V4 M0 12 V13" {...s} /></g>,
    advisory: <g><rect x="-24" y="-32" width="48" height="64" rx="5" {...s} fill={panel} /><path d="M-12 -16 H12 M-12 -6 H12 M-12 4 H4" {...s} /><path d="M10 14 L14 20 L24 8" {...s} /></g>,
    tip: <g><path d="M0 -32 A20 20 0 0 1 12 4 V14 H-12 V4 A20 20 0 0 1 0 -32 Z" {...s} fill={panel} /><path d="M-8 22 H8" {...s} /></g>,
    news: <g><rect x="-32" y="-24" width="64" height="48" rx="5" {...s} fill={panel} /><path d="M-22 -12 H6 M-22 -2 H22 M-22 8 H22" {...s} /><rect x="10" y="-16" width="12" height="8" {...s} /></g>,
  };
  return <>{items[topic] ?? items.news}</>;
}

export function TopicArt({ topic, person = true, className }: { topic: Topic; person?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  const sc = SCENE[topic] ?? SCENE.news;
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" className={cn("block h-full w-full", className)} aria-hidden>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={sc.a} /><stop offset="1" stopColor={sc.b} />
        </linearGradient>
        <radialGradient id={`${id}glow`}><stop offset="0" stopColor={sc.glow} stopOpacity="0.55" /><stop offset="1" stopColor={sc.glow} stopOpacity="0" /></radialGradient>
        <filter id={`${id}blur`}><feGaussianBlur stdDeviation="2" /></filter>
      </defs>
      <rect width="320" height="180" fill={`url(#${id}bg)`} />
      {/* city / horizon silhouettes */}
      <path d="M0 150 L20 150 L20 128 L34 128 L34 140 L52 140 L52 118 L66 118 L66 146 L90 146 L90 132 L104 132 L104 150 L320 150 L320 180 L0 180 Z" fill="#000" opacity="0.25" />
      <path d="M200 150 L214 150 L214 122 L232 122 L232 138 L250 138 L250 112 L266 112 L266 144 L290 144 L290 128 L306 128 L306 150 Z" fill="#000" opacity="0.2" />
      {/* stars */}
      {[[30, 24], [70, 44], [130, 18], [250, 30], [290, 60], [180, 40], [16, 80]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.2" fill="#fff" opacity="0.6" />)}
      {/* glowing object */}
      <g transform={person ? "translate(224 74)" : "translate(160 86)"}>
        <circle r="62" fill={`url(#${id}glow)`} />
        <g filter={`url(#${id}blur)`} opacity="0.6"><Obj topic={topic} glow={sc.glow} /></g>
        <Obj topic={topic} glow={sc.glow} />
      </g>
      {person && (
        <g transform="translate(22 30) scale(0.82)">
          {/* person at a laptop, seen from behind-left, lit by the screen */}
          <ellipse cx="110" cy="178" rx="90" ry="14" fill="#000" opacity="0.35" />
          <path d="M48 180 C50 140 70 124 100 122 C130 124 150 140 152 180 Z" fill="#17222E" />
          <path d="M100 122 C130 124 150 140 152 180" fill="none" stroke={sc.glow} strokeOpacity="0.55" strokeWidth="2" />
          <circle cx="100" cy="98" r="22" fill="#1E2A36" />
          <path d="M118 92 C121 102 117 112 108 117 C114 108 115 100 112 92 Z" fill="#E7B48A" opacity="0.85" />
          <path d="M78 94 C78 72 98 66 113 73 C122 78 125 87 122 95 C113 86 96 85 78 94 Z" fill="#2A1C14" />
          <path d="M120 92 C122 100 118 112 108 118" fill="none" stroke={sc.glow} strokeOpacity="0.6" strokeWidth="2" />
          {/* laptop */}
          <path d="M142 162 L196 150 L204 176 L148 180 Z" fill="#11161C" stroke={sc.glow} strokeOpacity="0.5" />
          <path d="M150 160 L192 151 L197 168 L154 175 Z" fill={sc.glow} opacity="0.35" />
        </g>
      )}
    </svg>
  );
}
