-- ============================================================
-- SETUP: Jadwal Backup Otomatis (jalankan SEKALI di Supabase Dashboard > SQL Editor)
-- ============================================================
-- Ini pola YANG SAMA seperti yang dipakai untuk menjadwalkan telegram-dispatch
-- (kalau itu sudah pernah kamu setup, langkahnya persis sama, tinggal ganti nama).

-- LANGKAH 1 — Aktifkan extension yang dibutuhkan (aman dijalankan berkali-kali)
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- LANGKAH 2 — Simpan secret rahasia untuk fungsi backup-dispatch (SEKALI SAJA).
-- Ganti 'GANTI_DENGAN_SECRET_ACAK_PANJANG' dengan string acak sendiri (mis. hasil
-- generate password 32+ karakter). Simpan juga secret yang sama ini nanti di
-- environment variable Edge Function backup-dispatch (Supabase Dashboard > Edge
-- Functions > backup-dispatch > Settings > Secrets), dengan nama BACKUP_DISPATCH_SECRET.
select vault.create_secret('GANTI_DENGAN_SECRET_ACAK_PANJANG', 'backup_dispatch_secret');

-- Kalau secretnya sudah pernah dibuat dan mau diganti, pakai ini (bukan create_secret lagi):
-- select vault.update_secret(
--   (select id from vault.secrets where name = 'backup_dispatch_secret'),
--   'SECRET_BARU_DI_SINI'
-- );

-- LANGKAH 3 — Jadwalkan cron job. Ganti <PROJECT_REF> dengan Project Reference
-- Supabase kamu (terlihat di URL dashboard: https://supabase.com/dashboard/project/<PROJECT_REF>).
-- Jadwal di bawah = setiap hari jam 19:00 UTC (= 02:00 WIB dini hari, saat trafik sepi).
select cron.schedule(
  'daily-backup-dispatch',
  '0 19 * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.functions.supabase.co/backup-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'backup_dispatch_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Verifikasi jadwal sudah terpasang:
-- select * from cron.job where jobname = 'daily-backup-dispatch';

-- Kalau suatu saat mau mencabut jadwalnya:
-- select cron.unschedule('daily-backup-dispatch');

-- ============================================================
-- LANGKAH 4 (di luar SQL, di Supabase Dashboard)
-- ============================================================
-- 1. Deploy fungsi lewat CLI: supabase functions deploy backup-dispatch
--                              supabase functions deploy backup-now
-- 2. Buka Edge Functions > backup-dispatch > Settings > Secrets, tambahkan:
--      BACKUP_DISPATCH_SECRET = (secret yang sama seperti Langkah 2 di atas)
--    (Fungsi ini membaca secretnya dari Vault langsung lewat getSecret(), jadi
--    env var ini opsional/cadangan kalau kamu ingin verifikasi tambahan — yang
--    WAJIB adalah secret di Vault pada Langkah 2.)
-- 3. Test manual dulu sebelum mengandalkan jadwalnya, dengan curl:
--      curl -X POST https://<PROJECT_REF>.functions.supabase.co/backup-dispatch \
--        -H "x-internal-secret: SECRET_YANG_SAMA_DENGAN_LANGKAH_2"
--    Responsnya berupa JSON daftar status backup per user — pastikan tidak ada
--    error sebelum mengandalkan jadwal otomatisnya.
