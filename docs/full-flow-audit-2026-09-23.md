# Audit alur MES dari order sampai pengiriman

Tanggal: 23 September 2026

## Ruang lingkup dan batas pemeriksaan

Audit mencakup kode alur marketing order, demand, PLM, MO, WO, operator station, material, quality, finished goods, pengiriman, traceability, planning, integrasi, dan UI responsif. Saya memeriksa halaman dashboard, daftar WO, detail WO, dispatch, station, dan beranda beberapa peran di browser. Temuan integritas data di bawah diuji dengan menjalankan reducer pada salinan seed; data browser tidak diubah. Temuan di tabel adalah kondisi saat audit awal. Status perbaikannya ada di bagian akhir. Belum ada pengujian manual pada setiap halaman.

Repositori ini adalah demo frontend. Dataset dan sesi disimpan di browser; tidak ada API operasional, autentikasi server, atau koneksi langsung ke sistem eksternal. Karena itu “bisa jalan” perlu dibedakan antara alur demo yang konsisten dan sistem yang siap dipakai bersama oleh beberapa pengguna.

## Alur yang dituju

1. Marketing membuat order dan mengonfirmasinya; setiap baris menghasilkan demand.
2. Planner menyelesaikan demand dengan alokasi stok, MO, atau gabungan keduanya.
3. Engineering menyediakan revisi produk, BOM, BOR, BOP, spesifikasi, dan instruksi yang dirilis. MO mengambil snapshot saat dirilis.
4. Supervisor menjadwalkan serta menetapkan mesin, operator, shift, dan resource ke WO.
5. Operator menyiapkan material, menjalankan WO, mencatat output, lalu meminta inspeksi bila diperlukan.
6. Quality mencatat hasil dan disposition; hold atau rework ditangani sebelum WO/MO selesai.
7. Warehouse menerima finished goods. Marketing mengirim kuantitas yang tersedia untuk order yang benar.
8. Genealogy dan histori menunjukkan material, WIP, mesin, operator, inspeksi, receipt, dan pengiriman yang konsisten.

## Temuan terkonfirmasi

### P0 — integritas transaksi

| ID  | Temuan dan bukti                                                                                                                                                                                                                                                                                                                   | Dampak                                                                                                     | Kriteria perbaikan                                                                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01 | `marketingOrderItems/deliver` di `packages/fixtures/src/store.ts:720` mengurangi `action.qty` dari **setiap** baris finished goods dengan produk sama dan `allocatedQty > 0`, tanpa membatasi site atau menjumlahkan sisa yang sudah diambil. Uji seed: kirim 1 unit `mkt-12-l1`, stok Jakarta dan Surabaya masing-masing turun 1. | Stok beberapa lokasi/site terpotong untuk satu pengiriman.                                                 | Pilih baris stok pada site order, ambil total tepat sebesar kuantitas kirim, catat sumber stok per pengiriman, dan tolak jika stok bebas/teralokasi tidak cukup. Uji multi-lokasi dan dua site. |
| F02 | `manufacturingOrders/complete` di `store.ts:1018` langsung mengganti status. Uji seed: `MO-2026-00285` menjadi `completed` sementara enam WO masih `in_progress`/`waiting`.                                                                                                                                                        | MO terlihat selesai sebelum produksi selesai; langkah FG dan demand berikutnya bisa memakai status keliru. | Selesaikan MO hanya setelah semua WO wajib selesai, quantity/disposition cocok, dan hold aktif beres. UI menampilkan alasan yang menghalangi.                                                   |
| F03 | UI `CompleteDialog` memeriksa inspeksi lulus, tetapi `workOrders/complete` di `store.ts:1286` tidak. Uji seed: `MO-2026-00304-50` yang wajib quality menjadi `completed` tanpa inspeksi lulus.                                                                                                                                     | Aturan quality hanya berlaku di satu tombol UI.                                                            | Terapkan gate di reducer/service dan UI dengan sumber aturan yang sama; uji lulus, gagal, pending, dan reinspection.                                                                            |
| F04 | `workOrders/recordOutput` di `store.ts:2539` dan form `execution-dialogs.tsx:135` hanya mensyaratkan jumlah positif. Uji seed: WO target 800 dengan 594 good menerima tambahan 1.600, menjadi 2.194; input WIP hanya dikurangi sampai nol.                                                                                         | Output dan WIP dapat tidak seimbang.                                                                       | Validasi terhadap input WIP, status WO, dan batas/aturan overproduction yang disetujui. Pastikan good + reject + scrap + rework direkonsiliasi tanpa kuantitas negatif.                         |
| F05 | Aksi mesin dan maintenance memakai `state.sites[0]` untuk event (`store.ts:2163`, `:2233`, `:2274`). Uji mesin Surabaya menghasilkan event dengan site Jakarta.                                                                                                                                                                    | Alarm dan histori salah site; operator site yang benar bisa tidak melihatnya.                              | Turunkan site dari work center mesin atau WO terkait; uji kedua site.                                                                                                                           |

