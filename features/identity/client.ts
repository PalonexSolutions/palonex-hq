"use client";

export async function submitIdentity(operation: string, data: object = {}) {
  const response = await fetch(`/api/identity/${operation}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.error ?? "The request could not be completed. Please try again.");
  }
}

export async function publicLogout() {
  await submitIdentity("logout");
  window.location.replace("/login");
}
