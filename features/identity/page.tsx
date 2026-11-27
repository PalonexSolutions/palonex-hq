import "server-only";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { currentIdentity } from "@/lib/server/identity-auth";

export const privatePageMetadata = (title: string, description?: string): Metadata => ({
  title, description, robots: { index: false, follow: false },
});

export async function publicAccount() {
  return currentIdentity(new Headers(await headers()));
}

export async function redirectSignedIn() {
  if (await publicAccount()) redirect("/account");
}

export function IdentityPanel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="shell content-page identity-page">
    <section className="card identity-panel">
      <p className="eyebrow">PALONEX ACCOUNT</p>
      <h1>{title}</h1>
      <p className="lede">{description}</p>
      {children}
    </section>
  </div>;
}