### P1 — handoff dan aturan proses

| ID  | Temuan                                                                                                                                                                                                                                    | Kriteria perbaikan                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F06 | Membatalkan marketing order hanya mengubah status order. Dialog di `MarketingOrderDetailPage.tsx:270` meminta demand dibatalkan terpisah.                                                                                                 | Tampilkan dampak ke tiap demand, alokasi, MO, dan stock reservation sebelum konfirmasi. Jalankan perubahan terkait secara atomik sesuai status produksinya. |
| F07 | Kartu fulfillment pada detail order (`FulfillmentCard.tsx:16`) membuka daftar umum; baris dengan gap belum punya aksi Resolve langsung.                                                                                                   | Dari satu baris order, pengguna sampai ke demand terkait dengan gap dan aksi yang sudah terpilih, lalu kembali ke order setelah selesai.                    |
| F08 | `marketingOrders/setStatus`, `demands/allocate`, `finishedGoods/receive`, dan beberapa aksi WO menerima perubahan tanpa validasi transisi/kuantitas yang lengkap di reducer. Form UI memvalidasi sebagian, tetapi aturan domain tersebar. | Buat aturan status dan kuantitas terpusat; aksi tidak valid mengembalikan alasan yang bisa ditampilkan UI. Tambahkan uji transisi negatif.                  |
| F09 | Grafik “Plan vs actual” di `ProductionControlPage.tsx:267` memakai `mo.goodQty` (output akhir) sementara dashboard memakai kuantitas good pada operasi terjauh.                                                                           | Pilih definisi metrik, beri nama jelas di semua layar, dan uji contoh MO yang baru selesai pada operasi awal.                                               |
| F10 | Penghapusan inspeksi yang sudah selesai membiarkan defect record tetap ada (`InspectionDetailPage.tsx:315` menjelaskannya).                                                                                                               | Tetapkan kebijakan koreksi audit: void/supersede dengan jejak alasan, atau relasi defect yang tetap menjelaskan inspeksi asal. Hindari bukti quality yatim. |

### P1 — UI yang menghambat pekerjaan

| ID  | Pengamatan browser                                                                                                                                                                  | Perbaikan dan ukuran selesai                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| F11 | Pada lebar 390 px, lima kartu statistik memenuhi hampir seluruh layar daftar WO; tabel belum terlihat sebelum scroll. Pada desktop 1280×720 hanya sekitar dua baris tabel terlihat. | Ringkas statistik dan tampilkan pencarian, filter utama, serta baris pertama lebih awal. Ukur pada 390×844 dan 1280×720.   |
| F12 | Detail WO _Ready_ menampilkan angka output 0 besar, sedangkan resource validation yang menjelaskan hambatan ada di bawah layar ponsel.                                              | Untuk WO sebelum mulai, tampilkan blocker dan aksi Assign terlebih dahulu. Setelah mulai, tampilkan output sebagai fokus.  |
| F13 | Baris WO ponsel menyembunyikan mesin, operator, dan tenggat; daftar default membuka `All` termasuk 270 WO historis (`WorkOrdersPage.tsx:43`).                                       | Tampilkan metadata penentu pilihan pada baris dan buka pekerjaan aktif secara default; histori tetap bisa dipilih.         |
| F14 | Navigasi bawah ponsel masih sama untuk semua peran (`PhoneNav.tsx:90`), walau beranda sudah mengikuti peran.                                                                        | Tampilkan pintasan operator, supervisor, quality, planner, dan marketing sesuai pekerjaan; halaman lain tetap ada di More. |
| F15 | Dashboard memberi ruang yang sama pada kartu dengan nilai 0 dan masalah aktif; tautan “Operator issue” menuju direktori orang umum (`DashboardPage.tsx:150`).                       | Urutkan perhatian menurut jumlah/urgensi, ringkas nol, dan arahkan ke daftar orang/WO yang terdampak.                      |

## Kesiapan operasional di luar demo

1. **Data bersama dan transaksi.** `AppStateProvider` menyimpan satu dataset ke `localStorage` (`apps/admin/src/state/store.tsx:14`). Perlu API, database, transaksi atomik, versioning, dan penanganan konflik bila dua pengguna bertindak bersamaan. Gagal menyimpan saat storage penuh sekarang diabaikan (`packages/fixtures/src/persistence.ts:32`).
2. **Autentikasi dan otorisasi.** Login demo menerima akun terpilih atau email dengan sembarang password (`apps/admin/src/pages/auth/LoginPage.tsx:58`). Permission terutama mengatur tombol di UI. Untuk produksi perlu identitas terverifikasi, otorisasi di server untuk setiap aksi, site scope, dan audit actor yang jelas.
3. **Integrasi.** `integrationConnections/sync` hanya mengubah timestamp/status dan menambah log `ok` di reducer (`store.ts:2116`). Perlu adapter nyata, queue, retry/idempotency, pemetaan ID, dan status gagal yang berasal dari sistem eksternal.
4. **Audit dan koreksi.** Perubahan stok, quality, dan status perlu event yang saling terkait, reversal yang terlacak, dan larangan menghapus bukti yang sudah dipakai. Generator seed punya pemeriksaan referensi (`scripts/seed/checks.ts`), tetapi aksi runtime belum memakai pemeriksaan serupa.
5. **Verifikasi otomatis.** `package.json` belum menyediakan perintah test. Typecheck dan build lulus, tetapi keduanya tidak menguji hasil reducer atau perjalanan pengguna.

