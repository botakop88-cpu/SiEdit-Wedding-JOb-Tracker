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
  FOR SELECT USING (user_id = auth.uid() AND deleted_at IS NULL);
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
-- TABLE: job
-- ============================================================
CREATE TABLE IF NOT EXISTS job (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  vendor_id UUID REFERENCES vendor(id) ON DELETE SET NULL,
  nama_project TEXT NOT NULL,
  jenis_edit TEXT,
  harga INTEGER DEFAULT 0,
  deadline DATE,
  status_edit TEXT DEFAULT 'Masuk',
  status_bayar TEXT DEFAULT 'Belum Bayar',
  status_cetak TEXT DEFAULT 'Belum Cetak',
  tanggal_lunas DATE,
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
  FOR SELECT USING (user_id = auth.uid() AND deleted_at IS NULL);
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE invoice ALTER COLUMN user_id SET DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_invoice_user ON invoice(user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_deleted ON invoice(deleted_at);

ALTER TABLE invoice ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_select ON invoice
  FOR SELECT USING (user_id = auth.uid() AND deleted_at IS NULL);
CREATE POLICY invoice_insert ON invoice
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY invoice_update ON invoice
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY invoice_delete ON invoice
  FOR DELETE USING (user_id = auth.uid());

COMMENT ON COLUMN invoice.status_bayar IS 'Status pembayaran invoice: Belum Bayar / Lunas';

-- ============================================================
-- NOTE for existing data (migration from v1.0 single-user):
-- If you already have data without user_id set, run:
--   UPDATE vendor SET user_id = '<your-user-uuid>' WHERE user_id IS NULL;
--   UPDATE job SET user_id = '<your-user-uuid>' WHERE user_id IS NULL;
--   UPDATE invoice SET user_id = '<your-user-uuid>' WHERE user_id IS NULL;
-- Then ALTER columns to NOT NULL if they aren't already.
-- ============================================================