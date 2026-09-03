// Lokal mock data + mock Supabase client.
// Hanya aktif saat VITE_PREVIEW_MODE=true (lihat supabaseClient.ts).
// Tidak menyentuh Supabase/Vercel — semua data hidup di memori browser.

type Row = Record<string, unknown>

const MOCK_USER_ID = '00000000-0000-4000-8000-000000000001'
const MOCK_EMAIL = 'demo@siedit.app'

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function isoNow(): string {
  return new Date().toISOString()
}

function daysFromNow(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function dateOnly(n: number): string {
  return daysFromNow(n).slice(0, 10)
}

// ─── In-memory store ─────────────────────────────────────────────
const DB: Record<string, Row[]> = { vendor: [], job: [], invoice: [], user_settings: [], job_payment: [], invoice_payment: [], vendor_price_item: [] }

// File yang "diupload" ke storage (invoice logo & backup), key = bucket/path.
const FILES: Record<string, Blob> = {}

// Blob URL (URL.createObjectURL) untuk file yang diupload — supaya `<img src=...>`
// yang diambil via getPublicUrl bisa benar-benar dirender di browser saat mode demo.
const BLOB_URLS: Record<string, string> = {}


// ─── Select / join parser ────────────────────────────────────────
interface JoinSpec { alias: string; fk: string; fields: string[] }
interface ParsedSelect { all: boolean; cols: string[]; joins: JoinSpec[] }

function parseSelect(sel: string): ParsedSelect {
  const joins: JoinSpec[] = []
  let base = sel
  const re = /([A-Za-z_][A-Za-z0-9_]*):([A-Za-z_][A-Za-z0-9_]*)\(([^)]*)\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(sel))) {
    joins.push({ alias: m[1], fk: m[2], fields: m[3].split(',').map((s) => s.trim()).filter(Boolean) })
    base = base.replace(m[0], '')
  }
  base = base.replace(/[\s,]+$/, '')
  return { all: base === '*', cols: base === '*' ? [] : base.split(',').map((s) => s.trim()).filter(Boolean), joins }
}

function applyJoin(table: string, row: Row, j: JoinSpec): void {
  if (table !== 'job') return
  const fkVal = row[j.fk] as string | null
  const found = DB.vendor.find((v) => v.id === fkVal)
  if (!found) { row[j.alias] = null; return }
  const out: Row = {}
  for (const f of j.fields) out[f] = found[f]
  row[j.alias] = out
}

function projectRow(table: string, row: Row, p: ParsedSelect): Row {
  const out: Row = p.all ? { ...row } : Object.fromEntries(p.cols.map((c) => [c, row[c]]))
  for (const j of p.joins) applyJoin(table, out, j)
  return out
}

function parseInList(raw: unknown): unknown[] {
  const s = String(raw).replace(/^\(/, '').replace(/\)$/, '')
  if (!s.trim()) return []
  return s.split(',').map((x) => x.trim().replace(/^"|"$/g, ''))
}

function sortRows(rows: Row[], orders: { col: string; asc: boolean }[]): Row[] {
  if (orders.length === 0) return rows
  return [...rows].sort((a, b) => {
    for (const { col, asc } of orders) {
      const av = a[col], bv = b[col]
      if (av == null && bv == null) continue
      if (av == null) return 1
      if (bv == null) return -1
      const c = av < bv ? -1 : av > bv ? 1 : 0
      if (c !== 0) return asc ? c : -c
    }
    return 0
  })
}

// ─── Query builder ───────────────────────────────────────────────
type Predicate = (r: Row) => boolean
type Mutation = { type: 'insert' | 'update' | 'delete' | 'upsert'; payload: Row | Row[]; onConflict?: string }

// Kolom default yang diset di skema Postgres (docs/migration.sql). Mock harus
// menirukannya: form tidak selalu mengirim field ini, tapi DB mengisinya sendiri.
const TABLE_DEFAULTS: Record<string, Row> = {
  job: { status_edit: 'Masuk', status_bayar: 'Belum Bayar', status_cetak: 'Belum Cetak', harga: 0, total_dibayar: 0 },
  invoice: { status_bayar: 'Belum Bayar', total: 0 },
  vendor: { harga_kolase_sudah_pilih: 35000, harga_kolase_belum_pilih: 50000, harga_edit_full: 135000 },
  vendor_price_item: { harga: 0, urutan: 0 },
}

