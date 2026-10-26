import { useId } from "react";

/** Decorative 3D-style illustrations for the scan pages (inline SVG, no text). */

/** A glowing scanner device with a shield and magnifier — Scan & Analyze header. */
export function ScanHeroArt({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 260 170" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}top`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1C4A3D" /><stop offset="1" stopColor="#0C2620" />
        </linearGradient>
        <linearGradient id={`${id}side`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0B231D" /><stop offset="1" stopColor="#051310" />
        </linearGradient>
        <linearGradient id={`${id}screen`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#42F5C5" stopOpacity="0.55" /><stop offset="1" stopColor="#19E6A0" stopOpacity="0.1" />
        </linearGradient>
        <radialGradient id={`${id}glow`}><stop offset="0" stopColor="#19E6A0" stopOpacity="0.55" /><stop offset="1" stopColor="#19E6A0" stopOpacity="0" /></radialGradient>
        <linearGradient id={`${id}shield`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#B8FFE6" /><stop offset="1" stopColor="#19E6A0" />
        </linearGradient>
      </defs>
      <ellipse cx="130" cy="150" rx="110" ry="16" fill={`url(#${id}glow)`} />
      {/* base slab (isometric) */}
      <path d="M40 112 L130 80 L220 112 L130 144 Z" fill={`url(#${id}top)`} stroke="#19E6A0" strokeOpacity="0.35" />
      <path d="M40 112 L130 144 L130 156 L40 124 Z" fill={`url(#${id}side)`} />
      <path d="M220 112 L130 144 L130 156 L220 124 Z" fill="#071A15" />
      {/* grid lines on slab */}
      <g stroke="#42F5C5" strokeOpacity="0.18">
        <path d="M70 101 L160 133 M100 90 L190 122 M70 123 L160 91 M100 133 L190 101" />
      </g>
      {/* tilted screen */}
      <path d="M78 106 L82 30 L178 6 L182 82 Z" fill="#06110F" stroke="#19E6A0" strokeOpacity="0.6" />
      <path d="M86 100 L89 36 L173 15 L176 78 Z" fill={`url(#${id}screen)`} />
      <g stroke="#B8FFE6" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round">
        <path d="M97 52 L130 44 M97 62 L150 49 M97 72 L140 61" />
      </g>
      {/* shield */}
      <g transform="translate(140 50)">
        <circle r="26" fill={`url(#${id}glow)`} />
        <path d="M0 -18 L14 -12 V0 C14 9 8 15 0 19 C-8 15 -14 9 -14 0 V-12 Z" fill={`url(#${id}shield)`} />
        <path d="M-6 0 L-1.5 4.5 L7 -4" stroke="#04281D" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* magnifier */}
      <g transform="translate(206 70)">
        <circle r="17" fill="#42F5C5" fillOpacity="0.08" stroke="#42F5C5" strokeWidth="4" />
        <path d="M12 12 L26 26" stroke="#19E6A0" strokeWidth="7" strokeLinecap="round" />
      </g>
      {/* particles */}
      {[[60, 40], [222, 30], [36, 80], [240, 104], [110, 18]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 2 ? 2 : 1.4} fill="#B8FFE6" opacity="0.7" />
      ))}
    </svg>
  );
}

/** Fishing hook over an envelope — shown on high-risk result headers. */
export function ThreatArt({ className, tone = "#FF5D65" }: { className?: string; tone?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden>
      <defs>
        <radialGradient id={`${id}g`}><stop offset="0" stopColor={tone} stopOpacity="0.4" /><stop offset="1" stopColor={tone} stopOpacity="0" /></radialGradient>
        <linearGradient id={`${id}env`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1A3A32" /><stop offset="1" stopColor="#0A1C17" /></linearGradient>
      </defs>
      <ellipse cx="80" cy="70" rx="70" ry="44" fill={`url(#${id}g)`} />
      <g transform="translate(36 54) rotate(-8)">
        <rect width="84" height="54" rx="6" fill={`url(#${id}env)`} stroke="#42F5C5" strokeOpacity="0.4" />
        <path d="M4 6 L42 32 L80 6" fill="none" stroke="#42F5C5" strokeOpacity="0.6" strokeWidth="2" />
      </g>
      <path d="M96 6 V40 C96 52 82 54 78 46" fill="none" stroke={tone} strokeWidth="4" strokeLinecap="round" />
      <path d="M78 46 L74 38" stroke={tone} strokeWidth="4" strokeLinecap="round" />
      <circle cx="96" cy="6" r="3" fill={tone} />
    </svg>
  );
}
