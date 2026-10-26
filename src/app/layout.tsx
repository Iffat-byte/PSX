import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = {
  title: { default: "PSX Pilot — Your Intelligent Investing Workspace", template: "%s · PSX Pilot" },
  description: "Portfolio management, investment calculators, trade journal and behavioral insights for Pakistan Stock Exchange investors.",
  manifest: "/manifest.webmanifest",
  applicationName: "PSX Pilot",
  appleWebApp: { capable: true, title: "PSX Pilot", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#070b14" },
    { media: "(prefers-color-scheme: light)", color: "#f5f7fa" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Apply the saved theme before paint to avoid a flash.
const themeScript = `try{var s=JSON.parse(localStorage.getItem('psx-pilot:v1')||'{}');var t=(s.state&&s.state.settings&&s.state.settings.theme)||'dark';if(t==='dark')document.documentElement.classList.add('dark')}catch(e){document.documentElement.classList.add('dark')}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Suspense>
          <AppShell>{children}</AppShell>
        </Suspense>
      </body>
    </html>
  );
}
