-- ================================================================
-- SiEdit — Fix RLS SELECT Policy for Recycle Bin
-- JALANKAN INI DULU SEBELUM DEPLOY KODE
-- ================================================================
-- Masalah: Policy SELECT lama filter `deleted_at IS NULL` sehingga
-- soft-deleted rows tidak terbaca di Recycle Bin (Settings).
-- Solusi: Drop policy lama, bikin baru tanpa filter deleted_at.

-- vendor
DROP POLICY IF EXISTS vendor_select ON public.vendor;
CREATE POLICY vendor_select ON public.vendor
  FOR SELECT
  USING (user_id = auth.uid());

-- job
DROP POLICY IF EXISTS job_select ON public.job;
CREATE POLICY job_select ON public.job
  FOR SELECT
  USING (user_id = auth.uid());

-- invoice
DROP POLICY IF EXISTS invoice_select ON public.invoice;
CREATE POLICY invoice_select ON public.invoice
  FOR SELECT
  USING (user_id = auth.uid());