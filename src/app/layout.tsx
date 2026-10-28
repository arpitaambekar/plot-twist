import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: { default: "plot twist.", template: "%s · plot twist." },
  description: "There's always another story. Travel intelligence, destination research and campaign studio.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#FAF9F6" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={GeistSans.variable}>
      <body className="min-h-screen bg-ivory">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
