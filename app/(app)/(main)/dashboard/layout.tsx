export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 overflow-x-clip px-3 sm:px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[url('/main-background.png')] bg-cover bg-center bg-no-repeat md:bg-fixed"
      />
      <div className="relative z-10 flex min-h-[calc(100vh-10rem)] flex-col">{children}</div>
    </div>
  );
}
