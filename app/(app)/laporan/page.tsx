import { Suspense } from "react";
import LaporanBrowser from "@/components/LaporanBrowser";

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Memuat…</p>}>
      <LaporanBrowser />
    </Suspense>
  );
}
