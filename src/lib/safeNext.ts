// Where to send someone after sign-in. Only same-site paths survive: a crafted ?next= must never bounce a visitor to
// another site (an open redirect is a phishing tool). Browsers read "/\host" and "/<tab>/host" as "//host", so
// backslashes and control characters are refused too.

/** The ?next= value for the page the visitor is on now. */
export function nextParam(loc: { pathname: string; search: string }): string {
  return encodeURIComponent(loc.pathname + loc.search);
}

/** A decoded, same-site path from a ?next= value, or `fallback`. */
export function safeNext(next: unknown, fallback = "/"): string {
  if (typeof next !== "string" || next === "") return fallback;
  let path: string;
  try {
    path = decodeURIComponent(next);
  } catch {
    return fallback;
  }
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(path)) return fallback;
  return path;
}
