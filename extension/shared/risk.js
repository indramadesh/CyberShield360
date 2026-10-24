// Risk interpretation shared across UI surfaces. Matches the platform's bands.
// Colour is NEVER the only signal — always paired with a label + icon text.

export const RISK = {
  CRITICAL: { label: "Critical Risk", tone: "#f87171", bg: "rgba(248,113,113,0.14)", icon: "⛔" },
  HIGH: { label: "High Risk", tone: "#fb923c", bg: "rgba(251,146,60,0.14)", icon: "⚠" },
  SUSPICIOUS: { label: "Suspicious", tone: "#fbbf24", bg: "rgba(251,191,36,0.14)", icon: "!" },
  LOW: { label: "Low Risk", tone: "#34d399", bg: "rgba(52,211,153,0.14)", icon: "✓" },
  UNKNOWN: { label: "Not analyzed", tone: "#9aa7bd", bg: "rgba(154,167,189,0.14)", icon: "?" },
  UNAVAILABLE: { label: "Analysis unavailable", tone: "#9aa7bd", bg: "rgba(154,167,189,0.14)", icon: "…" },
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
