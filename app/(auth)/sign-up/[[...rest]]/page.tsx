import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";
import { isSafeJoinRedirectPath } from "@/lib/safe-redirect-url";

type PageProps = { searchParams: Promise<{ redirect_url?: string }> };

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create a LobSmash account — leagues, sessions, and leaderboards.",
};

export default async function SignUpPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const safeRedirect = isSafeJoinRedirectPath(sp.redirect_url)
    ? sp.redirect_url
    : undefined;
  const fallbackRedirectUrl = safeRedirect ?? "/dashboard";
  const signInUrl = safeRedirect
    ? `/login?redirect_url=${encodeURIComponent(safeRedirect)}`
    : "/login";

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col items-stretch justify-start gap-4 py-1 sm:items-center sm:justify-center sm:gap-6 sm:py-4">
      <SignUp
        path="/sign-up"
        routing="path"
        fallbackRedirectUrl={fallbackRedirectUrl}
        signInUrl={signInUrl}
        appearance={{
          elements: {
            rootBox: "w-full max-w-full",
            card: "w-full max-w-full shadow-lg border border-border/60 sm:shadow-xl",
            cardBox: "w-full",
            formButtonPrimary:
              "bg-primary text-primary-foreground hover:bg-primary/90 font-medium",
          },
        }}
      />
    </div>
  );
}
