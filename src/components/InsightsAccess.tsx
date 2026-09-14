import { useEffect, useRef, useState } from "react";

interface Props { onAuthenticated: () => void; }

type AccessState = "checking" | "ready" | "verifying" | "locked" | "unconfigured";

export default function InsightsAccess({ onAuthenticated }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pin, setPin] = useState(""); const [state, setState] = useState<AccessState>("checking"); const [message, setMessage] = useState(""); const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const checkSession = async () => {
    try { const response = await fetch("/.netlify/functions/admin-session", { credentials: "same-origin" }); const body = await response.json(); if (body.authenticated) onAuthenticated(); else if (!body.configured) setState("unconfigured"); else { setState("ready"); setTimeout(() => inputRef.current?.focus(), 0); } } catch { setState("unconfigured"); }
  };
  useEffect(() => { void checkSession(); }, []);
  useEffect(() => { if (!lockedUntil) return; const timer = window.setInterval(() => { if (lockedUntil <= Date.now()) { setLockedUntil(null); setState("ready"); setMessage(""); inputRef.current?.focus(); } }, 1000); return () => window.clearInterval(timer); }, [lockedUntil]);
  const submit = async (candidate: string) => {
    if (candidate.length !== 6 || state === "verifying") return;
    setState("verifying"); setMessage("");
    try { const response = await fetch("/.netlify/functions/admin-login", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin: candidate }) }); const body = await response.json(); if (response.ok && body.ok) { onAuthenticated(); return; } if (body.error === "locked" && body.lockedUntil) { setLockedUntil(new Date(body.lockedUntil).getTime()); setState("locked"); setPin(""); return; } setPin(""); setState("ready"); setMessage(body.error === "incorrect_pin" ? `Incorrect access code. ${body.attemptsRemaining} attempts remaining.` : "Unable to verify access right now."); inputRef.current?.focus(); } catch { setPin(""); setState("ready"); setMessage("Unable to verify access right now."); }
  };
  const update = (value: string) => { const digits = value.replace(/\D/g, "").slice(0, 6); setPin(digits); if (digits.length === 6) void submit(digits); };
  const remaining = lockedUntil ? Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000)) : 0;
  return <main className="min-h-screen bg-[#0e0e0e] text-[#f5f5f2] grid place-items-center px-5 py-12"><section className="w-full max-w-md border border-white/10 bg-[#171717] p-6 sm:p-8 animate-fade-up" aria-labelledby="admin-access-title"><p className="font-display text-3xl uppercase tracking-tight">BANG <span className="text-[#858582]">/ Analytics</span></p><div className="border-t border-white/10 mt-8 pt-7"><p className="text-[10px] tracking-[.28em] uppercase font-body text-[#858582]">Admin access</p><h1 id="admin-access-title" className="font-display text-5xl uppercase leading-none mt-3">Secure entry</h1>{state === "unconfigured" ? <p className="font-body text-sm leading-relaxed text-[#b7b7b2] mt-6">Analytics security backend not configured. Set the required server-only environment variables and initialize the admin PIN before access can be granted.</p> : <><p className="font-body text-sm leading-relaxed text-[#b7b7b2] mt-5">Enter the six-digit access code to view protected analytics.</p><div className="relative mt-8"><input ref={inputRef} type="password" inputMode="numeric" autoComplete="one-time-code" aria-label="Six-digit admin access code" disabled={state === "checking" || state === "verifying" || state === "locked"} value={pin} onChange={(event) => update(event.target.value)} className="absolute inset-0 opacity-0 cursor-text" /><div className="grid grid-cols-6 gap-2 pointer-events-none" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <span key={index} className={`h-13 grid place-items-center border text-2xl font-display ${pin[index] ? "border-[#f5f5f2] text-[#f5f5f2]" : "border-white/15 text-[#858582]"}`}>{pin[index] ? "•" : ""}</span>)}</div></div><p aria-live="polite" className={`min-h-5 mt-4 text-xs font-body ${message ? "text-[#d7cec1]" : "text-[#858582]"}`}>{state === "checking" || state === "verifying" ? "Verifying access…" : state === "locked" ? `Access temporarily locked. Try again in ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}.` : message}</p></>}</div></section></main>;
}
