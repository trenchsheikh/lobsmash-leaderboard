/** Full-viewport shell backdrop: gradient + grain + mesh (see globals.css). */
export function MainShellBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed top-[calc(-1*env(safe-area-inset-top,0px))] right-[calc(-1*env(safe-area-inset-right,0px))] bottom-[calc(-1*env(safe-area-inset-bottom,0px))] left-[calc(-1*env(safe-area-inset-left,0px))] z-0 md:inset-0"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/12 to-primary/28 dark:via-primary/18 dark:to-primary/35" />
      <div className="main-shell-grain absolute inset-0 opacity-[0.4] mix-blend-multiply dark:opacity-[0.22] dark:mix-blend-soft-light" />
      <div className="main-shell-mesh absolute inset-0 opacity-[0.55] dark:opacity-[0.35]" />
    </div>
  );
}
