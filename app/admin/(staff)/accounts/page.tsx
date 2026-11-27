import { adminPage } from "@/features/admin/access";
import { PublicAccounts } from "@/features/admin/public-accounts";
import { Metrics } from "@/features/admin/view";
import { identityCounts, identityListing } from "@/lib/server/identity-admin";

export default async function AdminAccounts() {
  await adminPage();
  const [counts, listing] = await Promise.all([identityCounts(), identityListing("", 1)]);
  return <>
    <h1>Public accounts</h1>
    <Metrics values={[["Total accounts", counts.total], ["Verified", counts.verified], ["Suspended", counts.suspended]]} />
    <PublicAccounts initial={{ ...listing, items: listing.items.map(account => ({
      ...account, createdAt: account.createdAt.toISOString(),
    })) }} />
  </>;
}
