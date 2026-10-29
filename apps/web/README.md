# RAME Guardian

RAME Guardian is a Personal AI agent with explicit, versioned, user-authorized decisions. It extracts useful work from untrusted documents without allowing models, tools, documents, or stale sessions to silently rewrite user authority.

Built for the **Nebius x NVIDIA Global AI Hackathon 2026** using NVIDIA Nemotron through Nebius Token Factory.

## The trust loop

1. **Observed** — Nemotron reads a document as untrusted evidence.
2. **Proposed** — model output remains a proposal, never authorization.
3. **Authorized** — only the authenticated user creates a versioned decision and Ed25519 receipt.
4. **Executed** — every protected action checks the latest decision version and constraints.
5. **Evidenced** — allowed and blocked attempts appear in a human-readable audit trail.

## Architecture

- Web client: Next.js-compatible Vinext application
- Agent API: shared HTTP contracts designed for web now and a future VS Code client
- Model: `nvidia/nemotron-3-super-120b-a12b`
- Inference: Nebius Token Factory
- Durable storage: Cloudflare D1 with Drizzle ORM
- Receipts: server-side Ed25519 signatures with a persistent public verification key
- Identity: ChatGPT identity headers on the private hosted build

The `NEBIUS_API_KEY` is a server-side deployment secret. It is never sent to the browser or committed to source control.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run db:generate
npm run dev
```

Configure `NEBIUS_API_KEY` only through your local secret environment or hosting secret manager.

## Project boundaries

This repository contains the hackathon project. The wider [RAME ecosystem](https://ramesystem.com/) predates the event and is linked for background only; it is not presented as hackathon work. See `PREEXISTING_WORK.md`.

## Author and license

Copyright 2026 Antoni Caimari. Licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0). Source profile: [github.com/caimari](https://github.com/caimari).
