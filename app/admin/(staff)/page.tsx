import { adminPage } from "@/features/admin/access";
import { dateTime, EnquiryLink, Metrics, QueueSummary, StatusPill } from "@/features/admin/view";
import { overview } from "@/lib/server/admin-enquiries";

export default async function AdminHome() {
  await adminPage();
  const { counts, recent, volume, notifications } = await overview();
  return <>
    <h1>Enquiry overview</h1>
    <Metrics values={[["Total enquiries", counts.total], ["New", counts.new], ["In progress", counts.in_progress], ["Resolved", counts.resolved]]} />
    <div className="admin-columns">
      <section className="card admin-section">
        <h2>Recent enquiries</h2>
        {recent.length ? <ul className="admin-rows">{recent.map(item => <li key={item.id}>
          <div><EnquiryLink id={item.id}>{item.subject}</EnquiryLink><p>{dateTime(item.created_at)}</p></div>
          <StatusPill status={item.status} />
        </li>)}</ul> : <p>No enquiries yet.</p>}
      </section>
      <section className="card admin-section">
        <h2>Enquiry volume</h2>
        {volume.length ? <>
          <p>Days with submissions in the last 14 days (UTC).</p>
          <ul className="admin-bars">{volume.map(day => <li key={day.day}>
            <span>{day.day}</span><meter aria-label={`Enquiries on ${day.day}`} max={Math.max(...volume.map(row => row.total))} value={day.total} /><strong>{day.total}</strong>
          </li>)}</ul>
        </> : <p>No submissions in the last 14 days.</p>}
      </section>
    </div>
    <section className="card admin-section">
      <h2>Notification queue</h2>
      <QueueSummary queue={notifications} />
    </section>
  </>;
}
