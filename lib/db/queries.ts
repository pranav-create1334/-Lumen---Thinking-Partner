import { asc, desc, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import { AppError, logServerError } from "@/lib/api/errors";
import type { ChatMessage, ChatRole, ConversationSummary } from "@/types/chat";

const DEFAULT_ERROR = new AppError(
  503,
  "DB_UNAVAILABLE",
  "Could not reach the chat history database. Verify PostgreSQL is running and DATABASE_URL is correct, then retry.",
);

function mapDatabaseError(error: unknown): never {
  if (error instanceof AppError) throw error;
  const code = (error as { code?: string; message?: string })?.code ?? "";
  logServerError("db", error);

  if (code === "42P01") {
    throw new AppError(
      500,
      "DB_NOT_MIGRATED",
      'Database tables are missing. Run "npm run db:migrate" (after setting DATABASE_URL) to create them.',
    );
  }
  if (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "08P01" ||
    code === "28000" ||
    code === "28P01" ||
    code === "3D000"
  ) {
    throw DEFAULT_ERROR;
  }
  throw DEFAULT_ERROR;
}

function toConversation(row: typeof conversations.$inferSelect): ConversationSummary {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toMessage(row: typeof messages.$inferSelect): ChatMessage {
  return {
    id: row.id,
    role: row.role as ChatRole,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listConversations(limit = 100): Promise<ConversationSummary[]> {
  try {
    const db = getDatabase();
    if (!db) throw DEFAULT_ERROR;
    const rows = await db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.updatedAt))
      .limit(limit);
    return rows.map(toConversation);
  } catch (error) {
    mapDatabaseError(error);
  }
}

export async function getConversation(id: string): Promise<ConversationSummary | null> {
  try {
    const db = getDatabase();
    if (!db) throw DEFAULT_ERROR;
    const rows = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    return rows[0] ? toConversation(rows[0]) : null;
  } catch (error) {
    mapDatabaseError(error);
  }
}

export async function getMessages(conversationId: string): Promise<ChatMessage[]> {
  try {
    const db = getDatabase();
    if (!db) throw DEFAULT_ERROR;
    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt), asc(messages.id));
    return rows.map(toMessage);
  } catch (error) {
    mapDatabaseError(error);
  }
}

export async function createConversation(title: string): Promise<ConversationSummary> {
  try {
    const db = getDatabase();
    if (!db) throw DEFAULT_ERROR;
    const rows = await db.insert(conversations).values({ title }).returning();
    return toConversation(rows[0]);
  } catch (error) {
    mapDatabaseError(error);
  }
}

export async function renameConversation(id: string, title: string): Promise<ConversationSummary> {
  try {
    const db = getDatabase();
    if (!db) throw DEFAULT_ERROR;
    const rows = await db
      .update(conversations)
      .set({ title, updatedAt: sql`now()` })
      .where(eq(conversations.id, id))
      .returning();
    if (!rows[0]) throw new AppError(404, "CONVERSATION_NOT_FOUND", "That conversation no longer exists.");
    return toConversation(rows[0]);
  } catch (error) {
    mapDatabaseError(error);
  }
}

export async function touchConversation(id: string): Promise<void> {
  try {
    const db = getDatabase();
    if (!db) throw DEFAULT_ERROR;
    await db
      .update(conversations)
      .set({ updatedAt: sql`now()` })
      .where(eq(conversations.id, id));
  } catch (error) {
    mapDatabaseError(error);
  }
}

export async function deleteConversation(id: string): Promise<void> {
  try {
    const db = getDatabase();
    if (!db) throw DEFAULT_ERROR;
    // Messages are removed via ON DELETE CASCADE.
    const rows = await db.delete(conversations).where(eq(conversations.id, id)).returning({ id: conversations.id });
    if (!rows[0]) throw new AppError(404, "CONVERSATION_NOT_FOUND", "That conversation no longer exists.");
  } catch (error) {
    mapDatabaseError(error);
  }
}

export async function saveMessage(
  conversationId: string,
  role: ChatRole,
  content: string,
): Promise<ChatMessage> {
  try {
    const db = getDatabase();
    if (!db) throw DEFAULT_ERROR;
    const rows = await db
      .insert(messages)
      .values({ conversationId, role, content })
      .returning();
    return toMessage(rows[0]);
  } catch (error) {
    mapDatabaseError(error);
  }
}

export async function deleteMessage(id: string): Promise<void> {
  try {
    const db = getDatabase();
    if (!db) throw DEFAULT_ERROR;
    await db.delete(messages).where(eq(messages.id, id));
  } catch (error) {
    mapDatabaseError(error);
  }
}
