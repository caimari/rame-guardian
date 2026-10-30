"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, Check, ClipboardCopy, Database, FileCheck2, GitCompareArrows, KeyRound, Loader2, LockKeyhole, RefreshCw, RotateCcw, ShieldCheck, Sparkles, Zap } from "lucide-react";

type Language = "en" | "es";
type WorkResult = { id: string; kind: string; title: string; version: number; content: Record<string, unknown>; dependencies: string[]; humanEditedPaths: string[] };
type RepairOperation = { resultId: string; reason: string; beforeContent?: Record<string, unknown>; nextContent: Record<string, unknown> };
type Draft = { id: string; status: string; targetDecisionVersion: number; targetHours: number; baseVersions: Record<string, number>; operations: RepairOperation[]; impact: { changed: Array<{ resultId: string; reason: string }>; preserved: string[]; protectedFields: string[]; atomicWrites: number }; model: { model: string; recommendation: { summary: string; selectedAlternative: string; rationale: string; preserved: string[]; risks: string[] } }; approvalHash: string | null; createdAt: number };
type RecoveryState = { decision: null | { id: string; version: number; value: { hours?: number }; statement: string }; results: WorkResult[]; drafts: Draft[]; events: Array<{ id: string; action: string; detail: Record<string, unknown>; created_at: number }>; comparison: Record<"guardian" | "reference", { staleRejected: boolean; atomic: boolean; protectedFields: boolean; recovery: string; evidence: string }> };

