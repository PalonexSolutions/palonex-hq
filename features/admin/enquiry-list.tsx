"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { categories } from "../enquiries/constants";
import { adminRequest } from "./client";

type Cursor = { time: string; id: string };
type Item = { id: string; full_name: string; email: string; subject: string; category: keyof typeof categories; status: string; created_at: string };
type Page = { items: Item[]; nextCursor: Cursor | null };

export function EnquiryList({ initial }: { initial: Page }) {
  const [page, setPage] = useState(initial);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<(Cursor | null)[]>([null]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load(query: Record<string, string>, cursors: (Cursor | null)[]) {
    setBusy(true); setError("");
    try {
      const cursor = cursors.at(-1);
      setPage(await adminRequest<Page>("/api/admin/enquiries", "POST", { ...query, ...(cursor ? { cursor } : {}) }));
      setHistory(cursors); setFilters(query);
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries([...new FormData(event.currentTarget)]
      .filter(([, value]) => typeof value === "string" && value !== "")) as Record<string, string>;
    void load(values, [null]);
  }

  return <>
    <form method="post" className="card admin-filters" onSubmit={search}>
      <label>Search enquiries <input name="search" type="search" maxLength={150} placeholder="Name, email or reference" /></label>
      <label>Status <select name="status"><option value="">All statuses</option><option value="NEW">New</option><option value="IN_PROGRESS">In progress</option><option value="RESOLVED">Resolved</option><option value="ARCHIVED">Archived</option></select></label>
      <label>Category <select name="category"><option value="">All categories</option>{Object.entries(categories).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
      <label>Sort by date <select name="order"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
      <button className="button primary" disabled={busy}>Apply filters</button>
    </form>
    {error && <p role="alert" className="admin-error">{error}</p>}
    <section className="card admin-section" aria-label="Enquiry results" aria-busy={busy}>
      {page.items.length ? <ul className="admin-rows">{page.items.map(item => <li key={item.id}>
        <div><Link className="text-link" prefetch={false} href={`/admin/enquiries/${item.id}`}>{item.subject}</Link>
          <p>{item.full_name} · {item.email}</p><p>{categories[item.category]} · {item.created_at.slice(0, 10)}</p>
        </div>
        <span className="status">{item.status.toLowerCase().replaceAll("_", " ")}</span>
      </li>)}</ul> : <p>No enquiries match these filters.</p>}
      <div className="admin-actions">
        <button className="button" disabled={busy || history.length < 2} onClick={() => load(filters, history.slice(0, -1))}>Previous page</button>
        <p role="status">{busy ? "Loading enquiries…" : `Page ${history.length} · ${page.items.length} results`}</p>
        <button className="button" disabled={busy || !page.nextCursor} onClick={() => load(filters, [...history, page.nextCursor])}>Next page</button>
      </div>
    </section>
  </>;
}
