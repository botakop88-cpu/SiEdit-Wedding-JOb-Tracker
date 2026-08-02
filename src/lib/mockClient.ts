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

function tsDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

// ─── In-memory store ─────────────────────────────────────────────
const DB: Record<string, Row[]> = { vendor: [], job: [], invoice: [], user_settings: [] }

function seedData() {
  const v1 = 'v-11111111-1111-4000-8000-000000000001'
  const v2 = 'v-11111111-1111-4000-8000-000000000002'
  const v3 = 'v-11111111-1111-4000-8000-000000000003'
  const v4 = 'v-11111111-1111-4000-8000-000000000004'
  const v5 = 'v-11111111-1111-4000-8000-000000000005'

  DB.vendor = [
    { id: v1, user_id: MOCK_USER_ID, nama: 'Studio Anugrah', whatsapp: '081234567890', harga_kolase_sudah_pilih: 35000, harga_kolase_belum_pilih: 50000, harga_edit_full: 135000, created_at: tsDaysAgo(160), updated_at: null, deleted_at: null },
    { id: v2, user_id: MOCK_USER_ID, nama: 'FotoCantik Production', whatsapp: '081298765432', harga_kolase_sudah_pilih: 40000, harga_kolase_belum_pilih: 60000, harga_edit_full: 150000, created_at: tsDaysAgo(150), updated_at: null, deleted_at: null },
    { id: v3, user_id: MOCK_USER_ID, nama: 'Dedy Wedding Film', whatsapp: '085712345678', harga_kolase_sudah_pilih: 45000, harga_kolase_belum_pilih: 65000, harga_edit_full: 175000, created_at: tsDaysAgo(140), updated_at: null, deleted_at: null },
    { id: v4, user_id: MOCK_USER_ID, nama: 'Cahaya Studio', whatsapp: '087788990011', harga_kolase_sudah_pilih: 30000, harga_kolase_belum_pilih: 45000, harga_edit_full: 120000, created_at: tsDaysAgo(90), updated_at: null, deleted_at: null },
    { id: v5, user_id: MOCK_USER_ID, nama: 'Rafi Media', whatsapp: '081377112233', harga_kolase_sudah_pilih: 55000, harga_kolase_belum_pilih: 75000, harga_edit_full: 200000, created_at: tsDaysAgo(60), updated_at: null, deleted_at: null },
  ]

  const base = (n: string, v: string, jenis: string, harga: number, dl: string | null, se: string, sb: string, sc: string, lunas: string | null, ca: string, catatan: string | null): Row => ({
    id: 'j-' + n, user_id: MOCK_USER_ID, vendor_id: v, nama_project: '', jenis_edit: jenis, harga, deadline: dl,
    status_edit: se, status_bayar: sb, status_cetak: sc, tanggal_lunas: lunas, catatan, created_at: ca, updated_at: ca, deleted_at: null,
  })

  DB.job = [
    { ...base('001', v1, 'Kolase Sudah Pilih', 35000, dateOnly(-45), 'Selesai', 'Lunas', 'Sudah Cetak', dateOnly(-150), tsDaysAgo(160), 'Sudah dikirim ke vendor.'), nama_project: 'Pre-Wedding & Rina' },
    { ...base('002', v2, 'Edit Full', 150000, dateOnly(-40), 'Selesai', 'Lunas', 'Sudah Cetak', dateOnly(-120), tsDaysAgo(130), null), nama_project: 'Wedding Dito & Sari' },
    { ...base('003', v3, 'Kolase Belum Pilih', 65000, dateOnly(-30), 'Selesai', 'Lunas', 'Sudah Cetak', dateOnly(-95), tsDaysAgo(100), 'Request tone soft.'), nama_project: 'Pre-Wedding Bagas & Nia' },
    { ...base('004', v1, 'Edit Full', 135000, dateOnly(-25), 'Selesai', 'Lunas', 'Sudah Dikirim', dateOnly(-70), tsDaysAgo(75), null), nama_project: 'Wedding Ardi & Maya' },
    { ...base('005', v4, 'Kolase Sudah Pilih', 30000, dateOnly(-18), 'Selesai', 'Lunas', 'Sudah Cetak', dateOnly(-50), tsDaysAgo(55), null), nama_project: 'Pre-Wedding Yoga & Putri' },
    { ...base('006', v2, 'Edit Full', 150000, dateOnly(-12), 'Selesai', 'Lunas', 'Sudah Cetak', dateOnly(-35), tsDaysAgo(40), null), nama_project: 'Wedding Farhan & Ayu' },
    { ...base('007', v5, 'Kolase Belum Pilih', 75000, dateOnly(-8), 'Selesai', 'Lunas', 'Sudah Dikirim', dateOnly(-22), tsDaysAgo(28), null), nama_project: 'Pre-Wedding Rizky & Dian' },
    { ...base('008', v1, 'Edit Full', 135000, dateOnly(-5), 'Selesai', 'Lunas', 'Sudah Cetak', dateOnly(-12), tsDaysAgo(18), null), nama_project: 'Wedding Ivan & Sinta' },
    { ...base('009', v3, 'Kolase Sudah Pilih', 45000, dateOnly(-2), 'Selesai', 'Lunas', 'Sudah Dikirim', dateOnly(-6), tsDaysAgo(10), 'Kirim via email.'), nama_project: 'Pre-Wedding Aji & Lala' },
    { ...base('010', v4, 'Kolase Belum Pilih', 45000, dateOnly(-1), 'Revisi', 'Lunas', 'Belum Cetak', dateOnly(-3), tsDaysAgo(8), null), nama_project: 'Wedding Bima & Citra' },
    { ...base('011', v2, 'Edit Full', 150000, dateOnly(-1), 'Sedang Edit', 'Belum Bayar', 'Belum Cetak', null, tsDaysAgo(5), 'Revisi warna langit.'), nama_project: 'Pre-Wedding Galih & Vina' },
    { ...base('012', v5, 'Kolase Sudah Pilih', 55000, dateOnly(0), 'Masuk', 'Belum Bayar', 'Belum Cetak', null, tsDaysAgo(2), null), nama_project: 'Wedding Eko & Rara' },
    { ...base('013', v1, 'Edit Full', 135000, dateOnly(1), 'Sedang Edit', 'Belum Bayar', 'Belum Cetak', null, tsDaysAgo(1), 'Banyak scene outdoor.'), nama_project: 'Pre-Wedding Doni & Mita' },
    { ...base('014', v3, 'Kolase Belum Pilih', 65000, dateOnly(2), 'Masuk', 'Belum Bayar', 'Belum Cetak', null, tsDaysAgo(3), null), nama_project: 'Wedding Putra & Laras' },
    { ...base('015', v4, 'Kolase Sudah Pilih', 30000, dateOnly(3), 'Masuk', 'Belum Bayar', 'Belum Cetak', null, tsDaysAgo(1), null), nama_project: 'Pre-Wedding Surya & Indah' },
    { ...base('016', v2, 'Edit Full', 150000, dateOnly(6), 'Masuk', 'Belum Bayar', 'Belum Cetak', null, tsDaysAgo(1), null), nama_project: 'Wedding Tono & Dewi' },
    { ...base('017', v1, 'Kolase Sudah Pilih', 35000, null, 'Revisi', 'Belum Bayar', 'Belum Cetak', null, tsDaysAgo(4), null), nama_project: 'Pre-Wedding Agus & Bunga' },
    { ...base('018', v5, 'Kolase Belum Pilih', 75000, null, 'Masuk', 'Belum Bayar', 'Belum Cetak', null, tsDaysAgo(1), 'Deadline menyusul.'), nama_project: 'Wedding Hasan & Fitri' },
  ]

  const item = (jobId: string, nama: string, jenis: string, harga: number): Row => ({ job_id: jobId, nama_project: nama, harga, jenis })
  const invItem = (jobId: string, nama: string, jenis: string, harga: number) => JSON.stringify([item(jobId, nama, jenis, harga)])

  DB.invoice = [
    { id: 'i-001', user_id: MOCK_USER_ID, vendor_id: v1, vendor_nama: 'Studio Anugrah', tanggal: dateOnly(0), items_json: invItem('j-013', 'Pre-Wedding Doni & Mita', 'Edit Full', 135000), total: 135000, status_bayar: 'Belum Bayar', pdf_path: null, created_at: tsDaysAgo(1), deleted_at: null },
    { id: 'i-002', user_id: MOCK_USER_ID, vendor_id: v2, vendor_nama: 'FotoCantik Production', tanggal: dateOnly(-25), items_json: invItem('j-006', 'Wedding Farhan & Ayu', 'Edit Full', 150000), total: 150000, status_bayar: 'Lunas', pdf_path: null, created_at: tsDaysAgo(25), deleted_at: null },
    { id: 'i-003', user_id: MOCK_USER_ID, vendor_id: v3, vendor_nama: 'Dedy Wedding Film', tanggal: dateOnly(-60), items_json: invItem('j-003', 'Pre-Wedding Bagas & Nia', 'Kolase Belum Pilih', 65000), total: 65000, status_bayar: 'Lunas', pdf_path: null, created_at: tsDaysAgo(60), deleted_at: null },
    { id: 'i-004', user_id: MOCK_USER_ID, vendor_id: v5, vendor_nama: 'Rafi Media', tanggal: dateOnly(-7), items_json: invItem('j-012', 'Wedding Eko & Rara', 'Kolase Sudah Pilih', 55000), total: 55000, status_bayar: 'Belum Bayar', pdf_path: null, created_at: tsDaysAgo(7), deleted_at: null },
  ]

  DB.user_settings = [
    { id: 's-001', user_id: MOCK_USER_ID, telegram_chat_id: null, telegram_connect_code: null, telegram_connect_expires: null, notif_jam: '07:00:00', created_at: tsDaysAgo(160), updated_at: null },
  ]
}

