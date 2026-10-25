import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RAME Guardian — Memory you control",
  description: "A personal AI agent with explicit, versioned, user-authorized memory.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