## Urutan implementasi

1. **Kunci integritas data:** F01–F05. Satukan validasi reducer/service dan pesan UI. Tambahkan uji reducer yang mereproduksi setiap bug sebelum memperbaikinya.
2. **Tutup handoff:** F06–F10. Pastikan pembatalan, alokasi, receipt, dan pengiriman bergerak bersama dengan status yang tepat.
3. **Percepat tugas harian:** F11–F15. Uji pada ponsel operator dan desktop supervisor; ukur jumlah scroll/tap sampai tindakan utama.
4. **Jika targetnya produksi:** bangun backend, autentikasi, integrasi, audit, migrasi data, dan monitoring. Jalankan uji end-to-end di lingkungan bersama sebelum dipakai operasional.

## Skenario penerimaan minimum

- **MTO/hybrid:** order dua baris → confirm → demand → alokasi stok dan MO → release snapshot → dispatch → start → konsumsi material → output → inspeksi → complete → FG receipt → delivery. Jumlah order, WIP, FG, alokasi, dan pengiriman harus cocok di setiap langkah.
- **Quality gate:** WO wajib inspeksi tidak bisa selesai saat pending/gagal; setelah lulus atau disposition yang sah, operasi berikutnya terbuka tepat sekali.
- **Quantity:** tolak output tanpa input yang cukup, delivery melebihi stok/site order, receipt melebihi finished good, serta kuantitas negatif/pecahan bila satuannya piece.
- **Cancellation/hold:** cancel atau hold menunjukkan dampaknya, mempertahankan jejak keputusan, dan tidak meninggalkan demand/alokasi/WO aktif yang bertentangan.
- **Dua site:** tindakan mesin, stok, order, dan event Jakarta tidak mengubah angka Surabaya, dan sebaliknya.
- **Peran dan perangkat:** marketing, planner, supervisor, operator, quality, dan warehouse menyelesaikan tugas masing-masing pada desktop dan ponsel; tombol utama dan alasan penolakan terlihat tanpa mencari ke layar lain.

## Status implementasi 23 September 2026

- F01–F05: guard dan perhitungan diperbaiki di reducer. Alokasi stok terikat pada demand dan baris stok; data demo lama direkonstruksi saat dimuat. Pengiriman mengambil stok dari site serta reservasi order yang tepat, menolak stok kurang, dan mencatat lokasi sumber di event. MO dan WO memeriksa operasi serta quality sebelum selesai. Output dibatasi input WIP dan target; scrap dari form output tidak lagi mengurangi WIP dua kali. Event mesin dan maintenance memakai site work center.
- F06–F07: pembatalan order membatalkan demand dan MO yang belum dirilis serta melepas alokasi stok. Pembatalan ditolak jika sudah ada pengiriman atau produksi yang berjalan. Setiap gap fulfillment membuka demand terkait melalui aksi Resolve.
- F08–F10: alokasi demand, receipt FG, close MO, scrap/rework, dan sejumlah perubahan status diberi guard. Grafik production control memakai good pada operasi terjauh. Hasil inspeksi yang sudah selesai tidak bisa diedit atau dihapus; koreksi dilakukan dengan inspeksi baru.
- F11–F15: daftar WO membuka pekerjaan aktif, statistik diringkas, metadata penting muncul di baris ponsel, detail WO menaruh hambatan sebelum angka output, navigasi ponsel mengikuti peran, dan dashboard menampilkan masalah aktif dahulu.
- Verifikasi: `pnpm test` lulus 9 test reducer; `pnpm typecheck` dan `pnpm build` lulus. Daftar dan detail WO diperiksa di browser pada 390×844 dan 1280×720.

Pekerjaan yang masih diperlukan untuk operasional: backend dan transaksi multiuser, autentikasi serta otorisasi server, konektor sistem eksternal, ledger stok yang persisten dan transaksional, alur retur/kredit untuk order yang sudah terkirim, kebijakan override produksi melebihi target, serta uji perjalanan lengkap untuk setiap peran. Sinkronisasi integrasi pada demo kini diberi label lokal dan tidak mengaku telah menghubungi sistem eksternal.
