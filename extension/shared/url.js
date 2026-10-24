// URL helpers shared by popup, background and options.

export function normalizeUrl(input) {
  const raw = (input || "").trim();
  if (!raw) return "";
  const withScheme = /:\/\//.test(raw) ? raw : `http://${raw}`;
  try {
    const u = new URL(withScheme);
    u.hash = "";
    return u.toString();
  } catch {
    return raw;
  }
}

export function hostOf(input) {
  try {
    const withScheme = /:\/\//.test(input) ? input : `http://${input}`;
    return new URL(withScheme).hostname.toLowerCase();
  } catch {
    return "";
  }
}

// Browser-internal / restricted schemes the extension must not try to analyze.
export function isAnalyzable(url) {
  if (!url) return false;
  return /^https?:\/\//i.test(url);
}

export function originOf(input) {
  try {
    const withScheme = /:\/\//.test(input) ? input : `http://${input}`;
    const u = new URL(withScheme);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "";
  }
}
