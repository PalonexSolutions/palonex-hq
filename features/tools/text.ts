import { checkSize, splitLines } from "./input.ts";

export type DiffLine = { kind: "same" | "added" | "removed"; text: string };
const diffLineLimit = 10_000;

export function diffText(before: string, after: string): DiffLine[] {
  checkSize(before, 250_000);
  checkSize(after, 250_000);
  const left = before ? splitLines(before) : [];
  const right = after ? splitLines(after) : [];
  if (left.length > diffLineLimit || right.length > diffLineLimit) throw new Error("Compare at most 10,000 lines per input.");
  let first = 0;
  let endLeft = left.length;
  let endRight = right.length;
  while (first < endLeft && first < endRight && left[first] === right[first]) first++;
  while (endLeft > first && endRight > first && left[endLeft - 1] === right[endRight - 1]) {
    endLeft--; endRight--;
  }
  const rows = endLeft - first;
  const columns = endRight - first;
  const width = columns + 1;
  if ((rows + 1) * width > 2_000_000) throw new Error("The changed region is too large to compare. Try smaller sections.");
  const lengths = new Uint32Array((rows + 1) * width);
  for (let i = rows - 1; i >= 0; i--) {
    for (let j = columns - 1; j >= 0; j--) {
      const cell = i * width + j;
      lengths[cell] = left[first + i] === right[first + j]
        ? 1 + lengths[cell + width + 1]
        : Math.max(lengths[cell + width], lengths[cell + 1]);
    }
  }
  const diff: DiffLine[] = left.slice(0, first).map(text => ({ kind: "same", text }));
  let i = 0;
  let j = 0;
  while (i < rows || j < columns) {
    if (i < rows && j < columns && left[first + i] === right[first + j]) {
      diff.push({ kind: "same", text: left[first + i] }); i++; j++;
    } else if (j === columns || (i < rows && lengths[(i + 1) * width + j] >= lengths[i * width + j + 1])) {
      diff.push({ kind: "removed", text: left[first + i++] });
    } else diff.push({ kind: "added", text: right[first + j++] });
  }
  for (const text of left.slice(endLeft)) diff.push({ kind: "same", text });
  return diff;
}

export function diffAsText(lines: DiffLine[]) {
  const prefix = { same: " ", added: "+", removed: "-" };
  return lines.map(line => `${prefix[line.kind]} ${line.text}`).join("\n");
}

const characters = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const words = new Intl.Segmenter(undefined, { granularity: "word" });
const sentences = new Intl.Segmenter(undefined, { granularity: "sentence" });

export function textStats(input: string) {
  checkSize(input);
  let wordCount = 0;
  let characterCount = 0;
  let nonspaceCount = 0;
  let sentenceCount = 0;
  const trimmed = input.trim();
  for (const entry of words.segment(input)) if (entry.isWordLike) wordCount++;
  for (const { segment } of characters.segment(input)) {
    characterCount++;
    if (/\S/u.test(segment)) nonspaceCount++;
  }
  for (const { segment } of sentences.segment(trimmed)) if (/[\p{L}\p{N}]/u.test(segment)) sentenceCount++;
  return {
    characters: characterCount,
    nonspace: nonspaceCount,
    words: wordCount,
    sentences: sentenceCount,
    lines: input ? splitLines(input).length : 0,
    paragraphs: trimmed ? trimmed.split(/\r?\n[^\S\r\n]*\r?\n|\r[^\S\r\n]*\r/).filter(part => part.trim()).length : 0,
    minutes: Math.ceil(wordCount / 200),
  };
}

export type TextMode = "upper" | "lower" | "title" | "unique" | "trim";
export function transformText(input: string, mode: TextMode) {
  checkSize(input);
  if (mode === "upper") return input.toUpperCase();
  if (mode === "lower") return input.toLowerCase();
  if (mode === "title") return Array.from(words.segment(input.toLowerCase()), ({ segment, isWordLike }) =>
    isWordLike ? segment.replace(/^\p{L}/u, char => char.toUpperCase()) : segment).join("");
  if (mode === "unique") return [...new Set(splitLines(input))].join("\n");
  return splitLines(input.trim()).map(line => line.trim().replace(/[^\S\r\n]+/gu, " ")).join("\n");
}
