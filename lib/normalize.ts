const GELAR = new Set([
  "bapak", "ibu", "sdr", "sdri", "saudara", "saudari", "bpk", "h", "hj", "drs", "dra", "dr", "ir", "prof", "kh", "kyai", "kiai",
  "ustadz", "ustad", "ust", "ustadzah", "gus", "habib", "romo", "pdt", "pendeta", "pastor", "mgr", "ky", "nyai", "mayor", "letkol",
  "kolonel", "kapten", "serka", "serda", "sertu", "peltu", "pelda", "kompol", "akp", "akbp", "iptu", "ipda", "aiptu", "aipda",
  "bripka", "brigadir", "briptu", "bripda", "kombes", "drh", "apt", "ns", "dato", "tuan", "pak", "bu",
]);

/** Kunci pencocokan nama orang: tanpa gelar depan/belakang, huruf kecil, tanpa tanda baca. */
export function namaKey(nama: string): string {
  const depan = nama.split(",")[0] ?? nama; // gelar belakang biasanya setelah koma
  const tokens = depan
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[.'’`"]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  while (tokens.length > 1 && GELAR.has(tokens[0])) tokens.shift();
  return tokens.join(" ");
}

/** Kunci pencocokan nama tempat. */
export function tempatKey(nama: string): string {
  return nama
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[.'’`"]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Kunci dari isi kurung, mis. "Universitas Diponegoro (Undip)" -> "undip". */
export function kunciKurung(nama: string): string[] {
  return [...nama.matchAll(/\(([^)]+)\)/g)].map((m) => tempatKey(m[1])).filter((k) => k.length >= 2);
}

const STOP = new Set(["di", "dan", "yang", "ke", "dari", "pada", "kota", "kecamatan", "kel", "kelurahan", "kec", "jl", "jalan", "semarang", "tembalang"]);

export function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOP.has(t)),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n / (a.size + b.size - n);
}

export const rapi = (s: unknown, max = 600) =>
  (typeof s === "string" ? s : s == null ? "" : String(s)).replace(/\s+/g, " ").trim().slice(0, max);

const tokenSama = (a: string, b: string) => a === b || (a.length === 1 && b.startsWith(a)) || (b.length === 1 && a.startsWith(b));

/**
 * Dua nama dianggap orang yang sama bila kuncinya sama, atau yang pendek adalah awalan dari yang panjang
 * (inisial seperti "P." cocok dengan "Pramestuti").
 */
export function namaCocok(a: string, b: string): boolean {
  if (a === b) return true;
  const [pendek, panjang] = a.length <= b.length ? [a, b] : [b, a];
  const tp = pendek.split(" ");
  const tl = panjang.split(" ");
  if (tp.length > tl.length) return false;
  if (!tp.every((t, i) => tokenSama(t, tl[i]))) return false;
  return tp.length >= 2 || tp[0].length >= 7;
}

/** Kunci longgar nama tempat untuk menggabungkan varian penulisan. */
export function tempatKunciLonggar(nama: string): string[] {
  return tempatKey(nama)
    .replace(/\b(ponpes|pp)\b/g, "pondok pesantren")
    .replace(/\b(tradisional|umum|kota)\b/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Tempat yang sama: kata pertama sama dan kata-kata yang pendek seluruhnya ada di yang panjang. */
export function tempatSama(a: string, b: string): boolean {
  const ta = tempatKunciLonggar(a);
  const tb = tempatKunciLonggar(b);
  const [pendek, panjang] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (pendek.length < 2 || pendek[0] !== panjang[0]) return false;
  const set = new Set(panjang);
  return pendek.every((t) => set.has(t));
}
