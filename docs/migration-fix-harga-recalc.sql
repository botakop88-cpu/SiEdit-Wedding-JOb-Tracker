-- ============================================================
-- BUG FIX (data): status pembayaran job tidak ikut dihitung ulang
-- saat harga job diedit setelah ada pembayaran.
--
-- Jalankan SEKALI di Supabase Dashboard > SQL Editor. Aman dijalankan
-- berkali-kali (CREATE OR REPLACE / DROP ... IF EXISTS), tidak menyentuh
-- data yang sudah ada — kecuali baris job yang memang datanya sudah
-- kadung tidak sinkron (lihat query verifikasi & perbaikan di bagian
-- paling bawah file ini).
--
-- KRONOLOGI BUG:
-- job.status_bayar / total_dibayar / tanggal_lunas SEHARUSNYA selalu
-- dihitung ulang dari riwayat job_payment via recalc_job_payment_status()
-- (lihat komentar di record_job_payment/delete_job_payment). Tapi fungsi
-- itu hanya dipanggil saat baris job_payment berubah — TIDAK dipanggil
-- saat harga job itu sendiri diedit dari form Job.
--
-- Contoh nyata: job harga Rp100.000, sudah DP Rp50.000 (status "DP").
-- Editor lalu mengoreksi harga jadi Rp40.000 (mis. salah input, atau
-- vendor kasih diskon). Karena tidak ada recalc, job TETAP berstatus
-- "DP" dengan "sisa tagihan" Math.max(0, 40000-50000) = Rp0 yang
-- membingungkan, padahal seharusnya sudah "Lunas". Kasus sebaliknya:
-- job Lunas (harga 100rb, dibayar 100rb) lalu harga dinaikkan jadi
-- 150rb — job tetap tercatat "Lunas" padahal piutang Rp50rb hilang dari
-- Dashboard/Laporan/Piutang karena job Lunas selalu dikecualikan dari
-- perhitungan outstanding.
-- ============================================================

CREATE OR REPLACE FUNCTION trg_job_harga_recalc() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.harga IS DISTINCT FROM OLD.harga THEN
    PERFORM recalc_job_payment_status(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS job_harga_recalc ON job;
CREATE TRIGGER job_harga_recalc
  AFTER UPDATE OF harga ON job
  FOR EACH ROW EXECUTE FUNCTION trg_job_harga_recalc();

-- ============================================================
-- VERIFIKASI: cari job yang datanya SUDAH terlanjur tidak sinkron
-- (mis. gara-gara bug di atas, sebelum trigger ini terpasang).
-- Jalankan query ini untuk lihat daftarnya:
-- ============================================================
-- SELECT id, nama_project, harga, total_dibayar, status_bayar
-- FROM job
-- WHERE deleted_at IS NULL
--   AND (
--     (total_dibayar >= harga AND harga > 0 AND status_bayar <> 'Lunas')
--     OR (total_dibayar < harga AND status_bayar = 'Lunas')
--     OR (total_dibayar > 0 AND total_dibayar < harga AND status_bayar <> 'DP')
--   );
--
-- Untuk memperbaiki SEMUA job yang sudah terlanjur salah (aman, hanya
-- menghitung ulang dari job_payment yang benar-benar ada, tidak
-- mengubah riwayat pembayaran itu sendiri):
-- ============================================================
-- SELECT recalc_job_payment_status(id) FROM job WHERE deleted_at IS NULL;