class MockQuery {
  private table: string
  private selectCols: string | null = null
  private head = false
  private filters: Predicate[] = []
  private orderCols: { col: string; asc: boolean }[] = []
  private limitN: number | null = null
  private rangeFrom: number | null = null
  private rangeTo: number | null = null
  private singleFlag = false
  private mutation: Mutation | null = null

  constructor(table: string) { this.table = table }

  select(cols: string, opts?: { count?: 'exact' | 'planned'; head?: boolean }) {
    this.selectCols = cols
    if (opts?.head) this.head = true
    return this
  }

  is(col: string, val: unknown) {
    if (val === null) this.filters.push((r) => r[col] == null)
    else this.filters.push((r) => r[col] === val)
    return this
  }

  not(col: string, op: string, val: unknown) {
    if (op === 'is') { this.filters.push((r) => r[col] != null); return this }
    if (op === 'in') {
      const list = parseInList(val)
      this.filters.push((r) => !list.includes(r[col]))
      return this
    }
    if (op === 'eq') { this.filters.push((r) => r[col] !== val); return this }
    this.filters.push((r) => r[col] !== val)
    return this
  }

  eq(col: string, val: unknown) { this.filters.push((r) => r[col] === val); return this }
  neq(col: string, val: unknown) { this.filters.push((r) => r[col] !== val); return this }
  in(col: string, arr: unknown[]) { this.filters.push((r) => arr.includes(r[col])); return this }
  gte(col: string, val: unknown) {
    const target = val as string | number
    this.filters.push((r) => r[col] != null && (r[col] as string | number) >= target)
    return this
  }
  lte(col: string, val: unknown) {
    const target = val as string | number
    this.filters.push((r) => r[col] != null && (r[col] as string | number) <= target)
    return this
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCols.push({ col, asc: opts?.ascending ?? true })
    return this
  }

  limit(n: number) { this.limitN = n; return this }
  range(from: number, to: number) { this.rangeFrom = from; this.rangeTo = to; return this }
  maybeSingle() { this.singleFlag = true; return this }
  single() { this.singleFlag = true; return this }

  insert(payload: Row | Row[]) { this.mutation = { type: 'insert', payload }; return this }
  update(payload: Row) { this.mutation = { type: 'update', payload }; return this }
  upsert(payload: Row | Row[], opts?: { onConflict?: string }) { this.mutation = { type: 'upsert', payload, onConflict: opts?.onConflict }; return this }
  delete() { this.mutation = { type: 'delete', payload: {} }; return this }

  private execute(): unknown {
    const store = DB[this.table] ?? []
    let rows = store.slice()
    for (const f of this.filters) rows = rows.filter(f)

    if (this.mutation) {
      const mt = this.mutation
      if (mt.type === 'update') {
        // Samakan dengan trigger job_harga_recalc di database sungguhan: kalau
        // harga job diubah, hitung ulang status_bayar/total_dibayar/tanggal_lunas
        // dari riwayat job_payment yang ada, jangan biarkan jadi tidak sinkron.
        const hargaChanged = this.table === 'job' && 'harga' in mt.payload
        for (const r of rows) {
          const oldHarga = r.harga
          Object.assign(r, mt.payload)
          r.updated_at = isoNow()
          if (hargaChanged && r.harga !== oldHarga) recalcJobPayment(r.id as string)
        }
        return { data: rows, count: rows.length, error: null }
      }
      if (mt.type === 'delete') {
        const ids = new Set(rows.map((r) => r.id))
        DB[this.table] = store.filter((r) => !ids.has(r.id))
        return { data: rows, count: rows.length, error: null }
      }
      if (mt.type === 'upsert') {
        const pl = (Array.isArray(mt.payload) ? mt.payload[0] : mt.payload) ?? {}
        const key = mt.onConflict
        const existing = key ? store.find((r) => r[key] === pl[key]) : undefined
        if (existing) {
          Object.assign(existing, pl)
          existing.updated_at = isoNow()
          return { data: [existing], count: 1, error: null }
        }
        return this.insertRow(mt.payload, true)
      }
      return this.insertRow(mt.payload, true)
    }

    const count = rows.length
    if (this.orderCols.length) rows = sortRows(rows, this.orderCols)
    if (this.rangeFrom != null && this.rangeTo != null) rows = rows.slice(this.rangeFrom, this.rangeTo + 1)
    if (this.limitN != null) rows = rows.slice(0, this.limitN)

    if (this.head) return { data: [], count, error: null }

    const parsed = this.selectCols ? parseSelect(this.selectCols) : { all: true, cols: [], joins: [] as JoinSpec[] }
    const data = rows.map((r) => projectRow(this.table, r, parsed))
    return this.singleFlag ? { data: data[0] ?? null, count: data.length, error: null } : { data, count, error: null }
  }

