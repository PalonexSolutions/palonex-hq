"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { publicLogout } from "./client";

export function AccountNavigation() {
  const [authenticated, setAuthenticated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      void fetch("/api/identity/session", { cache: "no-store", signal: controller.signal })
        .then(response => response.ok ? response.json() : null)
        .then(result => { if (!controller.signal.aborted) setAuthenticated(result?.authenticated === true); })
        .catch(() => {});
    };
    refresh();
    window.addEventListener("pageshow", refresh);
    window.addEventListener("palonex:identity-change", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("palonex:identity-change", refresh);
    };
  }, []);

  async function logout() {
    setBusy(true);
    setError(false);
    try { await publicLogout(); }
    catch { setError(true); setBusy(false); }
  }

  return <nav className="identity-nav" aria-label="Account navigation">
    {authenticated ? <>
      <Link href="/account" prefetch={false}>Account</Link>
      <button type="button" disabled={busy} onClick={logout}>Log out</button>
      {error && <span role="alert">Sign-out failed. Try again.</span>}
    </> : <>
      <Link href="/login" prefetch={false}>Log in</Link>
      <Link href="/register" prefetch={false}>Create account</Link>
    </>}
  </nav>;
}
