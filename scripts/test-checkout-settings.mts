import assert from "node:assert/strict";
import test from "node:test";
import { resolveCheckoutSettings } from "../src/lib/payments/checkout-settings";
import { WireClient, WireError } from "../src/lib/payments/wire-core";

const credentials = { WIRE_API_KEY: "fixture-key", WIRE_QPAY_OPERATOR_ID: "qpay" };
const vercel = { ...credentials, NODE_ENV: "production", VERCEL: "1", VERCEL_ENV: "production" };
const notConfigured = (error: unknown) => error instanceof WireError && error.code === "not_configured";

test("Vercel checkout without APP_URL sends Wire returns to the customer's actual host", async () => {
  for (const host of ["pinecone-cafe.vercel.app", "cafe.example.test", "cafe-git-fix-team.vercel.app", "xn--caf-dma.example.test"]) {
    const settings = resolveCheckoutSettings({
      ...vercel,
      VERCEL_URL: "cafe-build-team.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "cafe.example.test",
    }, new Headers({ host, origin: "https://unrelated.example.test" }));
    assert.deepEqual(settings, { appUrl: `https://${host}`, operatorId: "qpay" });

    const request: typeof fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      for (const field of ["success_url", "cancel_url"]) {
        const url = new URL(body[field]);
        assert.equal(url.origin, `https://${host}`);
        assert.equal(url.searchParams.get("payment_order"), "PP-123456");
      }
      assert.equal(new URL(body.success_url).searchParams.get("payment"), "return");
      assert.equal(new URL(body.cancel_url).searchParams.get("payment"), "canceled");
      return Response.json({
        id: "cs_fixture", payment_intent: "pi_fixture", status: "open",
        url: "https://pay.wire.mn/c/cs_fixture",
      });
    };
    await new WireClient(credentials.WIRE_API_KEY, request)
      .createCheckout("pi_fixture", settings.appUrl, "PP-123456", "fixture:checkout");
  }
});

test("explicit APP_URL keeps precedence and normalizes to an origin", () => {
  const result = resolveCheckoutSettings({ ...vercel, APP_URL: " https://shop.example.test/menu?tab=coffee " },
    new Headers({ host: "cafe.vercel.app" }));
  assert.deepEqual(result, { appUrl: "https://shop.example.test", operatorId: "qpay" });
});

test("Vercel URL fallbacks separate production and preview deployments", () => {
  const env = { ...vercel, VERCEL_URL: "cafe-build.vercel.app", VERCEL_PROJECT_PRODUCTION_URL: "cafe.example.test" };
  assert.equal(resolveCheckoutSettings(env, new Headers()).appUrl, "https://cafe.example.test");
  assert.equal(resolveCheckoutSettings({ ...env, VERCEL_ENV: "preview" }, new Headers()).appUrl, "https://cafe-build.vercel.app");
  assert.equal(resolveCheckoutSettings({ ...vercel, VERCEL_URL: env.VERCEL_URL }, new Headers()).appUrl, "https://cafe-build.vercel.app");
  assert.throws(() => resolveCheckoutSettings({ ...vercel, VERCEL_ENV: "preview", VERCEL_PROJECT_PRODUCTION_URL: "cafe.example.test" }, new Headers()), notConfigured);
});

test("invalid explicit URLs fail with a payment configuration error", () => {
  for (const APP_URL of ["not-a-url", "http://shop.example.test", "ftp://shop.example.test", "https://user:password@shop.example.test"]) {
    assert.throws(() => resolveCheckoutSettings({ ...vercel, APP_URL }, new Headers({ host: "cafe.vercel.app" })), notConfigured);
  }
});

test("Vercel hosts cannot inject credentials, paths, protocols or host lists", () => {
  for (const host of ["https://cafe.vercel.app", "cafe.vercel.app/evil", "cafe.vercel.app?redirect=evil", "user@cafe.vercel.app", "cafe.vercel.app,evil.example.test", "cafe.vercel.app\\evil"]) {
    assert.throws(() => resolveCheckoutSettings(vercel, new Headers({ host })), notConfigured);
    assert.throws(() => resolveCheckoutSettings({ ...vercel, VERCEL_URL: host }, new Headers()), notConfigured);
  }
});

test("other production hosts still need APP_URL and cannot use request origins", () => {
  const env = { ...credentials, NODE_ENV: "production" };
  assert.throws(() => resolveCheckoutSettings(env, new Headers({ host: "cafe.example.test", origin: "https://cafe.example.test" })), notConfigured);
  assert.deepEqual(resolveCheckoutSettings({ ...env, APP_URL: "https://cafe.example.test" }, new Headers()), {
    appUrl: "https://cafe.example.test", operatorId: "qpay",
  });
});

test("development infers only localhost origins, including with vercel dev", () => {
  for (const origin of ["http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000"]) {
    const result = resolveCheckoutSettings({ ...credentials, NODE_ENV: "development", VERCEL: "1", VERCEL_ENV: "development" }, new Headers({ origin }));
    assert.equal(result.appUrl, origin);
  }
  for (const origin of ["https://remote.example.test", "invalid", "null"]) {
    assert.throws(() => resolveCheckoutSettings(credentials, new Headers({ origin })), notConfigured);
  }
});

test("missing Wire credentials still prevent checkout", () => {
  for (const missing of [{ WIRE_API_KEY: "" }, { WIRE_QPAY_OPERATOR_ID: " " }]) {
    assert.throws(() => resolveCheckoutSettings({ ...vercel, ...missing }, new Headers({ host: "cafe.vercel.app" })), notConfigured);
  }
});
