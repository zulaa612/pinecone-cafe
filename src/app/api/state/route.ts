import { getCurrentUser } from "@/lib/auth/dal";
import { getCafeState } from "@/lib/data";

/*orders scoped */
export async function GET() {
  const user = await getCurrentUser();
  const state = await getCafeState(user);
  return Response.json(state, { headers: { "Cache-Control": "private, no-store" } });
}
