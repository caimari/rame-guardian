import Database from "better-sqlite3";
import type { AuthorizationCommitResult, AuthorizationReceipt, AuthorizedDecision, AuthorityRepository, DecisionProposal } from "@rame/authority";

type ProposalRow = { payload: string };
type DecisionRow = { payload: string };

export class SqliteAuthorityRepository implements AuthorityRepository {
  readonly db: Database.Database;

  constructor(filename: string) {
    this.db = new Database(filename);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS proposals (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        decision_key TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        decision_key TEXT NOT NULL,
        version INTEGER NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        authorized_at TEXT NOT NULL,
        UNIQUE(owner_id, decision_key, version)
      );
      CREATE TABLE IF NOT EXISTS receipts (
        receipt_id TEXT PRIMARY KEY,
        decision_id TEXT NOT NULL UNIQUE,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_decisions_latest ON decisions(owner_id, decision_key, version DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_owner ON audit_events(owner_id, id DESC);
    `);
  }

  saveProposal(proposal: DecisionProposal) {
    this.db.prepare(`INSERT INTO proposals(id, owner_id, decision_key, status, payload, created_at)
      VALUES(@id, @ownerId, @key, @status, @payload, @createdAt)
      ON CONFLICT(id) DO UPDATE SET status=excluded.status, payload=excluded.payload`).run({ ...proposal, payload: JSON.stringify(proposal) });
  }

  getProposal(id: string): DecisionProposal | null {
    const row = this.db.prepare("SELECT payload FROM proposals WHERE id = ?").get(id) as ProposalRow | undefined;
    return row ? JSON.parse(row.payload) as DecisionProposal : null;
  }

  commitAuthorization(proposal: DecisionProposal, decision: AuthorizedDecision, receipt: AuthorizationReceipt): AuthorizationCommitResult {
    const transaction = this.db.transaction((): AuthorizationCommitResult => {
      const stored = this.db.prepare("SELECT payload FROM proposals WHERE id = ?").get(proposal.id) as ProposalRow | undefined;
      if (!stored || (JSON.parse(stored.payload) as DecisionProposal).status !== "pending") return "proposal_not_pending";
      const latest = this.latestDecision(proposal.ownerId, proposal.key);
      if ((latest?.version ?? null) !== proposal.basedOnVersion) return "proposal_stale";
      this.db.prepare(`INSERT INTO decisions(id, owner_id, decision_key, version, status, payload, authorized_at)
        VALUES(@id, @ownerId, @key, @version, @status, @payload, @authorizedAt)`).run({ ...decision, payload: JSON.stringify(decision) });
      this.db.prepare("UPDATE proposals SET status = ?, payload = ? WHERE id = ?")
        .run(proposal.status, JSON.stringify(proposal), proposal.id);
      this.db.prepare("INSERT INTO receipts(receipt_id, decision_id, payload, created_at) VALUES(?, ?, ?, ?)")
        .run(receipt.payload.receiptId, receipt.payload.decisionId, JSON.stringify(receipt), receipt.payload.authorizedAt);
      this.audit(decision.ownerId, "decision.authorized", decision.id, { key: decision.key, version: decision.version, source: decision.source });
      return "committed";
    });
    return transaction.immediate();
  }

  latestDecision(ownerId: string, key: string): AuthorizedDecision | null {
    const row = this.db.prepare("SELECT payload FROM decisions WHERE owner_id = ? AND decision_key = ? ORDER BY version DESC LIMIT 1").get(ownerId, key) as DecisionRow | undefined;
    return row ? JSON.parse(row.payload) as AuthorizedDecision : null;
  }

  listLatestDecisions(ownerId: string): AuthorizedDecision[] {
    const rows = this.db.prepare(`SELECT d.payload FROM decisions d
      WHERE d.owner_id = ? AND d.status = 'active'
      AND d.version = (SELECT MAX(d2.version) FROM decisions d2 WHERE d2.owner_id = d.owner_id AND d2.decision_key = d.decision_key)
      ORDER BY d.decision_key`).all(ownerId) as DecisionRow[];
    return rows.map((row) => JSON.parse(row.payload) as AuthorizedDecision);
  }

  getReceipt(receiptId: string): AuthorizationReceipt | null {
    const row = this.db.prepare("SELECT payload FROM receipts WHERE receipt_id = ?").get(receiptId) as { payload: string } | undefined;
    return row ? JSON.parse(row.payload) as AuthorizationReceipt : null;
  }

  audit(ownerId: string, eventType: string, subjectId: string, payload: unknown) {
    this.db.prepare("INSERT INTO audit_events(owner_id, event_type, subject_id, payload, created_at) VALUES(?, ?, ?, ?, ?)")
      .run(ownerId, eventType, subjectId, JSON.stringify(payload), new Date().toISOString());
  }

  listAuditEvents(ownerId: string, limit = 100) {
    const rows = this.db.prepare(`SELECT id, event_type AS eventType, subject_id AS subjectId, payload, created_at AS createdAt
      FROM audit_events WHERE owner_id = ? ORDER BY id DESC LIMIT ?`).all(ownerId, limit) as Array<{ id: number; eventType: string; subjectId: string; payload: string; createdAt: string }>;
    return rows.map((row) => ({ ...row, payload: JSON.parse(row.payload) as unknown }));
  }
}
