# RAME Guardian

**A personal AI that repairs its work when user decisions change—without overwriting human edits or trusting hidden instructions.**

[Live demo](https://rame-guardian.elvenchub3.chatgpt.site) · [Verification record](docs/VERIFICATION.md) · [Evaluation protocol](docs/EVALUATION.md)

RAME Guardian is a submission for the **Nebius x NVIDIA Global AI Hackathon 2026**, built for the Personal AI track. It uses NVIDIA Nemotron at runtime through Nebius Token Factory.

Ordinary assistant memory can preserve text while losing an important distinction: what the model observed, what it proposed, and what the user actually authorized. Guardian keeps those states separate. When an authorized decision changes, it identifies affected work, asks Nemotron for a selective repair, preserves compatible human edits and independent results, and applies the approved revision only if every reviewed version is still current.

## Product experience

The deployed application contains three connected workspaces:

1. **Conversation** — Nemotron 3.5 Lightning answers, plans, and may propose one durable memory. Nothing is stored until the user approves the exact proposal.
2. **Guardian Lab** — Nemotron Super extracts useful work from an untrusted document while an external policy gate isolates hidden authorization overrides and blocks stale or unauthorized actions.
3. **Recovery Studio** — a 12-hour delivery plan is revised after the user authorizes a newer eight-hour availability decision. An older six-hour repair is rejected, current state is recovered, and a new selective repair is reviewed and committed atomically.

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

Run strict TypeScript checks, the 14 deterministic engine tests, and web lint/type checks:

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
