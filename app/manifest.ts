import type { MetadataRoute } from "next";

// Manifest PWA. Bisa diambil tanpa login (proxy.ts mengecualikannya); tidak memuat data apa pun.
export default function manifest(): MetadataRoute.Manifest {
  const ikon = [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }];
  return {
    id: "/",
    name: "Data IK",
    short_name: "Data IK",
    description: "Arsip laporan intelkam dan data khusus: lokasi penting, orang penting, kejadian menonjol, personil.",
    lang: "id",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f5f6f8",
    theme_color: "#1d4ed8",
    categories: ["productivity", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Pintasan saat ikon ditekan lama (Android).
    shortcuts: [
      { name: "Lokasi Penting", short_name: "Lokasi", url: "/lokasi", icons: ikon },
      { name: "Orang Penting", short_name: "Orang", url: "/orang", icons: ikon },
      { name: "Data Personil", short_name: "Personil", url: "/personil", icons: ikon },
      { name: "Perlu Dipilih", short_name: "Koreksi", url: "/koreksi", icons: ikon },
      { name: "Catatan WhatsApp", short_name: "Catatan", url: "/catatan", icons: ikon },
    ],
  };
}
