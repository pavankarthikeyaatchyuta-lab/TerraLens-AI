import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="dark">
      <body className="min-h-screen bg-tactical-900 text-slate-200 antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
        {children}
      </body>
    </html>
  );
}