  private insertRow(payload: Row | Row[], respectSingle = false) {
    const now = isoNow()
    const list = (Array.isArray(payload) ? payload : [payload]).map((p) => {
      const row: Row = { id: p.id ?? genId(), user_id: MOCK_USER_ID, created_at: now, updated_at: now, deleted_at: null, ...TABLE_DEFAULTS[this.table], ...p }
      ;(DB[this.table] ?? (DB[this.table] = [])).push(row)
      return row
    })
    if (respectSingle && this.singleFlag) {
      const parsed = this.selectCols ? parseSelect(this.selectCols) : { all: true, cols: [], joins: [] as JoinSpec[] }
      const data = projectRow(this.table, list[0], parsed)
      return { data: data as Row, count: list.length, error: null }
    }
    return { data: list, count: list.length, error: null }
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected)
  }
}

// ─── Mock RPC: fungsi pembayaran ────────────────────────────────
// Meniru perilaku fungsi database record_job_payment / delete_job_payment /
// reset_job_payment / reverse_invoice_payments: status_bayar, total_dibayar, dan
// tanggal_lunas job SELALU dihitung ulang dari riwayat job_payment.
function recalcJobPayment(jobId: string): void {
  const job = DB.job.find((j) => j.id === jobId)
  if (!job) return
  const harga = (job.harga as number) ?? 0
  const pays = (DB.job_payment ?? []).filter((p) => p.job_id === jobId)
  const total = pays.reduce((s, p) => s + ((p.jumlah as number) ?? 0), 0)
  const lastTanggal = pays.reduce((mx, p) => (String(p.tanggal) > mx ? String(p.tanggal) : mx), '')
  job.total_dibayar = total
  job.status_bayar = total >= harga && harga > 0 ? 'Lunas' : total > 0 ? 'DP' : 'Belum Bayar'
  job.tanggal_lunas = total >= harga && harga > 0 ? lastTanggal || null : null
  job.updated_at = isoNow()
}

class MockRpc {
  private name: string
  private args: Row

  constructor(name: string, args: Row) {
    this.name = name
    this.args = args
  }

