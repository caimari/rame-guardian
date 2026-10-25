# RAME Guardian

RAME Guardian is a Personal AI agent that turns untrusted documents into useful work without allowing models, tools, documents, or stale sessions to silently rewrite user-authorized decisions.

This repository is being developed for the Nebius x NVIDIA Global AI Hackathon 2026. NVIDIA Nemotron models are called at runtime through Nebius Token Factory. The deterministic authority engine remains outside the model: Nemotron may observe, plan, and propose, but only an authenticated user can authorize durable decisions.

## Trust model

```text
Untrusted observation -> model proposal -> user authorization -> versioned decision
                                                              -> server-signed receipt
Action request + expected versions -> deterministic policy check -> execute or block
```

## Status

The first implementation gate covers human-only authorization, Ed25519 receipts, constraint enforcement, and stale-version rejection. The agent server, document workflow, web client, OpenShell integration, and evaluation suite are under active development.

## Development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run check
```

## License

Apache-2.0. Copyright 2026 Antoni Caimari.
