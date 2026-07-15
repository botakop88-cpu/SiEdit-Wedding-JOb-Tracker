-- ================================================================
-- SiEdit — Vendor Price Item (Custom Products per Vendor)
-- JALANKAN INI DULU SEBELUM DEPLOY KODE
-- ================================================================
-- Mengubah sistem harga vendor dari 3 kolom tetap (harga_kolase_sudah_pilih,
-- harga_kolase_belum_pilih, harga_edit_full) menjadi daftar produk/harga
-- custom per vendor, tanpa batas kategori, bebas teks, maksimal 15 item.

CREATE TABLE IF NOT EXISTS vendor_price_item (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  nama_produk TEXT NOT NULL,
  harga INTEGER NOT NULL DEFAULT 0,
  urutan INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

ALTER TABLE vendor_price_item ALTER COLUMN user_id SET DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_vendor_price_item_vendor ON vendor_price_item(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_price_item_user ON vendor_price_item(user_id);

ALTER TABLE vendor_price_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY vendor_price_item_select ON vendor_price_item
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY vendor_price_item_insert ON vendor_price_item
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY vendor_price_item_update ON vendor_price_item
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY vendor_price_item_delete ON vendor_price_item
  FOR DELETE
  USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_vendor_price_item_updated_at ON vendor_price_item;
CREATE TRIGGER update_vendor_price_item_updated_at
  BEFORE UPDATE ON vendor_price_item
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- CATATAN: Kolom lama TIDAK dihapus di migrasi ini (aman/reversible).
-- Setelah fitur baru dites & dipakai lancar minimal beberapa hari,
-- baru boleh drop manual (JANGAN otomatis jalankan):
--
--   ALTER TABLE vendor DROP COLUMN harga_kolase_sudah_pilih;
--   ALTER TABLE vendor DROP COLUMN harga_kolase_belum_pilih;
--   ALTER TABLE vendor DROP COLUMN harga_edit_full;
-- ================================================================
