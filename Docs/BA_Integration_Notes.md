# Phase 10 Wallet Intelligence — Integrasi BA awal

## Perubahan
- Menambahkan `Script/behavior_adjustment_engine.js` adapter data Phase 7/8.
- Phase 10 menambahkan `wallet_intelligence` sebagai bagian output terpisah, berisi DB Weight, role, komponen H/S/F, skor BA, cakupan data, dan status.
- Formula Phase 10 legacy untuk Evidence Strength/Risk tetap memakai versi scoring `phase10-scoring-v1`.
- Phase 11 tidak diubah dan tidak dijalankan ulang.

## Status data
Komponen yang tidak didukung data lengkap tetap `null` dan menghasilkan `PARTIAL`/`INSUFFICIENT_DATA`. BA tidak digabungkan dengan DB Weight.

## Keputusan operasional yang telah dikunci pengguna
1. Ambang “large portion” SELL = ≥50% dari acquisition amount yang teramati.
2. Faktor jumlah transaksi dan waktu dikalikan terhadap skor dasar: base score × transaction-count factor × time factor; hasil dibatasi pada −100 sampai 0.
3. Rekonsiliasi posisi hanya diterima jika BUY + RECEIVE − SELL − TRANSFER_OUT sama persis dengan saldo saat ini.
4. Large Flow-Out memakai transfer keluar tunggal terbesar; Repeated Distribution memakai 3 signature unik, 3 penerima unik, dan ≥0,5% supply dalam 60 menit.
5. Pola SELL terkonsentrasi diturunkan dari transaksi yang tersedia; pemeriksaan pelemahan BUY disimpan sebagai indikator, tidak menjadi penalti tambahan tersendiri.

Poin 1 dan 2 telah dikonfirmasi pengguna dan diperlakukan sebagai aturan operasional final. Poin 3–5 merupakan metode implementasi yang dijelaskan secara eksplisit; jangan mengubahnya tanpa pembahasan.
