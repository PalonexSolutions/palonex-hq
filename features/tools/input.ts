export const textLimit = 500_000;
export function checkSize(input: string, limit = textLimit) {
  if (input.length > limit) throw new Error(`Input exceeds the ${limit.toLocaleString("en-US")} character limit.`);
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The operation could not be completed.";
}

export const splitLines = (input: string) => input.split(/\r\n|\r|\n/);
