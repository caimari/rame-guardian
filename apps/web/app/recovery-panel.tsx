"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ClipboardCopy, Database, FileCheck2, GitCompareArrows, KeyRound, Loader2, LockKeyhole, RefreshCw, RotateCcw, ShieldCheck, Sparkles, Zap } from "lucide-react";

type Language = "en" | "es";
type WorkResult = { id: string; kind: string; title: string; version: number; content: Record<string, unknown>; dependencies: string[]; humanEditedPaths: string[] };
type Draft = { id: string; status: string; targetDecisionVersion: number; targetHours: number; baseVersions: Record<string, number>; operations: Array<{ resultId: string; reason: string; nextContent: Record<string, unknown> }>; impact: { changed: Array<{ resultId: string; reason: string }>; preserved: string[]; protectedFields: string[]; atomicWrites: number }; model: { model: string; recommendation: { summary: string; selectedAlternative: string; rationale: string; preserved: string[]; risks: string[] } }; approvalHash: string | null; createdAt: number };
type RecoveryState = { decision: null | { id: string; version: number; value: { hours?: number }; statement: string }; results: WorkResult[]; drafts: Draft[]; events: Array<{ id: string; action: string; detail: Record<string, unknown>; created_at: number }>; comparison: Record<"guardian" | "reference", { staleRejected: boolean; atomic: boolean; protectedFields: boolean; recovery: string; evidence: string }> };

const words = {
  en: {
    eyebrow: "RECOVERY STUDIO · LIVE D1 STATE", title: "Recover useful work after authority changes.", intro: "A stale draft is rejected first. Nemotron then proposes the smallest coherent repair; Guardian validates, binds approval to exact versions, and commits once.",
    baseline: "1 · Authorize & seed 12h", old: "2 · Ask Super for 6h draft", approveOld: "3 · Approve old draft", change: "4 · Session B: authorize 8h", reject: "5 · Apply stale draft", refresh: "6 · Recover from current state", approve: "7 · Approve exact repair", apply: "8 · Commit atomically", reload: "Reload durable state", replay: "Repeat same request", concurrent: "Simulate concurrent edit",
    authority: "Current authority", none: "Not initialized", results: "Versioned work results", repair: "Latest repair proposal", comparison: "Fair protected control", trace: "Evidence trace", protected: "Protected", preserved: "Preserved", changed: "Changes", model: "Nemotron recommendation", noDraft: "Generate a draft to inspect its exact impact.", noTrace: "Run the scenario to produce a persistent trace.", copy: "Copy", copied: "Copied", working: "Working…", reset: "Starts a fresh four-result scenario.", reference: "Protected reference", guardian: "RAME Guardian", conflict: "Expected conflict", success: "Committed", proof: "Proof", recovery: "Recovery effort",
  },
  es: {
    eyebrow: "ESTUDIO DE RECUPERACIÓN · ESTADO D1 REAL", title: "Recupera trabajo útil cuando cambia la autoridad.", intro: "Primero se rechaza un borrador obsoleto. Después Nemotron propone la reparación mínima coherente; Guardian valida, liga la aprobación a versiones exactas y confirma una sola vez.",
    baseline: "1 · Autorizar y crear base de 12h", old: "2 · Pedir a Super borrador de 6h", approveOld: "3 · Aprobar borrador antiguo", change: "4 · Sesión B: autorizar 8h", reject: "5 · Aplicar borrador obsoleto", refresh: "6 · Recuperar estado actual", approve: "7 · Aprobar reparación exacta", apply: "8 · Confirmar atómicamente", reload: "Recargar estado duradero", replay: "Repetir la misma solicitud", concurrent: "Simular edición concurrente",
    authority: "Autoridad actual", none: "Sin inicializar", results: "Resultados de trabajo versionados", repair: "Última propuesta de reparación", comparison: "Control protegido equivalente", trace: "Rastro de evidencias", protected: "Protegido", preserved: "Conservado", changed: "Cambios", model: "Recomendación de Nemotron", noDraft: "Genera un borrador para inspeccionar su impacto exacto.", noTrace: "Ejecuta el escenario para producir un rastro persistente.", copy: "Copiar", copied: "Copiado", working: "Procesando…", reset: "Inicia un escenario nuevo con cuatro resultados.", reference: "Control protegido", guardian: "RAME Guardian", conflict: "Conflicto esperado", success: "Confirmado", proof: "Prueba", recovery: "Esfuerzo de recuperación",
  },
};

