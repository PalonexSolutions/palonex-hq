"use client";

export default function AdminError({ reset }: { reset: () => void }) {
  return <section className="shell admin-shell">
    <h1>Administration unavailable</h1>
    <p className="lede" role="alert">Please try again. If the issue persists, contact your system administrator.</p>
    <button className="button" onClick={reset}>Try again</button>
  </section>;
}
