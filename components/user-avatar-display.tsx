"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { userInitials } from "@/lib/user-display";
import { cn } from "@/lib/utils";

type Props = {
  name: string | null | undefined;
  username: string | null | undefined;
  avatarUrl: string | null | undefined;
  className?: string;
  size?: "sm" | "default" | "lg" | "xl";
};

const sizeClass: Record<NonNullable<Props["size"]>, string> = {
  sm: "size-8 text-xs",
  default: "size-10 text-sm",
  lg: "size-20 text-2xl",
  xl: "size-28 text-3xl sm:size-32 sm:text-4xl",
};

export function UserAvatarDisplay({
  name,
  username,
  avatarUrl,
  className,
  size = "default",
}: Props) {
  const initials = userInitials(name, username);

  return (
    <Avatar
      data-slot="user-avatar-display"
      size={size === "lg" || size === "xl" ? "lg" : size === "sm" ? "sm" : "default"}
      className={cn(sizeClass[size], className)}
    >
      {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
      <AvatarFallback className="bg-primary/15 font-semibold text-primary">{initials}</AvatarFallback>
    </Avatar>
  );
}
