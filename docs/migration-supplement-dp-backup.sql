-- ============================================================
-- SUPPLEMENT untuk database yang SUDAH BERJALAN (bukan instalasi baru).
-- Jalankan SEKALI di Supabase Dashboard > SQL Editor SEBELUM deploy kode fitur
-- DP/Cicilan + Backup + Kustomisasi Invoice.
--
-- Kenapa perlu: docs/migration.sql versi baru menaruh kolom-kolom baru ini di dalam
-- CREATE TABLE IF NOT EXISTS, jadi kolomnya TIDAK akan ditambahkan ke tabel yang
-- sudah ada di database live. Kalau kode baru terlanjur di-deploy tanpa file ini,
-- insert/update job & user_settings akan error "column ... does not exist".
--
-- Aman dijalankan berkali-kali (IF NOT EXISTS), tidak menyentuh data yang ada.
-- ============================================================

ALTER TABLE job ADD COLUMN IF NOT EXISTS total_dibayar INTEGER DEFAULT 0;

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS nama_studio TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS invoice_logo_url TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS invoice_footer TEXT;

-- Jaring pengaman (sudah terpasang di live DB, tapi tidak ada salahnya dipastikan):
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS nomor TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_nomor_user
  ON invoice(user_id, nomor) WHERE nomor IS NOT NULL;

-- Harga job wajib > 0 (mencegah job "Rp0" yang tidak pernah bisa berstatus Lunas).
-- NOT VALID = tidak memvalidasi baris lama yang mungkin terlanjur ber-harga 0
-- (baris itu tetap bisa dilihat/diubah di UI), tapi semua insert/update baru akan
-- ditolak kalau harga <= 0. Kalau mau bersihkan baris lama ber-harga 0:
--   UPDATE job SET harga = <isi harga baru> WHERE harga <= 0;
-- lalu jalankan VALIDATE untuk mengaktifkan pemeriksaan penuh:
--   ALTER TABLE job VALIDATE CONSTRAINT job_harga_positive;
ALTER TABLE job DROP CONSTRAINT IF EXISTS job_harga_positive;
ALTER TABLE job ADD CONSTRAINT job_harga_positive CHECK (harga > 0) NOT VALID;

-- ============================================================
-- OPSI A: cicilan per invoice (tabel invoice_payment + alokasi otomatis ke job)
-- ============================================================

-- Ledger cicilan per invoice: SATU baris = SATU pembayaran vendor yang mencakup
-- beberapa job sekaligus. Jumlahnya dibagikan otomatis ke job lewat
-- record_invoice_payment (di bawah), yang menulis baris job_payment.
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

-- Tautan baris job_payment -> cicilan invoice yang membuatnya
ALTER TABLE job_payment ADD COLUMN IF NOT EXISTS invoice_payment_id UUID REFERENCES invoice_payment(id) ON DELETE SET NULL;

-- Catat SATU pembayaran vendor untuk SATU invoice (batch beberapa job).
-- Jumlah dibagikan otomatis urut ke tiap job di dalam items_json: job paling awal
-- dilunasi penuh dulu (LEAST(sisa_tagihan, sisa_job)), kelebihannya lanjut ke job
-- berikutnya. Status tiap job & invoice dihitung ulang dari riwayat.
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

-- reverse_invoice_payments versi baru: selain menghapus job_payment & recalc, juga
-- menghapus baris invoice_payment milik invoice tersebut (ledger cicilan ikut bersih)
-- dan mengembalikan status invoice ke Belum Bayar (biar badge & ringkasan Piutang
-- konsisten saat undo lewat modal pembayaran, bukan cuma lewat toggle di Riwayat).
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

-- Baca secret dari vault (dipakai Edge Function telegram-webhook). Konsisten dengan
-- cara telegram-dispatch membaca vault.decrypted_secrets langsung; fungsi ini cuma
-- pembungkus biar aksesnya lewat jalur resmi.
CREATE OR REPLACE FUNCTION siedit_get_secret(p_name TEXT) RETURNS TEXT
LANGUAGE sql SECURITY DEFINER SET search_path = vault AS $$
  SELECT decrypted_secret FROM decrypted_secrets WHERE name = p_name;
$$;