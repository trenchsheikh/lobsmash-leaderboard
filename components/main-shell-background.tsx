/** Full-viewport shell backdrop: gradient + subtle grain (see globals.css). */
export function MainShellBackground() {
  return (
    <div className="main-shell-bg-root" aria-hidden>
      <div className="absolute inset-0 [background-image:var(--shell-gradient)]" />
      <div className="main-shell-grain absolute inset-0 opacity-[0.4] mix-blend-multiply dark:opacity-[0.22] dark:mix-blend-soft-light" />
    </div>
  );
}
