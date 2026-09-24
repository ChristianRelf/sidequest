import { chromium,expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile,mkdir,writeFile } from 'node:fs/promises';
async function main(){
  await mkdir('artifacts/motion',{recursive:true});const credentials=JSON.parse(await readFile('.local/demo-credentials.json','utf8'));
  const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:'artifacts/motion',size:{width:1280,height:900}}});
  const headers={origin:'http://localhost:3000','x-sidequest-csrf':'1'};const login=await context.request.post('http://localhost:3000/api/auth/login',{headers,data:credentials});if(!login.ok())throw new Error('QA login failed');
  const original=await context.request.get('http://localhost:3000/api/state').then(r=>r.json());const page=await context.newPage();await page.addInitScript('globalThis.__name = (target, value) => target;');const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const results:unknown[]=[];
  for(const theme of ['light','dark']){
    await context.request.patch('http://localhost:3000/api/settings',{headers,data:{preferences:{theme,companions:true,reducedMotion:false}}});
    for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]){
      await page.setViewportSize(viewport);
      for(const view of ['today','week']){
        await page.goto('http://localhost:3000/'+view);await page.locator('h1').waitFor();await page.waitForLoadState('networkidle');await page.evaluate(()=>document.fonts.ready);
        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();results.push({theme,viewport:viewport.name,view,overflow,violations:axe.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});
        await page.screenshot({path:`artifacts/${view}-${viewport.name}-${theme}.png`,fullPage:viewport.name==='desktop'});
        if(viewport.name==='mobile')await page.screenshot({path:`artifacts/${view}-mobile-${theme}-full.png`,fullPage:true});
      }
    }
  }
  await context.request.patch('http://localhost:3000/api/settings',{headers,data:{preferences:{theme:'light'}}});await page.setViewportSize({width:1440,height:1000});
  for(const view of ['habits','tasks','progress','settings','gallery','onboarding']){await page.goto('http://localhost:3000/'+view);await page.locator('h1').waitFor();await page.waitForLoadState('networkidle');await page.screenshot({path:`artifacts/${view}-desktop.png`,fullPage:true});const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();results.push({theme:'light',viewport:'desktop',view,violations:axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});}
  await page.goto('http://localhost:3000/gallery');await page.getByRole('button',{name:'hop',exact:true}).waitFor();await page.locator('.character-card .character').first().waitFor();
  const motionSamples:unknown[]=[];
  for(const state of ['travel','hop','celebrate','recover']){
    await page.getByRole('button',{name:state,exact:true}).click();await page.waitForTimeout(100);
    for(const time of [130,420,780]){
      const sample=await page.evaluate((time)=>{const card=document.querySelector('.character-card')!;const animations=document.getAnimations().filter(a=>a.effect instanceof KeyframeEffect&&card.contains(a.effect.target));for(const a of animations){a.pause();a.currentTime=time;}return {count:animations.length,transforms:[...card.querySelectorAll('[data-joint]')].map(el=>({joint:el.getAttribute('data-joint'),transform:getComputedStyle(el).transform})).filter(x=>x.transform!=='none')};},time);await page.locator('.character-card').first().screenshot({path:`artifacts/motion/pip-${state}-${time}.png`});motionSamples.push({state,time,...sample});
    }
  }
  await writeFile('artifacts/visual-audit.json',JSON.stringify(results,null,2));
  // Interruption: a recovery cue replaces an unfinished hop, with no leftover root transform.
  await page.getByRole('button',{name:'hop',exact:true}).click();await page.getByRole('button',{name:'recover',exact:true}).click();await page.waitForTimeout(2200);const interruptedRoot=await page.locator('.character-card [data-joint=root]').first().evaluate(el=>getComputedStyle(el).transform);expect(interruptedRoot).toBe('none');
  await page.getByLabel('Reduced motion',{exact:true}).check();await page.getByRole('button',{name:'celebrate',exact:true}).click();await page.waitForTimeout(250);const reducedMotion=await page.locator('.character-card [data-joint=root]').first().evaluate(el=>getComputedStyle(el).transform);expect(reducedMotion).toBe('none');await page.screenshot({path:'artifacts/gallery-reduced-motion.png'});await page.getByLabel('Reduced motion',{exact:true}).uncheck();
  await page.getByRole('button',{name:'hop',exact:true}).click();await page.getByRole('button',{name:'Pause',exact:true}).click();const paused=await page.evaluate(()=>document.getAnimations().filter(a=>(a.effect as KeyframeEffect)?.target?.closest('.character-card')).every(a=>a.playState==='paused'));expect(paused).toBe(true);await page.getByRole('button',{name:'Resume',exact:true}).click();
  await page.getByRole('button',{name:'idle',exact:true}).click();
  const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  const performanceSample=await page.evaluate(async()=>{const intervals:number[]=[];const longTasks:number[]=[];const observer=new PerformanceObserver(list=>{for(const e of list.getEntries())longTasks.push(e.duration);});observer.observe({type:'longtask',buffered:false});let last=performance.now();await new Promise<void>(resolve=>{const frame=(now:number)=>{intervals.push(now-last);last=now;if(intervals.length<120)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});observer.disconnect();intervals.sort((a,b)=>a-b);return {cpuThrottle:4,frames:intervals.length,medianMs:intervals[60],p95Ms:intervals[114],maxMs:intervals.at(-1),longTasks};});await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
  await page.setViewportSize({width:390,height:844});await page.goto('http://localhost:3000/today');await page.locator('.hero-world .character').waitFor();await page.waitForTimeout(300);await page.screenshot({path:'artifacts/motion/today-mobile-enter.png'});
  // Web Animations failure: semantic content and ordinary controls must remain usable.
  const fallback=await browser.newContext({viewport:{width:390,height:844}});await fallback.addInitScript(()=>{Object.defineProperty(Element.prototype,'animate',{value:undefined,configurable:true});});await fallback.request.post('http://localhost:3000/api/auth/login',{headers,data:credentials});const fallbackPage=await fallback.newPage();await fallbackPage.goto('http://localhost:3000/today');await expect(fallbackPage.getByRole('button',{name:'Complete session',exact:true})).toBeVisible();await fallbackPage.getByRole('button',{name:'Quick add'}).click();await expect(fallbackPage.getByLabel('Task name')).toBeVisible();await fallbackPage.getByRole('button',{name:'Close dialog'}).click();await fallbackPage.screenshot({path:'artifacts/animation-fallback-mobile.png'});await fallback.close();
  await context.request.patch('http://localhost:3000/api/settings',{headers,data:{preferences:original.user.preferences}});
  await writeFile('artifacts/visual-qa.json',JSON.stringify({results,motionSamples,interruptedRoot,reducedMotion,paused,performanceSample,errors},null,2));const video=page.video();await page.close();await context.close();if(video)await video.saveAs('artifacts/motion/sidequest-review.webm');await browser.close();console.log(JSON.stringify({auditCount:results.length,violations:results.flatMap((r:any)=>r.violations).length,performanceSample,errors}));
}
main().catch(e=>{console.error(e);process.exit(1);});
