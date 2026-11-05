const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
(async () => {
 const browser = await chromium.launch();
 const results=[];
 for (const viewport of [{width:1366,height:768},{width:1920,height:1080},{width:900,height:500}]) {
  const page=await browser.newPage({viewport}); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(!['localhost','127.0.0.1'].includes(url.hostname))return route.abort();
   if(url.pathname.endsWith('/operations/settings/preferences'))return route.fulfill({json:{dockingEnabled:true,toolsVisible:true,toolsDocked:true,toolsCompact:false,attendanceCustomizationVersion:3}});
   if(route.request().method()!=='GET')return route.fulfill({json:{saved:true}});
   return route.continue();
  });
  await page.goto('http://127.0.0.1:5180/atendimento');
  const tools=page.locator('.resource-workbench:visible');
  await page.locator('.app-shell').waitFor();
  if(viewport.width < 1000) await page.getByRole('button',{name:'Mostrar biblioteca lateral',exact:true}).click();
  await expect(tools.locator('.workbench-resource-card').first()).toBeVisible({timeout:20000});
  const options=tools.getByRole('button',{name:/Opções/});
  await expect(options).toHaveAttribute('aria-expanded','false');
  await expect(tools.getByRole('button',{name:'Favoritos',exact:true})).toHaveCount(0);
  const card=tools.locator('.workbench-resource-card').first();
  await expect(card.locator('button')).toHaveCount(2);
  await card.getByRole('button',{name:/Expandir detalhes/}).click();
  await expect(card.locator('.resource-card-details')).toBeVisible();
  await card.getByRole('button',{name:/Recolher detalhes/}).click();
  await expect(card.locator('.resource-card-details')).toHaveCount(0);
  await options.click();
  await expect(tools.getByRole('button',{name:'Favoritos',exact:true})).toBeVisible();
  await expect(tools.getByLabel('Filtrar por categoria')).toBeAttached();
  await tools.getByRole('button',{name:'Favoritos',exact:true}).click();
  await expect(options.getByLabel('Filtros ativos')).toBeVisible();
  await tools.getByRole('button',{name:'Todos',exact:true}).click();
  await options.click();
  const scroll=await tools.locator('.resource-results').evaluate(el=>{el.scrollTop=el.scrollHeight;return {height:el.clientHeight,scrollHeight:el.scrollHeight,lastVisible:el.lastElementChild.getBoundingClientRect().bottom<=el.getBoundingClientRect().bottom+1}});
  expect(scroll.height).toBeGreaterThan(0);expect(scroll.lastVisible).toBe(true);expect(errors).toEqual([]);
  await page.screenshot({path:'.audit/library-'+viewport.width+'.png'});
  results.push({viewport,scroll,errors});await page.close();
 }
 fs.writeFileSync('.audit/library-workbench-validation.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

