export default function MainLoading() {
  return (
    <div
      className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 pb-12"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="flex flex-col gap-4">
        <div className="h-9 w-48 max-w-[70%] animate-pulse rounded-lg bg-muted/80 motion-reduce:animate-none" />
        <div className="h-4 w-full max-w-md animate-pulse rounded bg-muted/60 motion-reduce:animate-none" />
        <div className="mt-6 h-40 w-full animate-pulse rounded-xl border border-border/60 bg-muted/30 motion-reduce:animate-none" />
      </div>
    </div>
  );
}
