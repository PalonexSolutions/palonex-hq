"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Status } from "../enquiries/schema";
import { adminRequest } from "./client";

const label = (status: Status) => status.toLowerCase().replaceAll("_", " ");

export function EnquiryActions({ id, status, allowed }: { id: string; status: Status; allowed: readonly Status[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<Status | "">("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  async function save(body: object, message: string, onSuccess: () => void) {
    setBusy(true); setError(""); setFeedback("");
    try {
      await adminRequest(`/api/admin/enquiries/${id}`, "PATCH", body);
      onSuccess();
      setFeedback(message);
      router.refresh();
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }

  function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void save({ action: "note", note: new FormData(form).get("note") }, "Internal note added.", () => form.reset());
  }

  return <section className="card admin-section">
    <h2>Manage enquiry</h2>
    {allowed.length ? <div className="admin-form">
      <label>New status
        <select value={target} onChange={event => { setTarget(event.target.value as Status | ""); setConfirm(false); }}
          disabled={busy}>
          <option value="">Select a status</option>
          {allowed.map(next => <option value={next} key={next}>{label(next)}</option>)}
        </select>
      </label>
      {confirm && target ? <>
        <p>Change status from <strong>{label(status)}</strong> to <strong>{label(target)}</strong>? The change will be recorded in the audit history.</p>
        <div className="admin-actions">
          <button className="button primary" disabled={busy} onClick={() => save({ action: "status", from: status, to: target },
            "Enquiry status updated.", () => { setConfirm(false); setTarget(""); })}>Confirm status change</button>
          <button className="button" disabled={busy} onClick={() => setConfirm(false)}>Cancel</button>
        </div>
      </> : <button className="button" disabled={busy || !target} onClick={() => setConfirm(true)}>Review status change</button>}
    </div> : <p>This enquiry is archived. No further status transitions are available.</p>}
    <form method="post" className="admin-form" onSubmit={addNote}>
      <label>Internal note <textarea name="note" rows={4} required maxLength={2000} /></label>
      <button className="button primary" disabled={busy}>Add note</button>
    </form>
    {busy && <p role="status">Saving changes…</p>}
    {feedback && <p role="status">{feedback}</p>}
    {error && <p role="alert" className="admin-error">{error}</p>}
  </section>;
}
