"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { publicLogout, submitIdentity } from "./client";

export function PasswordField({ label = "Password", name = "password", current = false, feedback = false }: {
  label?: string; name?: string; current?: boolean; feedback?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [length, setLength] = useState(0);
  const feedbackId = `identity-strength-${name}`;
  return <div className="identity-field">
    <label htmlFor={`identity-${name}`}>{label}</label>
    <div className="identity-password">
      <input id={`identity-${name}`} name={name} type={visible ? "text" : "password"}
        autoComplete={current ? "current-password" : "new-password"} minLength={current ? undefined : 14} maxLength={128}
        required aria-describedby={feedback ? feedbackId : undefined} onChange={feedback ? event => setLength(event.target.value.length) : undefined} />
      <button type="button" className="button" aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
        aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? "Hide" : "Show"}</button>
    </div>
    {feedback && <small id={feedbackId} aria-live="polite">
      {length === 0 ? "Use 14 or more characters. A unique passphrase works well." : length < 14 ? `${14 - length} more characters to reach the minimum.` : "Minimum length met. Avoid predictable or repeated text."}
    </small>}
  </div>;
}

type FormMode = "register" | "login" | "forgot" | "resend" | "verify" | "reset" | "profile" | "password";
const labels: Record<FormMode, string> = {
  register: "Create account", login: "Log in", forgot: "Request reset link", resend: "Request verification link",
  verify: "Verify email", reset: "Reset password", profile: "Save profile", password: "Change password",
};
const success: Partial<Record<FormMode, string>> = {
  register: "If this address can be registered or verified, a verification message has been queued. Check your inbox after delivery.",
  forgot: "If an account matches that address, password reset instructions have been queued.",
  resend: "If the address needs verification, a new verification message has been queued.",
  verify: "Your email is verified. You can now log in.",
  reset: "Password reset. Log in with your new password.",
  profile: "Your profile has been updated.",
  password: "Password changed. Other sessions have been revoked.",
};

const subscribeHydration = () => () => {};

export function IdentityForm({ mode, name }: { mode: FormMode; name?: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const router = useRouter();
  const hasEmail = ["register", "login", "forgot", "resend"].includes(mode);
  const hasNewPassword = ["register", "reset", "password"].includes(mode);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data: Record<string, FormDataEntryValue | boolean> = Object.fromEntries(new FormData(form));
    if (mode === "register") data.consent = data.consent === "on";
    if (mode === "reset" || mode === "verify") {
      const link = window.location.hash.slice(1);
      if (!/^[A-Za-z0-9_-]{43}$/.test(link)) {
        setError("This link is missing or invalid. Request a new link.");
        return;
      }
      data.link = link;
    }
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await submitIdentity(mode, data);
      if (mode === "login") { window.location.replace("/account"); return; }
      if (mode === "reset" || mode === "verify") window.history.replaceState(null, "", window.location.pathname);
      if (hasNewPassword) {
        for (const field of form.querySelectorAll<HTMLInputElement>('input[autocomplete="new-password"], input[autocomplete="current-password"]')) field.value = "";
      }
      if (mode === "reset") window.dispatchEvent(new Event("palonex:identity-change"));
      setMessage(success[mode] ?? "");
      if (mode === "profile") router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "The request failed.");
    } finally { setBusy(false); }
  }

  const complete = (mode === "verify" || mode === "reset") && !!message;
  return <form method="post" className="identity-form" onSubmit={submit}>
    {!complete && <>
      {(mode === "register" || mode === "profile") && <label>Full name <input name="name" autoComplete="name" minLength={2} maxLength={100} required defaultValue={name} /></label>}
      {hasEmail && <label>Email address <input name="email" type="email" autoComplete="email" maxLength={254} required /></label>}
      {mode === "login" && <PasswordField current />}
      {mode === "password" && <PasswordField name="currentPassword" label="Current password" current />}
      {hasNewPassword && <><PasswordField feedback /><PasswordField name="confirmation" label="Confirm password" /></>}
      {mode === "register" && <>
        <div className="enquiry-honeypot" aria-hidden="true"><label>Leave empty <input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        <label className="identity-consent"><input name="consent" type="checkbox" required />
          <span>I accept the <Link href="/terms" target="_blank" rel="noopener noreferrer">terms</Link> and <Link href="/privacy" target="_blank" rel="noopener noreferrer">privacy policy</Link>.</span>
        </label>
      </>}
      <button className="button primary" disabled={busy || !hydrated}>{busy ? "Working…" : labels[mode]}</button>
    </>}
    {message && <p role="status">{message}</p>}
    {error && <p role="alert" className="identity-error">{error}</p>}
  </form>;
}

export function AccountLogout() {
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true); setError(false);
    try { await publicLogout(); }
    catch { setError(true); setBusy(false); }
  }
  return <>
    <button type="button" className="button" disabled={busy} onClick={logout}>Log out of this account</button>
    {error && <p className="identity-error" role="alert">Sign-out failed. Try again.</p>}
  </>;
}
