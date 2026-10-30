# RAME Guardian

**A personal AI that repairs its work when user decisions change—without overwriting human edits or trusting hidden instructions.**

[Live demo](https://guardian.ramesystem.com) · [Submission video](https://vimeo.com/1241378616) · [Exact judge walkthrough](#exact-recovery-studio-walkthrough) · [Verification record](docs/VERIFICATION.md) · [Evaluation protocol](docs/EVALUATION.md)

RAME Guardian is a submission for the **Nebius x NVIDIA Global AI Hackathon 2026**, built for the Personal AI track. It uses NVIDIA Nemotron at runtime through Nebius Token Factory.

Ordinary assistant memory can preserve text while losing an important distinction: what the model observed, what it proposed, and what the user actually authorized. Guardian keeps those states separate. When an authorized decision changes, it identifies affected work, asks Nemotron for a selective repair, preserves compatible human edits and independent results, and applies the approved revision only if every reviewed version is still current.

## Quick start for judges

The public demo requires **no account, password, API key, or installation**. It uses isolated anonymous sessions and sample data.

1. Open the [live demo](https://guardian.ramesystem.com). Select **Recovery Studio** if it is not already active.
2. Select **Reset demo** in the header. The starting state must say **Not initialized** and highlight only step 1.
3. Press only the highlighted button, in order from **1** through **8**. A check means that the expected step completed; it is not another button to press.
4. After each step, scroll below the controls and inspect **Work and commitments**, **Changed / Preserved**, and **Evidence trace**. The field-by-field guide follows below.
5. At step 5, rejection is the expected success condition: Guardian must show **0 of 4 results changed · 0 partial writes**. Continue with the highlighted step 6.
6. After step 8, confirm that the three authority-dependent results are at `v2`, the independent result remains at `v1`, and the protected commitments are unchanged. Select **Reload durable state** to verify persistence.

Expected outcome: Guardian rejects the obsolete six-hour repair without modifying work, then uses NVIDIA Nemotron through Nebius to prepare a current eight-hour repair. Only the delivery plan, delivery wording, and unfinished training task change. The approved price (`€2,600`), accessibility requirement (`WCAG AAA checkout`), completed architecture audit, and independent research result remain intact.

The two model-assisted draft steps use live inference, so explanatory wording may vary. Authorization, version checks, protected fields, stale rejection, and atomic application are enforced deterministically outside the model. **Advanced tests are optional and are not part of the main walkthrough.**

### Exact Recovery Studio walkthrough

The visible evidence areas have distinct roles:

- **Current authority** is the latest user-authorized availability decision. `12h · v1` means 12 hours, decision version 1.
- **Work and commitments** contains four durable results. A result version changes only after a successful commit.
- **Changed / Preserved** shows the exact proposed or committed content changes and the commitments that must remain intact.
- **Evidence trace** is the append-only sequence of baseline, draft, approval, rejection, and application events.
- **Fair protected control** is supporting context for the final comparison; it does not need to be reread after every step.

`pending` means proposed but not approved. `approved` means the exact draft was authorized but has not changed durable work. `stale` means its reviewed assumptions are obsolete and it was rejected. `applied` means the approved repair was committed.

#### 1 — Authorize and seed the 12-hour baseline

Select **1 · Authorize & seed 12h**. Confirm:

- **Current authority:** `12h · v1`.
- **Delivery plan v1:** 12 hours; allocation `Core build · 6h`, `Validation · 3h`, `Demo · 3h`; mode `full`.
- **Client proposal v1:** price `€2,600`; accessibility `WCAG AAA checkout`; full scope by October 30.
- **Execution board v1:** Architecture audit is `done`; checkout and training are `todo`.
- **Independent research note v1:** `reviewed · No availability dependency`.
- **Evidence trace:** `Baseline Initialized`.

These are the commitments Guardian must keep coherent. The price is a user-approved edit, accessibility is a required condition, the audit is completed work, and the research note is independent of availability.

#### 2 — Ask Nemotron for an old six-hour draft

Select **2 · Ask Super for 6h draft** and wait for live inference. In **Changed / Preserved**, confirm:

- Status: `pending · 6h`.
- The preview reduces the plan, narrows the delivery wording, and defers unfinished training.
- Price, accessibility, completed audit, and independent research remain unchanged.
- All four durable results are still `v1`.
- **Evidence trace:** `Draft Created`.

Nemotron has proposed a repair, but no durable work has been changed.

#### 3 — Approve the old draft

Select **3 · Approve old draft**. Confirm:

- Status changes to `approved · 6h`.
- **Evidence trace** adds `Draft Approved` with an approval hash.
- Every durable result remains at `v1` with unchanged content.

Approval binds the exact proposal to the reviewed decision and result versions; it still does not execute it.

#### 4 — Authorize the newer eight-hour decision

Select **4 · Session B: authorize 8h**. Confirm:

- **Current authority** advances to `8h · v2`.
- The approved six-hour draft still targets decision `v1`.
- All four work products remain at `v1`.

The older repair is now obsolete even though it was valid when approved.

#### 5 — Attempt the obsolete repair

Select **5 · Apply stale draft**. Rejection is the expected success condition; a completed check on step 5 means the protection test passed. Confirm:

- The notice says the obsolete draft was rejected before execution.
- **Changed / Preserved:** `0 of 4 results changed · 0 partial writes` and `No work was modified`.
- **Evidence trace:** `Stale Rejected`.
- Every result remains at `v1`; authority remains `8h · v2`.

Guardian rechecked current authority at execution time and rejected the entire stale operation.

#### 6 — Recover from the current state

Select **6 · Recover from current state** and wait for Nemotron. Confirm that the new draft is `pending · 8h` and targets decision snapshot `v2`.

**Changed** previews exactly three affected results:

- Delivery plan: `12 → 8` hours; allocation `6/3/3 → 4/2/2`; mode `full → focused`.
- Client proposal: only the delivery commitment changes to focused scope with asynchronous training.
- Execution board: unfinished training changes `todo → async` and moves outside the critical delivery path.

**Preserved** must show:

- Approved price: `€2,600`.
- Accessibility: `WCAG AAA checkout`.
- Completed work: `Architecture audit · done`.
- Independent result: `reviewed · No availability dependency`.

All four durable results must still be `v1`; this is a reviewed preview, not a write. **Evidence trace** adds a new `Draft Created` event.

#### 7 — Approve the exact current repair

Select **7 · Approve exact repair**. Confirm:

- Status: `approved · 8h`.
- The same exact changes and preserved commitments remain visible.
- **Evidence trace:** a new `Draft Approved` event.
- All durable work remains at `v1`.

The user has authorized this exact repair against decision `v2` and the reviewed base versions, but it has not been committed yet.

#### 8 — Commit atomically

Select **8 · Commit atomically**. Confirm:

- The guide says `8 / 8 — Scenario complete`.
- The notice says `Selective repair committed atomically`.
- Delivery plan is `v2`, with 8 hours and allocation `4/2/2`.
- Client proposal is `v2`, with updated delivery wording but the same price and accessibility requirement.
- Execution board is `v2`, with the audit still `done` and training now asynchronous.
- Independent research remains unchanged at `v1`.
- **Changed / Preserved** now describes the verified result after commit.
- **Evidence trace:** `Applied`, with three atomic writes.

Exactly the three authority-dependent results changed together. Select **Reload durable state** and confirm that the same final versions and values remain after the server reads them again. Reload does not rerun the model or create another repair.

## Product experience

The deployed application contains three connected workspaces:

1. **Conversation** — Nemotron 3.5 Lightning answers, plans, and may propose one durable memory. Nothing is stored until the user approves the exact proposal.
2. **Guardian Lab** — Nemotron Super extracts useful work from an untrusted document while an external policy gate isolates hidden authorization overrides and blocks stale or unauthorized actions.
3. **Recovery Studio** — a 12-hour delivery plan is revised after the user authorizes a newer eight-hour availability decision. An older six-hour repair is rejected, current state is recovered, and a new selective repair is reviewed and committed atomically.

The public evaluation build starts in Recovery Studio and requires no account. Each browser receives a random, short-lived, HttpOnly session cookie; only its SHA-256 digest is stored. Every data route validates that server-side session before reading or writing D1. The header includes a session-scoped reset, and model calls are limited per session and globally to protect the shared Nebius evaluation budget.

## What the recovery demonstrates

The acceptance scenario uses four durable results:

- A delivery plan.
- A client proposal with a human-edited price and accessibility requirement.
- A task board with stable task identities and completed work.
- An independent research result that must remain unchanged.

Nemotron receives the current authorized decision, result versions, dependencies, and protected fields. Guardian validates the proposed repair, binds approval to the exact reviewed versions, and commits every related update in one transaction. A concurrent edit makes the repair stale and causes zero partial writes. Replaying the same application request returns the stored receipt without duplicating work.

## Trust boundary

```text
untrusted observation
        │
        ▼
Nemotron proposal ──► deterministic validation ──► user review
                                                       │
                                                       ▼
                                            version-bound approval
                                                       │
                                                       ▼
                                atomic policy check and durable commit
```

Nemotron interprets documents, explains consequences, and proposes repairs. It cannot authorize a durable decision, bypass protected fields, or directly commit an action. Those transitions are enforced outside the model.

## Architecture

```text
Browser
  │
  ├── Conversation / Guardian Lab / Recovery Studio
  │
  ▼
Vinext application on Cloudflare Workers
  ├── Nebius Token Factory
  │     ├── nvidia/Nemotron-3_5-Lightning
  │     └── nvidia/nemotron-3-super-120b-a12b
  ├── D1 durable state and atomic batches
  ├── version and protected-field policy gates
  └── Ed25519 authorization receipts and audit evidence

Local evaluation engine
  ├── Fastify agent API
  ├── SQLite authority and revision workspace
  └── deterministic and live-model verification suites
```

The production path is implemented in [`apps/web`](apps/web). The local engine under [`packages/authority`](packages/authority) and [`services/agent`](services/agent) provides a separately runnable API and reproducible evaluation harness for the same trust model. Both implementations and their tests are included in this repository; neither depends on private RAME research systems.

## Repository layout

```text
apps/web/                 deployed web application, D1 schema and migrations
packages/authority/       versioned authorization engine and receipts
services/agent/           local API, Nebius client and revision workspace
tests/                    deterministic acceptance and comparison tests
scripts/                  live Nemotron selective-repair gate
docs/                     verification, evaluation and submission records
```

## Requirements

- Node.js **22.13 or newer**. The tested version is pinned in [`.nvmrc`](.nvmrc).
- npm 10 or newer.
- A Nebius Token Factory API key for live inference.

Use Node 22 before installing. Native SQLite dependencies are compiled for the active Node ABI.

```bash
nvm use
npm ci
```

## Verify the complete repository

Run strict TypeScript checks, the 17 automated engine tests, and web lint/type checks:

```bash
npm run check
```

Build the production web application:

```bash
npm run build
```

No API key is required for deterministic tests or the production build.

## Run the local agent API

Keep the real key outside Git:

```bash
export NEBIUS_API_KEY='replace-locally'
npm run start --workspace @rame/agent-server
```

The API listens on `127.0.0.1:8787` by default. Its principal routes are:

- `POST /v1/proposals`
- `POST /v1/proposals/:id/authorize`
- `POST /v1/agent/inspect-document`
- `POST /v1/agent/plan-repair`
- `POST /v1/actions/execute`
- `POST /v1/results/:id/human-edit`
- `POST /v1/repairs/prepare`
- `POST /v1/repairs/:id/apply`
- `GET /v1/audit`

## Run the web application locally

The hosted application uses Cloudflare bindings and keeps `NEBIUS_API_KEY` server-side. For local UI development:

```bash
cd apps/web
npm run dev
```

Provide local secrets only through an ignored `.dev.vars` or environment configuration. Do not commit `.dev.vars`, `.env`, private keys, database files, or credentials. D1 schema changes are defined in [`apps/web/db/schema.ts`](apps/web/db/schema.ts) and generated into [`apps/web/drizzle`](apps/web/drizzle).

## Live Nemotron gate

The optional live gate consumes Token Factory credits:

```bash
export NEBIUS_API_KEY='replace-locally'
npm run test:live-repair
```

The recorded passing run used `nvidia/nemotron-3-super-120b-a12b`, returned two alternatives and four field-level operations, preserved both human edits and completed task state, and left the independent result unchanged. See [docs/VERIFICATION.md](docs/VERIFICATION.md) for exact evidence and limitations.

## Security and privacy notes

- Model output is always untrusted until validated.
- Documents cannot create user authorization.
- Runtime secrets never enter browser bundles or Git history.
- Anonymous evaluation sessions are isolated in D1 and cannot select their own user identifier.
- Nebius calls have hourly per-session and global limits; deterministic actions remain available without consuming model credits.
- Approved repairs are tied to decision and result versions.
- D1 batch failure rolls back the complete repair.
- The project does not contain or call Core, Core2, RAME Code, or other private research systems.

This is a hackathon prototype, not a claim of complete production security. The comparative evaluation isolates specific execution semantics and is not presented as a broad benchmark of all agent frameworks.

## Hackathon provenance

The RAME name and earlier private research predate the event. This repository is a clean, independently runnable hackathon implementation. See:

- [PREEXISTING_WORK.md](PREEXISTING_WORK.md)
- [HACKATHON_WORK.md](HACKATHON_WORK.md)

## License

Apache-2.0. Copyright 2026 Antoni Caimari.
