"use client";

import { useState } from "react";
import { Actions, Copy, Download, Feedback, TextPanel } from "./controls";
import { csvToJson, formatJson, JsonSyntaxError, jsonToCsv } from "./data";
import { convertBase64, convertUrl, type UrlMode } from "./encoding";
import { errorMessage } from "./input";

const converterOptions = {
  json: {
    modes: [["format", "Format"], ["minify", "Minify"], ["validate", "Validate"]],
    instructions: "Paste JSON and choose an operation. Formatting preserves the original values and escape sequences.",
  },
  csv: {
    modes: [["to-csv", "JSON to CSV"], ["to-json", "CSV to JSON"]],
    instructions: "Use an array of objects or comma-separated records. Set the header option manually for ambiguous CSV. Import untrusted CSV as text in spreadsheets to prevent formula interpretation.",
  },
  base64: {
    modes: [["encode", "Encode text"], ["decode", "Decode Base64"]],
    instructions: "Convert UTF-8 text using standard Base64. The decoder accepts optional padding and whitespace.",
  },
  url: {
    modes: [["encode-component", "Encode component"], ["decode-component", "Decode component"], ["normalize-url", "Normalize full URL"], ["decode-url", "Decode full URL for display"]],
    instructions: "Use component mode for one value. Full URL mode accepts HTTP and HTTPS addresses, preserves structural delimiters when decoding, and never opens the address.",
  },
} as const;

const jsonSample = '{"team":"PaLoNex","tools":["JSON","CSV"],"ready":true}';
const csvSample = 'name,score,note\r\n"PaLoNex, HQ",10,"Works ""locally"""\r\n東京,8,';
const csvJsonSample = '[{"name":"PaLoNex, HQ","score":10},{"name":"東京","score":8}]';
const unicodeText = "Hello, 世界 👋";

export function Converter({ kind }: { kind: keyof typeof converterOptions }) {
  const config = converterOptions[kind];
  const [mode, setMode] = useState<string>(config.modes[0][0]);
  const [indent, setIndent] = useState(2);
  const [headers, setHeaders] = useState<"auto" | "yes" | "no">("auto");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [offset, setOffset] = useState<number>();

  function clearResult() {
    setOutput(null); setError(""); setMessage(""); setOffset(undefined);
  }

  function sample() {
    const value = {
      json: () => jsonSample,
      csv: () => mode === "to-csv" ? csvJsonSample : csvSample,
      base64: () => mode === "encode" ? unicodeText : convertBase64(unicodeText, "encode"),
      url: () => mode === "decode-component" ? "PaLoNex%20%26%20%E6%9D%B1%E4%BA%AC"
        : mode === "normalize-url" ? "https://example.com/PaLoNex Tools?q=東京"
        : mode === "decode-url" ? "https://example.com/PaLoNex%20Tools?q=%E6%9D%B1%E4%BA%AC%26HQ"
        : "PaLoNex & 東京",
    }[kind]();
    setInput(value);
    clearResult();
  }

  function run() {
    clearResult();
    try {
      if (kind === "json") {
        setOutput(formatJson(input, mode as "format" | "minify" | "validate", indent));
        setMessage(mode === "validate" ? "Valid JSON." : "JSON is valid and ready.");
      } else if (kind === "csv" && mode === "to-json") {
        const result = csvToJson(input, headers);
        setOutput(result.output);
        setMessage(result.hasHeaders ? "Converted using the first record as headers." : "Converted with numbered column names.");
      } else {
        setOutput(kind === "csv" ? jsonToCsv(input)
          : kind === "base64" ? convertBase64(input, mode as "encode" | "decode")
          : convertUrl(input, mode as UrlMode));
        setMessage("Conversion complete.");
      }
    } catch (error) {
      setError(errorMessage(error));
      if (error instanceof JsonSyntaxError) setOffset(error.offset);
    }
  }

  const filename = kind === "csv" && mode === "to-csv" ? "converted.csv"
    : (kind === "csv" || kind === "json") ? "result.json" : "result.txt";
  const previewStart = Math.max(0, (offset ?? 0) - 36);
  return <section className="tool-workbench" aria-label="Converter">
    <p>{config.instructions}</p>
    <div className="tool-settings">
      <label>Operation <select value={mode} onChange={event => { setMode(event.target.value); clearResult(); }}>
        {config.modes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      {kind === "json" && mode === "format" && <label>Indentation <select value={indent} onChange={event => { setIndent(Number(event.target.value)); clearResult(); }}>
        <option value={2}>2 spaces</option><option value={4}>4 spaces</option>
      </select></label>}
      {kind === "csv" && mode === "to-json" && <label>First row <select value={headers} onChange={event => { setHeaders(event.target.value as typeof headers); clearResult(); }}>
        <option value="auto">Detect headers</option><option value="yes">Contains headers</option><option value="no">Contains data</option>
      </select></label>}
    </div>
    <div className="tool-panels">
      <TextPanel id="tool-input" label="Input" value={input} error={!!error} onChange={value => { setInput(value); clearResult(); }} />
      <TextPanel id="tool-output" label="Output" value={output ?? ""} />
    </div>
    {offset !== undefined && <pre className="tool-error-preview" aria-label="JSON error location">
      {previewStart > 0 && "…"}{input.slice(previewStart, offset)}<mark>{input[offset] ?? "End of input"}</mark>{input.slice(offset + 1, offset + 36)}
    </pre>}
    <Actions>
      <button type="button" className="button primary" onClick={run}>{config.modes.find(([value]) => value === mode)?.[1]}</button>
      <button type="button" className="button" onClick={sample}>Load sample</button>
      <button type="button" className="button" onClick={() => { setInput(""); clearResult(); }}>Clear</button>
      <Copy value={output} />
      {kind !== "url" && <Download value={output} filename={filename} type={filename.endsWith(".json") ? "application/json" : filename.endsWith(".csv") ? "text/csv;charset=utf-8" : undefined} />}
    </Actions>
    <Feedback error={error} message={message} />
  </section>;
}
