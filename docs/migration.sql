-- SiEdit Web v1.1 — Database Schema Migration
-- Multi-user with RLS by auth.uid() and DEFAULT auth.uid()

-- 1. Enable uuid extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Auto-update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABLE: vendor
-- ============================================================
CREATE TABLE IF NOT EXISTS vendor (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  nama TEXT NOT NULL,
  whatsapp TEXT,
  harga_kolase_sudah_pilih INTEGER DEFAULT 35000,
  harga_kolase_belum_pilih INTEGER DEFAULT 50000,
  harga_edit_full INTEGER DEFAULT 135000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

-- Align default for existing tables (safe if column exists)
ALTER TABLE vendor ALTER COLUMN user_id SET DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_vendor_user ON vendor(user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_deleted ON vendor(deleted_at);

ALTER TABLE vendor ENABLE ROW LEVEL SECURITY;

CREATE POLICY vendor_select ON vendor
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY vendor_insert ON vendor
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY vendor_update ON vendor
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY vendor_delete ON vendor
  FOR DELETE USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_vendor_updated_at ON vendor;
CREATE TRIGGER update_vendor_updated_at
  BEFORE UPDATE ON vendor
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE: vendor_price_item
-- Daftar Produk / Harga per vendor (bebas nama produk, dipakai sebagai
-- pilihan "Jenis Edit" saat menambah job). Satu vendor bisa punya banyak baris.
-- ============================================================
CREATE TABLE IF NOT EXISTS vendor_price_item (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
  nama_produk TEXT NOT NULL,
  harga INTEGER DEFAULT 0,
  urutan INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

ALTER TABLE vendor_price_item ALTER COLUMN user_id SET DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_vendor_price_item_vendor ON vendor_price_item(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_price_item_user ON vendor_price_item(user_id);

ALTER TABLE vendor_price_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY vendor_price_item_select ON vendor_price_item
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY vendor_price_item_insert ON vendor_price_item
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY vendor_price_item_update ON vendor_price_item
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY vendor_price_item_delete ON vendor_price_item
  FOR DELETE USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_vendor_price_item_updated_at ON vendor_price_item;
CREATE TRIGGER update_vendor_price_item_updated_at
  BEFORE UPDATE ON vendor_price_item
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE: job
-- ============================================================
CREATE TABLE IF NOT EXISTS job (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  vendor_id UUID REFERENCES vendor(id) ON DELETE SET NULL,
  nama_project TEXT NOT NULL,
  jenis_edit TEXT,
  harga INTEGER NOT NULL CHECK (harga > 0),
  deadline DATE,
  status_edit TEXT DEFAULT 'Masuk',
  status_bayar TEXT DEFAULT 'Belum Bayar',
  status_cetak TEXT DEFAULT 'Belum Cetak',
  tanggal_lunas DATE,
  total_dibayar INTEGER DEFAULT 0,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

ALTER TABLE job ALTER COLUMN user_id SET DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_job_user ON job(user_id);
CREATE INDEX IF NOT EXISTS idx_job_vendor ON job(vendor_id);
CREATE INDEX IF NOT EXISTS idx_job_deleted ON job(deleted_at);

ALTER TABLE job ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_select ON job
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY job_insert ON job
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY job_update ON job
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY job_delete ON job
  FOR DELETE USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_job_updated_at ON job;
CREATE TRIGGER update_job_updated_at
  BEFORE UPDATE ON job
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE: invoice
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  vendor_id UUID REFERENCES vendor(id) ON DELETE SET NULL,
  vendor_nama TEXT NOT NULL,
  tanggal DATE NOT NULL,
  items_json TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  status_bayar TEXT DEFAULT 'Belum Bayar',
  pdf_path TEXT,
  nomor TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE invoice ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Unique invoice number per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_nomor_user ON invoice(user_id, nomor) WHERE nomor IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoice_user ON invoice(user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_deleted ON invoice(deleted_at);

ALTER TABLE invoice ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_select ON invoice
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY invoice_insert ON invoice
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY invoice_update ON invoice
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY invoice_delete ON invoice
  FOR DELETE USING (user_id = auth.uid());

COMMENT ON COLUMN invoice.status_bayar IS 'Status pembayaran invoice: Belum Bayar / DP / Lunas';

-- ============================================================
-- TABLE: invoice_payment
-- Ledger cicilan per invoice: SATU baris = SATU pembayaran dari vendor yang mencakup
-- beberapa job sekaligus (batch). Jumlahnya lalu dibagikan otomatis ke tiap job lewat
-- record_invoice_payment (lihat fungsi di bawah), yang menulis baris job_payment.
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_payment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  invoice_id UUID NOT NULL REFERENCES invoice(id) ON DELETE CASCADE,
  jumlah INTEGER NOT NULL CHECK (jumlah > 0),
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE invoice_payment ALTER COLUMN user_id SET DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_invoice_payment_invoice ON invoice_payment(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payment_user ON invoice_payment(user_id);

ALTER TABLE invoice_payment ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_payment_select ON invoice_payment
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY invoice_payment_insert ON invoice_payment
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY invoice_payment_update ON invoice_payment
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY invoice_payment_delete ON invoice_payment
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- TABLE: job_payment
-- Riwayat tiap kali ada pembayaran (DP/cicilan/pelunasan) untuk 1 job.
-- job.total_dibayar, job.status_bayar, job.tanggal_lunas TIDAK PERNAH diubah
-- langsung dari frontend — SELALU lewat fungsi record_job_payment /
-- delete_job_payment / reverse_invoice_payments di bawah, supaya cuma ada
-- SATU jalur resmi (tidak ada lagi kasus "beberapa tempat beda cara nyimpen").
-- ============================================================
CREATE TABLE IF NOT EXISTS job_payment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  job_id UUID NOT NULL REFERENCES job(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoice(id) ON DELETE SET NULL,
  invoice_payment_id UUID REFERENCES invoice_payment(id) ON DELETE SET NULL,
  jumlah INTEGER NOT NULL CHECK (jumlah > 0),
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE job_payment ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Untuk database yang SUDAH berjalan (CREATE TABLE IF NOT EXISTS tidak menambah kolom)
ALTER TABLE job_payment ADD COLUMN IF NOT EXISTS invoice_payment_id UUID REFERENCES invoice_payment(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_job_payment_job ON job_payment(job_id);
CREATE INDEX IF NOT EXISTS idx_job_payment_invoice ON job_payment(invoice_id);
CREATE INDEX IF NOT EXISTS idx_job_payment_user ON job_payment(user_id);

ALTER TABLE job_payment ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_payment_select ON job_payment
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY job_payment_insert ON job_payment
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY job_payment_update ON job_payment
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY job_payment_delete ON job_payment
  FOR DELETE USING (user_id = auth.uid());

-- Hitung ulang total_dibayar/status_bayar/tanggal_lunas job dari SEMUA baris
-- job_payment yang ada untuk job itu (bukan increment/decrement manual), supaya
-- tidak pernah melenceng walau ada race condition atau baris yang dihapus.
CREATE OR REPLACE FUNCTION recalc_job_payment_status(p_job_id UUID) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_harga INTEGER;
  v_total INTEGER;
  v_last_tanggal DATE;
BEGIN
  SELECT harga INTO v_harga FROM job WHERE id = p_job_id;
  IF v_harga IS NULL THEN RETURN; END IF;

  SELECT COALESCE(SUM(jumlah), 0) INTO v_total FROM job_payment WHERE job_id = p_job_id;
  SELECT MAX(tanggal) INTO v_last_tanggal FROM job_payment WHERE job_id = p_job_id;

  UPDATE job SET
    total_dibayar = v_total,
    status_bayar = CASE
      WHEN v_total >= v_harga AND v_harga > 0 THEN 'Lunas'
      WHEN v_total > 0 THEN 'DP'
      ELSE 'Belum Bayar'
    END,
    tanggal_lunas = CASE WHEN v_total >= v_harga AND v_harga > 0 THEN v_last_tanggal ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_job_id;
END;
$$;

-- BUG FIX (data): job.status_bayar/total_dibayar/tanggal_lunas dihitung dari
-- job.harga + SUM(job_payment). Sebelumnya, kalau harga job diedit SETELAH ada
-- pembayaran (mis. DP 50rb dari harga 100rb, lalu harga dikoreksi jadi 40rb),
-- status_bayar TIDAK ikut dihitung ulang — job tetap "DP" padahal seharusnya
-- "Lunas" (sudah kelebihan bayar), atau sebaliknya bisa tetap "Lunas" padahal
-- harga dinaikkan sehingga sebenarnya masih ada sisa tagihan. Ini melanggar
-- invarian yang disebutkan di komentar record_job_payment/delete_job_payment
-- (status_bayar harus SELALU konsisten dengan riwayat job_payment vs harga).
-- Trigger ini menutup celahnya: setiap kali kolom harga job diubah, status
-- pembayarannya otomatis dihitung ulang dari riwayat job_payment yang ada.
CREATE OR REPLACE FUNCTION trg_job_harga_recalc() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.harga IS DISTINCT FROM OLD.harga THEN
    PERFORM recalc_job_payment_status(NEW.id);
  END IF;
  RETURN NULL; -- AFTER trigger, hasil recalc sudah ditulis oleh recalc_job_payment_status
END;
$$;

DROP TRIGGER IF EXISTS job_harga_recalc ON job;
CREATE TRIGGER job_harga_recalc
  AFTER UPDATE OF harga ON job
  FOR EACH ROW EXECUTE FUNCTION trg_job_harga_recalc();

-- Catat 1 pembayaran baru (DP/cicilan/pelunasan). Dipakai web & bot Telegram.
-- Mengembalikan id baris job_payment yang baru dibuat.
CREATE OR REPLACE FUNCTION record_job_payment(
  p_job_id UUID,
  p_jumlah INTEGER,
  p_tanggal DATE DEFAULT CURRENT_DATE,
  p_catatan TEXT DEFAULT NULL,
  p_invoice_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner UUID;
  v_new_id UUID;
BEGIN
  SELECT user_id INTO v_owner FROM job WHERE id = p_job_id AND deleted_at IS NULL;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Job tidak ditemukan';
  END IF;
  -- Kalau dipanggil dari sesi login user biasa, pastikan job ini memang miliknya.
  -- Kalau dipanggil pakai service role key (bot Telegram), auth.uid() kosong -> dilewati.
  IF auth.uid() IS NOT NULL AND auth.uid() != v_owner THEN
    RAISE EXCEPTION 'Tidak berhak mengubah job ini';
  END IF;
  IF p_jumlah IS NULL OR p_jumlah <= 0 THEN
    RAISE EXCEPTION 'Jumlah pembayaran harus lebih dari 0';
  END IF;

  INSERT INTO job_payment (user_id, job_id, invoice_id, jumlah, tanggal, catatan)
  VALUES (v_owner, p_job_id, p_invoice_id, p_jumlah, COALESCE(p_tanggal, CURRENT_DATE), p_catatan)
  RETURNING id INTO v_new_id;

  PERFORM recalc_job_payment_status(p_job_id);
  RETURN v_new_id;
END;
$$;

-- Hapus 1 baris pembayaran (mis. salah catat) dan otomatis hitung ulang status job.
CREATE OR REPLACE FUNCTION delete_job_payment(p_payment_id UUID) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner UUID;
  v_job_id UUID;
BEGIN
  SELECT user_id, job_id INTO v_owner, v_job_id FROM job_payment WHERE id = p_payment_id;
  IF v_job_id IS NULL THEN RETURN; END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() != v_owner THEN
    RAISE EXCEPTION 'Tidak berhak menghapus pembayaran ini';
  END IF;

  DELETE FROM job_payment WHERE id = p_payment_id;
  PERFORM recalc_job_payment_status(v_job_id);
END;
$$;

-- Hapus SEMUA riwayat pembayaran job ini (dipakai tombol "Tandai Belum Bayar" —
-- aksi eksplisit mengembalikan job ke status belum dibayar sama sekali).
CREATE OR REPLACE FUNCTION reset_job_payment(p_job_id UUID) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner UUID;
BEGIN
  SELECT user_id INTO v_owner FROM job WHERE id = p_job_id;
  IF v_owner IS NULL THEN RETURN; END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() != v_owner THEN
    RAISE EXCEPTION 'Tidak berhak mengubah job ini';
  END IF;

  DELETE FROM job_payment WHERE job_id = p_job_id;
  PERFORM recalc_job_payment_status(p_job_id);
END;
$$;

-- Dipanggil saat invoice dibatalkan "Lunas"-nya (toggle balik ke Belum Bayar, atau
-- tombol "Batalkan semua pembayaran" di modal): hapus semua pembayaran yang tercatat
-- berasal dari invoice ini (baik job_payment maupun ledger invoice_payment), kembalikan
-- status invoice ke Belum Bayar, lalu hitung ulang status tiap job yang terkait.
CREATE OR REPLACE FUNCTION reverse_invoice_payments(p_invoice_id UUID) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT job_id FROM job_payment WHERE invoice_id = p_invoice_id LOOP
    DELETE FROM job_payment WHERE invoice_id = p_invoice_id AND job_id = r.job_id;
    PERFORM recalc_job_payment_status(r.job_id);
  END LOOP;
  DELETE FROM invoice_payment WHERE invoice_id = p_invoice_id;
  UPDATE invoice SET status_bayar = 'Belum Bayar' WHERE id = p_invoice_id;
END;
$$;

-- Catat SATU pembayaran dari vendor untuk SATU invoice (batch beberapa job).
-- Jumlah dibagikan otomatis urut ke tiap job di dalam items_json: job paling awal
-- dilunasi penuh dulu (LEAST(sisa_tagihan, sisa_job)), kelebihannya lanjut ke job
-- berikutnya. Status tiap job & invoice dihitung ulang dari riwayat. Semua alokasi
-- ditautkan ke SATU baris invoice_payment (pembayaran itu sendiri).
-- Mengembalikan id baris invoice_payment yang baru dibuat.
CREATE OR REPLACE FUNCTION record_invoice_payment(
  p_invoice_id UUID,
  p_jumlah INTEGER,
  p_tanggal DATE DEFAULT CURRENT_DATE,
  p_catatan TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner UUID;
  v_total INTEGER;
  v_paid INTEGER;
  v_new_id UUID;
  v_remaining INTEGER;
  v_item RECORD;
  v_job_sisa INTEGER;
  v_alloc INTEGER;
BEGIN
  SELECT user_id, total INTO v_owner, v_total
  FROM invoice WHERE id = p_invoice_id AND deleted_at IS NULL;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Invoice tidak ditemukan';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() != v_owner THEN
    RAISE EXCEPTION 'Tidak berhak mengubah invoice ini';
  END IF;
  IF p_jumlah IS NULL OR p_jumlah <= 0 THEN
    RAISE EXCEPTION 'Jumlah pembayaran harus lebih dari 0';
  END IF;

  SELECT COALESCE(SUM(jumlah), 0) INTO v_paid FROM invoice_payment WHERE invoice_id = p_invoice_id;
  IF v_paid + p_jumlah > v_total THEN
    RAISE EXCEPTION 'Jumlah melebihi sisa tagihan invoice (sisa %)', v_total - v_paid;
  END IF;

  INSERT INTO invoice_payment (user_id, invoice_id, jumlah, tanggal, catatan)
  VALUES (v_owner, p_invoice_id, p_jumlah, COALESCE(p_tanggal, CURRENT_DATE), p_catatan)
  RETURNING id INTO v_new_id;

  v_remaining := p_jumlah;
  FOR v_item IN
    SELECT item->>'job_id' AS job_id
    FROM invoice, jsonb_array_elements(items_json::jsonb) AS item
    WHERE id = p_invoice_id
  LOOP
    IF v_remaining <= 0 THEN EXIT; END IF;

    SELECT COALESCE(j.harga, 0) - COALESCE(j.total_dibayar, 0) INTO v_job_sisa
    FROM job j
    WHERE j.id = v_item.job_id::uuid AND j.deleted_at IS NULL;

    IF v_job_sisa IS NULL OR v_job_sisa <= 0 THEN CONTINUE; END IF;

    v_alloc := LEAST(v_remaining, v_job_sisa);
    INSERT INTO job_payment (user_id, job_id, invoice_id, invoice_payment_id, jumlah, tanggal, catatan)
    VALUES (v_owner, v_item.job_id::uuid, p_invoice_id, v_new_id, v_alloc, COALESCE(p_tanggal, CURRENT_DATE), p_catatan);
    PERFORM recalc_job_payment_status(v_item.job_id::uuid);
    v_remaining := v_remaining - v_alloc;
  END LOOP;

  UPDATE invoice SET status_bayar = CASE
    WHEN v_paid + p_jumlah >= v_total THEN 'Lunas'
    ELSE 'DP'
  END
  WHERE id = p_invoice_id;

  RETURN v_new_id;
END;
$$;

-- ============================================================
-- Baca secret dari vault (dipakai Edge Function telegram-webhook).
-- Konsisten dengan cara telegram-dispatch membaca vault.decrypted_secrets
-- langsung; fungsi ini cuma pembungkus biar aksesnya lewat jalur resmi.
-- ============================================================
CREATE OR REPLACE FUNCTION siedit_get_secret(p_name TEXT) RETURNS TEXT
LANGUAGE sql SECURITY DEFINER SET search_path = vault AS $$
  SELECT decrypted_secret FROM decrypted_secrets WHERE name = p_name;
$$;

-- ============================================================
-- TABLE: user_settings
-- Satu baris per user. Dipakai halaman Pengaturan/Notifikasi (web) dan
-- untuk menyimpan state percakapan bot Telegram (wizard_step/wizard_data).
-- ============================================================
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  telegram_chat_id TEXT,
  telegram_connect_code TEXT,
  telegram_connect_expires TIMESTAMPTZ,
  notif_jam TIME DEFAULT '07:00',
  -- Kustomisasi tampilan invoice yang dicetak/di-print (nama studio, logo, catatan kaki)
  nama_studio TEXT,
  invoice_logo_url TEXT,
  invoice_footer TEXT,
  -- Kolom di bawah ini murni state internal bot Telegram (wizard /tambah, /lunas dst),
  -- tidak dipakai/ditampilkan di web.
  wizard_step INTEGER,
  wizard_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

ALTER TABLE user_settings ALTER COLUMN user_id SET DEFAULT auth.uid();

-- PERINGATAN sebelum menjalankan index unik di bawah pada database yang SUDAH BERJALAN:
-- versi lama app ini punya bug race-condition yang bisa menghasilkan lebih dari 1 baris
-- user_settings untuk user yang sama. Cek dulu dengan query ini —
--   SELECT user_id, COUNT(*) FROM user_settings GROUP BY user_id HAVING COUNT(*) > 1;
-- — kalau ada hasilnya, hapus baris duplikatnya dulu (sisakan yang paling baru/lengkap
-- datanya) SEBELUM menjalankan CREATE UNIQUE INDEX di bawah, kalau tidak perintahnya
-- akan gagal dengan error "could not create unique index".

-- Satu baris per user (mencegah baris ganda yang membuat .maybeSingle() gagal)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);
-- Dipakai bot Telegram untuk mencari user dari chat id, dan saat proses connect via kode
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_settings_telegram_chat ON user_settings(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_settings_connect_code ON user_settings(telegram_connect_code) WHERE telegram_connect_code IS NOT NULL;

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_settings_select ON user_settings
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY user_settings_insert ON user_settings
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY user_settings_update ON user_settings
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY user_settings_delete ON user_settings
  FOR DELETE USING (user_id = auth.uid());

-- Catatan: fungsi Edge (telegram-webhook, telegram-dispatch) mengakses tabel ini
-- memakai SERVICE ROLE KEY, yang otomatis melewati RLS di atas — policy ini hanya
-- berlaku untuk akses dari aplikasi web (memakai sesi login user biasa).

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- STORAGE: logo invoice (publik-read, supaya bisa ditampilkan di invoice yang
-- di-print/di-download) dan backup otomatis (privat, cuma bisa diakses via
-- service role oleh Edge Function backup-dispatch, atau signed URL dari web).
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-assets', 'invoice-assets', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

-- Tiap user cuma boleh upload/lihat/hapus logo miliknya sendiri, di dalam folder
-- bernama user_id-nya sendiri (invoice-assets/<user_id>/logo.png).
CREATE POLICY invoice_assets_select ON storage.objects
  FOR SELECT USING (bucket_id = 'invoice-assets');
CREATE POLICY invoice_assets_insert ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'invoice-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY invoice_assets_update ON storage.objects
  FOR UPDATE USING (bucket_id = 'invoice-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY invoice_assets_delete ON storage.objects
  FOR DELETE USING (bucket_id = 'invoice-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Bucket backups: user boleh LIST & DOWNLOAD folder miliknya sendiri (buat halaman
-- Pengaturan > Backup), tapi tidak boleh upload/hapus manual dari web — itu cuma
-- boleh lewat backup-dispatch (jalan pakai service role, otomatis bebas RLS).
CREATE POLICY backups_select_own ON storage.objects
  FOR SELECT USING (bucket_id = 'backups' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- NOTE for existing data (migration from v1.0 single-user):
-- If you already have data without user_id set, run:
--   UPDATE vendor SET user_id = '<your-user-uuid>' WHERE user_id IS NULL;
--   UPDATE job SET user_id = '<your-user-uuid>' WHERE user_id IS NULL;
--   UPDATE invoice SET user_id = '<your-user-uuid>' WHERE user_id IS NULL;
-- Then ALTER columns to NOT NULL if they aren't already.
-- ============================================================