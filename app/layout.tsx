import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Osservatore CRM",
  description: "CRM professionale per agenzia marketing e quotidiano online"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
