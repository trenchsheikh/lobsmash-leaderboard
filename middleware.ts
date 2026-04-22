import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isSafePostAuthRedirectPath } from "@/lib/safe-redirect-url";

const isPublicRoute = createRouteMatcher([
  "/login(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/join(.*)",
  "/friendly/invite(.*)",
  "/game(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth();

  if (request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = userId ? "/dashboard" : "/login";
    return NextResponse.redirect(url);
  }

  if (
    userId &&
    (request.nextUrl.pathname.startsWith("/login") ||
      request.nextUrl.pathname.startsWith("/sign-up"))
  ) {
    const redirectUrl = request.nextUrl.searchParams.get("redirect_url");
    if (redirectUrl && isSafePostAuthRedirectPath(redirectUrl)) {
      try {
        const u = new URL(redirectUrl, request.url);
        if (isSafePostAuthRedirectPath(u.pathname)) {
          return NextResponse.redirect(u);
        }
      } catch {
        /* fall through */
      }
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
