import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { formatJson, JsonSyntaxError, csvToJson, jsonToCsv, parseCsv } from "../../features/tools/data.ts";
import { convertBase64, convertUrl } from "../../features/tools/encoding.ts";
import { fileLimit, generateUuids, hashSha256 } from "../../features/tools/crypto.ts";
import { diffAsText, diffText, textStats, transformText } from "../../features/tools/text.ts";

test("JSON formats without rewriting numbers, keys or escaped strings", () => {
  const source = String.raw`{"界":9007199254740999,"界":"a \"quoted\" 😀","list":[]}`;
  const formatted = formatJson(source, "format", 4);
  assert.match(formatted, /\n    "界": 9007199254740999/);
  assert.equal(formatJson(formatted, "minify"), source);
  assert.equal(formatJson(" null ", "validate"), " null ");
  assert.equal(formatJson(" { } ", "format"), "{}");
  assert.throws(() => formatJson("", "format"), /Enter JSON/);
  assert.throws(() => formatJson('{"a":1,\r\n"b":}', "format"), (error: unknown) =>
    error instanceof JsonSyntaxError && error.message.includes("Line 2, column 5") && error.offset !== undefined);
  assert.throws(() => formatJson(" ".repeat(500_001), "format"), /limit/);
  assert.throws(() => formatJson("[".repeat(2000) + "0" + "]".repeat(2000), "format"), /output is too large/);
});

test("CSV handles RFC-style quoting, empty cells, BOM and header modes", () => {
  const text = '\uFEFFname,id,note\r\n"東京, HQ",7,"line 1\r\nline ""2"""\r\nParis,2,';
  const converted = csvToJson(text, "auto");
  assert.equal(converted.hasHeaders, true);
  assert.deepEqual(JSON.parse(converted.output), [
    { name: "東京, HQ", id: "7", note: 'line 1\r\nline "2"' }, { name: "Paris", id: "2", note: "" },
  ]);
  assert.deepEqual(JSON.parse(csvToJson("a,b\nc,d", "no").output), [
    { column_1: "a", column_2: "b" }, { column_1: "c", column_2: "d" },
  ]);
  assert.deepEqual(JSON.parse(csvToJson("name\n東京", "yes").output), [{ name: "東京" }]);
  assert.deepEqual(parseCsv('""\n'), [[""]]);
  assert.deepEqual(parseCsv("a,\r"), [["a", ""]]);
  assert.throws(() => parseCsv(""), /Enter CSV/);
  assert.throws(() => parseCsv('"x'), /Unclosed/);
  assert.throws(() => parseCsv('"x" y'), /Invalid quote/);
  assert.throws(() => csvToJson("a,a\na,b", "yes"), /unique/);
  assert.throws(() => csvToJson("a,b\na", "yes"), /Expected 2/);
  assert.equal(jsonToCsv('[{"name":"a,b"},{"score":7}]'), 'name,score\r\n"a,b",""\r\n"",7');
  assert.deepEqual(parseCsv(jsonToCsv(JSON.stringify([{ a: { x: 1 }, b: null, c: 'a"b' }]))), [
    ["a", "b", "c"], ['{"x":1}', "", 'a"b'],
  ]);
  assert.throws(() => jsonToCsv("[]"), /nonempty/);
  assert.throws(() => jsonToCsv('{"a":1}'), /array/);
  assert.throws(() => parseCsv("x".repeat(500_001)), /limit/);
});

test("diff handles Unicode, empty inputs and bounded large comparisons", () => {
  assert.deepEqual(diffText("", ""), []);
  assert.equal(diffAsText(diffText("keep\n東京", "keep\r\n서울")), "  keep\n- 東京\n+ 서울");
  assert.equal(diffAsText(diffText("", "a\n")), "+ a\n+ ");
  const lines = Array.from({ length: 10_000 }, (_, i) => String(i));
  const before = lines.join("\n");
  lines[5000] = "changed";
  assert.equal(diffText(before, lines.join("\n")).filter(line => line.kind !== "same").length, 2);
  assert.throws(() => diffText("x\n".repeat(10_001), ""), /10,000/);
  assert.throws(() => diffText("x\n".repeat(1500), "y\n".repeat(1500)), /changed region/);
});

