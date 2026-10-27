# Tahap A — Audit dan Perubahan Normalisasi Role & DB Weight

## Ringkasan
- Database: 675 wallet, alamat unik seluruhnya.
- Sumber role utama: `groups` yang dikenali.
- Fallback: prefix nama lama (`E-`, `W-`, `D-`, `Rug-`, `Kol-`) hanya jika tidak ada role terstruktur yang dikenali.
- Role multi-label dipertahankan dan bobot dijumlahkan sesuai konfigurasi.
- Wallet tanpa role yang dapat dikenali menerima `DEFAULT` dengan bobot konfigurasi `default` yang sama, terlepas dari nama/nomor.
- Modifier ⭐ dan 💚 tetap memakai nilai dari `Config/scoring.json`.

## Hasil inspeksi database saat ini
- 675 entri; 675 alamat unik.
- Role terstruktur dikenali: Dev 97, Rug/Kol 96, early 43, Whale 22, Default 1.
- 416 wallet memakai fallback DEFAULT; 1 wallet memakai fallback nama.
- 3 konflik antara prefix nama dan groups: `D-47`, `Rug-14`, `MAIN`. `groups` diprioritaskan; konflik dicatat pada output.
- Tidak ditemukan label `groups` yang tidak dikenal pada database versi ini.
- Ada satu entri `W-10` dengan groups `Default` dan `Whale`; kedua role dipertahankan, sehingga bobot role adalah 1 + 3 = 4.

## Perubahan kode
1. Modul baru `Script/wallet_role_normalizer.js` untuk normalisasi role, fallback, konflik, bobot role, dan modifier.
2. Phase 7 menggunakan modul tersebut.
3. Output wallet Phase 7 kini menyertakan `role_source`, `role_conflicts`, dan `unrecognized_groups` selain `roles`, `role_weight`, `modifier_weight`, dan `total_database_weight`.
4. Tidak ada perubahan pada formula Phase 11, bobot konfigurasi, maupun mesin BA.

## Catatan interpretasi
- Konflik nama vs groups tidak mengubah role terpilih: role terstruktur menjadi acuan.
- `DEFAULT` bersama role lain tetap dipertahankan sebagai multi-role dan bobotnya dijumlahkan. Jika kelak keputusan desain menetapkan DEFAULT sebagai label netral yang tidak dijumlahkan saat ada role lain, itu akan menjadi perubahan aturan yang perlu persetujuan eksplisit.
- Tahap A belum mengubah format atau formula skor Phase 11.

## Validasi
Tes unit normalizer dan integritas database tersedia pada `tests/`. Jalankan `npm test` dari direktori proyek.
