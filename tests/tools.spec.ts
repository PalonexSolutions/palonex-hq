import { expect, test } from "@playwright/test";
import { tools } from "../features/tools/catalog";

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  // Keep errors with the page so the same listener covers route transitions.
  browserErrors.set(page, errors);
});

const browserErrors = new WeakMap<import("@playwright/test").Page, string[]>();
test.afterEach(({ page }) => expect(browserErrors.get(page)).toEqual([]));

test("directory filters by name and category and links all eight workspace routes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Tools", exact: true }).click();
  await expect(page).toHaveURL("/tools");
  const search = page.getByRole("searchbox", { name: "Search tools" });
  await search.fill("base64");
  await expect(page.getByText("1 tool found")).toBeVisible();
  await page.getByLabel("Category").selectOption("Text");
  await expect(page.getByText("0 tools found")).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(page.getByText("8 tools found")).toBeVisible();
  for (const tool of tools) {
    await expect(page.getByRole("link", { name: new RegExp(tool.name) })).toHaveAttribute("href", `/tools/${tool.slug}`);
  }
  await page.getByRole("link", { name: /Text Diff/ }).click();
  await expect(page).toHaveURL("/tools/diff");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://palonexsolutions.in/tools/diff");
  await page.getByRole("link", { name: "All engineering tools" }).click();
  await expect(page).toHaveURL("/tools");
});

test("JSON highlights invalid syntax and supports validation, format, minify, copy and download", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/tools/json");
  const input = page.getByLabel("Input", { exact: true });
  const output = page.getByLabel("Output", { exact: true });
  await input.fill('{"a":1,\n"b":}');
  await page.getByRole("button", { name: "Format", exact: true }).click();
  await expect(page.locator(".tool-workbench").getByRole("alert")).toContainText("Line 2, column 5");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator(".tool-error-preview mark")).toHaveText("}");
  await page.getByRole("button", { name: "Load sample" }).click();
  await page.getByLabel("Indentation").selectOption("4");
  await page.getByRole("button", { name: "Format", exact: true }).click();
  await expect(output).toHaveValue(/\n {4}"team"/);
  await page.getByRole("button", { name: "Copy output" }).click();
  await expect(page.getByText("Copied to clipboard.")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await output.inputValue());
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("result.json");
  expect(await download.failure()).toBeNull();
  await page.getByLabel("Operation").selectOption("minify");
  await page.getByRole("button", { name: "Minify", exact: true }).click();
  expect(await output.inputValue()).toBe(JSON.stringify(JSON.parse(await input.inputValue())));
  await page.getByLabel("Operation").selectOption("validate");
  await page.getByRole("button", { name: "Validate", exact: true }).click();
  await expect(page.getByText("Valid JSON.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(input).toHaveValue("");
  await expect(output).toHaveValue("");
});

test("CSV converts both directions and rejects malformed quoted values", async ({ page }) => {
  await page.goto("/tools/csv");
  const input = page.getByLabel("Input", { exact: true });
  const output = page.getByLabel("Output", { exact: true });
  await page.getByRole("button", { name: "Load sample" }).click();
  await page.getByRole("button", { name: "JSON to CSV" }).click();
  await expect(output).toHaveValue(/"PaLoNex, HQ",10/);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV" }).click();
  expect((await download).suggestedFilename()).toBe("converted.csv");
  await page.getByLabel("Operation").selectOption("to-json");
  await page.getByRole("button", { name: "Load sample" }).click();
  await page.getByRole("button", { name: "CSV to JSON" }).click();
  expect(JSON.parse(await output.inputValue())[1]).toEqual({ name: "東京", score: "8", note: "" });
  await page.getByLabel("First row").selectOption("no");
  await page.getByRole("button", { name: "CSV to JSON" }).click();
  expect(JSON.parse(await output.inputValue())[0]).toEqual({ column_1: "name", column_2: "score", column_3: "note" });
  await input.fill('"invalid');
  await page.getByRole("button", { name: "CSV to JSON" }).click();
  await expect(page.locator(".tool-workbench").getByRole("alert")).toContainText("Unclosed quoted field");
});

test("diff marks line types, hides unchanged lines and swaps inputs", async ({ page }) => {
  await page.goto("/tools/diff");
  await page.getByRole("button", { name: "Load sample" }).click();
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page.locator('[data-kind="same"]')).toHaveCount(2);
  await expect(page.locator('[data-kind="added"]')).toContainText("Implementation");
  await expect(page.locator('[data-kind="removed"]')).toContainText("Draft");
  await page.getByLabel("Show only changes").check();
  await expect(page.locator('[data-kind="same"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Swap inputs" }).click();
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page.locator('[data-kind="removed"]')).toContainText("Implementation");
});

test("Base64 round-trips Unicode and rejects invalid inputs", async ({ page }) => {
  await page.goto("/tools/base64");
  const input = page.getByLabel("Input", { exact: true });
  const output = page.getByLabel("Output", { exact: true });
  await input.fill("नमस्ते 👋");
  await page.getByRole("button", { name: "Encode text" }).click();
  const encoded = await output.inputValue();
  expect(encoded).not.toContain("👋");
  await page.getByLabel("Operation").selectOption("decode");
  await input.fill(encoded);
  await page.getByRole("button", { name: "Decode Base64" }).click();
  await expect(output).toHaveValue("नमस्ते 👋");
  await input.fill("!");
  await page.getByRole("button", { name: "Decode Base64" }).click();
  await expect(page.locator(".tool-workbench").getByRole("alert")).toContainText("valid standard Base64");
});

