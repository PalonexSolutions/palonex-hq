import { adminPage } from "@/features/admin/access";
import { dateTime, EnquiryLink, QueueSummary, StatusPill } from "@/features/admin/view";
import { queueStats, recentDeliveries } from "@/lib/server/admin-enquiries";

export default async function AdminNotifications() {
  await adminPage();
  const [queue, deliveries] = await Promise.all([queueStats(), recentDeliveries()]);
  return <>
    <h1>Notifications</h1>
    <QueueSummary queue={queue} />
    <section className="card admin-section">
      <h2>Recent delivery activity</h2>
      <p>Showing up to 50 jobs. An accepted send means the provider accepted the request.</p>
      {deliveries.length ? <ul className="admin-rows">{deliveries.map(job => <li key={`${job.enquiry_id}-${job.kind}`}>
        <div>
          <EnquiryLink id={job.enquiry_id}>{job.enquiry_id}</EnquiryLink>
          <p>{job.kind === "company" ? "Company notice" : "Acknowledgement"} · {job.attempts} attempts</p>
          <p>Queued {dateTime(job.queued_at)}{job.sent_at ? ` · Accepted ${dateTime(job.sent_at)}` : job.failed_at ? ` · Failed ${dateTime(job.failed_at)}` : ` · Next eligible ${dateTime(job.available_at)}`}</p>
          {job.failed_at && <p className="admin-error">Delivery stopped after the retry limit or retry window.</p>}
        </div>
        <StatusPill status={job.sent_at ? "Accepted" : job.failed_at ? "Failed" : "Pending"} />
      </li>)}</ul> : <p>No notification jobs yet.</p>}
    </section>
  </>;
}
