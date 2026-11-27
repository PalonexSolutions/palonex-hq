import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/server/admin-auth";
import { HttpError } from "@/lib/server/http";

export const adminPage = cache(async () => {
  try { return await requireAdmin(new Headers(await headers())); }
  catch (error) {
    if (error instanceof HttpError && error.status === 401) redirect("/admin/login");
    throw error;
  }
});
