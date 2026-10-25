"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BrainCircuit, Check, ChevronRight, CircleDot, GitFork, Globe2, History, KeyRound, Loader2, LockKeyhole, MessageSquareText, Plus, Send, ShieldCheck, Sparkles, X } from "lucide-react";
import type { ChatResponse, MemoryProposal } from "../lib/contracts";

type Message = { role: "user" | "assistant"; content: string };
const EXAMPLES = [
  "Remember that I prefer concise technical summaries.",
  "Help me plan a safe production deployment.",
  "What do you remember about how I work?",
];

export default function GuardianApp({ displayName }: { displayName: string }) {
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: "Good morning. I can help without silently profiling you. If something seems worth remembering, I’ll show the exact proposal and wait for your approval." }]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<MemoryProposal | null>(null);
  const [authorized, setAuthorized] = useState<MemoryProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const firstName = useMemo(() => displayName.split(/[ @]/)[0] || "there", [displayName]);

  useEffect(() => {
    void fetch("/api/memory").then((response) => response.json()).then((data: { memories?: MemoryProposal[] }) => {
      if (Array.isArray(data.memories)) setAuthorized(data.memories);
    }).catch(() => undefined);
  }, []);

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const content = input.trim();
    if (!content || loading) return;
    const nextMessages = [...messages, { role: "user" as const, content }];
    setMessages(nextMessages); setInput(""); setLoading(true); setNotice(null);
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: nextMessages.slice(-8), authorizedMemory: authorized.map((item) => item.statement) }),
      });
      const data = (await response.json()) as ChatResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || "The agent is unavailable.");
      setMessages((current) => [...current, { role: "assistant", content: data.reply }]);
      if (data.proposal) setPending(data.proposal);
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: error instanceof Error ? `I couldn’t reach the model: ${error.message}` : "I couldn’t reach the model. Please try again." }]);
    } finally { setLoading(false); }
  }

  async function authorizeProposal() {
    if (!pending) return;
    setNotice(null);
    const response = await fetch("/api/memory", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(pending) });
    if (!response.ok) { setNotice("Authorization failed. Nothing was stored."); return; }
    setAuthorized((current) => [pending, ...current]); setNotice("Memory authorized. A versioned receipt was created."); setPending(null);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top"><span className="brand-mark"><ShieldCheck size={19} /></span><span>RAME <strong>Guardian</strong></span></a>
        <div className="topbar-center"><span className="live-dot" /> Private workspace</div>
        <nav className="top-actions">
          <a href="https://github.com/caimari" target="_blank" rel="noreferrer"><GitFork size={16} /> GitHub</a>
          <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noreferrer"><KeyRound size={16} /> Apache-2.0</a>
          <span className="avatar">AC</span>
        </nav>
      </header>

      <div className="workspace" id="top">
        <aside className="sidebar">
          <button className="new-thread" type="button"><Plus size={17} /> New thread</button>
          <div className="nav-group"><p>Workspace</p><button className="nav-item active"><MessageSquareText size={17} /> Conversation</button><button className="nav-item"><BrainCircuit size={17} /> Memory <span>{authorized.length}</span></button><button className="nav-item"><History size={17} /> Audit trail</button></div>
          <div className="trust-card"><LockKeyhole size={19} /><div><strong>Your context stays yours</strong><p>No memory is committed without explicit approval.</p></div></div>
          <div className="sidebar-footer"><span>Powered by</span><strong>NVIDIA Nemotron</strong><span>on Nebius Token Factory</span></div>
        </aside>

        <section className="conversation">
          <div className="conversation-head"><div><span className="eyebrow">PERSONAL AI · VERIFIED MEMORY</span><h1>Your agent, with memory you control.</h1></div><span className="model-pill"><Sparkles size={14} /> Nemotron 3.5</span></div>
          <div className="principle-strip"><div><span>01</span><strong>Observed</strong><small>Context is detected</small></div><ChevronRight size={16} /><div><span>02</span><strong>Proposed</strong><small>You see the exact claim</small></div><ChevronRight size={16} /><div><span>03</span><strong>Authorized</strong><small>A signed version is kept</small></div></div>
          <div className="messages" aria-live="polite">
            <div className="day-label">Today</div>
            {messages.map((message, index) => <div className={`message ${message.role}`} key={`${message.role}-${index}`}><span className="message-avatar">{message.role === "assistant" ? <ShieldCheck size={17} /> : firstName.slice(0, 1).toUpperCase()}</span><div><p className="message-name">{message.role === "assistant" ? "Guardian" : firstName}</p><div className="bubble">{message.content}</div></div></div>)}
            {loading && <div className="thinking"><Loader2 size={16} className="spin" /> Nemotron is reasoning…</div>}
            {pending && <article className="proposal-card"><div className="proposal-head"><div><CircleDot size={18} /><span><strong>Memory proposal</strong><small>Nothing has been stored yet</small></span></div><span className="proposal-state">AWAITING YOU</span></div><blockquote>{pending.statement}</blockquote><div className="proposal-meta"><span>Scope <strong>{pending.scope}</strong></span><span>Confidence <strong>{Math.round(pending.confidence * 100)}%</strong></span><span>Source <strong>This conversation</strong></span></div><div className="proposal-actions"><button className="reject" onClick={() => { setPending(null); setNotice("Proposal rejected. Nothing was stored."); }}><X size={16} /> Reject</button><button className="approve" onClick={() => void authorizeProposal()}><Check size={16} /> Authorize memory</button></div></article>}
            {notice && <div className="notice"><ShieldCheck size={16} /> {notice}</div>}
          </div>
          <div className="composer-wrap"><div className="suggestions">{EXAMPLES.map((prompt) => <button key={prompt} onClick={() => setInput(prompt)}>{prompt}</button>)}</div><form className="composer" onSubmit={sendMessage}><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Talk to Guardian…" rows={1} /><button type="submit" disabled={!input.trim() || loading}><Send size={18} /></button></form><p>Guardian may make mistakes. You decide what becomes memory.</p></div>
        </section>

        <aside className="memory-panel">
          <div className="panel-title"><div><BrainCircuit size={18} /><span><strong>Authorized memory</strong><small>{authorized.length} active memories</small></span></div><button>•••</button></div>
          {authorized.length === 0 ? <div className="empty-memory"><span><ShieldCheck size={25} /></span><strong>No silent memory</strong><p>Approved facts will appear here with their origin and version history.</p></div> : authorized.map((item, index) => <article className="memory-item" key={`${item.statement}-${index}`}><div><span className="verified"><Check size={12} /> VERIFIED</span><span className="version">v{index + 1}.0</span></div><p>{item.statement}</p><small>Authorized just now · This conversation</small></article>)}
          <div className="audit-preview"><div className="panel-title"><div><History size={18} /><span><strong>Recent activity</strong><small>Human-readable audit trail</small></span></div></div><ol><li><span className="event-dot green" /><div><strong>Workspace opened</strong><small>Private session · just now</small></div></li><li><span className="event-dot" /><div><strong>Memory policy loaded</strong><small>Explicit authorization required</small></div></li></ol></div>
          <a className="ecosystem-link" href="https://ramesystem.com/" target="_blank" rel="noreferrer"><Globe2 size={16} /><span><strong>Explore the RAME ecosystem</strong><small>Pre-existing work · ramesystem.com</small></span><ChevronRight size={16} /></a>
        </aside>
      </div>
    </main>
  );
}
