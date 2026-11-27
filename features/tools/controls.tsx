"use client";

import { useState, type ReactNode } from "react";
import { errorMessage } from "./input";

export function Actions({ children }: { children: ReactNode }) {
  return <div className="tool-actions">{children}</div>;
}

export function Feedback({ error, message }: { error?: string; message?: string }) {
  return <>{error ? <p className="tool-error" role="alert">{error}</p> : <p className="tool-message" role="status">{message}</p>}</>;
}

export function TextPanel({ id, label, value, onChange, error }: {
  id: string; label: string; value: string; onChange?: (value: string) => void; error?: boolean;
}) {
  return <div className="tool-field">
    <label htmlFor={id}>{label}</label>
    <textarea id={id} value={value} spellCheck={false} autoCapitalize="off" autoComplete="off" readOnly={!onChange}
      aria-invalid={error || undefined} onChange={onChange ? event => onChange(event.target.value) : undefined} />
  </div>;
}

export function Copy({ value, label = "Copy output" }: { value: string | null; label?: string }) {
  const [feedback, setFeedback] = useState<{ value: string; error?: string }>();
  const current = feedback?.value === value ? feedback : undefined;
  async function copy() {
    if (value === null) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard access is unavailable. Select and copy the output manually.");
      await navigator.clipboard.writeText(value);
      setFeedback({ value });
    } catch (error) {
      setFeedback({ value, error: errorMessage(error) });
    }
  }
  return <span className="tool-copy">
    <button className="button" type="button" disabled={value === null} onClick={copy}>{current && !current.error ? "Copied" : label}</button>
    <span className="tool-copy-feedback" role="status">{current ? current.error ?? "Copied to clipboard." : ""}</span>
  </span>;
}

export function Download({ value, filename, type = "text/plain;charset=utf-8" }: {
  value: string | null; filename: string; type?: string;
}) {
  function download() {
    if (value === null) return;
    const url = URL.createObjectURL(new Blob([value], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <button className="button" type="button" onClick={download} disabled={value === null}>Download {filename.split(".").at(-1)?.toUpperCase()}</button>;
}
