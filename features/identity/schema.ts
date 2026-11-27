import { z } from "zod";

export const consentVersion = "2026-11-28";
export const publicRoles = ["registered", "intern", "trainer", "moderator"] as const;
export type PublicRole = (typeof publicRoles)[number];
export type IdentityRole = "visitor" | PublicRole | "administrator" | "super_administrator";
export const hasVerifiedAccess = (principal: { status: string; emailVerified: boolean }) =>
  principal.status === "active" && principal.emailVerified;

export const publicEmail = z.string().trim().max(254).email().transform(email => email.toLowerCase());
const name = z.string().trim().min(2, "Enter your full name.").max(100).regex(/^[^\x00-\x1f\x7f]+$/u);
const password = z.string().min(14, "Use at least 14 characters.").max(128)
  .refine(value => /\S/u.test(value) && new Set(value).size >= 6, "Choose a less repetitive passphrase.");
const confirmation = z.string().max(128);
const link = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const honeypot = z.literal("");
const existingPassword = z.string().min(1).max(128);

export const forms = {
  register: z.strictObject({ name, email: publicEmail, password, confirmation, consent: z.literal(true), website: honeypot })
    .refine(values => values.password === values.confirmation, { message: "Passwords must match." }),
  login: z.strictObject({ email: publicEmail, password: existingPassword }),
  resend: z.strictObject({ email: publicEmail }),
  forgot: z.strictObject({ email: publicEmail }),
  verify: z.strictObject({ link }),
  reset: z.strictObject({ link, password, confirmation })
    .refine(values => values.password === values.confirmation, { message: "Passwords must match." }),
  profile: z.strictObject({ name }),
  password: z.strictObject({ currentPassword: existingPassword, password, confirmation })
    .refine(values => values.password === values.confirmation, { message: "Passwords must match." }),
};
