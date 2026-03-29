/** Full-viewport fabric background for the main app shell (all routes under `(main)`). */
export function MainShellBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 min-h-[100dvh] bg-[url('/mobile-background.png')] bg-cover bg-center bg-no-repeat opacity-[0.72] md:bg-[url('/main-background.png')] md:bg-fixed"
    />
  );
}
