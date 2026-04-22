import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";
import { courtEliteAuthAppearance } from "@/lib/clerk-auth-appearance";
import { isSafePostAuthRedirectPath } from "@/lib/safe-redirect-url";

type PageProps = { searchParams: Promise<{ redirect_url?: string }> };

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to LobSmash — leagues, sessions, and leaderboards.",
};

export default async function LoginPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const safeRedirect = isSafePostAuthRedirectPath(sp.redirect_url)
    ? sp.redirect_url
    : undefined;
  const fallbackRedirectUrl = safeRedirect ?? "/dashboard";
  const signUpUrl = safeRedirect
    ? `/sign-up?redirect_url=${encodeURIComponent(safeRedirect)}`
    : "/sign-up";

  return (
    <div className="flex w-full flex-col items-stretch">
      <SignIn
        path="/login"
        routing="path"
        appearance={courtEliteAuthAppearance}
        fallbackRedirectUrl={fallbackRedirectUrl}
        signUpUrl={signUpUrl}
      />
    </div>
  );
}
