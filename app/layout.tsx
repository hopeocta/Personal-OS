import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal OS",
  description: "Personal dashboard",
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