export default function RecoveryPanel({ language, onAuthorityChanged }: { language: Language; onAuthorityChanged: () => Promise<void> }) {
  const t = words[language];
  const [state, setState] = useState<RecoveryState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const requestIds = useRef<Record<string, string>>({});
  const latest = state?.drafts[0] ?? null;
  const oldDraft = useMemo(() => state?.drafts.find((draft) => draft.targetHours === 6) ?? null, [state]);
  const currentDraft = useMemo(() => state?.drafts.find((draft) => draft.targetHours === 8 && draft.status !== "stale") ?? null, [state]);

  async function load() {
    const response = await fetch("/api/recovery");
    if (!response.ok) throw new Error("Recovery state could not be loaded.");
    setState(await response.json() as RecoveryState);
  }
  useEffect(() => {
    let active = true;
    void fetch("/api/recovery").then(async (response) => {
      if (!response.ok) throw new Error("Recovery state could not be loaded.");
      return response.json() as Promise<RecoveryState>;
    }).then((next) => { if (active) setState(next); }).catch((error) => { if (active) setNotice({ kind: "warn", text: String(error) }); });
    return () => { active = false; };
  }, []);

  async function post(action: string, extra: Record<string, unknown> = {}, allowConflict = false) {
    setBusy(action); setNotice(null);
    try {
      const response = await fetch("/api/recovery", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
      const data = await response.json() as { error?: string; state?: RecoveryState; replayed?: boolean; message?: string };
      if (data.state) setState(data.state);
      else await load();
      if (!response.ok && !allowConflict) throw new Error(data.error ?? "Request failed.");
      if (!response.ok) setNotice({ kind: "warn", text: `${t.conflict}: ${data.error} · partial writes: 0` });
      else setNotice({ kind: "ok", text: data.replayed ? "Idempotent replay: the stored receipt was returned; no duplicate writes." : data.message ?? "Evidence stored successfully." });
      return response.ok;
    } catch (error) {
      setNotice({ kind: "warn", text: error instanceof Error ? error.message : "Request failed." });
      return false;
    } finally { setBusy(null); }
  }

  async function authorize(hours: 12 | 8) {
    setBusy(`authorize-${hours}`); setNotice(null);
    try {
      const proposed = await api("/api/authority", { action: "propose", key: "work.available_hours", kind: "rule", value: { hours }, statement: `I authorize up to ${hours} hours for this delivery.`, sourceRef: `recovery-session-${hours === 12 ? "A" : "B"}` });
      if (!proposed.ok) throw new Error(String(proposed.data.error));
      const proposalId = (proposed.data.proposal as { id: string }).id;
      const approved = await api("/api/authority", { action: "authorize", proposalId });
      if (!approved.ok) throw new Error(String(approved.data.error));
      if (hours === 12) await post("initialize"); else { await load(); setNotice({ kind: "ok", text: "Session B stored a new signed 8-hour authority version." }); }
      await onAuthorityChanged();
    } catch (error) { setNotice({ kind: "warn", text: error instanceof Error ? error.message : "Authorization failed." }); }
    finally { setBusy(null); }
  }

  async function approveDraft(draft: Draft | null) { if (draft) await post("approve", { draftId: draft.id }); }
  async function applyDraft(draft: Draft | null, expectedConflict = false) {
    if (!draft) return;
    const storageKey = `rame-repair-request:${draft.id}`;
    requestIds.current[draft.id] ??= window.localStorage.getItem(storageKey) ?? crypto.randomUUID();
    window.localStorage.setItem(storageKey, requestIds.current[draft.id]);
    await post("apply", { draftId: draft.id, requestId: requestIds.current[draft.id] }, expectedConflict);
  }
  async function copy(value: unknown, id: string) {
    await navigator.clipboard.writeText(typeof value === "string" ? value : JSON.stringify(value, null, 2)).catch(() => undefined);
    setCopied(id); window.setTimeout(() => setCopied(null), 1200);
  }
  const stepBusy = (key: string) => busy === key ? <Loader2 className="spin" size={15} /> : null;

  return <section className="recovery-workspace">
    <header className="recovery-intro">
      <div><p>{t.eyebrow}</p><h2>{t.title}</h2><span>{t.intro}</span></div>
      <div className="recovery-authority"><KeyRound size={18} /><span><small>{t.authority}</small><strong>{state?.decision ? `${state.decision.value.hours}h · v${state.decision.version}` : t.none}</strong></span></div>
    </header>

    <div className="recovery-actions" aria-label="Recovery scenario controls">
      <button onClick={() => void authorize(12)} disabled={!!busy}>{stepBusy("authorize-12")}<Database size={15} />{t.baseline}<small>{t.reset}</small></button>
      <button onClick={() => void post("create_draft", { targetHours: 6, provisional: true })} disabled={!!busy || state?.results.length !== 4}>{stepBusy("create_draft")}<Sparkles size={15} />{t.old}</button>
      <button onClick={() => void approveDraft(oldDraft)} disabled={!!busy || oldDraft?.status !== "pending"}><FileCheck2 size={15} />{t.approveOld}</button>
      <button onClick={() => void authorize(8)} disabled={!!busy || oldDraft?.status !== "approved"}>{stepBusy("authorize-8")}<KeyRound size={15} />{t.change}</button>
      <button className="conflict-button" onClick={() => void applyDraft(oldDraft, true)} disabled={!!busy || oldDraft?.status !== "approved"}><AlertTriangle size={15} />{t.reject}</button>
      <button onClick={() => void post("create_draft", { targetHours: 8, provisional: false })} disabled={!!busy || state?.decision?.value.hours !== 8}><RefreshCw size={15} />{t.refresh}</button>
      <button onClick={() => void approveDraft(currentDraft)} disabled={!!busy || currentDraft?.status !== "pending"}><ShieldCheck size={15} />{t.approve}</button>
      <button className="commit-button" onClick={() => void applyDraft(currentDraft)} disabled={!!busy || currentDraft?.status !== "approved"}><Zap size={15} />{t.apply}</button>
    </div>

    <div className="recovery-utilities">
      <button onClick={() => void load()} disabled={!!busy}><RotateCcw size={14} />{t.reload}</button>
      <button onClick={() => void post("concurrent_edit")} disabled={!!busy || currentDraft?.status !== "approved"}><GitCompareArrows size={14} />{t.concurrent}</button>
      <button onClick={() => void applyDraft(currentDraft)} disabled={!!busy || currentDraft?.status !== "applied"}><RefreshCw size={14} />{t.replay}</button>
    </div>
    {notice && <div className={`recovery-notice ${notice.kind}`} >{notice.kind === "ok" ? <Check size={17} /> : <AlertTriangle size={17} />}<span>{notice.text}</span></div>}

    <div className="recovery-layout">
      <div className="recovery-primary">
        <section className="recovery-section">
          <header><div><p>STATE GRAPH</p><h3>{t.results}</h3></div><CopyMini id="all-results" copied={copied} label={t} onClick={() => void copy(state?.results ?? [], "all-results")} /></header>
          <div className="result-grid">{state?.results.length ? state.results.map((result) => <article className="result-card" key={result.id}>
            <div><span className={`result-kind ${result.kind}`}>{result.kind.replace("_", " ")}</span><strong>v{result.version}</strong></div>
            <h4>{result.title}</h4>
            <pre>{JSON.stringify(result.content, null, 2)}</pre>
            <footer>{result.humanEditedPaths.length ? <span><LockKeyhole size={12} />{result.humanEditedPaths.length} {t.protected.toLowerCase()}</span> : <span><Check size={12} />{t.preserved}</span>}<CopyMini id={result.id} copied={copied} label={t} onClick={() => void copy(result, result.id)} /></footer>
          </article>) : <div className="recovery-empty">{t.reset}</div>}</div>
        </section>

        <section className="recovery-section repair-review">
          <header><div><p>APPROVAL ENVELOPE</p><h3>{t.repair}</h3></div>{latest && <span className={`draft-status ${latest.status}`}>{latest.status} · {latest.targetHours}h</span>}</header>
          {latest ? <div className="repair-content">
            <div className="model-verdict"><Sparkles size={18} /><div><small>{t.model} · {latest.model.model.split("/").pop()}</small><strong>{latest.model.recommendation.summary}</strong><p>{latest.model.recommendation.rationale}</p></div></div>
            <div className="impact-columns"><div><h4>{t.changed}</h4>{latest.impact.changed.map((item) => <p key={item.resultId}><RefreshCw size={13} />{state?.results.find((result) => result.id === item.resultId)?.title ?? item.resultId}: {item.reason}</p>)}</div><div><h4>{t.preserved}</h4>{[...latest.impact.preserved, ...latest.impact.protectedFields].map((item) => <p key={item}><Check size={13} />{item}</p>)}</div></div>
            <footer><code>decision v{latest.targetDecisionVersion} · {Object.keys(latest.baseVersions).length} exact result versions · {latest.impact.atomicWrites} atomic writes</code>{latest.approvalHash && <code>approval {latest.approvalHash.slice(0, 18)}…</code>}<CopyMini id="draft" copied={copied} label={t} onClick={() => void copy(latest, "draft")} /></footer>
          </div> : <div className="recovery-empty">{t.noDraft}</div>}
        </section>

        <section className="recovery-section comparison-card">
          <header><div><p>CONTROL GROUP</p><h3>{t.comparison}</h3></div><GitCompareArrows size={18} /></header>
          <div className="comparison-grid">{state && (["reference", "guardian"] as const).map((key) => <article key={key} className={key === "guardian" ? "featured" : ""}><h4>{key === "guardian" ? t.guardian : t.reference}</h4><dl><div><dt>Stale write</dt><dd>{state.comparison[key].staleRejected ? "Rejected" : "Ready"}</dd></div><div><dt>Atomic</dt><dd>{state.comparison[key].atomic ? "Yes" : "No"}</dd></div><div><dt>{t.protected}</dt><dd>{state.comparison[key].protectedFields ? "Yes" : "No"}</dd></div></dl><p><strong>{t.recovery}</strong>{state.comparison[key].recovery}</p><p><strong>{t.proof}</strong>{state.comparison[key].evidence}</p></article>)}</div>
        </section>
      </div>

      <aside className="recovery-trace">
        <header><ShieldCheck size={18} /><div><p>APPEND-ONLY</p><h3>{t.trace}</h3></div></header>
        {state?.events.length ? <ol>{state.events.map((event) => <li key={event.id}><i className={event.action.includes("stale") ? "warn" : ""} /><div><strong>{event.action.replace("repair.", "").replaceAll("_", " ")}</strong><span>{new Date(event.created_at).toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span><small>{JSON.stringify(event.detail)}</small></div></li>)}</ol> : <div className="recovery-empty">{t.noTrace}</div>}
      </aside>
    </div>
  </section>;
}

async function api(path: string, body: unknown) {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { ok: response.ok, data: await response.json() as Record<string, unknown> };
}

function CopyMini({ id, copied, label, onClick }: { id: string; copied: string | null; label: { copy: string; copied: string }; onClick: () => void }) {
  return <button className="recovery-copy" onClick={onClick} title={label.copy}><ClipboardCopy size={13} />{copied === id ? label.copied : label.copy}</button>;
}
