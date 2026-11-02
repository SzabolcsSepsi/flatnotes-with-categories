import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { parseContents } from '../client/extensions/notebook/parse.js';

const base = process.env.TEST_BASE_URL;
if (!base || !/^http:\/\/127\.0\.0\.1:\d+(?:\/[a-z]+)?$/.test(base)) throw new Error('Disposable loopback fixture required');
const browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER ? { executablePath: process.env.TEST_BROWSER } : {}) });
const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
const page = await context.newPage();
const guideLink = page.getByRole('navigation', {name:'Notebook contents'}).getByRole('link', {name:'Guide',exact:true});
const errors = [];
const external = [];
page.on('pageerror', e => errors.push(e.message));
page.on('request', r => { if (!r.url().startsWith(new URL(base).origin)) external.push(r.url()); });
async function check(name, fn) { await fn(); console.log('PASS', name); }
async function login() {
  await page.goto(base + '/');
  await page.getByPlaceholder('Username').fill('synthetic-user');
  await page.getByPlaceholder('Password', { exact: true }).fill(process.env.TEST_PASSWORD);
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await page.getByRole('navigation', { name: 'Notebook contents' }).waitFor();
  await guideLink.waitFor();
}
async function api(path, data, method='GET') {
  return page.evaluate(async ({ path, data, method, base }) => {
    const response = await fetch(base + path, {
      method, headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('token'), 'Content-Type': 'application/json' },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    return { status: response.status, data: await response.json() };
  }, { path, data, method, base });
}
try {
  await check('login hides private navigation until authenticated', async () => {
    await page.goto(base + '/');
    await page.getByPlaceholder('Username').waitFor();
    assert.equal(await page.getByRole('navigation', { name:'Notebook contents' }).count(), 0);
    await login();
  });
  await check('nested menu opens the existing note route', async () => {
    await guideLink.click();
    await page.locator('.toast-viewer').getByText('Synthetic text', { exact:true }).waitFor();
    assert.equal(await guideLink.getAttribute('aria-current'), 'page');
  });
  await check('Contents survives WYSIWYG and Markdown round trip', async () => {
    const before = (await api('/api/notes/Contents')).data.content;
    await page.getByRole('link',{name:'Open / edit contents',exact:true}).click();
    await page.getByRole('button',{name:'Edit',exact:true}).click();
    await page.getByText('WYSIWYG',{exact:true}).click();
    await page.getByText('Markdown',{exact:true}).click();
    await page.getByRole('button',{name:'Save',exact:true}).click();
    const after = (await api('/api/notes/Contents')).data.content;
    const simplify = n => n.map(({label,kind,children}) => ({label,kind,...(children ? {children:simplify(children)} : {})}));
    assert.deepEqual(simplify(parseContents(before).nodes), simplify(parseContents(after).nodes));
    await page.getByRole('button',{name:'Edit',exact:true}).click();
  });
  await check('date-sorted tasks and calendar do not rewrite Home', async () => {
    const before = (await api('/api/notes/Home')).data.content;
    await page.getByRole('link',{name:'Tasks by date',exact:true}).click();
    await page.locator('.notebook-task-list li').first().waitFor();
    assert.deepEqual(await page.locator('.notebook-task-list time').allTextContents(), ['2026-01-03','2026-12-15']);
    await page.getByLabel('Show completed').check();
    assert.deepEqual(await page.locator('.notebook-task-list time').allTextContents(), ['2026-01-02','2026-01-03','2026-12-15']);
    await page.getByRole('button',{name:'Month view',exact:true}).click();
    assert.ok(await page.locator('.notebook-day').count() >= 28);
    assert.equal((await api('/api/notes/Home')).data.content, before);
  });
  await check('malicious navigation and task text never executes', async () => {
    await api('/api/notes/Contents',{newContent:'# Contents\n## <img src=x onerror="window.__probe=1">\n- [[Guide]]\n- [[../outside]]\n- [[javascript:alert(1)]]'},'PATCH');
    await page.getByRole('button',{name:'Refresh contents',exact:true}).click();
    await page.getByText('<img src=x onerror="window.__probe=1">',{exact:true}).waitFor();
    assert.equal(await page.locator('.notebook-sidebar img').count(),0);
    assert.equal(await page.locator('.notebook-sidebar a[href*="outside"]').count(),0);
    await api('/api/notes/Home',{newContent:'- [ ] 2026-01-01 — <img src=x onerror="window.__probe=1">'},'PATCH');
    await page.getByRole('button',{name:'Refresh tasks',exact:true}).click();
    await page.getByRole('button',{name:'List view',exact:true}).click();
    await page.locator('.notebook-task-list').getByText('<img src=x onerror="window.__probe=1">',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.__probe), undefined);
    assert.equal(await page.locator('.notebook-agenda img').count(),0);
  });
  await check('missing Home never creates a note', async () => {
    await api('/api/notes/Home',null,'DELETE');
    await page.getByRole('button',{name:'Refresh tasks',exact:true}).click();
    await page.getByText('Home does not exist yet.',{exact:false}).waitFor();
    assert.equal((await api('/api/notes/Home')).status,404);
    await api('/api/notes',{title:'Home',content:'# Home\n- [ ] 2026-01-03 — Earlier'},'POST');
  });
  await check('sidebar navigation immediately protects unsaved edits', async () => {
    await page.getByRole('link',{name:'Home note',exact:true}).click();
    await page.getByRole('button',{name:'Edit',exact:true}).click();
    const title = page.getByPlaceholder('Title',{exact:true});
    await title.fill('Unsaved synthetic title');
    page.once('dialog', dialog => dialog.dismiss());
    await guideLink.click();
    assert.ok(page.url().endsWith('/note/Home'));
    assert.equal(await title.inputValue(), 'Unsaved synthetic title');
    page.once('dialog', dialog => dialog.accept());
    await guideLink.click();
    await page.locator('.toast-viewer').getByText('Synthetic text',{exact:true}).waitFor();
  });
  await check('mobile navigation stays usable', async () => {
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.getByText('Contents menu',{exact:true}).isVisible());
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth + 2));
    await page.setViewportSize({width:1365,height:900});
  });
  await check('logout clears both draft stores and private menu', async () => {
    await page.evaluate(()=>{sessionStorage.setItem('synthetic-draft','PRIVATE_TEST');localStorage.setItem('synthetic-draft','PRIVATE_TEST');});
    await page.getByRole('button',{name:'Menu',exact:true}).click();
    await page.getByText('Log Out',{exact:true}).click();
    await page.getByPlaceholder('Username').waitFor();
    assert.equal(await page.getByRole('navigation',{name:'Notebook contents'}).count(),0);
    assert.deepEqual(await page.evaluate(()=>[sessionStorage.length,localStorage.getItem('synthetic-draft')]),[0,null]);
  });
  await check('expired/invalid token hides private navigation', async () => {
    await login();
    await page.evaluate(()=>sessionStorage.setItem('token','invalid.jwt.value'));
    await page.getByRole('button',{name:'Refresh contents',exact:true}).click();
    await page.getByPlaceholder('Username').waitFor();
    assert.equal(await page.getByRole('navigation',{name:'Notebook contents'}).count(),0);
  });
  await check('late mutation responses cannot revive a logged-out note', async () => {
    for (const method of ['PATCH', 'DELETE', 'POST']) {
      await login();
      await guideLink.click();
      await page.locator('.toast-viewer').getByText('Synthetic text',{exact:true}).waitFor();
      let release;
      let observed;
      const received = new Promise(resolve => { observed = resolve; });
      const delayed = new Promise(resolve => { release = resolve; });
      const pattern = method === 'POST' ? '**/api/notes' : '**/api/notes/Guide';
      const handler = async route => {
        if (route.request().method() !== method) return route.continue();
        observed();
        await delayed;
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({title:'Late synthetic response',content:'SYNTHETIC_LATE_PRIVATE',lastModified:1})});
      };
      await page.route(pattern,handler);
      if (method === 'POST') {
        await page.getByRole('link').filter({has:page.getByRole('button',{name:'New Note',exact:true})}).click();
        await page.getByPlaceholder('Title',{exact:true}).fill('New synthetic note');
        await page.getByRole('button',{name:'Save',exact:true}).click();
      } else if (method === 'PATCH') {
        await page.getByRole('button',{name:'Edit',exact:true}).click();
        await page.getByPlaceholder('Title',{exact:true}).fill('Updated synthetic note');
        await page.getByRole('button',{name:'Save',exact:true}).click();
      } else {
        await page.getByRole('button',{name:'Delete',exact:true}).click();
        await page.locator('div.fixed').getByRole('button',{name:'Delete',exact:true}).click();
      }
      await received;
      await page.getByRole('button',{name:'Menu',exact:true}).click();
      await page.getByText('Log Out',{exact:true}).click();
      await page.getByPlaceholder('Username').waitFor();
      const done = page.waitForResponse(r => r.request().method() === method && r.url().includes('/api/notes'));
      release();
      await done;
      await page.waitForTimeout(150);
      assert.ok(page.url().includes('/login'));
      assert.equal(await page.getByText('SYNTHETIC_LATE_PRIVATE',{exact:true}).count(),0);
      await page.unroute(pattern,handler);
    }
  });
  await check('an old-token 401 cannot invalidate a newer login', async () => {
    await login();
    let release;
    let observed;
    const received = new Promise(resolve => { observed = resolve; });
    const delayed = new Promise(resolve => { release = resolve; });
    const handler = async route => { observed(); await delayed; await route.fulfill({status:401,contentType:'application/json',body:'{"detail":"expired"}'}); };
    await page.route('**/api/notes/Contents',handler);
    await page.getByRole('button',{name:'Refresh contents',exact:true}).click();
    await received;
    const fresh = await api('/api/token',{username:'synthetic-user',password:process.env.TEST_PASSWORD},'POST');
    assert.equal(fresh.status,200);
    // Ensure a distinct test token without depending on JWT issuance clock ticks.
    const replacement = fresh.data.access_token + '-new-session-marker';
    await page.evaluate(token=>sessionStorage.setItem('token',token),replacement);
    const done = page.waitForResponse(r=>r.status()===401);
    release(); await done;
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('token')),replacement);
    assert.ok(!page.url().includes('/login'));
    await page.unroute('**/api/notes/Contents',handler);
    await page.evaluate(token=>sessionStorage.setItem('token',token),fresh.data.access_token);
  });
  await check('cookie-only session expiry clears transient drafts', async () => {
    await page.evaluate(()=>{sessionStorage.removeItem('token');sessionStorage.setItem('Guide','SYNTHETIC_COOKIE_DRAFT');});
    await context.clearCookies();
    await page.getByRole('button',{name:'Refresh contents',exact:true}).click();
    await page.getByPlaceholder('Username').waitFor();
    assert.equal(await page.evaluate(()=>sessionStorage.length),0);
    assert.equal(await page.getByRole('navigation',{name:'Notebook contents'}).count(),0);
  });
  assert.deepEqual(errors,[], 'No unhandled browser errors');
  assert.deepEqual(external,[], 'No external requests with the synthetic fixtures');
  console.log('PASS browser errors and external-request checks');
} finally {
  await browser.close();
}
