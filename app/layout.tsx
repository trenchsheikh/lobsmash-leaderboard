import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Geist_Mono, Outfit, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const fontHeading = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const fontSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "LobSmash",
  description: "League sessions, games, and leaderboards",
  icons: {
    icon: [{ url: "/lobsmash-logo.svg", type: "image/svg+xml" }],
    shortcut: "/lobsmash-logo.svg",
    apple: "/lobsmash-logo.png",
  },
  openGraph: {
    title: "LobSmash",
    description: "League sessions, games, and leaderboards",
    images: ["/lobsmash-logo.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "LobSmash",
    description: "League sessions, games, and leaderboards",
    images: ["/lobsmash-logo.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  /** Lets the page show through browser chrome instead of a flat tint over the shell. */
  themeColor: "transparent",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontHeading.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="app-body">
        <div className="app-root">
          <ClerkProvider
            appearance={{
              variables: {
                colorPrimary: "#99e600",
                colorBackground: "#ffffff",
                colorText: "#002d62",
                colorTextSecondary: "#3d5670",
                colorInputBackground: "#f0f4f8",
                colorInputText: "#002d62",
              },
              elements: {
                card: "shadow-xl border border-border/60",
              },
            }}
          >
            {children}
          </ClerkProvider>
        </div>
        <div className="shrink-0">
          <Toaster richColors position="top-right" />
        </div>
      </body>
    </html>
  );
}
