/** Full-viewport fabric background for the main app shell (all routes under `(main)`). */
export function MainShellBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed top-[calc(-1*env(safe-area-inset-top,0px))] right-[calc(-1*env(safe-area-inset-right,0px))] bottom-[calc(-1*env(safe-area-inset-bottom,0px))] left-[calc(-1*env(safe-area-inset-left,0px))] z-0 bg-[url('/mobile-background.png')] bg-cover bg-center bg-no-repeat opacity-[0.72] md:inset-0 md:bg-[url('/main-background.png')] md:bg-fixed"
    />
  );
}
