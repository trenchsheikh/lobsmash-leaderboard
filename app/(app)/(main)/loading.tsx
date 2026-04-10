import { Spinner } from "@/components/ui/spinner";

export default function MainLoading() {
  return (
    <div
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-16 pb-12"
      aria-busy="true"
      aria-label="Loading"
    >
      <Spinner className="size-8 text-muted-foreground" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
