"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { adminRequest } from "./client";

type Account = {
  id: string; name: string; email: string; emailVerified: boolean; createdAt: string; status: "active" | "suspended";
};
type Results = { items: Account[]; more: boolean };

export function PublicAccounts({ initial }: { initial: Results }) {
  const [results, setResults] = useState(initial);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<string>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const api = "/api/admin/accounts";

  async function load(next: number, query: string) {
    setResults(await adminRequest<Results>(api, "POST", { action: "list", search: query, page: next }));
    setPage(next); setSearch(query); setSelection(undefined);
  }

  async function browse(next: number, query: string) {
    setBusy(true); setError(""); setMessage("");
    try { await load(next, query); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void browse(1, String(new FormData(event.currentTarget).get("search") ?? ""));
  }

  async function update(account: Account) {
    const to = account.status === "active" ? "suspended" : "active";
    setBusy(true); setError(""); setMessage("");
    try {
      await adminRequest(api, "POST", { action: "status", id: account.id, from: account.status, to });
      setMessage(to === "suspended" ? "Account suspended and sessions revoked." : "Account reactivated.");
      await load(page, search);
      router.refresh();
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }

  return <>
    <form method="post" className="card admin-form" onSubmit={submit}>
      <label>Search public accounts <input name="search" type="search" maxLength={150} placeholder="Name, email or account reference" /></label>
      <button className="button primary" disabled={busy}>Search accounts</button>
    </form>
    {message && <p role="status">{message}</p>}
    {error && <p role="alert" className="admin-error">{error}</p>}
    <section className="card admin-section" aria-label="Public account results" aria-busy={busy}>
      {results.items.length ? <ul className="admin-rows">{results.items.map(account => <li key={account.id}>
        <div>
          <strong>{account.name}</strong><p>{account.email}</p>
          <p>{account.emailVerified ? "Verified" : "Unverified"} · {account.status} · Created {account.createdAt.slice(0, 10)}</p>
          <p>Account reference {account.id}</p>
          {selection === account.id && <div>
            <p>{account.status === "active" ? "Suspend this account and revoke its sessions?" : "Restore sign-in for this account?"}</p>
            <div className="admin-actions">
              <button className="button primary" disabled={busy} onClick={() => update(account)}>Confirm {account.status === "active" ? "suspension" : "reactivation"}</button>
              <button className="button" disabled={busy} onClick={() => setSelection(undefined)}>Cancel</button>
            </div>
          </div>}
        </div>
        {selection !== account.id && <button className="button" disabled={busy}
          onClick={() => setSelection(account.id)}>{account.status === "active" ? "Suspend" : "Reactivate"}</button>}
      </li>)}</ul> : <p>No public accounts match this search.</p>}
      <div className="admin-actions">
        <button className="button" disabled={busy || page <= 1} onClick={() => browse(page - 1, search)}>Previous page</button>
        <p role="status">Page {page}</p>
        <button className="button" disabled={busy || page >= 400 || !results.more} onClick={() => browse(page + 1, search)}>Next page</button>
      </div>
    </section>
  </>;
}
