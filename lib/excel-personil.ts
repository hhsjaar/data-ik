import * as XLSX from "xlsx";
import { rapi } from "./normalize";
import { statusDariNomor, unitDariJabatan } from "./personil";

export type BarisPersonil = { no: number; nama: string; pangkat: string; nrp: string; jabatan: string; unit: string; status: string; keterangan: string };

/**
 * Baca "DATA NOMINATIF RIIL PERSONEL" (.xls/.xlsx). Kolom: NO, NAMA, PANGKAT, NRP/NIP, JABATAN, KET.
 * Baris lanjutan tanpa nama (mis. NIP PNS yang terpecah dua baris: "19780520" lalu "2002121006", dan pangkat
 * "TK 1" untuk PENGATUR TK I) digabung ke baris orang di atasnya.
 */
export function bacaPersonil(buf: ArrayBuffer | Buffer): BarisPersonil[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("File Excel kosong.");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: false });

  // Cari baris judul kolom (mengandung NAMA dan PANGKAT).
  const h = rows.findIndex((r) => r.some((c) => /^nama$/i.test(String(c).trim())) && r.some((c) => /^pangkat$/i.test(String(c).trim())));
  if (h < 0) throw new Error('Baris judul kolom (NO, NAMA, PANGKAT, NRP/NIP, JABATAN, KET) tidak ditemukan.');
  const kol = (re: RegExp) => rows[h].findIndex((c) => re.test(String(c).trim()));
  const iNo = kol(/^no\.?$/i), iNama = kol(/^nama$/i), iPangkat = kol(/^pangkat$/i), iNrp = kol(/nrp|nip/i), iJab = kol(/^jabatan$/i), iKet = kol(/^ket/i);
  if ([iNama, iPangkat, iNrp, iJab].some((i) => i < 0)) throw new Error("Kolom NAMA / PANGKAT / NRP-NIP / JABATAN tidak lengkap.");

  const cell = (r: unknown[], i: number) => (i < 0 ? "" : rapi(r[i], 200));
  const out: BarisPersonil[] = [];
  for (const r of rows.slice(h + 1)) {
    const nama = cell(r, iNama);
    const nomor = cell(r, iNrp).replace(/\s+/g, "");
    if (!nama) {
      // baris lanjutan
      const last = out[out.length - 1];
      if (last && (nomor || cell(r, iPangkat))) {
        if (nomor) last.nrp += nomor;
        const tambahan = cell(r, iPangkat);
        if (tambahan) last.pangkat = `${last.pangkat} ${tambahan}`.trim();
        last.status = statusDariNomor(last.nrp);
      }
      continue;
    }
    const jabatan = cell(r, iJab);
    out.push({
      no: Number(cell(r, iNo)) || out.length + 1,
      nama,
      pangkat: cell(r, iPangkat),
      nrp: nomor,
      jabatan,
      unit: unitDariJabatan(jabatan),
      status: statusDariNomor(nomor),
      keterangan: cell(r, iKet),
    });
  }
  return out;
}
