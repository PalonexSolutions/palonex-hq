import { adminPage } from "@/features/admin/access";
import { EnquiryList } from "@/features/admin/enquiry-list";
import { listEnquiries } from "@/lib/server/enquiries";

export default async function AdminEnquiries() {
  await adminPage();
  const initial = await listEnquiries();
  return <>
    <h1>Enquiries</h1>
    <EnquiryList initial={{ ...initial, items: initial.items.map(item => ({
      id: item.id, full_name: item.full_name, email: item.email, subject: item.subject,
      category: item.category, status: item.status, created_at: item.created_at.toISOString(),
    })) }} />
  </>;
}
