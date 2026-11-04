import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base=process.env.TEST_BASE_URL;
if (!base || !/^http:\/\/127\.0\.0\.1:\d+\/notebook$/.test(base)) throw new Error('Disposable loopback fixture required');
const browser=await chromium.launch({headless:true,...(process.env.TEST_BROWSER?{executablePath:process.env.TEST_BROWSER}:{})});
try {
  const page=await browser.newPage();
  await page.goto(base+'/');
  const nav=page.getByRole('navigation',{name:'Notebook contents'});
  await nav.getByRole('link',{name:'Guide',exact:true,includeHidden:true}).waitFor({state:'attached'});
  assert.equal(await nav.locator('.notebook-tree details[open]').count(),0);
  await nav.getByText('Projects',{exact:true}).click();
  await nav.getByRole('link',{name:'Guide',exact:true}).waitFor();
  assert.equal(await nav.getByRole('button',{name:/Add /,includeHidden:true}).count(),0);
  assert.equal(await nav.locator('form').count(),0);
  console.log('PASS read-only navigation has no mutation controls');
} finally { await browser.close(); }
