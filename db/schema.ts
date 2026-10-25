import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const memoryVersions = sqliteTable("memory_versions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  statement: text("statement").notNull(),
  scope: text("scope", { enum: ["preference", "workflow", "project"] }).notNull(),
  confidence: real("confidence").notNull(),
  version: integer("version").notNull().default(1),
  digest: text("digest").notNull(),
  source: text("source").notNull().default("conversation"),
  status: text("status", { enum: ["authorized", "revoked"] }).notNull().default("authorized"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  subjectId: text("subject_id").notNull(),
  detail: text("detail").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
