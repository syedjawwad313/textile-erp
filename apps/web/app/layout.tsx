import "./globals.css";
import type { Metadata } from "next";
import { AppProviders } from "../providers/app-providers";
import { AppShell } from "../components/layout/app-shell";

export const metadata: Metadata = {
  title: "Textile & Apparel ERP / MES",
  description: "Enterprise Manufacturing Execution System & Commercial ERP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-slate-50">
      <body className="h-full antialiased font-sans text-slate-900 bg-slate-50">
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
