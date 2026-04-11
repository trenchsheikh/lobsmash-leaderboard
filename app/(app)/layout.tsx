import { maybeRecordLastSeenIp } from "@/lib/auth/last-seen";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await maybeRecordLastSeenIp();
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-transparent">{children}</div>
  );
}
