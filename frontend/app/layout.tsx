import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grok Batch Video Generator",
  description: "Generate multiple 10s clips with Grok and merge them into one video.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