  private execute(): unknown {
    const a = this.args
    if (this.name === 'record_job_payment') {
      const jobId = a.p_job_id as string
      const job = DB.job.find((j) => j.id === jobId && j.deleted_at == null)
      if (!job) return { data: null, error: { message: 'Job tidak ditemukan' } }
      const jumlah = Number(a.p_jumlah)
      if (!jumlah || jumlah <= 0) return { data: null, error: { message: 'Jumlah pembayaran harus lebih dari 0' } }
      const payment: Row = {
        id: genId(),
        user_id: MOCK_USER_ID,
        job_id: jobId,
        invoice_id: (a.p_invoice_id as string | null) ?? null,
        invoice_payment_id: null,
        jumlah,
        tanggal: (a.p_tanggal as string | null) ?? dateOnly(0),
        catatan: (a.p_catatan as string | null) ?? null,
        created_at: isoNow(),
      }
      ;(DB.job_payment ?? (DB.job_payment = [])).push(payment)
      recalcJobPayment(jobId)
      return { data: payment.id, error: null }
    }
    if (this.name === 'delete_job_payment') {
      const pid = a.p_payment_id as string
      const found = (DB.job_payment ?? []).find((x) => x.id === pid)
      if (!found) return { data: null, error: null }
      DB.job_payment = (DB.job_payment ?? []).filter((x) => x.id !== pid)
      recalcJobPayment(found.job_id as string)
      return { data: null, error: null }
    }
    if (this.name === 'reset_job_payment') {
      const jobId = a.p_job_id as string
      DB.job_payment = (DB.job_payment ?? []).filter((x) => x.job_id !== jobId)
      recalcJobPayment(jobId)
      return { data: null, error: null }
    }
    if (this.name === 'reverse_invoice_payments') {
      const invId = a.p_invoice_id as string
      const affected = new Set(
        (DB.job_payment ?? []).filter((x) => x.invoice_id === invId).map((x) => x.job_id as string),
      )
      DB.job_payment = (DB.job_payment ?? []).filter((x) => x.invoice_id !== invId)
      DB.invoice_payment = (DB.invoice_payment ?? []).filter((x) => x.invoice_id !== invId)
      for (const jobId of affected) recalcJobPayment(jobId)
      const inv = DB.invoice.find((i) => i.id === invId)
      if (inv) inv.status_bayar = 'Belum Bayar'
      return { data: null, error: null }
    }
    if (this.name === 'record_invoice_payment') {
      const invId = a.p_invoice_id as string
      const inv = DB.invoice.find((i) => i.id === invId && i.deleted_at == null)
      if (!inv) return { data: null, error: { message: 'Invoice tidak ditemukan' } }
      const jumlah = Number(a.p_jumlah)
      if (!jumlah || jumlah <= 0) return { data: null, error: { message: 'Jumlah pembayaran harus lebih dari 0' } }
      let items: Row[] = []
      try { items = JSON.parse(inv.items_json as string) } catch { items = [] }
      const total = Number(inv.total) || 0
      const paid = (DB.invoice_payment ?? []).filter((x) => x.invoice_id === invId).reduce((s, x) => s + (Number(x.jumlah) || 0), 0)
      if (paid + jumlah > total) {
        return { data: null, error: { message: `Jumlah melebihi sisa tagihan invoice (sisa ${total - paid})` } }
      }
      const tanggal = (a.p_tanggal as string | null) ?? dateOnly(0)
      const catatan = (a.p_catatan as string | null) ?? null
      const ipId = genId()
      ;(DB.invoice_payment ?? (DB.invoice_payment = [])).push({
        id: ipId, user_id: MOCK_USER_ID, invoice_id: invId, jumlah, tanggal, catatan, created_at: isoNow(),
      })
      let remaining = jumlah
      for (const it of items) {
        if (remaining <= 0) break
        const job = DB.job.find((j) => j.id === it.job_id && j.deleted_at == null)
        if (!job) continue
        const sisaJob = Math.max(0, (Number(job.harga) || 0) - (Number(job.total_dibayar) || 0))
        if (sisaJob <= 0) continue
        const alloc = Math.min(remaining, sisaJob)
        ;(DB.job_payment ?? (DB.job_payment = [])).push({
          id: genId(), user_id: MOCK_USER_ID, job_id: job.id as string, invoice_id: invId, invoice_payment_id: ipId,
          jumlah: alloc, tanggal, catatan, created_at: isoNow(),
        })
        recalcJobPayment(job.id as string)
        remaining -= alloc
      }
      inv.status_bayar = paid + jumlah >= total ? 'Lunas' : 'DP'
      return { data: ipId, error: null }
    }
    return { data: null, error: { message: `RPC '${this.name}' belum diimplementasikan di mock` } }
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected)
  }
}

// ─── Mock storage & Edge Functions ───────────────────────────────
class MockStorage {
  private bucket: string

  constructor(bucket: string) {
    this.bucket = bucket
  }

