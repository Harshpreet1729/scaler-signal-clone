"use client";

import { useEffect, useState, type FormEvent } from "react";
import Messenger from "./messenger/messenger";
import { Icon } from "./messenger/icons";
import type { Profile } from "./messenger/types";

type SignedIn = { user: Profile; csrf_token: string; expires_at: number };
const avatars = ["sky", "fern", "sun", "clay"] as const;

class AuthError extends Error {
  constructor(message: string, readonly code: string) { super(message); }
}
async function api<T>(path: string, body?: unknown, csrf?: string): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: body === undefined ? undefined : { "Content-Type": "application/json", ...(csrf ? { "X-CSRF-Token": csrf } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new AuthError(data.error?.message ?? "Request failed. Try again.", data.error?.code ?? "REQUEST");
  return data as T;
}

export default function Onboarding({ restoreSession }: { restoreSession: boolean }) {
  const [signedIn, setSignedIn] = useState<SignedIn | null>(null);
  const [loading, setLoading] = useState(restoreSession);
  const [mode, setMode] = useState<"register" | "login">("register");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState<string>("sky");
  const [otp, setOtp] = useState("");
  const [challenge, setChallenge] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!restoreSession) return;
    let active = true;
    api<SignedIn>("/api/auth/me").then((data) => { if (active) setSignedIn(data); })
      .catch((problem) => { if (active && problem.code !== "UNAUTHENTICATED") setError(problem.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [restoreSession]);

  function chooseMode(next: "register" | "login") {
    setMode(next); setChallenge(null); setOtp(""); setError("");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const id = challenge ?? (await api<{ challenge_id: string }>("/api/auth/challenges", { username, purpose: mode })).challenge_id;
      setChallenge(id);
      const body = { challenge_id: id, otp, ...(mode === "register" ? { display_name: displayName, avatar_key: avatar } : {}) };
      setSignedIn(await api<SignedIn>("/api/auth/" + mode, body));
      setOtp(""); setChallenge(null);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not sign in.");
      if (problem instanceof AuthError && problem.code === "CHALLENGE_ENDED") setChallenge(null);
    } finally { setBusy(false); }
  }
  async function logout() {
    if (!signedIn) return;
    setBusy(true); setError("");
    try {
      await api("/api/auth/logout", {}, signedIn.csrf_token);
      setSignedIn(null); setUsername(""); setDisplayName(""); setChallenge(null);
    } catch (problem) {
      if (problem instanceof AuthError && problem.code === "UNAUTHENTICATED") setSignedIn(null);
      else setError(problem instanceof Error ? problem.message : "Could not log out.");
    } finally { setBusy(false); }
  }

  if (loading) return <main className="auth-loading"><Icon name="chat" size={44} /><p role="status">Restoring your session…</p></main>;
  if (signedIn) return <Messenger profile={signedIn.user} csrf={signedIn.csrf_token} onLogout={logout} busy={busy} error={error} />;

  return (
    <main className="auth-page">
      <header className="auth-brand"><span className="auth-symbol"><Icon name="chat" size={34} /></span><h1>Signal</h1><p>A Signal-inspired messaging demo</p></header>
      <section className="auth-card" aria-label="Demo account">
          <nav className="modes" aria-label="Account action">
            <button type="button" aria-pressed={mode === "register"} onClick={() => chooseMode("register")} disabled={busy}>Register</button>
            <button type="button" aria-pressed={mode === "login"} onClick={() => chooseMode("login")} disabled={busy}>Log in</button>
          </nav>
          <p id="demo-help" className="notice">Demo only: use OTP <strong>123456</strong>. Anyone can access a demo username. Use fictitious details.</p>
          <form onSubmit={submit} aria-describedby="demo-help">
            <label htmlFor="username">Username</label>
            <input id="username" value={username} onChange={(event) => { setUsername(event.target.value); setChallenge(null); }}
              required minLength={3} maxLength={32} pattern="[A-Za-z0-9_]{3,32}" autoComplete="username" autoCapitalize="none" spellCheck={false} disabled={busy} />
            <p className="hint">3–32 ASCII letters, numbers or underscores; case insensitive.</p>
            {mode === "register" && <>
              <label htmlFor="display-name">Display name</label>
              <input id="display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={80} autoComplete="nickname" disabled={busy} />
              <fieldset disabled={busy}>
                <legend>Choose an avatar</legend>
                <div className="avatars">{avatars.map((key) => (
                  <label key={key} className="avatar-choice">
                    <input type="radio" name="avatar" value={key} checked={avatar === key} onChange={() => setAvatar(key)} />
                    <img src={"/avatars/" + key + ".svg"} width="44" height="44" alt="" />
                    <span>{key[0].toUpperCase() + key.slice(1)}</span>
                  </label>
                ))}</div>
              </fieldset>
            </>}
            <label htmlFor="otp">Demo OTP</label>
            <input id="otp" value={otp} onChange={(event) => setOtp(event.target.value)} required pattern="[0-9]{6}" minLength={6} maxLength={6} inputMode="numeric" autoComplete="one-time-code" disabled={busy} />
            <button className="submit" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "register" ? "Create demo account" : "Sign in"}</button>
            {mode === "login" && <p className="hint">Seed accounts: alice, bob, carol, dave.</p>}
          </form>
      {error && <p className="error" role="alert">{error}</p>}
      </section>
      <footer className="auth-footer"><p>Original assignment · No real end-to-end encryption</p><a href="/api/health/live">Check backend health</a></footer>
    </main>
  );
}
