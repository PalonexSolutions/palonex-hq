"use client";

import { useRef, useState } from "react";
import { Actions, Copy, Download, Feedback, TextPanel } from "./controls";
import { generateUuids, hashSha256 } from "./crypto";
import { errorMessage } from "./input";

export function HashWorkspace() {
  const [mode, setMode] = useState<"text" | "file">("text");
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File>();
  const [output, setOutput] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileControl = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  function clearResult() {
    request.current++;
    setOutput(null); setError(""); setBusy(false);
  }
  function reset() {
    setInput(""); setFile(undefined);
    if (fileControl.current) fileControl.current.value = "";
    clearResult();
  }
  async function generate() {
    clearResult();
    const source = mode === "text" ? input : file;
    if (source === undefined) { setError("Choose a file to hash."); return; }
    const id = request.current;
    setBusy(true);
    try {
      const hash = await hashSha256(source);
      if (id === request.current) setOutput(hash);
    } catch (error) {
      if (id === request.current) setError(errorMessage(error));
    } finally {
      if (id === request.current) setBusy(false);
    }
  }
  return <section className="tool-workbench" aria-label="SHA-256 workspace">
    <p>Hash UTF-8 text or the raw bytes of a file up to 32 MiB. The file stays on this device. SHA-256 is a one-way digest.</p>
    <fieldset className="tool-settings">
      <legend>Input type</legend>
      <label><input type="radio" name="hash-source" checked={mode === "text"} onChange={() => { setMode("text"); clearResult(); }} /> Text</label>
      <label><input type="radio" name="hash-source" checked={mode === "file"} onChange={() => { setMode("file"); setFile(undefined); clearResult(); }} /> File</label>
    </fieldset>
    {mode === "text" ? <TextPanel id="hash-input" label="Text to hash" value={input} onChange={value => { setInput(value); clearResult(); }} />
      : <label className="tool-field">File to hash
        <input ref={fileControl} type="file" onChange={event => { setFile(event.target.files?.[0]); clearResult(); }} />
      </label>}
    <Actions>
      <button className="button primary" disabled={busy} onClick={generate}>{busy ? "Hashing…" : "Generate hash"}</button>
      <button className="button" onClick={() => { setMode("text"); setInput("abc"); clearResult(); }}>Load sample</button>
      <button className="button" onClick={reset}>Clear</button>
    </Actions>
    <Feedback error={error} message={busy ? "Calculating SHA-256…" : output ? "SHA-256 digest ready." : undefined} />
    <div className="tool-field">
      <label htmlFor="hash-output">Hexadecimal digest</label>
      <input className="tool-code" id="hash-output" value={output ?? ""} readOnly />
      <Actions><Copy value={output} label="Copy hash" /></Actions>
    </div>
  </section>;
}

export function UuidWorkspace() {
  const [count, setCount] = useState("1");
  const [values, setValues] = useState<string[]>([]);
  const [error, setError] = useState("");
  function generate() {
    try { setValues(generateUuids(Number(count))); setError(""); }
    catch (error) { setValues([]); setError(errorMessage(error)); }
  }
  const output = values.length ? values.join("\n") : null;
  return <section className="tool-workbench" aria-label="UUID workspace">
    <p>Generate up to 100 random version 4 identifiers with the browser’s cryptographic random source.</p>
    <div className="tool-settings">
      <label>Number of UUIDs <input type="number" min={1} max={100} step={1} value={count}
        onChange={event => { setCount(event.target.value); setError(""); }} /></label>
    </div>
    <Actions>
      <button className="button primary" onClick={generate}>Generate UUIDs</button>
      <button className="button" onClick={() => { setCount("1"); setValues([]); setError(""); }}>Reset</button>
      <Copy value={output} label="Copy all" />
      <Download value={output} filename="uuids.txt" />
    </Actions>
    <Feedback error={error} message={values.length ? `Generated ${values.length} UUID${values.length === 1 ? "" : "s"}.` : undefined} />
    {!!values.length && <ol className="tool-uuids" aria-label="Generated UUIDs">
      {values.map((value, index) => <li key={value}><code>{value}</code><Copy value={value} label={`Copy UUID ${index + 1}`} /></li>)}
    </ol>}
  </section>;
}
