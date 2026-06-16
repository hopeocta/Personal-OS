import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal OS",
  description: "Personal dashboard",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Personal OS", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#F2EEE3",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className="dark">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
