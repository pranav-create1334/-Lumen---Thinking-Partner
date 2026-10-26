import {
  geminiApiKey,
  geminiModel,
  maxOutputTokens,
  MAX_CONTEXT_MESSAGES,
  getStorageMode,
} from "@/lib/config";
import { MAX_MESSAGE_LENGTH } from "@/lib/validation/chat";

/**
 * GET /api/config — public runtime configuration for the client.
 * Contains no secrets (no API key). Never include the key value here.
 */
export async function GET() {
  const missingApiKey = !geminiApiKey();
  return Response.json(
    {
      storageMode: getStorageMode(),
      model: geminiModel(), // non-sensitive model ID (documented default: gemini-3.5-flash)
      maxMessageLength: MAX_MESSAGE_LENGTH,
      maxContextMessages: MAX_CONTEXT_MESSAGES,
      maxOutputTokens: maxOutputTokens(),
      missingApiKey,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
