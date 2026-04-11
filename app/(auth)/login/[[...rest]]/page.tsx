import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";
import { isSafeJoinRedirectPath } from "@/lib/safe-redirect-url";

type PageProps = { searchParams: Promise<{ redirect_url?: string }> };

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to LobSmash — leagues, sessions, and leaderboards.",
};

export default async function LoginPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const safeRedirect = isSafeJoinRedirectPath(sp.redirect_url)
    ? sp.redirect_url
    : undefined;
  const fallbackRedirectUrl = safeRedirect ?? "/dashboard";
  const signUpUrl = safeRedirect
    ? `/sign-up?redirect_url=${encodeURIComponent(safeRedirect)}`
    : "/sign-up";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <SignIn
        path="/login"
        routing="path"
        fallbackRedirectUrl={fallbackRedirectUrl}
        signUpUrl={signUpUrl}
      />
    </div>
  );
}
