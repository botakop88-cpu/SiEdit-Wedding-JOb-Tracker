-- ============================================================
-- SETUP: Auto-hapus Recycle Bin setelah 30 hari (jalankan SEKALI di Supabase Dashboard > SQL Editor)
-- ============================================================
-- Sesuai copy di UI Recycle Bin ("Data yang dihapus akan tersimpan 30 hari"),
-- item yang sudah di-soft-delete (deleted_at terisi) dihapus PERMANEN otomatis
-- setiap hari setelah lewat 30 hari. Ini pola yang sama seperti setup-cron-backup.sql.

-- LANGKAH 1 — Aktifkan extension yang dibutuhkan (aman dijalankan berkali-kali)
create extension if not exists pg_cron with schema extensions;

-- LANGKAH 2 — Buat fungsi purge (aman dijalankan berkali-kali, CREATE OR REPLACE).
-- Aman terhadap FK: job_payment.job_id ON DELETE CASCADE, invoice_payment.invoice_id
-- ON DELETE CASCADE, vendor_price_item.vendor_id ON DELETE CASCADE, dan
-- job/invoice.vendor_id ON DELETE SET NULL. Urutan hapus menangani ketergantungan.
create or replace function purge_recycle_bin() returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Hapus permanen job yang sudah dihapus lebih dari 30 hari (dan semua job_payment-nya)
  delete from job
  where deleted_at is not null
    and deleted_at < now() - interval '30 days';

  -- Hapus permanen invoice yang sudah dihapus lebih dari 30 hari (dan semua invoice_payment-nya)
  delete from invoice
  where deleted_at is not null
    and deleted_at < now() - interval '30 days';

  -- Hapus permanen vendor yang sudah dihapus lebih dari 30 hari (dan semua vendor_price_item-nya)
  delete from vendor
  where deleted_at is not null
    and deleted_at < now() - interval '30 days';
end;
$$;

-- LANGKAH 3 — Jadwalkan cron harian. Jam 20:00 UTC = 03:00 WIB (trafik sepi).
select cron.schedule(
  'daily-purge-recycle-bin',
  '0 20 * * *',
  $$ select purge_recycle_bin(); $$
);

-- Verifikasi jadwal sudah terpasang:
-- select * from cron.job where jobname = 'daily-purge-recycle-bin';

-- Test manual (opsional, sebaiknya di tahap pengembangan):
-- select purge_recycle_bin();

-- Kalau suatu saat mau mencabut jadwalnya:
-- select cron.unschedule('daily-purge-recycle-bin');