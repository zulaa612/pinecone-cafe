import { getCurrentUser } from "@/lib/auth/dal";
import { getCafeState } from "@/lib/data";

/** Single read endpoint for the storefront and dashboard. Response is scoped to the caller's session. */
export async function GET() {
  const user = await getCurrentUser();
  const state = await getCafeState(user);
  return Response.json(state, { headers: { "Cache-Control": "no-store" } });
}
