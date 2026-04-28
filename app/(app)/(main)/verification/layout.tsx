import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";

export default function VerificationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/profile"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "gap-1.5 text-muted-foreground hover:text-foreground",
          )}
        >
          <ChevronLeft className="size-4" aria-hidden />
          Profile
        </Link>
        <span className="text-muted-foreground/40" aria-hidden>
          /
        </span>
        <span className="font-medium text-foreground">Verification</span>
      </div>
      {children}
    </div>
  );
}
