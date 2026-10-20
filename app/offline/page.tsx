export const metadata = { title: "Offline · Data IK" };

// Halaman statis tanpa data; dipakai service worker saat tidak ada koneksi.
export default function Offline() {
  return (
    <div className="login">
      <div className="panel" style={{ maxWidth: 380, textAlign: "center" }}>
        <div className="brand" style={{ justifyContent: "center", padding: 0, marginBottom: 12 }}>
          <i>IK</i>
          <span>Data IK</span>
        </div>
        <h2>Tidak ada koneksi</h2>
        <p className="muted">Data IK butuh internet karena datanya tidak disimpan di perangkat. Sambungkan lagi lalu coba kembali.</p>
        <a className="btn primary" href="/">Coba lagi</a>
      </div>
    </div>
  );
}
