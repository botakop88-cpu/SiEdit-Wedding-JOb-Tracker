-- ================================================================
-- SiEdit — Add "nomor" column to invoice table
-- JALANKAN INI DULU SEBELUM DEPLOY KODE
-- ================================================================
-- Menambahkan kolom nomor untuk menyimpan nomor invoice (INV-XXXX)
-- sehingga reprint tidak perlu hitung ulang dari count().
-- Untuk invoice lama: kolom akan NULL, frontend punya fallback.

ALTER TABLE invoice ADD COLUMN IF NOT EXISTS nomor TEXT;