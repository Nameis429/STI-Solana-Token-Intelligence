# BA — Aturan Dikunci dan Evaluasi Ulang

## Keputusan yang dikunci
1. **Large portion SELL:** `sold_percent >= 50%` dari acquisition amount yang teramati.
2. **Penggabungan modifier SELL:** `base_score × transaction_count_factor × time_factor`, kemudian clamp pada rentang `[-100, 0]`.
3. DB Weight dan BA tetap terpisah; tidak ada skor gabungan.
4. Formula Phase 11 tidak diubah.

## Evaluasi ulang output uji
Sumber: output pengujian yang disertakan dalam ZIP integrasi, CA `8DXqVUopcdviLvujTcpwEqkKzB43Arp6E1axzsEE5Btq`. Phase 10 dihitung ulang dari input Phase 1–9. File Phase 11 tidak dijalankan ulang atau diubah.

- Wallet dievaluasi: **54**
- `AVAILABLE`: **6**
- `PARTIAL`: **1**
- `INSUFFICIENT_DATA`: **47**
- Wallet dengan skor BA numerik: **7** (6 AVAILABLE + 1 PARTIAL; status PARTIAL tidak berarti komponen lengkap)
- Skor legacy Phase 10 (evidence/category/wallet scores) dibandingkan dengan output sebelumnya: **tidak berubah**.

### Wallet dengan nilai BA numerik
| Wallet label | BA | H | S | F | Status |
|---|---:|---:|---:|---:|---|
| 28Zq | +5 | +20 | 0 | 0 | AVAILABLE |
| A1Z8 | +5 | +20 | 0 | 0 | AVAILABLE |
| 7qBA8…wsex | 0 | — | — | 0 | PARTIAL |
| 8QSTH…pUVc | +5 | +20 | 0 | 0 | AVAILABLE |
| C756V…Kynw | −16.25 | +12 | −38.5 | 0 | AVAILABLE |
| Dy2af…zxzQ | +5 | +20 | 0 | 0 | AVAILABLE |
| HiVJw…tCqb | −50 | 0 | −100 | 0 | AVAILABLE |

`H` = Holding Duration; `S` = Sell Activity; `F` = Flow-Out. Tanda “—” berarti tidak tersedia, bukan nol.

## Penilaian
- Aturan 50% dan formula multiplikatif kini ditetapkan sebagai keputusan operasional final.
- Distribusi status masih menunjukkan 47/54 wallet `INSUFFICIENT_DATA`; hasil ini tidak membuktikan BA valid untuk semua wallet.
- Nilai BA `0` pada wallet `PARTIAL` berasal dari komponen Flow-Out bernilai 0 dengan bobot tetap 25%; komponen H dan S tidak tersedia dan tidak dinormalisasi ulang. Status PARTIAL harus tetap terlihat agar angka 0 tidak disalahartikan sebagai hasil lengkap.
- Skor BA positif pada wallet dengan Holding +20 dan SELL/Flow 0 berasal dari bobot Holding 25% (= +5), bukan skor gabungan dengan DB Weight.
- Skor legacy Phase 10 tetap sama pada evaluasi ulang. Phase 11 tidak diubah.

## Batasan
Evaluasi ini menggunakan satu CA dari output integrasi, bukan simulasi tambahan atas 7 CA. Tidak dilakukan klaim akurasi prediktif atau kesiapan model berdasarkan sampel ini.