  async upload(path: string, file: Blob) {
    const key = `${this.bucket}/${path}`
    FILES[key] = file
    if (typeof URL !== 'undefined' && URL.createObjectURL) {
      const url = URL.createObjectURL(file)
      if (BLOB_URLS[key]) URL.revokeObjectURL(BLOB_URLS[key])
      BLOB_URLS[key] = url
    }
    return { data: { path }, error: null }
  }

  getPublicUrl(path: string) {
    const key = `${this.bucket}/${path}`
    return { data: { publicUrl: BLOB_URLS[key] ?? `mock://${key}` } }
  }

  async remove(paths: string[]) {
    for (const p of paths) {
      const key = `${this.bucket}/${p}`
      delete FILES[key]
      if (BLOB_URLS[key]) {
        URL.revokeObjectURL(BLOB_URLS[key])
        delete BLOB_URLS[key]
      }
    }
    return { data: paths, error: null }
  }

  async list(folder: string) {
    const prefix = `${this.bucket}/${folder}/`
    const names = Object.keys(FILES).filter((k) => k.startsWith(prefix))
    const data = names.map((k, i) => ({
      name: k.slice(prefix.length),
      id: String(i),
      updated_at: isoNow(),
      created_at: isoNow(),
      last_accessed_at: isoNow(),
      metadata: {} as Row,
    }))
    return { data, error: null }
  }

  async createSignedUrl(path: string) {
    return { data: { signedUrl: `mock://${this.bucket}/${path}?signed` }, error: null }
  }

  async download(path: string) {
    const blob = FILES[`${this.bucket}/${path}`] ?? new Blob(['{}'], { type: 'application/json' })
    return { data: blob, error: null }
  }
}

// ─── Mock auth ───────────────────────────────────────────────────
type Listener = (event: string, session: unknown) => void
const listeners: Listener[] = []

function demoSession() {
  return {
    access_token: 'mock-access-token', refresh_token: 'mock-refresh-token',
    expires_in: 3600, expires_at: Date.now() + 3600 * 1000, token_type: 'bearer',
    user: {
      id: MOCK_USER_ID, aud: 'authenticated', role: 'authenticated', email: MOCK_EMAIL,
      email_confirmed_at: isoNow(), app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { name: 'Demo User' }, created_at: isoNow(), updated_at: isoNow(),
    },
  }
}

function emit(event: string, session: unknown) {
  for (const l of listeners) l(event, session)
}

const auth = {
  async getSession() { return { data: { session: demoSession() }, error: null } },
  async getUser() { return { data: { user: demoSession().user }, error: null } },
  onAuthStateChange(cb: Listener) {
    listeners.push(cb)
    setTimeout(() => cb('INITIAL_SESSION', demoSession()), 0)
    return { data: { subscription: { unsubscribe: () => { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1) } } } }
  },
  async signInWithPassword() { emit('SIGNED_IN', demoSession()); return { data: { session: demoSession() }, error: null } },
  async signUp() { emit('SIGNED_IN', demoSession()); return { data: { session: demoSession() }, error: null } },
  async signInWithOAuth() { return { data: { provider: 'google', url: window.location.href }, error: null } },
  async signOut() { emit('SIGNED_OUT', null); return { error: null } },
  async resetPasswordForEmail() { return { data: {}, error: null } },
  async updateUser(attrs: Row) {
    const meta = { ...demoSession().user.user_metadata, ...(attrs.data as Row) }
    const user = { ...demoSession().user, user_metadata: meta }
    emit('USER_UPDATED', { ...demoSession(), user })
    return { data: { user }, error: null }
  },
}

export function createMockClient() {
  return {
    from(table: string) { return new MockQuery(table) },
    rpc(name: string, args: Row) { return new MockRpc(name, args) },
    storage: {
      from(bucket: string) { return new MockStorage(bucket) },
    },
    functions: {
      async invoke(name: string) {
        if (name === 'backup-now') {
          FILES[`backups/${MOCK_USER_ID}/mock-backup-${Date.now()}.json`] = new Blob(['{}'], { type: 'application/json' })
          return { data: { ok: true, count: 1 }, error: null }
        }
        return { data: null, error: { message: `Fungsi '${name}' tidak tersedia di mode preview` } }
      },
    },
    auth,
  }
}