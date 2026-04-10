/**
 * User-facing session status. DB rows use `status: "draft"` for in-progress saved sessions;
 * the product surfaces that as "Live".
 */
export function sessionStatusDisplayLabel(status: string): string {
  if (status === "completed") return "Completed";
  if (status === "draft") return "Live";
  return status;
}
