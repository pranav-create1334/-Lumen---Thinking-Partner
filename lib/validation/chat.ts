import { z } from "zod";

export const MAX_MESSAGE_LENGTH = 6000;
export const MAX_TITLE_LENGTH = 200;
export const MAX_HISTORY_MESSAGES = 60;

export const conversationIdSchema = z.string().uuid("Invalid conversation id format.");

const messagePartSchema = z.object({
  role: z.enum(["user", "assistant"], {
    errorMap: () => ({ message: "Role must be either 'user' or 'assistant'." }),
  }),
  content: z
    .string({ errorMap: () => ({ message: "Message content must be a string." }) })
    .min(1, "Message content cannot be empty.")
    .max(MAX_MESSAGE_LENGTH, `Message content must be at most ${MAX_MESSAGE_LENGTH} characters.`),
});

/**
 * POST /api/chat request body.
 *
 * Two mutually exclusive call shapes:
 *  1. Database mode: { conversationId?, message } or { conversationId, regenerate: true }
 *     – the server is the source of truth and loads history itself.
 *  2. Local-only mode (no DATABASE_URL): { messages } – the full validated
 *     turn list ending with the new user message; the server does not persist.
 */
export const chatRequestSchema = z
  .object({
    conversationId: conversationIdSchema.optional(),
    message: messagePartSchema.shape.content
      .transform((value) => value.trim())
      .pipe(z.string().min(1, "Message cannot be empty."))
      .optional(),
    regenerate: z.boolean().optional(),
    messages: z.array(messagePartSchema).max(MAX_HISTORY_MESSAGES).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasMessages = Array.isArray(value.messages);
    const hasMessage = typeof value.message === "string";

    if (hasMessages && value.conversationId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["messages"],
        message: "Provide either `messages` (local mode) or `conversationId` (database mode), not both.",
      });
    }

    if (value.regenerate) {
      if (!value.conversationId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["conversationId"],
          message: "Regenerating requires a saved conversationId.",
        });
      }
      if (hasMessage) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["message"],
          message: "Regenerating cannot be combined with a new message.",
        });
      }
      if (hasMessages) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["messages"],
          message: "Regenerating cannot be combined with `messages`.",
        });
      }
      return;
    }

    if (hasMessages) {
      const last = value.messages![value.messages!.length - 1];
      if (!last || last.role !== "user") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["messages"],
          message: "The message list must end with the new user message.",
        });
      }
      return;
    }

    if (!hasMessage) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["message"],
        message: "A `message` is required.",
      });
    }
  });

export const renameConversationSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title cannot be empty.")
      .max(MAX_TITLE_LENGTH, `Title must be at most ${MAX_TITLE_LENGTH} characters.`),
  })
  .strict();

export const uuidParamSchema = z.object({ id: conversationIdSchema });

export function firstZodIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "The request could not be validated.";
}
