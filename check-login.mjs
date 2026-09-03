import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

page.on('console', msg => {
  if (msg.type() === 'error') console.log('[ERR]', msg.text());
});

// Login
await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

await page.fill('input[type="email"]', 'demo@siedit.com');
await page.fill('input[type="password"]', 'DemoSiEdit2026!');
await page.click('button[type="submit"]');
await page.waitForTimeout(5000);

console.log('URL after login:', page.url());

if (page.url().includes('dashboard')) {
  console.log('LOGIN SUCCESS!');
  const body = await page.evaluate(() => document.body.innerText);
  
  // Dashboard check
  console.log('\n=== DASHBOARD ===');
  console.log('Total Job:', body.includes('Total Job'));
  console.log('Belum Lunas:', body.includes('Belum Lunas'));
  console.log('Deadline:', body.includes('Deadline'));
  
  await page.screenshot({ path: 'C:/Users/Pandu Irawan/SiEdit-Wedding-JOb-Tracker/screenshots/demo-dashboard.png', fullPage: true });

  // Jobs page
  await page.goto('http://localhost:5173/jobs', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const jobsBody = await page.evaluate(() => document.body.innerText);
  const tableRows = await page.locator('table tbody tr').count();
  const checkboxes = await page.locator('table input[type="checkbox"]').count();
  const dropdowns = await page.locator('button[role="button"][aria-haspopup="menu"]').count();
  
  console.log('\n=== JOBS ===');
  console.log('Has Prewedding:', jobsBody.includes('Prewedding'));
  console.log('Has Wedding:', jobsBody.includes('Wedding'));
  console.log('Has Dekorasi:', jobsBody.includes('Dekorasi'));
  console.log('Has Katering:', jobsBody.includes('Katering'));
  console.log('Has Kenangan:', jobsBody.includes('Kenangan'));
  console.log('Table rows:', tableRows);
  console.log('Checkboxes:', checkboxes);
  console.log('Status dropdowns:', dropdowns);
  
  await page.screenshot({ path: 'C:/Users/Pandu Irawan/SiEdit-Wedding-JOb-Tracker/screenshots/demo-jobs.png', fullPage: true });

  // Vendors page
  await page.goto('http://localhost:5173/vendors', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const vendorsBody = await page.evaluate(() => document.body.innerText);
  
  console.log('\n=== VENDORS ===');
  console.log('Has Kenangan:', vendorsBody.includes('Kenangan'));
  console.log('Has Pelangi:', vendorsBody.includes('Pelangi'));
  console.log('Has Nusantara:', vendorsBody.includes('Nusantara'));
  
  await page.screenshot({ path: 'C:/Users/Pandu Irawan/SiEdit-Wedding-JOb-Tracker/screenshots/demo-vendors.png', fullPage: true });

  // Invoices page
  await page.goto('http://localhost:5173/invoices', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const invBody = await page.evaluate(() => document.body.innerText);
  
  console.log('\n=== INVOICES ===');
  console.log('Has INV-2026:', invBody.includes('INV-2026'));
  console.log('Has Lunas:', invBody.includes('Lunas'));
  console.log('Has Kenangan:', invBody.includes('Kenangan'));
  
  await page.screenshot({ path: 'C:/Users/Pandu Irawan/SiEdit-Wedding-JOb-Tracker/screenshots/demo-invoices.png', fullPage: true });

  // Settings page
  await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/Pandu Irawan/SiEdit-Wedding-JOb-Tracker/screenshots/demo-settings.png', fullPage: true });
  
} else {
  console.log('LOGIN FAILED');
  const body = await page.evaluate(() => document.body.innerText);
  console.log('Page text:', body.substring(0, 300));
}

await browser.close();
