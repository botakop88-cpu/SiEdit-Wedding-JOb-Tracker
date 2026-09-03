import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:5173';
const SHOTS = 'C:/Users/Pandu Irawan/SiEdit-Wedding-JOb-Tracker/screenshots';
mkdirSync(SHOTS, { recursive: true });

let step = 0;
async function snap(page, name) {
  step++;
  const path = `${SHOTS}/${String(step).padStart(2,'0')}-${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`📸 ${path}`);
  return path;
}

async function closeAnyModal(page) {
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
  const overlay = page.locator('div.fixed.inset-0.z-50');
  if (await overlay.count() > 0) {
    await overlay.first().click({ position: { x: 10, y: 10 }, force: true });
    await page.waitForTimeout(300);
  }
  const stillOpen = await page.locator('div.fixed.inset-0.z-50').count();
  if (stillOpen > 0) {
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
  }
}

async function waitForReady(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
}

const results = [];
function log(feature, status, detail = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : 'ℹ️';
  console.log(`${icon} [${feature}] ${detail}`);
  results.push({ feature, status, detail });
}

(async () => {
  console.log('=== SiEdit: Full Feature Test (Real Data) ===\n');
  
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('404') && !msg.text().includes('400')) {
      console.log(`  [console error] ${msg.text()}`);
    }
  });

  // ==========================================
  // 0. LOGIN
  // ==========================================
  console.log('\n🔐 === LOGIN ===');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  
  await page.fill('input[type="email"]', 'demo@siedit.com');
  await page.fill('input[type="password"]', 'DemoSiEdit2026!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  
  const isLoggedIn = page.url().includes('dashboard');
  log('Auth-Login', isLoggedIn ? 'PASS' : 'FAIL', `URL: ${page.url()}`);
  await snap(page, 'login-success');

  if (!isLoggedIn) {
    console.log('LOGIN FAILED - aborting');
    await browser.close();
    return;
  }

  // ==========================================
  // 1. DASHBOARD
  // ==========================================
  console.log('\n📊 === DASHBOARD ===');
  const dashBody = await page.evaluate(() => document.body.innerText);
  
  const kpis = ['Total Job', 'Belum Lunas', 'Deadline'];
  kpis.forEach(k => log('Dashboard-KPI', dashBody.includes(k) ? 'PASS' : 'FAIL', k));
  
  const navItems = ['Dashboard', 'Job', 'Vendor', 'Invoice', 'Laporan', 'Pengaturan'];
  navItems.forEach(n => log('Dashboard-Nav', dashBody.includes(n) ? 'PASS' : 'FAIL', n));
  
  await snap(page, 'dashboard');
  
  // Global search
  const searchInput = page.locator('input[placeholder*="Cari"]');
  if (await searchInput.count() > 0) {
    await searchInput.fill('Prewedding');
    await page.waitForTimeout(1000);
    const searchBody = await page.evaluate(() => document.body.innerText);
    log('Dashboard-GlobalSearch', searchBody.includes('Prewedding') ? 'PASS' : 'FAIL', 'Search "Prewedding"');
    await snap(page, 'dashboard-search');
    await searchInput.fill('');
    await page.waitForTimeout(500);
  }

  // ==========================================
  // 2. JOBS PAGE
  // ==========================================
  console.log('\n💼 === JOBS ===');
  await page.goto(`${BASE}/jobs`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  const jobsBody = await page.evaluate(() => document.body.innerText);
  const tableRows = await page.locator('table tbody tr').count();
  const checkboxes = await page.locator('table input[type="checkbox"]').count();
  const dropdowns = await page.locator('button[role="button"][aria-haspopup="menu"]').count();
  
  log('Jobs-Table', tableRows >= 5 ? 'PASS' : 'FAIL', `${tableRows} rows`);
  log('Jobs-Checkboxes', checkboxes >= 5 ? 'PASS' : 'FAIL', `${checkboxes} checkboxes`);
  log('Jobs-StatusDropdowns', dropdowns >= 5 ? 'PASS' : 'FAIL', `${dropdowns} dropdowns`);
  
  // Check data variety
  log('Jobs-HasPrewedding', jobsBody.includes('Prewedding') ? 'PASS' : 'FAIL');
  log('Jobs-HasWedding', jobsBody.includes('Wedding') ? 'PASS' : 'FAIL');
  log('Jobs-HasDekorasi', jobsBody.includes('Dekorasi') ? 'PASS' : 'FAIL');
  log('Jobs-HasKatering', jobsBody.includes('Katering') ? 'PASS' : 'FAIL');
  
  await snap(page, 'jobs-list');
  
  // Select all checkbox
  const selectAll = page.locator('table thead input[type="checkbox"]');
  if (await selectAll.count() > 0) {
    await selectAll.first().click();
    await page.waitForTimeout(500);
    const bulkBar = await page.evaluate(() => document.body.innerText);
    log('Jobs-BulkSelect', bulkBar.includes('dipilih') || bulkBar.includes('bulk') || bulkBar.includes('Bulk') ? 'PASS' : 'FAIL', 'Select all');
    await snap(page, 'jobs-bulk-select');
    await selectAll.first().click();
    await page.waitForTimeout(500);
  }
  
  // Status dropdown
  if (dropdowns > 0) {
    const firstDropdown = page.locator('button[role="button"][aria-haspopup="menu"]').first();
    await firstDropdown.click();
    await page.waitForTimeout(500);
    const menuBody = await page.evaluate(() => document.body.innerText);
    const hasMenuOptions = menuBody.includes('Masuk') || menuBody.includes('Sedang Edit') || menuBody.includes('Selesai') || menuBody.includes('Revisi');
    log('Jobs-StatusDropdownMenu', hasMenuOptions ? 'PASS' : 'FAIL', 'Status options visible');
    await snap(page, 'jobs-status-menu');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
  
  // More menu (3-dot)
  const moreBtns = page.locator('table tbody button').filter({ has: page.locator('svg') });
  
  // Filter buttons
  const filterBtns = page.locator('button').filter({ hasText: /Semua Status|Masuk|Sedang|Revisi|Selesai/ });
  const filterCount = await filterBtns.count();
  log('Jobs-Filters', filterCount >= 2 ? 'PASS' : 'FAIL', `${filterCount} filter buttons`);
  
  // Add job button
  const addJobBtn = page.locator('a[href*="/jobs/new"], button').filter({ hasText: /Tambah|Tambah Job/ });
  log('Jobs-AddButton', (await addJobBtn.count()) > 0 ? 'PASS' : 'FAIL');
  
  // Click first job row to view detail
  if (tableRows > 0) {
    const firstRow = page.locator('table tbody tr').first();
    await firstRow.click();
    await page.waitForTimeout(2000);
    const detailBody = await page.evaluate(() => document.body.innerText);
    const isDetail = detailBody.includes('Prewedding') || detailBody.includes('Wedding') || detailBody.includes('Dekorasi') || detailBody.includes('Katering') || detailBody.includes('Back') || detailBody.includes('Kembali');
    log('Jobs-DetailPage', isDetail ? 'PASS' : 'FAIL', 'Job detail view');
    await snap(page, 'jobs-detail');
    await page.goBack();
    await page.waitForTimeout(2000);
  }
  
  // ==========================================
  // 3. VENDORS PAGE
  // ==========================================
  console.log('\n🏪 === VENDORS ===');
  await page.goto(`${BASE}/vendors`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  const vendorsBody = await page.evaluate(() => document.body.innerText);
  const vendorCards = await page.locator('[class*="card"], [class*="Card"]').count();
  
  log('Vendors-HasKenangan', vendorsBody.includes('Kenangan') ? 'PASS' : 'FAIL');
  log('Vendors-HasPelangi', vendorsBody.includes('Pelangi') ? 'PASS' : 'FAIL');
  log('Vendors-HasNusantara', vendorsBody.includes('Nusantara') ? 'PASS' : 'FAIL');
  
  // Vendor KPIs
  log('Vendors-TotalKPI', vendorsBody.includes('Total Vendor') ? 'PASS' : 'FAIL');
  
  // Filter buttons
  log('Vendors-Filters', vendorsBody.includes('Semua Status') || vendorsBody.includes('Piutang') || vendorsBody.includes('Lunas') ? 'PASS' : 'FAIL');
  
  await snap(page, 'vendors-list');
  
  // Click first vendor to view detail
  const vendorLink = page.locator('a[href*="/vendors/"]').first();
  if (await vendorLink.count() > 0) {
    await vendorLink.click();
    await page.waitForTimeout(2000);
    const vendorDetail = await page.evaluate(() => document.body.innerText);
    log('Vendors-DetailPage', vendorDetail.includes('Kenangan') || vendorDetail.includes('Pelangi') || vendorDetail.includes('Nusantara') ? 'PASS' : 'FAIL');
    await snap(page, 'vendor-detail');
    await page.goBack();
    await page.waitForTimeout(2000);
  }
  
  // ==========================================
  // 4. INVOICES PAGE
  // ==========================================
  console.log('\n📄 === INVOICES ===');
  await page.goto(`${BASE}/invoices`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  const invBody = await page.evaluate(() => document.body.innerText);
  
  log('Invoices-HasVendor', invBody.includes('Kenangan') || invBody.includes('Nusantara') ? 'PASS' : 'FAIL');
  log('Invoices-TotalKPI', invBody.includes('TOTAL') || invBody.includes('Total') ? 'PASS' : 'FAIL');
  log('Invoices-PiutangKPI', invBody.includes('PIUTANG') || invBody.includes('Piutang') ? 'PASS' : 'FAIL');
  log('Invoices-LunasKPI', invBody.includes('LUNAS') || invBody.includes('Lunas') ? 'PASS' : 'FAIL');
  
  // Vendor select for invoice creation
  const vendorSelect = page.locator('select');
  if (await vendorSelect.count() > 0) {
    const options = await vendorSelect.first().locator('option').evaluateAll(els => els.map(e => e.textContent).filter(t => t && t !== ''));
    log('Invoices-VendorSelect', options.length > 1 ? 'PASS' : 'FAIL', `${options.length} vendor options`);
  }
  
  await snap(page, 'invoices');
  
  // ==========================================
  // 5. LAPORAN (REPORTS)
  // ==========================================
  console.log('\n📈 === LAPORAN ===');
  await page.goto(`${BASE}/reports`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  const reportsBody = await page.evaluate(() => document.body.innerText);
  log('Reports-PageLoaded', reportsBody.includes('Laporan') || reportsBody.includes('Report') ? 'PASS' : 'FAIL');
  log('Reports-HasCharts', reportsBody.includes('Pendapatan') || reportsBody.includes('Revenue') || reportsBody.includes('Bulanan') ? 'PASS' : 'FAIL');
  
  await snap(page, 'reports');
  
  // ==========================================
  // 6. SETTINGS PAGE
  // ==========================================
  console.log('\n⚙️ === SETTINGS ===');
  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  const settingsBody = await page.evaluate(() => document.body.innerText);
  log('Settings-PageLoaded', settingsBody.includes('Pengaturan') || settingsBody.includes('Setting') ? 'PASS' : 'FAIL');
  log('Settings-HasUser', settingsBody.includes('demo@siedit.com') ? 'PASS' : 'FAIL');
  
  // Logout
  log('Settings-LogoutBtn', settingsBody.includes('Keluar') || settingsBody.includes('Logout') ? 'PASS' : 'FAIL');
  
  await snap(page, 'settings');

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log('\n' + '='.repeat(50));
  console.log('=== TEST SUMMARY ===');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`✅ PASS: ${passed}`);
  console.log(`❌ FAIL: ${failed}`);
  console.log(`Total: ${results.length}`);
  
  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ❌ [${r.feature}] ${r.detail}`);
    });
  }
  
  console.log(`\n📸 Screenshots saved to: ${SHOTS}`);
  
  await browser.close();
})();
