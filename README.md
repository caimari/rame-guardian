# RAME Guardian

RAME Guardian is a Personal AI agent that turns untrusted documents into useful work without allowing models, tools, documents, or stale sessions to silently rewrite user-authorized decisions.

This repository is being developed for the Nebius x NVIDIA Global AI Hackathon 2026. NVIDIA Nemotron models are called at runtime through Nebius Token Factory. The deterministic authority engine remains outside the model: Nemotron may observe, plan, and propose, but only an authenticated user can authorize durable decisions.

## Trust model

```text
Untrusted observation -> model proposal -> user authorization -> versioned decision
                                                              -> server-signed receipt
Action request + expected versions -> deterministic policy check -> execute or block
```

## Implemented now

- Human-only authorization with versioned durable decisions.
- Atomic SQLite commits for proposals, decisions, receipts, and audit events.
- Ed25519 server-signed receipts with a public verification key.
- Nemotron document inspection through Nebius Token Factory with an explicit untrusted-data boundary.
- Transactional, idempotent task and calendar execution.
- Constraint enforcement and stale-session rejection at execution time.
- Persistent task, calendar, and human-readable audit outputs.

The web client, production authentication, OpenShell deployment, and broader evaluation suite remain under active development.

## Development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run check
```

To run the API, place the Nebius key in an environment variable without committing it:

```bash
export NEBIUS_API_KEY='...'
npm run start --workspace @rame/agent-server
```

The server listens on `127.0.0.1:8787` by default. The current identity header is intentionally a local-demo stub and must be replaced before public deployment.

## Core API

- `POST /v1/proposals` creates an untrusted decision proposal.
- `POST /v1/proposals/:id/authorize` performs the human authorization transition.
- `POST /v1/agent/inspect-document` asks Nemotron to extract plans while treating document contents as untrusted.
- `POST /v1/actions/execute` checks current decision versions and applies a task/calendar effect in one database transaction.
- `GET /v1/audit` exposes the evidence trail.

See [docs/VERIFICATION.md](docs/VERIFICATION.md) for the gates run against the implementation and the live model.

## License

Apache-2.0. Copyright 2026 Antoni Caimari.
