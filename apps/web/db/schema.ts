import { sql } from "drizzle-orm";
import { check, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export const authorityProposals = sqliteTable("authority_proposals", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), decisionKey: text("decision_key").notNull(),
  kind: text("kind").notNull(), valueJson: text("value_json").notNull(), statement: text("statement").notNull(),
  basedOnVersion: integer("based_on_version"), status: text("status").notNull(), sourceRef: text("source_ref").notNull(),
  sourceExcerpt: text("source_excerpt"), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const authorityDecisions = sqliteTable("authority_decisions", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), decisionKey: text("decision_key").notNull(),
  kind: text("kind").notNull(), valueJson: text("value_json").notNull(), statement: text("statement").notNull(),
  version: integer("version").notNull(), previousDecisionId: text("previous_decision_id"), authorizedBy: text("authorized_by").notNull(),
  authorizedAt: integer("authorized_at", { mode: "timestamp_ms" }).notNull(), status: text("status").notNull(),
});

export const authorizationReceipts = sqliteTable("authorization_receipts", {
  id: text("id").primaryKey(), decisionId: text("decision_id").notNull(), userId: text("user_id").notNull(),
  payloadJson: text("payload_json").notNull(), signature: text("signature").notNull(), keyId: text("key_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const signingKeys = sqliteTable("signing_keys", {
  keyId: text("key_id").primaryKey(), privateJwk: text("private_jwk").notNull(), publicJwk: text("public_jwk").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const actionAttempts = sqliteTable("action_attempts", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), requestHash: text("request_hash").notNull(),
  allowed: integer("allowed", { mode: "boolean" }).notNull(), code: text("code").notNull(), responseJson: text("response_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const calendarBlocks = sqliteTable("calendar_blocks", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), actionId: text("action_id").notNull(), title: text("title").notNull(),
  startAt: text("start_at").notNull(), endAt: text("end_at").notNull(), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const workResults = sqliteTable("work_results", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), kind: text("kind").notNull(), title: text("title").notNull(),
  version: integer("version").notNull().default(1), contentJson: text("content_json").notNull(), dependenciesJson: text("dependencies_json").notNull(),
  humanEditedPathsJson: text("human_edited_paths_json").notNull(), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const repairDrafts = sqliteTable("repair_drafts", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), status: text("status").notNull(), changeRequest: text("change_request").notNull(),
  targetDecisionKey: text("target_decision_key").notNull(), targetDecisionVersion: integer("target_decision_version").notNull(),
  targetHours: integer("target_hours").notNull(), baseVersionsJson: text("base_versions_json").notNull(), operationsJson: text("operations_json").notNull(),
  impactJson: text("impact_json").notNull(), modelJson: text("model_json").notNull(), approvalHash: text("approval_hash"),
  approvedAt: integer("approved_at", { mode: "timestamp_ms" }), appliedAt: integer("applied_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const repairApplications = sqliteTable("repair_applications", {
  requestId: text("request_id").primaryKey(), userId: text("user_id").notNull(), draftId: text("draft_id").notNull(),
  requestHash: text("request_hash").notNull(), responseJson: text("response_json").notNull(), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

// A failed assertion makes the whole D1 batch roll back, including every result update.
export const repairAssertions = sqliteTable("repair_assertions", {
  id: text("id").primaryKey(), ok: integer("ok").notNull(), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [check("repair_assertion_must_hold", sql`${table.ok} = 1`)]);
