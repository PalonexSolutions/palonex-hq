"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { categories } from "./constants";

const fields = [
  { name: "fullName", label: "Full name", autoComplete: "name", min: 2, max: 100 },
  { name: "email", label: "Email address", autoComplete: "email", max: 254 },
  { name: "organization", label: "Company or organization (optional)", autoComplete: "organization", max: 150 },
] as const;

type Ticket = { token: string; readyAt: number; expiresAt: number };

export function EnquiryForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [reference, setReference] = useState("");
  const ticket = useRef<Ticket | null>(null);
  const submitting = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    setBusy(true); setError(""); setFieldErrors({});
    try {
      if (!ticket.current || Date.now() >= ticket.current.expiresAt) {
        const response = await fetch("/api/enquiries", { cache: "no-store", signal: AbortSignal.timeout(10_000) });
        if (!response.ok) throw new Error("Enquiries are temporarily unavailable. Please try again.");
        const { token, minimumWaitMs } = await response.json();
        const now = Date.now();
        ticket.current = { token, readyAt: now + minimumWaitMs + 50, expiresAt: now + 119 * 60_000 };
      }
      const { token, readyAt } = ticket.current;
      const wait = readyAt - Date.now();
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
      const response = await fetch("/api/enquiries", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, consent: values.consent === "on", token }),
        signal: AbortSignal.timeout(15_000),
      });
      const result = await response.json();
      if (!response.ok) {
        setFieldErrors(result.fields ?? {});
        if (response.status === 409 || response.status === 400) ticket.current = null;
        throw new Error(result.error ?? "The enquiry could not be submitted.");
      }
      setReference(result.id);
      ticket.current = null;
      form.reset();
    } catch (failure) {
      setError(failure instanceof Error && failure.name === "Error" ? failure.message : "The enquiry could not be submitted. Please try again.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  function errorProps(name: string) {
    return { "aria-invalid": !!fieldErrors[name] || undefined, "aria-describedby": fieldErrors[name] ? `enquiry-error-${name}` : undefined };
  }

  function fieldError(name: string) {
    return fieldErrors[name] && <small className="enquiry-error" id={`enquiry-error-${name}`}>{fieldErrors[name]}</small>;
  }

  return <section className="card enquiry-card" aria-labelledby="enquiry-heading">
    <h3 id="enquiry-heading">Business enquiries</h3>
    {reference ? <>
      <p role="status">Your enquiry has been received. Reference <strong>{reference}</strong></p>
      <button type="button" className="button" onClick={() => setReference("")}>Send another enquiry</button>
    </> : <form className="enquiry-form" onSubmit={submit}>
      <fieldset disabled={busy}>
        {fields.map(field => <label key={field.name}>{field.label}
          <input {...errorProps(field.name)} name={field.name} type={field.name === "email" ? "email" : "text"}
            autoComplete={field.autoComplete} required={field.name !== "organization"}
            minLength={"min" in field ? field.min : undefined} maxLength={field.max} />
          {fieldError(field.name)}
        </label>)}
        <label>Enquiry category
          <select name="category" defaultValue="" required {...errorProps("category")}>
            <option value="" disabled>Select a category</option>
            {Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          {fieldError("category")}
        </label>
        <label>Subject
          <input name="subject" required minLength={4} maxLength={150} {...errorProps("subject")} />
          {fieldError("subject")}
        </label>
        <label>Message
          <textarea name="message" rows={5} required minLength={10} maxLength={5000} {...errorProps("message")} />
          {fieldError("message")}
        </label>
        <div className="enquiry-honeypot" aria-hidden="true">
          <label>Leave empty <input name="website" autoComplete="off" tabIndex={-1} /></label>
        </div>
        <label className="enquiry-consent">
          <input type="checkbox" name="consent" required {...errorProps("consent")} />
          <span>I consent to the use of my details to handle this enquiry as described in the <Link href="/privacy" target="_blank" rel="noopener noreferrer">privacy policy</Link>.</span>
        </label>
        {fieldError("consent")}
        <button type="submit" className="button primary">{busy ? "Submitting…" : "Send enquiry"}</button>
      </fieldset>
      {busy && <p role="status">Submitting your enquiry.</p>}
      {error && <p className="enquiry-error" role="alert">{error}</p>}
    </form>}
  </section>;
}
