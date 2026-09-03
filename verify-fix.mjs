import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:5173';
const SHOTS = 'C:/Users/Pandu Irawan/SiEdit-Wedding-JOb-Tracker/screenshots';
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

// Login with longer timeout
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.fill('input[type="email"]', 'demo@siedit.com');
await page.fill('input[type="password"]', 'DemoSiEdit2026!');
await Promise.all([
  page.waitForResponse(resp => resp.url().includes('/auth/v1/'), { timeout: 20000 }),
  page.click('button[type="submit"]')
]);
await page.waitForTimeout(8000);
console.log('Logged in, URL:', page.url());

// 1. DASHBOARD
console.log('\n=== DASHBOARD ===');
const dashBody = await page.evaluate(() => document.body.innerText);
console.log('Has Total Job:', dashBody.includes('Total Job'));
console.log('Has Pendapatan:', dashBody.includes('Pendapatan'));
console.log('Rp 0?:', dashBody.includes('Rp 0') && !dashBody.includes('Rp 8'));
await page.screenshot({ path: `${SHOTS}/verify-dashboard.png`, fullPage: true });

// 2. JOBS
console.log('\n=== JOBS ===');
await page.goto(`${BASE}/jobs`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const jobsBody = await page.evaluate(() => document.body.innerText);
const tableRows = await page.locator('table tbody tr').count();
console.log('Table rows:', tableRows);
console.log('Has sisa Rp:', jobsBody.includes('sisa'));
await page.screenshot({ path: `${SHOTS}/verify-jobs.png`, fullPage: true });

// 3. VENDORS
console.log('\n=== VENDORS ===');
await page.goto(`${BASE}/vendors`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const vendorsBody = await page.evaluate(() => document.body.innerText);
console.log('Has Kenangan:', vendorsBody.includes('Kenangan'));
console.log('0 Job?:', vendorsBody.includes('0 Job'));
console.log('Rp 0 Pendapatan?:', vendorsBody.includes('Rp 0'));
await page.screenshot({ path: `${SHOTS}/verify-vendors.png`, fullPage: true });

// 4. LAPORAN (was broken!)
console.log('\n=== LAPORAN ===');
await page.goto(`${BASE}/reports`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const reportsBody = await page.evaluate(() => document.body.innerText);
const hasError = reportsBody.includes('does not exist') || reportsBody.includes('error');
console.log('Has error?:', hasError);
if (hasError) console.log('Error text:', reportsBody.match(/.{0,80}(does not exist|error).{0,80}/)?.[0]);
console.log('Has Total Job:', reportsBody.includes('Total Job'));
console.log('Has Total Pendapatan:', reportsBody.includes('Total Pendapatan'));
console.log('Has Job per Status:', reportsBody.includes('Job per Status'));
await page.screenshot({ path: `${SHOTS}/verify-reports.png`, fullPage: true });

// 5. INVOICES
console.log('\n=== INVOICES ===');
await page.goto(`${BASE}/invoices`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const invBody = await page.evaluate(() => document.body.innerText);
console.log('Has TOTAL INVOICE:', invBody.includes('TOTAL INVOICE'));
console.log('Has PIUTANG:', invBody.includes('PIUTANG'));
console.log('Has LUNAS:', invBody.includes('LUNAS'));
await page.screenshot({ path: `${SHOTS}/verify-invoices.png`, fullPage: true });

await browser.close();
console.log('\nDone! Check screenshots.');
