import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { parseContents } from '../client/extensions/notebook/parse.js';

const base = process.env.TEST_BASE_URL;
if (!base || !/^http:\/\/127\.0\.0\.1:\d+\/notebook$/.test(base)) throw new Error('Disposable loopback fixture required');
const browser = await chromium.launch({headless:true, ...(process.env.TEST_BROWSER ? {executablePath:process.env.TEST_BROWSER} : {})});
const context = await browser.newContext({viewport:{width:1365,height:900}});
const page = await context.newPage();
const nav = page.getByRole('navigation',{name:'Notebook contents'});
const errors = [], external = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (!request.url().startsWith(new URL(base).origin)) external.push(request.url()); });
async function check(name, fn) { await fn(); console.log('PASS', name); }
async function login() {
  await page.goto(base+'/');
  await page.getByPlaceholder('Username').fill('synthetic-user');
  await page.getByPlaceholder('Password',{exact:true}).fill(process.env.TEST_PASSWORD);
  await page.getByRole('button',{name:'Log In',exact:true}).click();
  await nav.getByRole('button',{name:'Add category',exact:true}).waitFor();
  await page.waitForFunction(() => !document.querySelector('.notebook-create-actions button')?.disabled);
}
async function api(path, data, method='GET') {
  return page.evaluate(async ({base,path,data,method}) => {
    const response = await fetch(base+path,{method,headers:{Authorization:'Bearer '+sessionStorage.getItem('token'),'Content-Type':'application/json'},
      ...(data ? {body:JSON.stringify(data)} : {})});
    return {status:response.status,data:await response.json()};
  },{base,path,data,method});
}
async function refresh() {
  await nav.getByRole('button',{name:'Refresh contents',exact:true}).click();
  await page.waitForFunction(() => !document.querySelector('.notebook-create-actions button')?.disabled);
}
async function category(name, parent) {
  if (parent) await expandCategory(parent);
  await nav.getByRole('button',{name:parent ? `Add subcategory to ${parent}` : 'Add category',exact:true}).click();
  await page.getByLabel('Category name',{exact:true}).fill(name);
  await page.getByRole('button',{name:'Create category',exact:true}).click();
  await nav.getByText(name,{exact:true}).waitFor();
  await page.waitForFunction(() => !document.querySelector('.notebook-create-actions button')?.disabled);
}
async function noteForm(title, mode='create', parent='Projects') {
  if (parent) await expandCategory(parent);
  await nav.getByRole('button',{name:parent ? `Add note to ${parent}` : 'Add note',exact:true}).click();
  await page.getByLabel('Note action',{exact:true}).selectOption(mode);
  await page.getByLabel('Note title',{exact:true}).fill(title);
}
async function expandCategory(name) {
  const label = nav.getByText(name,{exact:true});
  if (!await label.evaluate(el => el.closest('details').open)) await label.click();
}
async function logout() {
  await page.getByRole('button',{name:'Menu',exact:true}).click();
  await page.getByText('Log Out',{exact:true}).click();
  await page.getByPlaceholder('Username').waitFor();
}
const original = '# Contents\nA preserved introduction.\n## Projects\n- [[Guide]]\n### Reference\n- [[Überblick & 10%]]\n';
try {
  await login();
  await mkdir('.qa/screenshots',{recursive:true});
  await check('empty sidebar has direct actions; cancel does not create Contents', async () => {
    await api('/api/notes/Contents',null,'DELETE');
    await refresh();
    await page.getByText('Your notes, organised',{exact:true}).waitFor();
    await page.screenshot({path:'.qa/screenshots/sidebar-empty.jpg'});
    await nav.getByRole('button',{name:'Add category',exact:true}).click();
    await page.getByLabel('Category name',{exact:true}).fill('Cancelled');
    await page.screenshot({path:'.qa/screenshots/sidebar-add-category.jpg'});
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    assert.equal((await api('/api/notes/Contents')).status,404);
    await category('Projects');
    const result = await api('/api/notes/Contents');
    assert.equal(result.status,200);
    assert.equal(parseContents(result.data.content).nodes[0].label,'Projects');
  });
  await check('nested category buttons choose the parent and preserve source', async () => {
    await api('/api/notes/Contents',{newContent:original},'PATCH');
    await refresh();
    await category('Ideas','Projects');
    const source = (await api('/api/notes/Contents')).data.content;
    assert.ok(source.startsWith(original));
    assert.equal(parseContents(source).nodes[0].children[2].label,'Ideas');
    await category('Reading');
  });
  await check('create note adds correct parent link and immediately opens editor', async () => {
    await noteForm('New page');
    await page.getByRole('button',{name:'Create note',exact:true}).click();
    await page.getByPlaceholder('Title',{exact:true}).waitFor({state:'visible'});
    assert.equal(await page.getByPlaceholder('Title',{exact:true}).inputValue(),'New page');
    const nodes = parseContents((await api('/api/notes/Contents')).data.content).nodes;
    assert.equal(nodes[0].children[1].label,'New page');
    assert.equal((await api('/api/notes/New%20page')).data.content,'');
    await page.getByRole('button',{name:'Edit',exact:true}).click();
  });
  await check('existing note creation never overwrites; explicit link preserves body', async () => {
    const guide = (await api('/api/notes/Guide')).data.content;
    await noteForm('Guide','create','Reading');
    await page.getByRole('button',{name:'Create note',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'already exists'}).waitFor();
    assert.equal((await api('/api/notes/Guide')).data.content,guide);
    await page.getByLabel('Note action',{exact:true}).selectOption('link');
    await page.getByRole('button',{name:'Add link',exact:true}).click();
    await page.locator('.toast-viewer').getByText('Synthetic text',{exact:true}).waitFor();
    assert.equal((await api('/api/notes/Guide')).data.content,guide);
    assert.equal(parseContents((await api('/api/notes/Contents')).data.content).nodes[1].children[0].label,'Guide');
  });
  await check('invalid paths and stale category selection cause no writes', async () => {
    const before = (await api('/api/notes/Contents')).data.content;
    await noteForm('../outside');
    await page.getByRole('button',{name:'Create note',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'valid note title'}).waitFor();
    assert.equal((await api('/api/notes/Contents')).data.content,before);
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await nav.getByRole('button',{name:'Add category',exact:true}).click();
    await page.getByLabel('Category name',{exact:true}).fill('Stale selection');
    await api('/api/notes/Contents',{newContent:before+'\nA change from another editor.\n'},'PATCH');
    await page.getByRole('button',{name:'Create category',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'Contents changed'}).waitFor();
    assert.ok(!(await api('/api/notes/Contents')).data.content.includes('Stale selection'));
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await refresh();
  });
  await check('Contents editor blocks sidebar writes and clean view refreshes after save', async () => {
    await nav.getByRole('link',{name:'Open / edit contents',exact:true}).click();
    await page.getByRole('button',{name:'Edit',exact:true}).click();
    assert.equal(await nav.getByRole('button',{name:'Add category',exact:true}).isDisabled(),true);
    await page.getByText('Finish editing Contents before changing the menu here.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Edit',exact:true}).click();
    await category('Added in clean view');
    await page.locator('.toast-viewer').getByText('Added in clean view',{exact:true}).waitFor();
    await nav.getByRole('link',{name:'todo',exact:true}).click();
  });
  await check('in-flight sidebar write blocks Contents editing and refreshes before next edit', async () => {
    await nav.getByRole('link',{name:'Open / edit contents',exact:true}).click();
    await page.locator('.toast-viewer').getByText('Added in clean view',{exact:true}).waitFor();
    await nav.getByRole('button',{name:'Add category',exact:true}).click();
    await page.getByLabel('Category name',{exact:true}).fill('Locked insertion');
    let observed, release;
    const received=new Promise(resolve=>{observed=resolve;});
    const delayed=new Promise(resolve=>{release=resolve;});
    const handler=async route=>{
      if (route.request().method()!=='PATCH') return route.continue();
      const response=await route.fetch();
      observed(); await delayed; await route.fulfill({response});
    };
    await page.route('**/api/notes/Contents',handler);
    await page.getByRole('button',{name:'Create category',exact:true}).click();
    await received;
    assert.equal(await page.getByRole('button',{name:'Edit',exact:true}).isDisabled(),true);
    assert.equal(await page.getByRole('button',{name:'Delete',exact:true}).isDisabled(),true);
    await page.locator('.notebook-menu').focus();
    await page.keyboard.press('e');
    assert.equal(await page.getByPlaceholder('Title',{exact:true}).isVisible(),false);
    const done=page.waitForResponse(r=>r.request().method()==='PATCH'&&r.url().endsWith('/api/notes/Contents'));
    release(); await done;
    await page.locator('.toast-viewer').getByText('Locked insertion',{exact:true}).waitFor();
    await page.waitForFunction(()=>!document.querySelector('.notebook-create-actions button')?.disabled);
    assert.equal(await page.getByRole('button',{name:'Edit',exact:true}).isDisabled(),false);
    await page.unroute('**/api/notes/Contents',handler);
    await nav.getByRole('link',{name:'todo',exact:true}).click();
  });
  await check('partial save failure keeps the new note and permits linking it later', async () => {
    await noteForm('Recoverable page');
    const handler = route => route.request().method()==='PATCH' ? route.fulfill({status:503,contentType:'application/json',body:'{}'}) : route.continue();
    await page.route('**/api/notes/Contents',handler);
    await page.getByRole('button',{name:'Create note',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'The note was created'}).waitFor();
    assert.equal((await api('/api/notes/Recoverable%20page')).status,200);
    assert.equal(await page.getByLabel('Note action',{exact:true}).inputValue(),'link');
    await page.unroute('**/api/notes/Contents',handler);
    await page.getByRole('button',{name:'Add link',exact:true}).click();
    await nav.getByRole('link',{name:'Recoverable page',exact:true,includeHidden:true}).waitFor({state:'attached'});
  });
  await check('sidebar is usable on mobile, keyboard, and in dark mode', async () => {
    await api('/api/notes/Contents',{newContent:'# Contents\n## Projects\n- [[Overview]]\n### Reference\n- [[Guide]]\n## Reading\n- [[Reading list]]\n## Ideas\n'},'PATCH');
    await api('/api/notes',{title:'Overview',content:'# Overview\nA place for project notes and useful references.\n\n## Next steps\n- Collect ideas\n- Add a note to a category\n'},'POST');
    await refresh();
    await expandCategory('Projects');
    await nav.getByRole('link',{name:'Overview',exact:true}).click();
    await page.locator('.toast-viewer').getByText('A place for project notes and useful references.',{exact:true}).waitFor();
    await page.setViewportSize({width:390,height:844});
    await nav.getByRole('button',{name:'Add category',exact:true}).click();
    assert.equal(await page.getByLabel('Category name',{exact:true}).evaluate(el => el===document.activeElement),true);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await page.screenshot({path:'.qa/screenshots/sidebar-mobile.jpg'});
    await page.setViewportSize({width:1365,height:900});
    await page.screenshot({path:'.qa/screenshots/sidebar-populated.jpg'});
    await page.evaluate(()=>document.body.classList.add('dark'));
    await page.screenshot({path:'.qa/screenshots/sidebar-dark.jpg'});
    await page.evaluate(()=>document.body.classList.remove('dark'));
  });
  await check('logout after create request stops the following menu write and navigation', async () => {
    await noteForm('Late page');
    const before = (await api('/api/notes/Contents')).data.content;
    let observed, release;
    const received = new Promise(resolve=>{observed=resolve;});
    const delayed = new Promise(resolve=>{release=resolve;});
    const handler = async route => {
      if (route.request().method()!=='POST') return route.continue();
      observed(); await delayed;
      await route.fulfill({status:200,contentType:'application/json',body:'{"title":"Late page","content":"","lastModified":1}'});
    };
    await page.route('**/api/notes',handler);
    await page.getByRole('button',{name:'Create note',exact:true}).click();
    await received;
    assert.equal(await page.getByRole('button',{name:'Saving…',exact:true}).isDisabled(),true);
    await logout();
    const done=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/api/notes'));
    release(); await done;
    await page.waitForTimeout(100);
    assert.equal(await nav.count(),0);
    await page.unroute('**/api/notes',handler);
    await login();
    assert.equal((await api('/api/notes/Contents')).data.content,before);
  });
  assert.deepEqual(errors,[]);
  assert.deepEqual(external,[]);
  console.log('PASS sidebar browser errors and external-request checks');
} finally { await browser.close(); }