const words = {
  en: {
    eyebrow: "RECOVERY STUDIO · LIVE D1 STATE", title: "Protect commitments when decisions change.", intro: "Guardian repairs only authority-dependent work, while preserving approved human edits, completed work, and independent results.",
    baseline: "1 · Authorize & seed 12h", old: "2 · Ask Super for 6h draft", approveOld: "3 · Approve old draft", change: "4 · Session B: authorize 8h", reject: "5 · Apply stale draft", refresh: "6 · Recover from current state", approve: "7 · Approve exact repair", apply: "8 · Commit atomically", reload: "Reload durable state", replay: "Repeat same request", concurrent: "Simulate concurrent edit",
    authority: "Current authority", none: "Not initialized", results: "Work and commitments", repair: "Changed / Preserved", comparison: "Fair protected control", trace: "Evidence trace", protected: "Protected", preserved: "Preserved", changed: "Changed", model: "Nemotron recommendation", noDraft: "Generate a draft to inspect its exact impact.", noTrace: "Run the scenario to produce a persistent trace.", copy: "Copy", copied: "Copied", working: "Working…", reset: "Starts a fresh four-result scenario.", reference: "Protected reference", guardian: "RAME Guardian", conflict: "Expected conflict", success: "Committed", proof: "Proof", recovery: "Recovery effort",
    proposedImpact: "Proposed impact", committedImpact: "Verified result after commit", rejectedImpact: "Verified result after stale rejection", proposedChanges: "Content Guardian will update", committedChanges: "Content Guardian updated", rejectedChanges: "No work was modified", preservedCommitments: "Human work and valid results kept intact", noWrites: "0 of 4 results changed · 0 partial writes", noWritesDetail: "The obsolete 6-hour draft was rejected before execution. Every result remains at its original version.", blockedDetail: "The 6-hour plan, proposal, and task changes were not applied.", userApproved: "USER-APPROVED EDIT", requiredCondition: "REQUIRED CONDITION", completedWork: "COMPLETED WORK", independentResult: "INDEPENDENT RESULT", unchanged: "Unchanged", decisionSnapshot: "Exact decision snapshot",
    nextStep: "Next step", clickHighlighted: "Press only the highlighted button. Completed steps are marked with a check.", scenarioComplete: "Scenario complete", reviewResult: "Review Changed / Preserved below, then reload the durable state.", done: "Completed", click: "Click now", afterComplete: "Verification after step 8", advanced: "Advanced tests (optional)", staleConfirmed: "Protection confirmed: the obsolete draft was rejected before execution. No results changed and there were 0 partial writes. Continue with highlighted step 6.",
  },
  es: {
    eyebrow: "ESTUDIO DE RECUPERACIÓN · ESTADO D1 REAL", title: "Protege compromisos cuando cambian las decisiones.", intro: "Guardian repara solo el trabajo dependiente de la autoridad y conserva las ediciones humanas aprobadas, el trabajo terminado y los resultados independientes.",
    baseline: "1 · Autorizar y crear base de 12h", old: "2 · Pedir a Super borrador de 6h", approveOld: "3 · Aprobar borrador antiguo", change: "4 · Sesión B: autorizar 8h", reject: "5 · Aplicar borrador obsoleto", refresh: "6 · Recuperar estado actual", approve: "7 · Aprobar reparación exacta", apply: "8 · Confirmar atómicamente", reload: "Recargar estado duradero", replay: "Repetir la misma solicitud", concurrent: "Simular edición concurrente",
    authority: "Autoridad actual", none: "Sin inicializar", results: "Trabajo y compromisos", repair: "Cambiado / Conservado", comparison: "Control protegido equivalente", trace: "Rastro de evidencias", protected: "Protegido", preserved: "Conservado", changed: "Cambiado", model: "Recomendación de Nemotron", noDraft: "Genera un borrador para inspeccionar su impacto exacto.", noTrace: "Ejecuta el escenario para producir un rastro persistente.", copy: "Copiar", copied: "Copiado", working: "Procesando…", reset: "Inicia un escenario nuevo con cuatro resultados.", reference: "Control protegido", guardian: "RAME Guardian", conflict: "Conflicto esperado", success: "Confirmado", proof: "Prueba", recovery: "Esfuerzo de recuperación",
    proposedImpact: "Impacto propuesto", committedImpact: "Resultado verificado tras confirmar", rejectedImpact: "Resultado verificado tras el rechazo obsoleto", proposedChanges: "Contenido que Guardian actualizará", committedChanges: "Contenido que Guardian actualizó", rejectedChanges: "No se modificó ningún trabajo", preservedCommitments: "Trabajo humano y resultados válidos intactos", noWrites: "0 de 4 resultados cambiados · 0 escrituras parciales", noWritesDetail: "El borrador obsoleto de 6 horas se rechazó antes de ejecutarse. Todos los resultados conservan su versión original.", blockedDetail: "Los cambios de 6 horas del plan, la propuesta y las tareas no se aplicaron.", userApproved: "EDICIÓN APROBADA", requiredCondition: "CONDICIÓN OBLIGATORIA", completedWork: "TRABAJO COMPLETADO", independentResult: "RESULTADO INDEPENDIENTE", unchanged: "Sin cambios", decisionSnapshot: "Instantánea exacta de la decisión",
    nextStep: "Siguiente paso", clickHighlighted: "Pulsa únicamente el botón destacado. Los pasos completados llevan una marca.", scenarioComplete: "Escenario completado", reviewResult: "Revisa Cambiado / Conservado y después recarga el estado duradero.", done: "Completado", click: "Pulsa ahora", afterComplete: "Verificación después del paso 8", advanced: "Pruebas avanzadas (opcionales)", staleConfirmed: "Protección confirmada: el borrador obsoleto se rechazó antes de ejecutarse. Ningún resultado cambió y hubo 0 escrituras parciales. Continúa con el paso 6 destacado.",
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
  const resultById = useMemo(() => new Map((state?.results ?? []).map((result) => [result.id, result])), [state]);
  const staleVersionsUnchanged = latest?.status === "stale" && state?.results.every((result) => latest.baseVersions[result.id] === result.version);
  const currentStep = useMemo(() => {
    if (!state?.decision || state.results.length !== 4) return 1;
    if (!oldDraft) return 2;
    if (oldDraft.status === "pending") return 3;
    if (oldDraft.status === "approved" && state.decision.value.hours !== 8) return 4;
    if (oldDraft.status === "approved" && state.decision.value.hours === 8) return 5;
    if (oldDraft.status === "stale" && !currentDraft) return 6;
    if (currentDraft?.status === "pending") return 7;
    if (currentDraft?.status === "approved") return 8;
    if (currentDraft?.status === "applied") return 9;
    return 1;
  }, [currentDraft, oldDraft, state]);
  const stepLabels = [t.baseline, t.old, t.approveOld, t.change, t.reject, t.refresh, t.approve, t.apply];
  const stepClass = (step: number, extra = "") => `${extra} ${currentStep === step ? "current-step" : ""} ${currentStep > step ? "completed-step" : ""}`.trim();
  const stepIcon = (step: number, icon: ReactNode) => currentStep > step ? <Check size={15} /> : icon;

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
      if (!response.ok) setNotice({ kind: "ok", text: t.staleConfirmed });
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
      <div className="recovery-authority" aria-label={`${t.authority}: ${state?.decision ? `${state.decision.value.hours}h, version ${state.decision.version}` : t.none}`}><KeyRound size={18} /><div><small>{t.authority}</small><strong>{state?.decision ? `${state.decision.value.hours}h · v${state.decision.version}` : t.none}</strong></div></div>
    </header>

    <div className={`recovery-guide ${currentStep === 9 ? "complete" : ""}`}><span>{currentStep === 9 ? "8 / 8" : `${currentStep} / 8`}</span><div><strong>{currentStep === 9 ? t.scenarioComplete : `${t.nextStep}: ${stepLabels[currentStep - 1]}`}</strong><p>{currentStep === 9 ? t.reviewResult : t.clickHighlighted}</p></div></div>

    <div className="recovery-actions" aria-label="Recovery scenario controls">
      <button className={stepClass(1)} aria-current={currentStep === 1 ? "step" : undefined} onClick={() => void authorize(12)} disabled={!!busy || currentStep !== 1}>{stepBusy("authorize-12")}{stepIcon(1, <Database size={15} />)}{t.baseline}<small>{currentStep > 1 ? t.done : t.click}</small></button>
      <button className={stepClass(2)} aria-current={currentStep === 2 ? "step" : undefined} onClick={() => void post("create_draft", { targetHours: 6, provisional: true })} disabled={!!busy || currentStep !== 2}>{stepBusy("create_draft")}{stepIcon(2, <Sparkles size={15} />)}{t.old}<small>{currentStep > 2 ? t.done : currentStep === 2 ? t.click : ""}</small></button>
      <button className={stepClass(3)} aria-current={currentStep === 3 ? "step" : undefined} onClick={() => void approveDraft(oldDraft)} disabled={!!busy || currentStep !== 3}>{stepIcon(3, <FileCheck2 size={15} />)}{t.approveOld}<small>{currentStep > 3 ? t.done : currentStep === 3 ? t.click : ""}</small></button>
      <button className={stepClass(4)} aria-current={currentStep === 4 ? "step" : undefined} onClick={() => void authorize(8)} disabled={!!busy || currentStep !== 4}>{stepBusy("authorize-8")}{stepIcon(4, <KeyRound size={15} />)}{t.change}<small>{currentStep > 4 ? t.done : currentStep === 4 ? t.click : ""}</small></button>
      <button className={stepClass(5, "conflict-button")} aria-current={currentStep === 5 ? "step" : undefined} onClick={() => void applyDraft(oldDraft, true)} disabled={!!busy || currentStep !== 5}>{stepIcon(5, <AlertTriangle size={15} />)}{t.reject}<small>{currentStep > 5 ? t.done : currentStep === 5 ? t.click : ""}</small></button>
      <button className={stepClass(6)} aria-current={currentStep === 6 ? "step" : undefined} onClick={() => void post("create_draft", { targetHours: 8, provisional: false })} disabled={!!busy || currentStep !== 6}>{stepIcon(6, <RefreshCw size={15} />)}{t.refresh}<small>{currentStep > 6 ? t.done : currentStep === 6 ? t.click : ""}</small></button>
      <button className={stepClass(7)} aria-current={currentStep === 7 ? "step" : undefined} onClick={() => void approveDraft(currentDraft)} disabled={!!busy || currentStep !== 7}>{stepIcon(7, <ShieldCheck size={15} />)}{t.approve}<small>{currentStep > 7 ? t.done : currentStep === 7 ? t.click : ""}</small></button>
      <button className={stepClass(8, "commit-button")} aria-current={currentStep === 8 ? "step" : undefined} onClick={() => void applyDraft(currentDraft)} disabled={!!busy || currentStep !== 8}>{stepIcon(8, <Zap size={15} />)}{t.apply}<small>{currentStep > 8 ? t.done : currentStep === 8 ? t.click : ""}</small></button>
    </div>

    <div className="recovery-utilities">
      <span>{t.afterComplete}</span><button onClick={() => void load()} disabled={!!busy || currentStep !== 9}><RotateCcw size={14} />{t.reload}</button>
      <details><summary>{t.advanced}</summary><div><button onClick={() => void post("concurrent_edit")} disabled={!!busy || currentDraft?.status !== "approved"}><GitCompareArrows size={14} />{t.concurrent}</button><button onClick={() => void applyDraft(currentDraft)} disabled={!!busy || currentDraft?.status !== "applied"}><RefreshCw size={14} />{t.replay}</button></div></details>
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
            <div className={`impact-proof ${latest.status}`}>
              <div className="impact-proof-heading"><span>{latest.status === "stale" ? t.rejectedImpact : latest.status === "applied" ? t.committedImpact : t.proposedImpact}</span><strong>{t.decisionSnapshot} · v{latest.targetDecisionVersion}</strong></div>
              {staleVersionsUnchanged && <div className="zero-write-proof"><ShieldCheck size={25} /><div><strong>{t.noWrites}</strong><p>{t.noWritesDetail}</p></div></div>}
              <div className="impact-proof-grid">
                <section className="changed-proof"><header><RefreshCw size={17} /><div><small>{t.changed}</small><h4>{latest.status === "stale" ? t.rejectedChanges : latest.status === "applied" ? t.committedChanges : t.proposedChanges}</h4></div></header>
                  {latest.status === "stale" ? <div className="blocked-change"><AlertTriangle size={18} /><span>{t.blockedDetail}</span></div> : latest.operations.map((operation) => <OperationDiff key={operation.resultId} operation={operation} result={resultById.get(operation.resultId)} language={language} />)}
                </section>
                <section className="preserved-proof"><header><ShieldCheck size={17} /><div><small>{t.preserved}</small><h4>{t.preservedCommitments}</h4></div></header><PreservedCommitments draft={latest} results={state?.results ?? []} language={language} labels={t} /></section>
              </div>
            </div>
            <div className="model-verdict"><Sparkles size={18} /><div><small>{t.model} · {latest.model.model.split("/").pop()}</small><strong>{latest.model.recommendation.summary}</strong><p>{latest.model.recommendation.rationale}</p></div></div>
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

type ImpactLabels = typeof words.en;
type FieldDiff = { label: string; before: unknown; after: unknown };

function OperationDiff({ operation, result, language }: { operation: RepairOperation; result?: WorkResult; language: Language }) {
  const diffs = meaningfulDiffs(result?.kind, operation.beforeContent ?? result?.content ?? {}, operation.nextContent, language);
  return <article className="operation-diff"><div className="operation-title"><strong>{result?.title ?? operation.resultId}</strong><span>{operation.reason}</span></div>{diffs.map((diff) => <div className="field-diff" key={diff.label}><small>{diff.label}</small><div><code>{displayValue(diff.before)}</code><ArrowRight size={13} /><code>{displayValue(diff.after)}</code></div></div>)}</article>;
}

function PreservedCommitments({ draft, results, language, labels }: { draft: Draft; results: WorkResult[]; language: Language; labels: ImpactLabels }) {
  const operationFor = (kind: string) => draft.operations.find((operation) => results.find((result) => result.id === operation.resultId)?.kind === kind);
  const proposal = operationFor("proposal");
  const board = operationFor("task_board");
  const reference = results.find((result) => result.kind === "reference");
  const audit = taskById(board?.nextContent ?? board?.beforeContent, "task-audit");
  const cards = [
    { badge: labels.userApproved, title: language === "es" ? "Precio aprobado" : "Approved price", value: proposal?.nextContent.price ?? proposal?.beforeContent?.price ?? "€2,600" },
    { badge: labels.requiredCondition, title: language === "es" ? "Accesibilidad" : "Accessibility", value: proposal?.nextContent.accessibility ?? proposal?.beforeContent?.accessibility ?? "WCAG AAA checkout" },
    { badge: labels.completedWork, title: language === "es" ? "Auditoría de arquitectura" : "Architecture audit", value: audit ? `${String(audit.title)} · ${String(audit.status)}` : "Architecture audit · done" },
    { badge: labels.independentResult, title: reference?.title ?? "Independent research note", value: reference ? `${String(reference.content.status)} · ${String(reference.content.conclusion)}` : "reviewed · No availability dependency" },
  ];
  return <div className="commitment-list">{cards.map((card) => <article key={card.badge}><span>{card.badge}</span><strong>{card.title}</strong><div><code>{displayValue(card.value)}</code><em><Check size={11} />{labels.unchanged}</em></div></article>)}</div>;
}

function meaningfulDiffs(kind: string | undefined, before: Record<string, unknown>, after: Record<string, unknown>, language: Language): FieldDiff[] {
  const label = (en: string, es: string) => language === "es" ? es : en;
  if (kind === "plan") return [
    { label: label("Available work", "Trabajo disponible"), before: before.availableHours, after: after.availableHours },
    { label: label("Time allocation", "Distribución del tiempo"), before: before.allocation, after: after.allocation },
    { label: label("Delivery mode", "Modo de entrega"), before: before.deliveryMode, after: after.deliveryMode },
  ];
  if (kind === "proposal") return [{ label: label("Delivery commitment", "Compromiso de entrega"), before: before.deliveryNote, after: after.deliveryNote }];
  if (kind === "task_board") {
    const oldTask = taskById(before, "task-training");
    const newTask = taskById(after, "task-training");
    return [
      { label: label("Team training", "Formación del equipo"), before: oldTask?.status, after: newTask?.status },
      { label: label("Critical path", "Ruta crítica"), before: label("Included", "Incluida"), after: newTask?.note },
    ];
  }
  return [];
}

function taskById(content: Record<string, unknown> | undefined, id: string) {
  const tasks = content && Array.isArray(content.tasks) ? content.tasks : [];
  return tasks.find((task) => task && typeof task === "object" && (task as Record<string, unknown>).id === id) as Record<string, unknown> | undefined;
}

function displayValue(value: unknown) {
  if (Array.isArray(value)) return value.map(String).join(" / ");
  if (value === undefined || value === null || value === "") return "—";
  return String(value);
}
