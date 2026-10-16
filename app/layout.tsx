import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Data IK",
  description: "Arsip laporan intelkam dan data khusus (lokasi penting, orang penting, kejadian menonjol).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
