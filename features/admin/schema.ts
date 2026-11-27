import { z } from "zod";
import { categories } from "../enquiries/constants.ts";
import { statuses } from "../enquiries/schema.ts";

export const staffEmail = z.string().trim().max(254).email().transform(email => email.toLowerCase());

export const loginSchema = z.strictObject({
  email: staffEmail,
  password: z.string().min(1).max(128),
});

export const adminListSchema = z.strictObject({
  status: z.enum(statuses).optional(),
  category: z.enum(Object.keys(categories) as [keyof typeof categories, ...(keyof typeof categories)[]]).optional(),
  search: z.string().trim().max(150).optional(),
  order: z.enum(["newest", "oldest"]).default("newest"),
  cursor: z.strictObject({ time: z.iso.datetime(), id: z.uuid() }).optional(),
});

export const enquiryChange = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("status"), from: z.enum(statuses), to: z.enum(statuses) }),
  z.strictObject({ action: z.literal("note"), note: z.string().trim().min(1).max(2000)
    .regex(/^[^\x00-\x08\x0b\x0c\x0e-\x1f\x7f]+$/u) }),
]);
