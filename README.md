# RAME Guardian

RAME Guardian is a Personal AI agent with explicit, versioned, user-authorized memory. It turns durable context into a proposal, shows the exact claim to the user, and persists it only after an affirmative action.

Built for the **Nebius x NVIDIA Global AI Hackathon 2026** using NVIDIA Nemotron through Nebius Token Factory.

## The trust loop

1. **Observed** — the agent detects potentially useful durable context.
2. **Proposed** — the user sees the exact statement, scope, source, and confidence.
3. **Authorized** — an immutable version and SHA-256 receipt are written with an audit event.

## Architecture

- Web client: Next.js-compatible Vinext application
- Agent API: shared HTTP contracts designed for web now and a future VS Code client
- Model: `nvidia/Nemotron-3_5-Lightning`
- Inference: Nebius Token Factory
- Durable storage: Cloudflare D1 with Drizzle ORM
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
