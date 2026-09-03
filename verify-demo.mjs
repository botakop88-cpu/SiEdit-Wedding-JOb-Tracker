import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

// Check login page
await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

console.log('URL:', page.url());
const hasLoginForm = await page.locator('form').count() > 0;
console.log('Login form visible:', hasLoginForm);

// Try login with demo credentials
if (hasLoginForm) {
  await page.fill('input[type="email"]', 'demo@siedit.app');
  await page.fill('input[type="password"]', 'DemoSiEdit2026!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  
  console.log('URL after login:', page.url());
  
  const body = await page.evaluate(() => document.body.innerText);
  console.log('Has "Total Job":', body.includes('Total Job'));
  console.log('Has "Kenangan":', body.includes('Kenangan'));
  console.log('Has "Pelangi":', body.includes('Pelangi'));
  console.log('Has "Nusantara":', body.includes('Nusantara'));
  
  // Check jobs
  await page.goto('http://localhost:5173/jobs', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  const jobsBody = await page.evaluate(() => document.body.innerText);
  const tableRows = await page.locator('table tbody tr').count();
  const checkboxes = await page.locator('table input[type="checkbox"]').count();
  const dropdowns = await page.locator('button[role="button"][aria-haspopup="menu"]').count();
  
  console.log('\nJobs page:');
  console.log('Has Prewedding:', jobsBody.includes('Prewedding'));
  console.log('Has Wedding:', jobsBody.includes('Wedding'));
  console.log('Table rows:', tableRows);
  console.log('Checkboxes:', checkboxes);
  console.log('Status dropdowns:', dropdowns);
  
  await page.screenshot({ path: 'C:/Users/Pandu Irawan/SiEdit-Wedding-JOb-Tracker/screenshots/demo-jobs.png', fullPage: true });
  console.log('Screenshot saved: demo-jobs.png');
  
  // Check vendors
  await page.goto('http://localhost:5173/vendors', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  const vendorsBody = await page.evaluate(() => document.body.innerText);
  console.log('\nVendors page:');
  console.log('Has Kenangan:', vendorsBody.includes('Kenangan'));
  console.log('Has Pelangi:', vendorsBody.includes('Pelangi'));
  console.log('Has Nusantara:', vendorsBody.includes('Nusantara'));
  
  await page.screenshot({ path: 'C:/Users/Pandu Irawan/SiEdit-Wedding-JOb-Tracker/screenshots/demo-vendors.png', fullPage: true });
  console.log('Screenshot saved: demo-vendors.png');
}

await browser.close();
