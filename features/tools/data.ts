import { checkSize } from "./input.ts";

export class JsonSyntaxError extends Error {
  readonly offset?: number;

  constructor(message: string, offset?: number) {
    super(message);
    this.offset = offset;
  }
}

type Expectation = "value" | "first-item" | "first-key" | "key" | "colon" | "array-tail" | "object-tail" | "end";

function locateJsonError(input: string) {
  const valueToken = /"(?:[^"\\\x00-\x1f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/y;
  const whitespace = /[ \t\n\r]*/y;
  const expected: Expectation[] = ["end", "value"];
  let offset = 0;

  while (expected.length) {
    whitespace.lastIndex = offset;
    whitespace.exec(input);
    offset = whitespace.lastIndex;
    const token = input[offset];
    switch (expected.pop()) {
      case "end":
        return offset;
      case "array-tail":
        if (token === "]") { offset++; break; }
        if (token !== ",") return offset;
        offset++;
        expected.push("array-tail", "value");
        break;
      case "object-tail":
        if (token === "}") { offset++; break; }
        if (token !== ",") return offset;
        offset++;
        expected.push("object-tail", "value", "colon", "key");
        break;
      case "first-item":
        if (token === "]") { offset++; break; }
        expected.push("array-tail", "value");
        break;
      case "first-key":
        if (token === "}") { offset++; break; }
        expected.push("object-tail", "value", "colon", "key");
        break;
      case "colon":
        if (token !== ":") return offset;
        offset++;
        break;
      case "key":
        if (token !== '"') return offset;
        valueToken.lastIndex = offset;
        if (!valueToken.exec(input)) return offset;
        offset = valueToken.lastIndex;
        break;
      case "value":
        if (token === "[" || token === "{") {
          expected.push(token === "[" ? "first-item" : "first-key");
          offset++;
        } else {
          valueToken.lastIndex = offset;
          if (!valueToken.exec(input)) return offset;
          offset = valueToken.lastIndex;
        }
        break;
    }
  }
  return offset;
}

export function parseJson(input: string): unknown {
  checkSize(input);
  if (!input.trim()) throw new JsonSyntaxError("Enter JSON to continue.");
  try {
    return JSON.parse(input);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    const position = error.message.match(/\bat position (\d+)/i);
    const coordinates = error.message.match(/\bline (\d+) column (\d+)/i);
    let offset = position ? Number(position[1]) : undefined;
    if (offset === undefined && coordinates) {
      const lineStarts = [0, ...Array.from(input.matchAll(/\r\n|\r|\n/g), match => match.index + match[0].length)];
      offset = lineStarts[Number(coordinates[1]) - 1] + Number(coordinates[2]) - 1;
    }
    if (offset === undefined && /unexpected end|unterminated/i.test(error.message)) offset = input.length;
    if (offset === undefined || !Number.isFinite(offset) || offset > input.length) offset = locateJsonError(input);
    const lines = input.slice(0, offset).split(/\r\n|\r|\n/);
    const location = `Line ${lines.length}, column ${lines.at(-1)!.length + 1}`;
    throw new JsonSyntaxError(`${location}: ${error.message}`, offset);
  }
}

export function formatJson(input: string, mode: "format" | "minify" | "validate", indent = 2) {
  parseJson(input);
  if (mode === "validate") return input;
  // Rewrite only whitespace so large integers, duplicate keys and escape sequences are preserved.
  const tokens = input.matchAll(/"(?:\\[\s\S]|[^"\\])*"|[^\s"\[\]{},:]+|[\[\]{},:]/g);
  const parts: string[] = [];
  let depth = 0;
  let previous = "";
  let size = 0;
  for (const [token] of tokens) {
    const closes = token === "]" || token === "}";
    const followsOpen = previous === "[" || previous === "{";
    if (closes) depth--;
    let prefix = "";
    if (mode === "format") {
      if ((followsOpen && !closes) || previous === "," || (closes && !followsOpen)) {
        prefix = "\n" + " ".repeat(depth * indent);
      } else if (previous === ":") prefix = " ";
    }
    size += prefix.length + token.length;
    if (size > 2_000_000) throw new Error("Formatted output is too large. Use minify or reduce the input.");
    parts.push(prefix + token);
    if (token === "[" || token === "{") depth++;
    previous = token;
  }
  return parts.join("");
}

