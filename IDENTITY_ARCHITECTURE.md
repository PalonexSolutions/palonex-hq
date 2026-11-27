# PaLoNex identity architecture

HQ uses Better Auth and PostgreSQL for a single public identity directory. Public registration creates a UUID in `palonex_private.identity_user`. Future HQ, AI SuperApp, InternHub and Connect records can reference that ID. Email identifies a login but is unsuitable as a cross-product foreign key. Accounts record verified email, active or suspended state, consent version and time, and the user's name.

## Trust boundaries

Staff credentials, sessions and allowlist still use `admin_*` tables, `BETTER_AUTH_SECRET` and the `palonex-admin` cookie. Public accounts use the same authentication library and private database, with `identity_*` tables, `PUBLIC_AUTH_SECRET` and the `palonex-public` cookie. An email matching a staff address grants no staff privileges. The staff CLI and existing eight-hour staff sessions remain in place. No generic Better Auth handler is mounted.

Visitors have no authenticated claims. A verified active identity has registered-user access. The `identity_role` table and server guard support intern, trainer and moderator grants. Public accounts cannot write role or status fields. Product grants may be provisioned by a future authorized workflow. Existing staff provisioned in `admin_staff` have administrator access. Super administrator is reserved for a future staff authorization policy.

## Account and email lifecycle

Registration validates consent, normalizes the email, hashes the password with Better Auth and leaves the address unverified. Non-enumerating endpoints acknowledge eligible registration, resend and recovery requests. The login endpoint requires a verified active account. Public sessions expire after seven days without renewal. Profile changes derive their identity from the verified session. Password changes rotate sessions and sign out other browsers. Password resets revoke all sessions.

Verification and recovery callbacks enqueue email in PostgreSQL. Only a random one-time grant appears in the email URL fragment. A hash of the grant is stored in the database and the underlying Better Auth token is encrypted at rest. The reset identifier is also hashed by Better Auth. The server atomically consumes the grant, then calls Better Auth to verify or reset. The most recent message invalidates earlier unused grants of that type. Verification expires after one hour, recovery after 30 minutes. An interrupted redemption may require requesting a fresh link.

The identity email worker uses the same Resend provider as the enquiry outbox, with a separate scheduler route and job queue. It claims up to five jobs using leases and stable provider idempotency keys. Jobs can retry before expiry. Opening admin pages does not dispatch mail.

## Security review

- **Bypass and privilege escalation.** Every protected operation verifies its own realm and enforces account state. Strict schemas reject role and verification edits. The two realms use distinct keys, cookies and session tables.
- **Session fixation and revocation.** Sign-in issues a fresh session. Logout, staff suspension and password reset invalidate persisted sessions. Cookies are HttpOnly, SameSite=Lax for public accounts and Secure on HTTPS. Plain HTTP is allowed on loopback only.
- **CSRF and redirects.** Every mutation validates the exact configured origin. Login navigates only to the fixed account destination. Email links use the configured origin.
- **IDOR and injection.** Public profile data is scoped by session UUID, with no caller-supplied account identifier. Staff account operations require separate staff authorization and use bound SQL parameters.
- **Enumeration and abuse.** Responses for registration, resend and recovery are generic. Recovery responses have a timing floor. Quotas apply to subject, network and global keys in PostgreSQL. Limit counters use keyed hashes. These measures reduce abuse without providing proof of humanity.
- **Credential and token handling.** Public APIs never return auth-library response bodies or credentials. Account routes disallow indexing, framing and caching. The fragment avoids normal URL access logs. Keep production infrastructure from logging request bodies, cookies and provider payloads.
- **Administration.** Staff can see basic public account information and change account status. Suspension revokes sessions and outstanding links. Status changes and audit entries share a transaction. Private schema access is granted only to the application and maintenance roles.

## Future products

Use central UUIDs in product-specific foreign keys and define per-product entitlements when each product ships. Keep authentication and role authority centralized. Each future application must establish its own verified session and authorization checks. Separate deployed origins will need an explicit federated sign-in mechanism and redirect policy. Cross-origin SSO, OAuth/OIDC and shared cookie domains are outside this milestone.