seedData()

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

function sortRows(rows: Row[], col: string, asc: boolean): Row[] {
  return [...rows].sort((a, b) => {
    const av = a[col], bv = b[col]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    const c = av < bv ? -1 : av > bv ? 1 : 0
    return asc ? c : -c
  })
}

// ─── Query builder ───────────────────────────────────────────────
type Predicate = (r: Row) => boolean
type Mutation = { type: 'insert' | 'update' | 'delete' | 'upsert'; payload: Row; onConflict?: string }

class MockQuery {
  private table: string
  private selectCols: string | null = null
  private head = false
  private filters: Predicate[] = []
  private orderCol: string | null = null
  private orderAsc = true
  private limitN: number | null = null
  private rangeFrom: number | null = null
  private rangeTo: number | null = null
  private single = false
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
    this.filters.push((r) => r[col] === val)
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
    this.orderCol = col
    this.orderAsc = opts?.ascending ?? true
    return this
  }

  limit(n: number) { this.limitN = n; return this }
  range(from: number, to: number) { this.rangeFrom = from; this.rangeTo = to; return this }
  maybeSingle() { this.single = true; return this }

  insert(payload: Row) { this.mutation = { type: 'insert', payload }; return this }
  update(payload: Row) { this.mutation = { type: 'update', payload }; return this }
  upsert(payload: Row, opts?: { onConflict?: string }) { this.mutation = { type: 'upsert', payload, onConflict: opts?.onConflict }; return this }
  delete() { this.mutation = { type: 'delete', payload: {} }; return this }

  private execute(): unknown {
    const store = DB[this.table] ?? []
    let rows = store.slice()
    for (const f of this.filters) rows = rows.filter(f)

    if (this.mutation) {
      const mt = this.mutation
      if (mt.type === 'update') {
        for (const r of rows) {
          Object.assign(r, mt.payload)
          r.updated_at = isoNow()
        }
        return { data: rows, count: rows.length, error: null }
      }
      if (mt.type === 'delete') {
        const ids = new Set(rows.map((r) => r.id))
        DB[this.table] = store.filter((r) => !ids.has(r.id))
        return { data: rows, count: rows.length, error: null }
      }
      if (mt.type === 'upsert') {
        const key = mt.onConflict
        const existing = key ? store.find((r) => r[key] === mt.payload[key]) : undefined
        if (existing) {
          Object.assign(existing, mt.payload)
          existing.updated_at = isoNow()
          return { data: [existing], count: 1, error: null }
        }
        return this.insertRow(mt.payload)
      }
      return this.insertRow(mt.payload)
    }

    const count = rows.length
    if (this.orderCol) rows = sortRows(rows, this.orderCol, this.orderAsc)
    if (this.rangeFrom != null && this.rangeTo != null) rows = rows.slice(this.rangeFrom, this.rangeTo + 1)
    if (this.limitN != null) rows = rows.slice(0, this.limitN)

    if (this.head) return { data: [], count, error: null }

    const parsed = this.selectCols ? parseSelect(this.selectCols) : { all: true, cols: [], joins: [] as JoinSpec[] }
    const data = rows.map((r) => projectRow(this.table, r, parsed))
    return this.single ? { data: data[0] ?? null, count: data.length, error: null } : { data, count, error: null }
  }

  private insertRow(payload: Row) {
    const now = isoNow()
    const row: Row = { id: payload.id ?? genId(), user_id: MOCK_USER_ID, created_at: now, updated_at: now, deleted_at: null, ...payload }
    ;(DB[this.table] ?? (DB[this.table] = [])).push(row)
    return { data: [row], count: 1, error: null }
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected)
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
    auth,
  }
}