test("Base64 handles UTF-8, BOM, invalid alphabet, padding and large values", () => {
  for (const input of ["", "\uFEFF東京 😀", "界".repeat(500_000)]) {
    assert.equal(convertBase64(convertBase64(input, "encode"), "decode"), input);
  }
  assert.equal(convertBase64(" Zg\n", "decode"), "f");
  assert.throws(() => convertBase64("x-==", "decode"), /Base64/);
  assert.throws(() => convertBase64("Zh==", "decode"), /padding/);
  assert.throws(() => convertBase64("/w==", "decode"), /UTF-8/);
  assert.throws(() => convertBase64("a".repeat(500_001), "encode"), /limit/);
});

test("URL conversion distinguishes component and full URL modes", () => {
  for (const input of ["", "東京 & a/b?"]) {
    assert.equal(convertUrl(convertUrl(input, "encode-component"), "decode-component"), input);
  }
  assert.equal(convertUrl("https://example.com/a b?q=東京", "normalize-url"), "https://example.com/a%20b?q=%E6%9D%B1%E4%BA%AC");
  assert.equal(convertUrl("https://example.com/a%2Fb?q=a%26b%20c", "decode-url"), "https://example.com/a%2Fb?q=a%26b c");
  assert.throws(() => convertUrl("", "normalize-url"), /absolute/);
  assert.throws(() => convertUrl("https://example.com/%FF", "decode-url"), /malformed/);
  assert.throws(() => convertUrl("%xyz", "decode-component"), /malformed/);
  assert.throws(() => convertUrl("javascript:alert(1)", "normalize-url"), /HTTP/);
  assert.throws(() => convertUrl("a".repeat(500_001), "encode-component"), /limit/);
});

test("SHA-256 matches known native digests for text and files", async () => {
  for (const input of ["", "abc", "東京 😀", "x".repeat(500_000)]) {
    const expected = createHash("sha256").update(input).digest("hex");
    assert.equal(await hashSha256(input), expected);
    assert.equal(await hashSha256(new Blob([input])), expected);
  }
  await assert.rejects(hashSha256("x".repeat(500_001)), /limit/);
  await assert.rejects(hashSha256(new Blob([new Uint8Array(fileLimit + 1)])), /32 MiB/);
});

test("UUID validates count and produces RFC variant/version identifiers", () => {
  for (const count of [0, 1.25, 101, NaN, Number("")]) assert.throws(() => generateUuids(count), /1 to 100/);
  const batch = generateUuids(100);
  assert.equal(new Set(batch).size, 100);
  for (const value of batch) assert.match(value, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.equal(generateUuids(1).length, 1);
});

test("Text counts graphemes, words, sentences, lines and paragraphs and transforms actual input", () => {
  assert.deepEqual(textStats(""), { characters: 0, nonspace: 0, words: 0, sentences: 0, lines: 0, paragraphs: 0, minutes: 0 });
  assert.deepEqual(textStats("Hi. 👋🏽\r\n\r\nBye!"), { characters: 11, nonspace: 8, words: 2, sentences: 2, lines: 3, paragraphs: 2, minutes: 1 });
  assert.equal(textStats("word ".repeat(201)).minutes, 2);
  assert.equal(textStats("a".repeat(500_000)).characters, 500_000);
  assert.throws(() => textStats("a".repeat(500_001)), /limit/);
  assert.equal(transformText("ñ😀", "upper"), "Ñ😀");
  assert.equal(transformText("Ñ", "lower"), "ñ");
  assert.equal(transformText("éLAN DÉJÀ", "title"), "Élan Déjà");
  assert.equal(transformText("a\r\nb\na", "unique"), "a\nb");
  assert.equal(transformText("  a\t b \n c  ", "trim"), "a b\nc");
});
