import { redirect } from "next/navigation";

type Props = { params: Promise<{ requestId: string }> };

/** Older links pointed here; the session portal is the canonical coach/player surface. */
export default async function VerificationInboxRequestRedirect({ params }: Props) {
  const { requestId } = await params;
  redirect(`/verification/session/${requestId}`);
}
