import { getStorageMode } from "@/lib/config";
import { handleRouteError, logServerError } from "@/lib/api/errors";
import { listConversations } from "@/lib/db/queries";

/**
 * GET /api/conversations — list saved conversations (database mode only).
 * Returns 501 in local-only mode; the client uses localStorage instead.
 */
export async function GET() {
  try {
    if (getStorageMode() !== "db") {
      return Response.json(
        {
          error: {
            code: "LOCAL_ONLY_MODE",
            message:
              "Server-side history is disabled (no DATABASE_URL). Conversations are stored locally in your browser.",
          },
        },
        { status: 501, headers: { "Cache-Control": "no-store" } },
      );
    }
    const conversations = await listConversations();
    return Response.json(
      { conversations },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logServerError("GET /api/conversations", error);
    return handleRouteError("GET /api/conversations", error);
  }
}
