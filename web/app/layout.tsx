import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/themeContext";

export const metadata: Metadata = {
  title: "TerraLens AI — Semantic Satellite Intelligence",
  description:
    "Smart India Hackathon 2026 (SIH26227) — Semantic Retrieval and Multi-Temporal Change Analysis of Satellite Imagery",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-tactical-900 text-foreground antialiased selection:bg-sky-500/20 selection:text-sky-900 dark:selection:text-sky-200">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
