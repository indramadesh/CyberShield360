// Risk interpretation shared across UI surfaces. Matches the platform's bands.
// Colour is NEVER the only signal — always paired with a label + icon text.

const svg = (d) =>
  `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

// `icon` is static SVG markup (no emoji) — safe to insert as HTML.
export const RISK = {
  CRITICAL: { label: "Critical Risk", tone: "#FF5D65", bg: "rgba(255,93,101,0.14)", icon: svg('<path d="M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9Z"/><path d="M12 8v4M12 16h.01"/>') },
  HIGH: { label: "High Risk", tone: "#FF8B4D", bg: "rgba(255,139,77,0.14)", icon: svg('<path d="M12 2.5 4 6v6c0 5 3.4 8.6 8 9.5 4.6-.9 8-4.5 8-9.5V6Z"/><path d="M12 8v4M12 16h.01"/>') },
  SUSPICIOUS: { label: "Suspicious", tone: "#FFBD59", bg: "rgba(255,189,89,0.14)", icon: svg('<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4M12 17h.01"/>') },
  LOW: { label: "Low Risk", tone: "#19E6A0", bg: "rgba(25,230,160,0.14)", icon: svg('<circle cx="12" cy="12" r="10"/><path d="m8.5 12 2.5 2.5 4.5-5"/>') },
  UNKNOWN: { label: "Not analyzed", tone: "#9BB8AD", bg: "rgba(155,184,173,0.14)", icon: svg('<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>') },
  UNAVAILABLE: { label: "Analysis unavailable", tone: "#9BB8AD", bg: "rgba(155,184,173,0.14)", icon: svg('<circle cx="12" cy="12" r="10"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>') },
};

export function riskMeta(level) {
  return RISK[(level || "UNKNOWN").toUpperCase()] || RISK.UNKNOWN;
}

// A LOW result is NOT a safety guarantee — the UI must say so.
export function safetyCaveat(level) {
  const l = (level || "").toUpperCase();
  if (l === "LOW") return "No known malicious indicators were found. This does not guarantee the site is safe.";
  if (l === "UNKNOWN" || l === "UNAVAILABLE") return "This destination has not been analyzed. Proceed with caution.";
  return "Treat this destination with caution and verify through official channels.";
}
