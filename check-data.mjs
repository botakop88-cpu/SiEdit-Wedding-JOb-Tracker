import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

// Check Jobs page data
await page.goto('http://localhost:5173/jobs', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const jobsInfo = await page.evaluate(() => {
  const tableRows = document.querySelectorAll('table tbody tr').length;
  const dropdowns = document.querySelectorAll('button[role="button"]').length;
  const checkboxes = document.querySelectorAll('table input[type="checkbox"]').length;
  const moreMenus = document.querySelectorAll('svg.lucide-more-vertical').length;
  const emptyState = document.body.innerText.includes('Tidak ada job');
  const vendorGroups = document.querySelectorAll('.card.overflow-hidden').length;
  return { tableRows, dropdowns, checkboxes, moreMenus, emptyState, vendorGroups };
});
console.log('Jobs:', JSON.stringify(jobsInfo, null, 2));

// Check Invoices page data
await page.goto('http://localhost:5173/invoices', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const invInfo = await page.evaluate(() => {
  const totalInvoice = document.body.innerText.includes('Total Invoice');
  const riwayat = document.querySelectorAll('.card-hover').length;
  const tabBuat = document.body.innerText.includes('Buat Invoice');
  const tabRiwayat = document.body.innerText.includes('Riwayat');
  const vendorOpts = Array.from(document.querySelectorAll('select option')).filter(o => o.value !== '').length;
  return { totalInvoice, riwayat, tabBuat, tabRiwayat, vendorOpts };
});
console.log('Invoices:', JSON.stringify(invInfo, null, 2));

// Check Reports charts
await page.goto('http://localhost:5173/reports', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const repInfo = await page.evaluate(() => {
  const svgs = document.querySelectorAll('svg').length;
  const recharts = document.querySelectorAll('.recharts-wrapper').length;
  const tabs = document.body.innerText.includes('Ringkasan') && document.body.innerText.includes('Keuangan');
  const selects = document.querySelectorAll('select').length;
  return { svgs, recharts, tabs, selects };
});
console.log('Reports:', JSON.stringify(repInfo, null, 2));

await browser.close();
