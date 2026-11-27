import Link from "next/link";
import type { QueueStats } from "@/lib/server/admin-enquiries";

const formatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
});

export function dateTime(value: Date | string) {
  return formatter.format(new Date(value)) + " UTC";
}

export function StatusPill({ status }: { status: string }) {
  return <span className="status">{status.toLowerCase().replaceAll("_", " ")}</span>;
}

export function Metrics({ values }: { values: [string, number][] }) {
  return <dl className="admin-metrics">
    {values.map(([label, value]) => <div className="card" key={label}><dt>{label}</dt><dd>{value.toLocaleString("en-GB")}</dd></div>)}
  </dl>;
}

export function QueueSummary({ queue }: { queue: QueueStats }) {
  return <>
    <Metrics values={[["Pending", queue.pending], ["Accepted by provider", queue.accepted], ["Failed", queue.failed]]} />
    <p className="admin-muted">{queue.oldest_pending ? `Oldest pending: ${dateTime(queue.oldest_pending)} (${queue.pending_hours}h ago).` : "No pending deliveries."}</p>
  </>;
}

export function EnquiryLink({ id, children }: { id: string; children: React.ReactNode }) {
  return <Link className="text-link" prefetch={false} href={`/admin/enquiries/${id}`}>{children}</Link>;
}
