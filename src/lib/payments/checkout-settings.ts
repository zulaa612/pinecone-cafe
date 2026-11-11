import { WireError } from "./wire-core";

type Environment = Readonly<Record<string, string | undefined>>;
type RequestHeaders = Pick<Headers, "get">;

function appOrigin(value: string, production: boolean) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password
      || (production && url.protocol !== "https:")) throw new Error();
    return url.origin;
  } catch {
    throw new WireError("not_configured");
  }
}

function vercelOrigin(host: string) {
  // Vercel domains are hostnames, never URLs, paths or forwarded-host lists.
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(host)) {
    throw new WireError("not_configured");
  }
  return appOrigin(`https://${host}`, true);
}

/** Resolve at request time so hosted checkout returns to the guest cookie's host. */
export function resolveCheckoutSettings(env: Environment, requestHeaders: RequestHeaders) {
  const operatorId = env.WIRE_QPAY_OPERATOR_ID?.trim();
  if (!env.WIRE_API_KEY?.trim() || !operatorId) throw new WireError("not_configured");

  const production = env.NODE_ENV === "production";
  const configuredUrl = env.APP_URL?.trim();
  if (configuredUrl) return { appUrl: appOrigin(configuredUrl, production), operatorId };

  if (env.VERCEL === "1" && env.VERCEL_ENV !== "development") {
    // Vercel routes Host to this deployment, including custom and preview aliases.
    // Do not derive a production redirect from an arbitrary Origin header.
    const host = requestHeaders.get("host")?.trim();
    const fallback = env.VERCEL_ENV === "production"
      ? env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || env.VERCEL_URL?.trim()
      : env.VERCEL_URL?.trim();
    const domain = host || fallback;
    if (domain) return { appUrl: vercelOrigin(domain), operatorId };
  }

  if (!production) {
    const origin = requestHeaders.get("origin");
    if (origin) {
      const appUrl = appOrigin(origin, false);
      if (["localhost", "127.0.0.1", "[::1]"].includes(new URL(appUrl).hostname)) {
        return { appUrl, operatorId };
      }
    }
  }
  throw new WireError("not_configured");
}
