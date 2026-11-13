const CERT_CODES = ["UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "DEPTH_ZERO_SELF_SIGNED_CERT", "CERT_HAS_EXPIRED"];

/**
 * Readable error text. Node's fetch only says "fetch failed"; the real reason (DNS, TLS, proxy)
 * is in `cause`, so surface it, with a hint for corporate proxies that Node doesn't trust.
 */
export function describeError(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const cause = (e as Error & { cause?: { code?: string; message?: string } }).cause;
  if (!cause || !/fetch failed|network/i.test(e.message)) return e.message;
  const code = cause.code ?? cause.message ?? "unknown";
  if (CERT_CODES.includes(code)) {
    return `${e.message} (${code}): a network security proxy is intercepting HTTPS. Start the app with NODE_OPTIONS=--use-system-ca npm run dev`;
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return `${e.message} (${code}): no internet connection or DNS is blocked`;
  if (code === "ECONNREFUSED" || code === "ECONNRESET" || code === "UND_ERR_CONNECT_TIMEOUT") return `${e.message} (${code}): the connection was blocked or timed out (firewall or VPN?)`;
  return `${e.message} (${code})`;
}
