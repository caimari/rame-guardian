# Nebius submission closure plan

Decision date: 2026-10-29 (Europe/Madrid)

Official deadline: 2026-10-30 18:00 CET (10:00 PDT)

Internal submission deadline: 2026-10-30 14:00 CET

## Frozen decision

RAME Guardian is the Nebius x NVIDIA Global AI Hackathon submission in the Personal AI track.

The central product claim is:

> When a user changes an authorized decision, RAME Guardian repairs the affected work with Nemotron while preserving compatible human edits, completed work, and independent results.

No new product capabilities will be added before submission. Core, Core2, RAME Code, the Meta entry, MCP, VS Code, external integrations, additional models, and long-context experiments are out of scope.

## Current verified assets

- Versioned, user-authorized decisions and Ed25519 receipts.
- Persistent authority, results, audit evidence, and recovery state.
- Nemotron inference through Nebius Token Factory.
- Untrusted-document and prompt-injection boundary.
- Selective repair with human-edit protection and stale-version rejection.
- Atomic and idempotent execution paths.
- Deployed bilingual web application with Conversation, Guardian Lab, and Recovery Studio.
- Fourteen automated tests passing on Node.js 22.
- Live Nemotron verification and documented evaluation protocol.
- Apache-2.0 license and pre-existing-work disclosure.

## Critical path

### Gate 1 — deployed acceptance flow

Owner: Antoni with Codex support

Acceptance criteria:

1. Start from a 12-hour authorized baseline with four stored results.
2. Generate and approve a provisional six-hour repair.
3. Authorize eight hours as a newer decision.
4. Confirm the old repair is rejected with zero partial writes.
5. Generate a new eight-hour repair with Nemotron.
6. Confirm price, accessibility, completed task identity, and independent result are preserved.
7. Approve and apply the repair atomically.
8. Reload the application and recover the final state.
9. Replay the same application request and confirm no duplicate execution.
10. Prepare a repair, introduce a concurrent edit, and confirm rejection.

Evidence to retain: screenshots, exact error/success messages, final versions, trace entries, and any defect found.

### Gate 2 — judge-accessible deployment

Owner: Codex prepares; Antoni authorizes the audience decision

Acceptance criteria:

- The production URL opens from a signed-out browser, or the submission contains working judge credentials and exact instructions.
- A judge can run the demonstrated path without payment or owner assistance.
- The deployed application remains available through the judging period.

Preferred decision: public read/run access with server-side secrets protected.

### Gate 3 — public source repository

Owner: Codex prepares; Antoni creates or authorizes the public GitHub destination

Acceptance criteria:

- Public GitHub, GitLab, or Bitbucket URL.
- Apache-2.0 visible at repository root and in repository metadata.
- Runnable web source, migrations, engine/evaluation source, tests, and required assets are available to judges.
- README is English-first and accurately describes the deployed architecture.
- Node.js 22 is pinned with `.nvmrc` and `engines`.
- A clean clone passes the documented installation, typecheck, tests, and build.
- No secret, private research, Core/Core2 file, or unrelated project history is present.
- `PREEXISTING_WORK.md` and `HACKATHON_WORK.md` clearly distinguish provenance.

Time-box rule: if a single consolidated repository is not ready within four hours, publish the runnable web source as the primary submission repository and the evaluation engine as a clearly linked secondary repository. Do not attempt a risky architectural integration before the deadline.

### Gate 4 — submission documentation

Owner: Codex drafts; Antoni reviews factual claims

Required content:

- Project name and elevator pitch.
- Personal AI track selection.
- Problem, target user, solution, user journey, architecture, and trust boundary.
- Exact role of Nebius Token Factory and NVIDIA Nemotron.
- Significant work completed during the submission period.
- Honest limitations and pre-existing-work disclosure.
- Setup, testing, and judge instructions.
- Feedback on Nebius and NVIDIA tools.
- Demo URL, source URL, and video URL.

Approved elevator pitch:

> A personal AI that repairs its work when user decisions change—without overwriting human edits or trusting hidden instructions.

### Gate 5 — demonstration video

Owner: Antoni records voice and screen; Codex prepares script and shot list

Constraints:

- Public YouTube URL.
- Maximum 2:50 target duration; never exceed three minutes.
- English narration or accurate English subtitles.
- Real production application, not a mockup.
- No unauthorized music, logos, private data, keys, or unrelated browser tabs.

Shot plan:

- 0:00–0:20 — user problem and value proposition.
- 0:20–0:45 — initial plan, proposal, tasks, and protected human edits.
- 0:45–1:15 — newer eight-hour decision invalidates the older repair.
- 1:15–2:05 — Nemotron prepares a selective recovery from current state.
- 2:05–2:30 — review, approval, atomic application, reload, and idempotent replay.
- 2:30–2:50 — architecture, Nebius/NVIDIA role, and final value statement.

### Gate 6 — final Devpost verification and submission

Owner: Antoni, with Codex checklist support

Acceptance criteria:

- All required fields completed in English.
- Demo, repository, and YouTube links tested from a signed-out browser.
- Thumbnail and screenshots render correctly.
- Testing instructions work without private assistance.
- Claims match the actual implementation and evidence.
- Submission completed by 2026-10-30 14:00 CET.

## Operating schedule

### 2026-10-29

1. 05:30–09:00 — run the production acceptance flow and fix only blocking defects.
2. 09:00–13:00 — prepare and publish source repositories; pin Node.js 22.
3. 13:00–15:00 — verify a clean clone, tests, build, license, and secret scan.
4. 15:00–17:00 — make the demo judge-accessible and test signed-out access.
5. 17:00–19:00 — finalize README, Devpost copy, testing instructions, thumbnail, and screenshots.
6. 19:00–21:00 — rehearse and record the production demonstration.
7. 21:00–22:00 — select the final take and prepare upload/subtitles.

### 2026-10-30

1. 07:00–09:00 — upload the public YouTube video and verify playback/subtitles.
2. 09:00–11:00 — complete the Devpost submission.
3. 11:00–12:00 — independent signed-out test of all links and instructions.
4. 12:00–13:00 — factual, license, attribution, and secret review.
5. 13:00–14:00 — submit and retain confirmation evidence.
6. 14:00–18:00 — emergency buffer only; no feature work.

## Stop rules

- Do not add features after scope freeze.
- Do not expose or mention Core/Core2 internals.
- Do not claim the protected-reference comparison is a completed broad benchmark.
- Do not claim document upload, MCP, VS Code, or arbitrary model portability.
- If video editing threatens the deadline, use one clear continuous recording with voiceover.
- If Recovery Studio has a non-critical secondary defect, document it and record the strongest truthful complete path.
- If the demo cannot be made public, provide tested judge access before recording and submission.
- Submit the complete valid entry before polishing optional material.

## Final definition of done

The entry is done only when a signed-out judge can open the demo, understand the value in under thirty seconds, watch a real recovery complete in under three minutes, inspect public source and setup instructions, and reproduce the automated checks with Node.js 22.
