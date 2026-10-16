export const COOKIE = "dataik_akses";

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const aksesDiwajibkan = () => !!process.env.ACCESS_CODE;

export async function tokenAkses() {
  return sha256(`dataik|${process.env.ACCESS_CODE ?? ""}`);
}

export function tokenAgentValid(req: Request) {
  const t = process.env.AGENT_TOKEN;
  if (!t) return false;
  const h = req.headers.get("authorization") ?? "";
  return h === `Bearer ${t}`;
}
