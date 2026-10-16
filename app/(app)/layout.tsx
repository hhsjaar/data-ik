import Nav, { KeluarButton } from "@/components/Nav";
import { aksesDiwajibkan } from "@/lib/auth";
import { loadReports } from "@/lib/reports";
import { readDb } from "@/lib/store";
import { JENIS_LAPORAN } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const db = await readDb();
  const hitung: Record<string, number> = {};
  try {
    for (const r of await loadReports()) hitung[r.template_type] = (hitung[r.template_type] ?? 0) + 1;
  } catch {
    /* sumber laporan tidak terjangkau: menu tetap tampil tanpa angka */
  }
  const adaHitung = Object.keys(hitung).length > 0;
  const utama = [
    { href: "/", label: "Beranda" },
    { href: "/lokasi", label: "Lokasi Penting", n: db.lokasi.length },
    { href: "/orang", label: "Orang Penting", n: db.orang.length },
    { href: "/kejadian", label: "Kejadian Menonjol", n: db.kejadian.length },
    { href: "/personil", label: "Data Personil Tembalang", n: db.personil.length },
    { href: "/catatan", label: "Catatan WhatsApp", n: db.catatan.length },
  ];
  const jenis = [
    {
      href: "/laporan",
      label: "Semua laporan",
      n: adaHitung ? Object.values(hitung).reduce((a, b) => a + b, 0) : undefined,
    },
    ...JENIS_LAPORAN.map((j) => ({
      href: `/laporan?jenis=${j.key}`,
      label: j.label,
      n: adaHitung ? (hitung[j.key] ?? 0) : undefined,
    })),
  ];
  return (
    <div className="shell">
          <aside className="side">
            <div className="brand">
              <i>IK</i>
              <span>Data IK</span>
            </div>
            <Nav utama={utama} jenis={jenis} />
            <div className="spacer" />
            {aksesDiwajibkan() && <KeluarButton />}
          </aside>
          <main className="main">{children}</main>
        </div>
  );
}
