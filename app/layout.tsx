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

export const metadata: Metadata = {
  title: "LobSmash",
  description: "League sessions, games, and leaderboards",
  icons: {
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
      <body className="flex min-h-full flex-col">
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
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
