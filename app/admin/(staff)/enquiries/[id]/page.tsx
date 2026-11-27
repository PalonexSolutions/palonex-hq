import { notFound } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { adminPage } from "@/features/admin/access";
import { EnquiryActions } from "@/features/admin/enquiry-actions";
import { dateTime, StatusPill } from "@/features/admin/view";
import { categories } from "@/features/enquiries/constants";
import { adminEnquiry } from "@/lib/server/admin-enquiries";
import { transitions } from "@/lib/server/enquiries";

export default async function AdminEnquiry({ params }: { params: Promise<{ id: string }> }) {
  await adminPage();
  const reference = z.uuid().safeParse((await params).id);
  if (!reference.success) notFound();
  const detail = await adminEnquiry(reference.data);
  if (!detail) notFound();
  const { enquiry, notes, audit } = detail;
  return <>
    <Link className="text-link admin-back" href="/admin/enquiries" prefetch={false}>Back to enquiries</Link>
    <h1>{enquiry.subject}</h1>
    <p className="lede admin-reference">Reference {enquiry.id} <StatusPill status={enquiry.status} /></p>
    <div className="admin-columns">
      <section className="card admin-section">
        <h2>Submission details</h2>
        <dl className="admin-details">
          <dt>Full name</dt><dd>{enquiry.full_name}</dd>
          <dt>Email</dt><dd>{enquiry.email}</dd>
          <dt>Organization</dt><dd>{enquiry.organization ?? "None provided"}</dd>
          <dt>Category</dt><dd>{categories[enquiry.category]}</dd>
          <dt>Submitted</dt><dd>{dateTime(enquiry.created_at)}</dd>
          <dt>Consent</dt><dd>Policy {enquiry.privacy_version} · {dateTime(enquiry.consented_at)}</dd>
          <dt>Status changed</dt><dd>{dateTime(enquiry.status_changed_at)}</dd>
        </dl>
        <h3>Message</h3><p className="admin-message">{enquiry.message}</p>
      </section>
      <EnquiryActions id={enquiry.id} status={enquiry.status} allowed={transitions[enquiry.status]} />
    </div>
    <div className="admin-columns">
      <section className="card admin-section">
        <h2>Internal notes</h2>
        {notes.length ? <><p>Most recent 50 notes.</p><ul className="admin-rows">{notes.map(note => <li key={note.id}><div>
          <p className="admin-message">{note.body}</p><p>{dateTime(note.created_at)} · Staff {note.actor_id}</p>
        </div></li>)}</ul></> : <p>No internal notes.</p>}
      </section>
      <section className="card admin-section">
        <h2>Audit history</h2>
        {audit.length ? <><p>Most recent 50 actions.</p><ul className="admin-rows">{audit.map(entry => <li key={entry.id}><div>
          <strong>{entry.action === "status_changed" ? `Status changed from ${entry.previous_status} to ${entry.new_status}` : "Internal note added"}</strong>
          <p>{dateTime(entry.created_at)} · Staff {entry.actor_id}</p>
        </div></li>)}</ul></> : <p>No actions recorded.</p>}
      </section>
    </div>
  </>;
}
