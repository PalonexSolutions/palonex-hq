"use client";

import { useState } from "react";
import { Actions, Copy, Feedback, TextPanel } from "./controls";
import { errorMessage } from "./input";
import { diffAsText, diffText, textStats, transformText, type DiffLine, type TextMode } from "./text";

export function DiffWorkspace() {
  const [before, setBefore] = useState("");
  const [after, setAfter] = useState("");
  const [result, setResult] = useState<DiffLine[] | null>(null);
  const [error, setError] = useState("");
  const [onlyChanges, setOnlyChanges] = useState(false);
  const [page, setPage] = useState(0);
  function update(left: string, right: string) {
    setBefore(left); setAfter(right); setResult(null); setError(""); setPage(0);
  }
  function compare() {
    setError(""); setPage(0);
    try { setResult(diffText(before, after)); }
    catch (error) { setResult(null); setError(errorMessage(error)); }
  }
  const visible = onlyChanges ? result?.filter(line => line.kind !== "same") : result;
  const pageSize = 200;
  const markers = { same: "Unchanged", added: "Added", removed: "Removed" };
  return <section className="tool-workbench" aria-label="Text comparison">
    <p>Compare two versions line by line. The comparison ignores newline style and preserves whitespace within lines.</p>
    <div className="tool-panels">
      <TextPanel id="before" label="Original text" value={before} onChange={value => update(value, after)} />
      <TextPanel id="after" label="Revised text" value={after} onChange={value => update(before, value)} />
    </div>
    <Actions>
      <button className="button primary" onClick={compare}>Compare</button>
      <button className="button" onClick={() => update(after, before)}>Swap inputs</button>
      <button className="button" onClick={() => update("Design\nDraft\nReview", "Design\nImplementation\nReview")}>Load sample</button>
      <button className="button" onClick={() => update("", "")}>Clear</button>
      <Copy value={result ? diffAsText(result) : null} label="Copy comparison" />
    </Actions>
    <Feedback error={error} message={result ? result.some(line => line.kind !== "same") ? "Comparison ready." : "No differences." : undefined} />
    {!!result?.length && <section className="tool-result" aria-label="Comparison result">
      <label><input type="checkbox" checked={onlyChanges} onChange={event => { setOnlyChanges(event.target.checked); setPage(0); }} /> Show only changes</label>
      {visible?.length ? <>
        <ol className="tool-diff">
          {visible.slice(page * pageSize, (page + 1) * pageSize).map((line, index) =>
            <li key={index} data-kind={line.kind}><span>{markers[line.kind]}</span><code>{line.text}</code></li>)}
        </ol>
        {visible.length > pageSize && <Actions>
          <button className="button" disabled={!page} onClick={() => setPage(page - 1)}>Previous lines</button>
          <span role="status">Page {page + 1} of {Math.ceil(visible.length / pageSize)}</span>
          <button className="button" disabled={(page + 1) * pageSize >= visible.length} onClick={() => setPage(page + 1)}>Next lines</button>
        </Actions>}
      </> : <p>No changed lines.</p>}
    </section>}
  </section>;
}

const statsLabels = {
  characters: "Characters", nonspace: "Without whitespace", words: "Words",
  sentences: "Sentences", lines: "Lines", paragraphs: "Paragraphs", minutes: "Reading time (min)",
} as const;
const modes = [
  ["upper", "UPPERCASE"], ["lower", "lowercase"], ["title", "Title case"],
  ["unique", "Remove duplicate lines"], ["trim", "Trim extra whitespace"],
] as const;

export function TextWorkspace() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState<string | null>(null);
  const [mode, setMode] = useState<TextMode>("upper");
  const [stats, setStats] = useState<ReturnType<typeof textStats>>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  function update(value: string) {
    setInput(value); setOutput(null); setStats(undefined); setError(""); setMessage("");
  }
  function run(operation: "count" | "transform") {
    setError("");
    try {
      if (operation === "count") setStats(textStats(input));
      else setOutput(transformText(input, mode));
      setMessage(operation === "count" ? "Counts updated." : "Text transformed.");
    } catch (error) { setError(errorMessage(error)); setMessage(""); }
  }
  return <section className="tool-workbench" aria-label="Text utilities">
    <p>Count what you’ve written or transform a copy. Reading time rounds up at 200 words per minute.</p>
    <div className="tool-panels">
      <TextPanel id="text-input" label="Input" value={input} onChange={update} />
      <TextPanel id="text-output" label="Transformed text" value={output ?? ""} />
    </div>
    <Actions>
      <button className="button primary" onClick={() => run("count")}>Count text</button>
      <label className="tool-inline-label">Transformation <select value={mode} onChange={event => { setMode(event.target.value as TextMode); setOutput(null); setMessage(""); setError(""); }}>
        {modes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <button className="button" onClick={() => run("transform")}>Transform</button>
      <button className="button" onClick={() => update("Hello, world!\nHello, world!\n\nPaLoNex makes practical tools.")}>Load sample</button>
      <button className="button" onClick={() => update("")}>Clear</button>
      <Copy value={output} />
    </Actions>
    <Feedback error={error} message={message} />
    {stats && <dl className="tool-stats">
      {(Object.keys(statsLabels) as (keyof typeof statsLabels)[]).map(key => <div className="card" key={key}>
        <dt>{statsLabels[key]}</dt><dd>{stats[key]}</dd>
      </div>)}
    </dl>}
  </section>;
}
