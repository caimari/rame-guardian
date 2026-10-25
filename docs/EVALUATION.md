# Comparative evaluation protocol

## Hypothesis

For work that persists across sessions, RAME should adapt existing results to a changed user decision with fewer unnecessary changes, fewer lost human edits, and fewer stale writes than a competent agent that regenerates or edits the same work without RAME's revision mechanism.

## Controlled comparison

Both arms receive:

- The same NVIDIA Nemotron model through Nebius Token Factory.
- The same user request and complete result snapshot.
- The same result contents, identifiers, versions, dependency metadata, and human-edit markers.
- The same system instructions to preserve human edits, stable task identity, completed state, and independent results.
- The same sampling settings and output budget.
- The same field-level model output whenever the execution layer itself is under test.

The reference arm is not intentionally weakened. It can inspect every result, propose alternatives, edit fields, and request approval. Its approved operations are applied like ordinary tool calls.

The RAME arm adds no private semantic facts. It applies the same proposed operations through a provisional revision that protects human-edited fields and completed task state, records reviewed base versions, and checks those versions atomically when applying.

## First isolated case

1. Nemotron receives a 12-hour delivery plan and proposes a six-hour selective repair.
2. The exact same operations are available to both executors.
3. Before application, a second session changes availability to eight hours.
4. The reference executor applies the earlier six-hour operation and overwrites the later edit.
5. RAME rejects the stale revision and preserves the eight-hour edit without a partial write.

This case measures execution semantics rather than language-model quality. It does not claim that every agent framework lacks concurrency controls.

## Product-quality cases

The broader suite will vary:

- Availability while holding deadline fixed.
- Deadline while holding scope fixed.
- A human edit that is compatible with the change.
- A human edit that conflicts with the change.
- A completed task inside an affected result.
- An independent result that must remain untouched.
- An edit arriving after preview but before application.

Reserved cases must not be used to tune the prompts.

## Metrics

- Known consequences updated.
- Independent results modified.
- Human-edited fields preserved.
- Stable task identities and completed states preserved.
- Formal constraints violated.
- Stale or partial writes.
- User corrections and review time.
- Prompt, completion, latency, and estimated inference cost.

The final report will include failures and confidence intervals where the number of repeated model runs makes them meaningful.
