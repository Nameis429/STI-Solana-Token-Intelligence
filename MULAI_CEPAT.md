# MULAI CEPAT (Termux / HP)

Panduan ringkas menjalankan Solana Token Intelligence dari HP. Dibuat 2026-10-11.

## 1. Siapkan aplikasi

```sh
pkg install nodejs
```

Extract ZIP ke folder, misal `~/sti`, lalu masuk ke folder itu:

```sh
cd ~/sti
```

## 2. Pasang API key

Key trial Helius milikmu (bukan key π). Jalankan:

```sh
node Script/set_key.js
```

Tempel key saat diminta, Enter. Key tersimpan lokal di `Config/config.json` — jangan bagikan file itu.

## 3. Verifikasi instalasi (tanpa RPC, cepat)

```sh
npm test
```

Harus **110/110 PASS**.

## 4. Jalankan pipeline

```sh
node main.js
```

- Pilih `00` untuk pipeline penuh (phase 1–12), lalu masukkan alamat mint token.
- Hasil: `Output/<mint>/report.html` — buka di browser HP.
- Skor, confidence, dan verdict Phase 12 (AVOID/CAUTION/WATCH/NEUTRAL_OK) ada di situ.

## 5. Data tambahan (opsional, bila dibutuhkan rule lanjutan)

**Funding graph (untuk CTR-01/02)** — setelah Phase 8 selesai untuk sebuah mint:

```sh
# lewat menu: pilih 14
# atau langsung:
node Script/collect_funding_graph.js <mint>
```

Hasil: `Output/<mint>/funding-graph.json`. Lalu jalankan ulang Phase 9 (`node main.js` → `09`) agar CTR-01/02 ikut dievaluasi.

**Seri likuiditas (untuk LTR-02/03)** — jalankan Phase 4 dua kali di waktu berbeda (misal hari ini dan besok):

```sh
node main.js   # pilih 04, masukkan mint yang sama
```

Tiap scan mengarsip snapshot ke `Output/<mint>/liquidity_history.jsonl`. Setelah ada ≥2 snapshot, jalankan ulang Phase 9.

**Volume market-wide (untuk SPR-03/CTR-04/TCR-01/02/03)** — kolektor ini memindai SEMUA transaksi mint, jadi butuh banyak panggilan RPC (1 per transaksi). Bawaan dibatasi 1500 transaksi:

```sh
# lewat menu: pilih 15
# atau langsung:
node Script/collect_market_volume.js <mint> [--max-tx 1500] [--delay-ms 300]
```

Hasil: `Output/<mint>/market-volume.json`. Signature yang gagal karena jaringan otomatis
di-retry (`--retry-passes 2` bawaan, hanya yang gagal — yang sukses tidak diulang).
Kalau masih banyak gagal, naikkan `--retry-passes 4` atau `--timeout-ms 40000`
(khusus jaringan HP yang lambat).

Kelima rule (SPR-03/CTR-04/TCR-01/02/03) dievaluasi
**bertingkat**: file `complete` → klaim market-wide; file `partial` dengan ≥500 transaksi
ter-parse → evaluasi **window teramati** (transaksi terbaru, scope diungkap di hasil —
bukan klaim market-wide); di bawah itu tetap INSUFFICIENT_DATA. Tidak perlu memaksa
`complete` untuk token tua yang transaksinya sangat banyak — window terbaru justru
yang paling relevan. Lalu jalankan ulang Phase 9 (`09`).

**Atur permanen via config.json (tanpa flag tiap kali):** semua angka di atas bisa
disimpan di `Config/config.json` pada section `market_volume` — berlaku otomatis
untuk menu 15 maupun perintah langsung. Prioritas: flag CLI > config.json > bawaan.
Setiap run menampilkan sumber setting yang dipakai.

```json
"market_volume": {
  "max_tx": 1500,
  "delay_ms": 300,
  "page_limit": 1000,
  "retry_passes": 2,
  "retry_delay_ms": 1500,
  "timeout_ms": 25000
}
```

Jangan timpa seluruh `config.json` — cukup tambahkan/edit section itu (key-mu aman,
`set_key.js` tidak menghapus section lain).

**Catatan biaya:** tiap signature = 1 panggilan `getTransaction`. Untuk token sangat ramai, naikkan `max_tx` bertahap dan perhatikan rate limit key trial-mu.

### Menu 16 — reddit social collector (Phase 12, tanpa login)
Mengumpulkan mention publik ticker/nama token di subreddit meme coin (default:
CryptoMoonShots, SolanaMemeCoins, memecoins, SatoshiStreetBets). Ticker otomatis
diambil dari `phase1-result.json` (bisa dioverride: `--ticker SYM`).

Hasil: `Data/social_signals.json` (digabung dengan data X bila ada — tidak menimpa)
dibaca Phase 12 sebagai **info saja, tidak mengubah verdict**. Sentimen tidak
dianalisis otomatis (dilabel `unknown`) — klaim sentimen tanpa model hanya fabrikasi.

Pengaturan di `Config/config.json` → `social_reddit` (prioritas: flag CLI > config > bawaan):
```json
"social_reddit": {
  "subreddits": ["CryptoMoonShots", "SolanaMemeCoins", "memecoins", "SatoshiStreetBets"],
  "days": 7,
  "limit": 100,
  "delay_ms": 2000
}
```

Jujur soal Reddit: sebagian jaringan diblokir login-wall (HTTP 403). Kolektor
melapor jelas dan berhenti tanpa memalsukan data — jalankan dari HP atau isi
`Data/social_signals.json` manual (lihat `Data/social_signals.example.json`).

### Sinyal X (manual) + Reddit (otomatis) — digabung
X menutup semua akses tanpa login sejak 2024, jadi sinyal X diisi manual:
```sh
node Script/set_social_x.js <MINT> <X_MENTIONS_24H> [--sentiment bullish|bearish|neutral|mixed|unknown] [--note "catatan"]
```
Contoh: `node Script/set_social_x.js 8DXq...Btq 120 --sentiment mixed --note "ramai dibahas influencer"`.
Data Reddit tidak tertimpa — Phase 12 membaca gabungan X+Reddit sebagai info
(heat LOW/MEDIUM/HIGH), tetap tidak mengubah verdict. Jalankan ulang menu 12
setelah mengisi.

## 6. Catatan

- Pipeline memakai RPC Helius — butuh koneksi internet biasa (tidak diblokir dari Indonesia).
- Jangan push `Config/config.json` yang sudah berisi key ke GitHub.
- Kalau ada error, salin pesan error-nya ke π.
