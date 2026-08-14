-- Normalisasi data jenis_edit lama yang kotor agar konsisten dengan 3 nilai standar.
-- Dipicu temuan di menu Laporan > Jenis Edit (data duplikat/typo dari entry lama Juli 2026).
-- Tidak ada perubahan schema; hanya data cleanup idempotent.

-- 1) Mapping pola teks yang pasti
UPDATE job SET jenis_edit = 'Edit Full'
WHERE jenis_edit = 'EDIT FULL';

UPDATE job SET jenis_edit = 'Kolase Belum Pilih'
WHERE jenis_edit = 'Kolase Blom Pilih';

UPDATE job SET jenis_edit = 'Kolase Sudah Pilih'
WHERE jenis_edit = 'Kolase Pilih';

-- 2) Mapping "Edit Kolase" berdasarkan harga vendor (18 job, semua Lunas)
-- Match harga = harga_kolase_belum_pilih  -> Kolase Belum Pilih (ERIK 50k, IRWAN 40k)
UPDATE job j SET jenis_edit = 'Kolase Belum Pilih'
FROM vendor v
WHERE j.vendor_id = v.id
  AND j.jenis_edit = 'Edit Kolase'
  AND j.harga = v.harga_kolase_belum_pilih;

-- Match harga = harga_kolase_sudah_pilih -> Kolase Sudah Pilih (YOUGA 35k)
UPDATE job j SET jenis_edit = 'Kolase Sudah Pilih'
FROM vendor v
WHERE j.vendor_id = v.id
  AND j.jenis_edit = 'Edit Kolase'
  AND j.harga = v.harga_kolase_sudah_pilih;