export function parseCsv(input: string): string[][] {
  checkSize(input);
  const source = input.replace(/^\uFEFF/, "");
  if (!source.length) throw new Error("Enter CSV data to continue.");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let state: "plain" | "quoted" | "closed" = "plain";
  function finishField() {
    row.push(field);
    field = "";
    state = "plain";
  }
  function finishRow() {
    finishField();
    rows.push(row);
    row = [];
  }
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (state === "quoted") {
      if (char === '"' && source[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') state = "closed";
      else field += char;
    } else if (char === ",") finishField();
    else if (char === "\n" || char === "\r") {
      finishRow();
      if (char === "\r" && source[i + 1] === "\n") i++;
    } else if (char === '"' && state === "plain" && !field) state = "quoted";
    else if (char === '"' || state === "closed") {
      throw new Error(`Invalid quote or trailing characters in CSV record ${rows.length + 1}, field ${row.length + 1}.`);
    } else field += char;
  }
  if (state === "quoted") throw new Error(`Unclosed quoted field in CSV record ${rows.length + 1}.`);
  if (row.length || field || state === "closed" || !/[\r\n]$/.test(source)) finishRow();
  return rows;
}

export function detectHeaders(rows: string[][]) {
  const first = rows[0] ?? [];
  return first.length > 0 && new Set(first.map(cell => cell.trim())).size === first.length
    && first.every(cell => /^[\p{L}_][\p{L}\p{N}_ .-]*$/u.test(cell.trim()))
    && rows.slice(1, 11).some(row => row.some(cell => /^[+-]?\d|^(true|false)$/i.test(cell.trim())));
}

export function csvToJson(input: string, headers: "auto" | "yes" | "no") {
  const rows = parseCsv(input);
  const [first] = rows;
  const hasHeaders = headers === "yes" || (headers === "auto" && detectHeaders(rows));
  const labels = hasHeaders ? first.map(cell => cell.trim()) : first.map((_, i) => `column_${i + 1}`);
  if (labels.some(label => !label) || new Set(labels).size !== labels.length) {
    throw new Error("Header names must be nonempty and unique.");
  }
  const records = rows.slice(hasHeaders ? 1 : 0);
  // Bound expansion caused by repeating long header names across many rows.
  const keySize = labels.reduce((sum, label) => sum + label.length, 0);
  if (keySize * records.length > 1_000_000) throw new Error("The JSON output would be too large.");
  return {
    output: JSON.stringify(records.map((row, i) => {
      if (row.length !== labels.length) throw new Error(`Record ${i + (hasHeaders ? 2 : 1)} has ${row.length} cells. Expected ${labels.length}.`);
      return Object.fromEntries(labels.map((label, index) => [label, row[index]]));
    }), null, 2),
    hasHeaders,
  };
}

export function jsonToCsv(input: string) {
  const data = parseJson(input);
  if (!Array.isArray(data) || !data.length || data.some(record => !record || typeof record !== "object" || Array.isArray(record))) {
    throw new Error("Enter a nonempty JSON array of objects.");
  }
  const labels = [...new Set(data.flatMap(record => Object.keys(record)))];
  if (!labels.length) throw new Error("At least one record needs a field.");
  if (labels.length * data.length > 500_000) throw new Error("The CSV output would be too large.");
  const quote = (value: string) => /[",\r\n]/.test(value) || value === "" ? `"${value.replaceAll('"', '""')}"` : value;
  return [labels.map(quote).join(","), ...data.map(record => labels.map(label => {
    const value = Object.hasOwn(record, label) ? record[label] : null;
    return quote(value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value));
  }).join(","))].join("\r\n");
}
