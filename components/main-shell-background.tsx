/** Grain overlay on top of the document shell gradient (see globals.css html background). */
export function MainShellBackground() {
  return (
    <div className="main-shell-bg-root" aria-hidden>
      <div className="main-shell-grain absolute inset-0 opacity-[0.4] mix-blend-multiply dark:opacity-[0.22] dark:mix-blend-soft-light" />
    </div>
  );
}
