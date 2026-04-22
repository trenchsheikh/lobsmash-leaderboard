import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";
import { courtEliteAuthAppearance } from "@/lib/clerk-auth-appearance";
import { isSafePostAuthRedirectPath } from "@/lib/safe-redirect-url";

type PageProps = { searchParams: Promise<{ redirect_url?: string }> };

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create a LobSmash account — leagues, sessions, and leaderboards.",
};

export default async function SignUpPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const safeRedirect = isSafePostAuthRedirectPath(sp.redirect_url)
    ? sp.redirect_url
    : undefined;
  const fallbackRedirectUrl = safeRedirect ?? "/dashboard";
  const signInUrl = safeRedirect
    ? `/login?redirect_url=${encodeURIComponent(safeRedirect)}`
    : "/login";

  return (
    <div className="flex w-full flex-col items-stretch">
      <SignUp
        path="/sign-up"
        routing="path"
        appearance={courtEliteAuthAppearance}
        fallbackRedirectUrl={fallbackRedirectUrl}
        signInUrl={signInUrl}
      />
    </div>
  );
}
