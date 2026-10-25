"use client";

import { FormEvent, useState } from "react";
import { BrainCircuit, Check, CircleDot, Copy, Loader2, MessageSquareText, Send, ShieldCheck, X } from "lucide-react";
import type { ChatResponse, MemoryProposal } from "../lib/contracts";

type Message = { role: "user" | "assistant"; content: string };

const words = {
  en: {
    title: "Conversation", eyebrow: "FAST PERSONAL AGENT", status: "Nemotron 3.5 Lightning",
    intro: "Ask for help, plan work, or tell Guardian a durable preference. Nothing becomes memory until you approve the exact proposal.",
    greeting: "Good morning. I can help without silently profiling you. If something seems worth remembering, I’ll show the exact proposal and wait for your approval.",
    placeholder: "Talk to Guardian…", working: "Nemotron is responding…", proposal: "Decision proposal", pending: "Nothing has been stored", awaiting: "AWAITING YOU",
    reject: "Reject", authorize: "Authorize decision", authorized: "Decision authorized. Its signed version is now available to the agent.", rejected: "Proposal rejected. Nothing was stored.",
    error: "I couldn’t reach the agent", helper: "Guardian may make mistakes. You decide what becomes durable authority.",
    suggestions: ["Remember that I prefer concise technical summaries.", "Help me plan a safe production deployment.", "What do you remember about how I work?"],
  },
  es: {
    title: "Conversación", eyebrow: "AGENTE PERSONAL RÁPIDO", status: "Nemotron 3.5 Lightning",
    intro: "Pide ayuda, planifica trabajo o comunica una preferencia duradera. Nada pasa a memoria hasta que apruebas la propuesta exacta.",
    greeting: "Buenos días. Puedo ayudarte sin perfilarte en silencio. Si algo merece recordarse, te mostraré la propuesta exacta y esperaré tu autorización.",
    placeholder: "Habla con Guardian…", working: "Nemotron está respondiendo…", proposal: "Propuesta de decisión", pending: "Todavía no se ha guardado nada", awaiting: "ESPERANDO TU DECISIÓN",
    reject: "Rechazar", authorize: "Autorizar decisión", authorized: "Decisión autorizada. Su versión firmada ya está disponible para el agente.", rejected: "Propuesta rechazada. No se ha guardado nada.",
    error: "No pude contactar con el agente", helper: "Guardian puede equivocarse. Tú decides qué se convierte en autoridad duradera.",
    suggestions: ["Recuerda que prefiero resúmenes técnicos concisos.", "Ayúdame a planificar un despliegue seguro.", "¿Qué recuerdas sobre cómo trabajo?"],
  },
};

export default function ConversationPanel({
  language,
  displayName,
  authorizedStatements,
  onAuthorized,
}: {
  language: "en" | "es";
  displayName: string;
  authorizedStatements: string[];
  onAuthorized: (verified: boolean) => Promise<void>;
}) {
  const t = words[language];
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [proposal, setProposal] = useState<MemoryProposal | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const firstName = displayName.split(/[ @]/)[0] || "You";
  const visibleMessages: Message[] = messages.length ? messages : [{ role: "assistant", content: t.greeting }];

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const content = input.trim();
    if (!content || loading) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next); setInput(""); setLoading(true); setNotice(null); setProposal(null);
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: next.slice(-8), authorizedMemory: authorizedStatements }) });
      const data = await response.json() as ChatResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || t.error);
      setMessages((current) => [...current, { role: "assistant", content: data.reply }]);
      setProposal(data.proposal);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : t.error;
      setMessages((current) => [...current, { role: "assistant", content: `${t.error}: ${detail}.` }]);
    } finally { setLoading(false); }
  }

  async function authorize() {
    if (!proposal || loading) return;
    setLoading(true); setNotice(null);
    try {
      const sourceExcerpt = [...messages].reverse().find((item) => item.role === "user")?.content;
      const proposed = await post("/api/authority", { action: "propose", key: proposal.key, kind: proposal.kind, value: proposal.value, statement: proposal.statement, sourceRef: "guardian-conversation", sourceExcerpt });
      if (!proposed.ok) throw new Error(String(proposed.data.error));
      const proposalId = (proposed.data.proposal as { id: string }).id;
      const authorized = await post("/api/authority", { action: "authorize", proposalId });
      if (!authorized.ok) throw new Error(String(authorized.data.error));
      await onAuthorized(authorized.data.receiptVerified === true);
      setProposal(null); setNotice(t.authorized);
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Authorization failed."); }
    finally { setLoading(false); }
  }

  async function copyText(value: string, key: string) {
    await navigator.clipboard.writeText(value).catch(() => undefined);
    setCopied(key); window.setTimeout(() => setCopied(null), 1200);
  }

  return <section className="conversation-workspace">
    <article className="guardian-card conversation-card">
      <header><div className="guardian-icon"><MessageSquareText size={19} /></div><div><p>{t.eyebrow}</p><h2>{t.title}</h2></div><span className="guardian-status ok">{t.status}</span></header>
      <div className="conversation-trust"><ShieldCheck size={16} /><span>{t.intro}</span></div>
      <div className="chat-messages" aria-live="polite">
        {visibleMessages.map((message, index) => <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
          <span className="chat-avatar">{message.role === "assistant" ? <ShieldCheck size={17} /> : firstName.slice(0, 1).toUpperCase()}</span>
          <div><small>{message.role === "assistant" ? "Guardian" : firstName}</small><div className="chat-bubble"><span>{message.content}</span><button onClick={() => void copyText(message.content, `message-${index}`)} aria-label="Copy message">{copied === `message-${index}` ? <Check size={14} /> : <Copy size={14} />}</button></div></div>
        </div>)}
        {loading && <div className="chat-thinking"><Loader2 className="spin" size={16} />{t.working}</div>}
        {proposal && <article className="chat-proposal">
          <header><div><CircleDot size={17} /><span><strong>{t.proposal}</strong><small>{t.pending}</small></span></div><em>{t.awaiting}</em></header>
          <blockquote>{proposal.statement}</blockquote>
          <dl><div><dt>Key</dt><dd>{proposal.key}</dd></div><div><dt>Scope</dt><dd>{proposal.scope}</dd></div><div><dt>Confidence</dt><dd>{Math.round(proposal.confidence * 100)}%</dd></div></dl>
          <footer><button className="chat-reject" onClick={() => { setProposal(null); setNotice(t.rejected); }}><X size={16} />{t.reject}</button><button className="guardian-primary" onClick={() => void authorize()}><Check size={16} />{t.authorize}</button></footer>
        </article>}
        {notice && <div className="chat-notice"><ShieldCheck size={16} />{notice}</div>}
      </div>
      <div className="chat-composer-wrap">
        <div className="chat-suggestions">{t.suggestions.map((suggestion) => <button key={suggestion} onClick={() => setInput(suggestion)}>{suggestion}</button>)}</div>
        <form className="chat-composer" onSubmit={sendMessage}><textarea rows={1} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder={t.placeholder} /><button disabled={!input.trim() || loading} type="submit"><Send size={18} /></button></form>
        <p>{t.helper}</p>
      </div>
    </article>
    <div className="conversation-capabilities"><div><BrainCircuit size={17} /><span><strong>{authorizedStatements.length} authorized decisions</strong><small>Only signed versions enter model context</small></span></div><div><ShieldCheck size={17} /><span><strong>No silent memory</strong><small>Model output remains a proposal</small></span></div></div>
  </section>;
}

async function post(path: string, body: unknown) {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { ok: response.ok, data: await response.json() as Record<string, unknown> };
}