test("URL modes distinguish value encoding and full URL normalization", async ({ page }) => {
  await page.goto("/tools/url");
  const input = page.getByLabel("Input", { exact: true });
  const output = page.getByLabel("Output", { exact: true });
  await input.fill("a / b");
  await page.getByRole("button", { name: "Encode component" }).click();
  await expect(output).toHaveValue("a%20%2F%20b");
  await page.getByLabel("Operation").selectOption("normalize-url");
  await input.fill("https://example.com/a b?q=東京");
  await page.getByRole("button", { name: "Normalize full URL" }).click();
  await expect(output).toHaveValue("https://example.com/a%20b?q=%E6%9D%B1%E4%BA%AC");
  await page.getByLabel("Operation").selectOption("decode-url");
  await input.fill("https://example.com/a%2Fb?q=a%26b%20c");
  await page.getByRole("button", { name: "Decode full URL for display" }).click();
  await expect(output).toHaveValue("https://example.com/a%2Fb?q=a%26b c");
  await input.fill("https://example.com/%z");
  await page.getByRole("button", { name: "Decode full URL for display" }).click();
  await expect(page.locator(".tool-workbench").getByRole("alert")).toContainText("invalid percent escape");
});

test("SHA-256 hashes actual text and local file bytes and clears output", async ({ page }) => {
  await page.goto("/tools/sha256");
  const digest = page.getByLabel("Hexadecimal digest");
  const expected = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
  await page.getByRole("button", { name: "Load sample" }).click();
  await page.getByRole("button", { name: "Generate hash" }).click();
  await expect(digest).toHaveValue(expected);
  await page.getByRole("radio", { name: "File" }).check();
  await page.getByRole("button", { name: "Generate hash" }).click();
  await expect(page.locator(".tool-workbench").getByRole("alert")).toContainText("Choose a file");
  await page.getByLabel("File to hash").setInputFiles({ name: "local.txt", mimeType: "text/plain", buffer: Buffer.from("abc") });
  await page.getByRole("button", { name: "Generate hash" }).click();
  await expect(digest).toHaveValue(expected);
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(digest).toHaveValue("");
  await expect(page.getByLabel("File to hash")).toHaveValue("");
});

test("UUID validates inputs and exports a batch", async ({ page }) => {
  await page.goto("/tools/uuid");
  const count = page.getByLabel("Number of UUIDs");
  await count.fill("0");
  await page.getByRole("button", { name: "Generate UUIDs" }).click();
  await expect(page.locator(".tool-workbench").getByRole("alert")).toContainText("1 to 100");
  await count.fill("3");
  await page.getByRole("button", { name: "Generate UUIDs" }).click();
  const values = await page.locator(".tool-uuids code").allTextContents();
  expect(new Set(values).size).toBe(3);
  for (const value of values) expect(value).toMatch(/^[a-f0-9-]{14}4/);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download TXT" }).click();
  expect((await download).suggestedFilename()).toBe("uuids.txt");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByRole("list", { name: "Generated UUIDs" })).toHaveCount(0);
});

test("Text Utilities counts graphemes and transforms the input in light mode", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/tools/text");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByLabel("Input", { exact: true }).fill("élan 👋🏽\nélan 👋🏽");
  const count = page.getByRole("button", { name: "Count text" });
  await count.focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".tool-stats")).toContainText("Characters13");
  await expect(page.locator(".tool-stats")).toContainText("Words2");
  await page.getByLabel("Transformation").selectOption("unique");
  await page.getByRole("button", { name: "Transform", exact: true }).click();
  await expect(page.getByLabel("Transformed text")).toHaveValue("élan 👋🏽");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
});

test("private input stays local and hashing explains unavailable Web Crypto", async ({ page }) => {
  const input = "Text only in this workspace: 東京 2d9e1";
  const outbound: string[] = [];
  page.on("request", request => outbound.push(request.url(), request.postData() ?? ""));
  await page.addInitScript(() => Object.defineProperty(crypto, "subtle", { value: undefined }));
  await page.goto("/tools/sha256");
  await page.getByLabel("Text to hash").fill(input);
  await page.getByRole("button", { name: "Generate hash" }).click();
  await expect(page.locator(".tool-workbench").getByRole("alert")).toContainText("requires a secure browser context");
  await page.goto("/tools/base64");
  await page.getByLabel("Input", { exact: true }).fill(input);
  await page.getByRole("button", { name: "Encode text" }).click();
  await expect(page.getByLabel("Output", { exact: true })).toHaveValue(Buffer.from(input).toString("base64"));
  expect(outbound.some(value => value.includes("2d9e1") || value.includes(Buffer.from(input).toString("base64")))).toBe(false);
  expect(await page.evaluate(() => Object.values(localStorage).concat(Object.values(sessionStorage)))).not.toContain(input);
  await page.reload();
  await expect(page.getByLabel("Input", { exact: true })).toHaveValue("");
});
