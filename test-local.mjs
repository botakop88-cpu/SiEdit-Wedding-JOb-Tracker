import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const BASE = 'http://localhost:5173';
const PROJECT = 'C:/Users/Pandu Irawan/SiEdit-Wedding-JOb-Tracker';
const results = [];

function log(page, status, detail = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : 'ℹ️';
  const msg = `[${page}] ${icon} ${detail}`;
  console.log(msg);
  results.push({ page, status, detail });
}

(async () => {
  console.log('=== SiEdit Local Test (v3) ===\n');
  
  const browser = await chromium.launch({ headless: true });
  
  // ==========================================
  // PART A: Source Code Verification (100% reliable)
  // ==========================================
  console.log('--- Source Code Verification ---');
  
  // Bug #1: Auth pages gradient background
  const loginSrc = readFileSync(`${PROJECT}/src/pages/Login.tsx`, 'utf-8');
  const registerSrc = readFileSync(`${PROJECT}/src/pages/Register.tsx`, 'utf-8');
  const forgotSrc = readFileSync(`${PROJECT}/src/pages/ForgotPassword.tsx`, 'utf-8');
  const resetSrc = readFileSync(`${PROJECT}/src/pages/ResetPassword.tsx`, 'utf-8');
  
  const pages = [
    { name: 'Login', src: loginSrc },
    { name: 'Register', src: registerSrc },
    { name: 'ForgotPassword', src: forgotSrc },
    { name: 'ResetPassword', src: resetSrc },
  ];
  
  for (const p of pages) {
    const hasGradient = p.src.includes('bg-gradient-to-br from-slate-900');
    const hasOldBg = p.src.includes('bg-gray-50');
    log('Bug#1', hasGradient && !hasOldBg ? 'PASS' : 'FAIL',
      `${p.name}: gradient=${hasGradient}, oldBg=${hasOldBg}`);
  }
  
  // Bug #18: Form card + error/success colors
  for (const p of pages) {
    const hasNewCard = p.src.includes('bg-white rounded-2xl shadow-xl');
    const hasOldCard = p.src.includes('bg-white/90 backdrop-blur');
    const hasRed50 = p.src.includes('bg-red-50 text-red-600');
    const hasOldRed = p.src.includes('bg-red-500/10 text-red-300');
    log('Bug#18', hasNewCard && hasRed50 ? 'PASS' : 'FAIL',
      `${p.name}: card=${hasNewCard}/${hasOldCard}, error=${hasRed50}/${hasOldRed}`);
  }
  
  // Bug #2: Reports date range
  const reportsSrc = readFileSync(`${PROJECT}/src/pages/Reports.tsx`, 'utf-8');
  const hasOldFormula = reportsSrc.includes('curMonth + 10') || reportsSrc.includes('(curMonth + 10) % 12');
  const hasNewFormula = reportsSrc.includes('curMonth - 5') || reportsSrc.includes('curMonth + 7');
  log('Bug#2', hasNewFormula && !hasOldFormula ? 'PASS' : 'FAIL',
    `Reports date range: old=${hasOldFormula}, new=${hasNewFormula}`);
  
  // Bug #3: try/finally in loadData
  const dashSrc = readFileSync(`${PROJECT}/src/pages/Dashboard.tsx`, 'utf-8');
  const jobsSrc = readFileSync(`${PROJECT}/src/pages/Jobs.tsx`, 'utf-8');
  const vendorsSrc = readFileSync(`${PROJECT}/src/pages/Vendors.tsx`, 'utf-8');
  const invoicesSrc = readFileSync(`${PROJECT}/src/pages/Invoices.tsx`, 'utf-8');
  
  for (const { name, src } of [
    { name: 'Dashboard', src: dashSrc },
    { name: 'Jobs', src: jobsSrc },
    { name: 'Vendors', src: vendorsSrc },
    { name: 'Invoices', src: invoicesSrc },
  ]) {
    const hasFinally = src.includes('} finally {');
    log('Bug#3', hasFinally ? 'PASS' : 'FAIL', `${name}: try/finally=${hasFinally}`);
  }
  
  // Bug #4: ResetPassword navigate instead of reload
  const hasReload = resetSrc.includes('window.location.reload()');
  const hasNavigate = resetSrc.includes('navigate(');
  log('Bug#4', !hasReload && hasNavigate ? 'PASS' : 'FAIL',
    `ResetPassword: reload=${hasReload}, navigate=${hasNavigate}`);
  
  // Bug #5: MockClient not()
  const mockSrc = readFileSync(`${PROJECT}/src/lib/mockClient.ts`, 'utf-8');
  const hasNotNeq = mockSrc.includes('!== val');
  const hasNotEq = mockSrc.includes('=== val') && !mockSrc.includes('!== val');
  log('Bug#5', hasNotNeq ? 'PASS' : 'FAIL',
    `MockClient not(): !== val=${hasNotNeq}, === val=${hasNotEq}`);
  
  // Bug #6: useEffect deps with user?.id guard
  for (const { name, src } of [
    { name: 'Dashboard', src: dashSrc },
    { name: 'Jobs', src: jobsSrc },
    { name: 'Vendors', src: vendorsSrc },
    { name: 'Invoices', src: invoicesSrc },
  ]) {
    const hasUserDep = src.includes('[user?.id]') || src.includes('[user?.id,');
    const hasUserGuard = src.includes('if (user)') || src.includes('if (!user)');
    log('Bug#6', hasUserDep ? 'PASS' : 'FAIL', `${name}: user dep=${hasUserDep}, guard=${hasUserGuard}`);
  }
  
  // Bug #7: Jobs bulk undo updated_at
  const hasUndoUpdatedAt = jobsSrc.includes('updated_at: new Date().toISOString()');
  log('Bug#7', hasUndoUpdatedAt ? 'PASS' : 'FAIL', `Jobs bulk undo updated_at=${hasUndoUpdatedAt}`);
  
  // Bug #15: AuthContext .catch()
  const authSrc = readFileSync(`${PROJECT}/src/lib/AuthContext.tsx`, 'utf-8');
  const hasCatch = authSrc.includes('.catch(() => {') && authSrc.includes('setLoading(false)');
  log('Bug#15', hasCatch ? 'PASS' : 'FAIL', `AuthContext .catch=${hasCatch}`);
  
  // ==========================================
  // PART B: Browser Verification (pages without auto-login)
  // ==========================================
  console.log('\n--- Browser Verification ---');
  
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  
  // Test ResetPassword (no auto-redirect since it's a reset page)
  const rpPage = await ctx.newPage();
  await rpPage.goto(`${BASE}/reset-password`, { waitUntil: 'networkidle' });
  const rpBg = await rpPage.evaluate(() => {
    const el = document.querySelector('.min-h-screen');
    return el ? { bgImage: getComputedStyle(el).backgroundImage, classes: el.className } : null;
  });
  if (rpBg) {
    const hasGradient = rpBg.bgImage.includes('gradient');
    log('Browser', hasGradient ? 'PASS' : 'FAIL', `ResetPassword bg: ${rpBg.bgImage.substring(0, 80)}`);
    log('Browser', 'INFO', `Classes: ${rpBg.classes}`);
  }
  await rpPage.close();
  
  // Test Dashboard (auto-logged in)
  const dashPage = await ctx.newPage();
  await dashPage.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  const dashCheck = await dashPage.evaluate(() => ({
    url: window.location.href,
    hasCards: document.querySelectorAll('[class*="card"]').length,
    title: document.title,
  }));
  log('Browser', dashCheck.url.includes('dashboard') ? 'PASS' : 'FAIL', 
    `Dashboard loaded: ${dashCheck.hasCards} cards`);
  await dashPage.close();
  
  // Test Jobs
  const jobsPage = await ctx.newPage();
  await jobsPage.goto(`${BASE}/jobs`, { waitUntil: 'networkidle' });
  const jobsCheck = await jobsPage.evaluate(() => ({
    url: window.location.href,
    hasSearch: !!document.querySelector('input'),
    hasBtns: document.querySelectorAll('button').length,
  }));
  log('Browser', jobsCheck.url.includes('jobs') ? 'PASS' : 'FAIL',
    `Jobs loaded: search=${jobsCheck.hasSearch}, buttons=${jobsCheck.hasBtns}`);
  await jobsPage.close();
  
  // Test Invoices
  const invPage = await ctx.newPage();
  await invPage.goto(`${BASE}/invoices`, { waitUntil: 'networkidle' });
  const invCheck = await invPage.evaluate(() => ({
    url: window.location.href,
    tabs: document.querySelectorAll('button').length,
  }));
  log('Browser', invCheck.url.includes('invoices') ? 'PASS' : 'FAIL',
    `Invoices loaded: ${invCheck.tabs} interactive elements`);
  await invPage.close();
  
  // Test Reports
  const repPage = await ctx.newPage();
  await repPage.goto(`${BASE}/reports`, { waitUntil: 'networkidle' });
  const repCheck = await repPage.evaluate(() => ({
    url: window.location.href,
    selects: document.querySelectorAll('select').length,
  }));
  log('Browser', repCheck.url.includes('reports') ? 'PASS' : 'FAIL',
    `Reports loaded: ${repCheck.selects} selects`);
  await repPage.close();
  
  // SPA Routing check
  console.log('\n--- SPA Routing ---');
  const routes = ['/login', '/register', '/forgot-password', '/reset-password',
    '/dashboard', '/jobs', '/vendors', '/invoices', '/reports', '/settings', '/notifications'];
  for (const route of routes) {
    const rp = await ctx.newPage();
    const resp = await rp.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
    log('Routing', resp?.status() === 200 ? 'PASS' : 'FAIL', `${route} → HTTP ${resp?.status()}`);
    await rp.close();
  }
  
  // JS errors check
  console.log('\n--- Console Errors ---');
  for (const route of routes) {
    const ep = await ctx.newPage();
    const errors = [];
    ep.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    ep.on('pageerror', err => errors.push(err.message));
    await ep.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
    await ep.waitForTimeout(500);
    log('Console', errors.length === 0 ? 'PASS' : 'FAIL',
      `${route}: ${errors.length === 0 ? 'clean' : errors.length + ' error(s): ' + errors[0]?.substring(0, 80)}`);
    await ep.close();
  }
  
  // ==========================================
  // SUMMARY
  // ==========================================
  console.log('\n=== SUMMARY ===');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const info = results.filter(r => r.status === 'INFO').length;
  console.log(`PASS: ${passed} | FAIL: ${failed} | INFO: ${info}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed:');
    results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  [${r.page}] ${r.detail}`));
  }
  
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
