"use client";

import { useState, type FormEvent } from "react";
import { adminRequest } from "./client";

export function LoginForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setError("");
    try {
      await adminRequest("/api/admin/session", "POST", data);
      window.location.replace("/admin");
    } catch (error) {
      setError((error as Error).message);
      setBusy(false);
    }
  }
  return <form method="post" className="admin-form" onSubmit={submit}>
    <label>Staff email <input type="email" autoComplete="username" name="email" maxLength={254} required /></label>
    <label>Password <input type="password" autoComplete="current-password" name="password" maxLength={128} required /></label>
    <button className="button primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    {error && <p role="alert" className="admin-error">{error}</p>}
  </form>;
}

export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setBusy(true); setError("");
    try {
      await adminRequest("/api/admin/session", "DELETE");
      window.location.replace("/admin/login");
    } catch (error) {
      setError((error as Error).message);
      setBusy(false);
    }
  }
  return <div>
    <button className="button" type="button" disabled={busy} onClick={logout}>{busy ? "Signing out…" : "Sign out"}</button>
    {error && <p role="alert" className="admin-error">{error}</p>}
  </div>;
}
