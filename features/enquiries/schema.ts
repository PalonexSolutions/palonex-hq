import { z } from "zod";

import { categories } from "./constants.ts";

export const statuses = ["NEW", "IN_PROGRESS", "RESOLVED", "ARCHIVED"] as const;
export type Status = (typeof statuses)[number];

const oneLine = (min: number, max: number) => z.string().trim().min(min).max(max).regex(/^[^\x00-\x1f\x7f]+$/u, "Use a single line.");
export const enquirySchema = z.strictObject({
  fullName: oneLine(2, 100),
  email: z.string().trim().max(254).email().transform(email => email.toLowerCase()),
  organization: z.union([z.literal(""), oneLine(1, 150)]).optional().transform(value => value || null),
  category: z.enum(Object.keys(categories) as [keyof typeof categories, ...(keyof typeof categories)[]]),
  subject: oneLine(4, 150),
  message: z.string().trim().min(10).max(5000).regex(/^[^\x00-\x08\x0b\x0c\x0e-\x1f\x7f]+$/u, "Message contains unsupported control characters."),
  consent: z.literal(true, { error: "Consent is required to submit an enquiry." }),
  website: z.literal(""),
  token: z.string().max(180),
});
export type EnquiryInput = z.output<typeof enquirySchema>;
