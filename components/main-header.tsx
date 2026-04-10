"use client";

import { useEffect, useState } from "react";
import { useClerk } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, Menu } from "lucide-react";
import { NotificationsBell } from "@/components/notifications-bell";
import { UserAvatarDisplay } from "@/components/user-avatar-display";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDrawerContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type MainHeaderUser = {
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
};

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/friends", label: "Friends" },
  { href: "/profile", label: "Profile" },
] as const;

function navLinkClass(active: boolean) {
  return cn(
    "rounded-lg px-3 py-3 text-base font-medium md:py-2 md:text-sm",
    "transition-[color,background-color,transform] duration-200 ease-out",
    "motion-safe:active:scale-[0.98] motion-reduce:active:scale-100",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    active
      ? "bg-primary/12 text-brand-navy dark:text-sky-300"
      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
  );
}

export function MainHeader({ user }: { user: MainHeaderUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useClerk();
  const displayName = user.name?.trim() || user.username?.trim() || "Account";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-0 bg-transparent px-3 pt-3 sm:px-4 sm:pt-4">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between gap-2 rounded-2xl border border-border bg-card/95 px-3 shadow-md backdrop-blur-xl ring-1 ring-black/[0.04] sm:h-14 sm:gap-4 sm:px-4 dark:border-white/12 dark:bg-white/10 dark:ring-white/10">
        <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-10">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 md:hidden"
            aria-label="Open menu"
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-main-nav"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="size-5" aria-hidden />
          </Button>
          <Link
            href="/dashboard"
            transitionTypes={["nav"]}
            className={cn(
              "inline-flex min-w-0 shrink-0 items-center rounded-md",
              "transition-[opacity,transform] duration-200 ease-out hover:opacity-90",
              "motion-safe:active:scale-[0.98] motion-reduce:active:scale-100",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            )}
          >
            <Image
              src="/lobsmash-logo-removebg-preview.png"
              alt="LobSmash"
              width={160}
              height={160}
              className="h-8 w-auto sm:h-9"
              priority
            />
          </Link>
          <nav
            className="hidden items-center gap-1 md:flex md:gap-2"
            aria-label="Main"
          >
            {navItems.map(({ href, label }) => {
              const active =
                pathname === href ||
                (href !== "/dashboard" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  transitionTypes={["nav"]}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-lg px-2.5 py-2 text-sm font-medium md:px-3",
                    "transition-[color,background-color,transform] duration-200 ease-out",
                    "motion-safe:active:scale-[0.98] motion-reduce:active:scale-100",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    active
                      ? "bg-primary/12 text-brand-navy dark:text-sky-300"
                      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <DialogDrawerContent
            id="mobile-main-nav"
            className="pb-[env(safe-area-inset-bottom,0px)]"
            showCloseButton
          >
            <DialogHeader className="border-b border-border/80 px-4 py-3 pr-12">
              <DialogTitle className="font-heading text-left text-lg">Menu</DialogTitle>
            </DialogHeader>
            <nav className="flex flex-col gap-0.5 p-2" aria-label="Main">
              {navItems.map(({ href, label }) => {
                const active =
                  pathname === href ||
                  (href !== "/dashboard" && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileNavOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={navLinkClass(active)}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-auto border-t border-border/80 p-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full justify-center gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  setMobileNavOpen(false);
                  void signOut({ redirectUrl: "/login" });
                }}
              >
                <LogOut className="size-4" aria-hidden />
                Sign out
              </Button>
            </div>
          </DialogDrawerContent>
        </Dialog>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <NotificationsBell />
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "flex max-w-[min(100%,220px)] items-center gap-2 rounded-full py-1 pr-1.5 pl-1 outline-none",
                "ring-offset-background hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              )}
              aria-label="Account menu"
            >
              <UserAvatarDisplay
                name={user.name}
                username={user.username}
                avatarUrl={user.avatarUrl}
                size="sm"
                className="ring-2 ring-background"
              />
              <span className="hidden min-w-0 truncate text-left text-sm font-medium lg:inline">
                {displayName}
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-0.5">
                    <span className="truncate text-sm font-medium">{displayName}</span>
                    {user.username ? (
                      <span className="truncate font-mono text-xs text-muted-foreground">
                        @{user.username}
                      </span>
                    ) : null}
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => router.push("/profile")}>
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/dashboard")}>
                  Dashboard
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => signOut({ redirectUrl: "/login" })}
                >
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
