import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { buildFilm, repository } from './build.mjs';
import { prepareCardStudio } from './card-studio.mjs';
import { renderFilm } from './render.mjs';
import { serve } from './server.mjs';
import { browserLaunchOptions } from './browser.mjs';
import { parseCli } from './cli.mjs';

let browser, server, outputDirectory, selectionDirectory, activePage, evidenceDirectory;
const errors = [];
async function waitForWorkbench(page) {
  await page.waitForFunction(() => window.__cardStudio?.ready || document.querySelector('#save-status.error'), undefined, { timeout: 120000 });
  assert.equal(await page.evaluate(() => Boolean(window.__cardStudio?.ready)), true, await page.locator('#save-status').innerText());
}
try {
  const { values } = parseCli({ video: { type: 'boolean' } }, { maxPositionals: 0 });
  if (values.help) {
    console.log('用法：npm run test:smoke -- [--video]\n实际检查桌面与手机页面、样式预览/加入/保存，以及关键帧；--video 另导出完整 15 秒草稿。不改用户选择或正式示例。');
  } else {
    const stamp = Date.now().toString(36);
    const selectionFile = path.join(repository, `.local/smoke-${stamp}/selection.json`);
    const evidence = path.join(repository, 'renders/open-source-smoke');
    evidenceDirectory = evidence;
    const output = path.join(repository, `build/smoke-${stamp}`);
    outputDirectory = output; selectionDirectory = path.dirname(selectionFile);
    await mkdir(evidence, { recursive: true });
    for (const file of ['failure.json', 'failure.png', 'report.json']) await rm(path.join(evidence, file), { force: true });
    await mkdir(path.dirname(selectionFile), { recursive: true });
    await writeFile(selectionFile, '{broken');
    const starter = await buildFilm('starter', path.join(output, 'starter'));
    await prepareCardStudio({ selectionFile, output: path.join(output, 'cards') });
    server = await serve(repository, 0, { selectionFile });
    browser = await chromium.launch(browserLaunchOptions());
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    activePage = page;
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/api/studio-cases', route => route.fulfill({ json: [{
      templateId: 'card-carousel',
      name: '本机预览案例',
      video: 'examples/studio-demo/video.mp4?case=local',
      poster: 'examples/studio-demo/poster.jpg?case=local',
    }] }));
    await page.goto(server.url + 'web/?preview=1#atmospheres');
    const trigger = page.getByRole('button', { name: '查看卡片转盘详情' });
    await trigger.waitFor();
    assert.equal(await trigger.locator('img').getAttribute('src'), server.url + 'examples/studio-demo/poster.jpg?case=local');
    assert.deepEqual(await page.getByRole('navigation', { name: '主导航' }).getByRole('link').allTextContents(), ['模板']);
    assert.equal(await page.locator('#atmospheres').isVisible(), false);
    assert.equal(await page.locator('#preview-dialog').isVisible(), false);
    const caseSelector = page.getByRole('group', { name: '选择案例' });
    assert.equal(await caseSelector.isVisible(), false);
    await trigger.click();
    const caseChoice = caseSelector.getByRole('button', { name: '本机预览案例' });
    assert.equal(await caseChoice.getAttribute('aria-pressed'), 'true');
    const video = page.locator('#template-video');
    assert.equal(await video.getAttribute('src'), server.url + 'examples/studio-demo/video.mp4?case=local');
    const officialCase = caseSelector.getByRole('button', { name: 'Guanmo Studio · 卡片转盘' });
    await officialCase.click();
    assert.equal(await officialCase.getAttribute('aria-pressed'), 'true');
    assert.equal(await caseChoice.getAttribute('aria-pressed'), 'false');
    assert.equal(await video.getAttribute('src'), server.url + 'examples/studio-demo/video.mp4');
    await page.waitForFunction(() => {
      const video = document.querySelector('#template-video');
      return video.readyState >= 2 || video.error;
    }, undefined, { timeout: 15000 });
    const example = await video.evaluate(element => ({
      src: new URL(element.currentSrc).pathname,
      width: element.videoWidth, height: element.videoHeight, duration: element.duration,
      error: element.error?.message
    }));
    assert.equal(example.error, undefined);
    assert.equal(example.src, '/examples/studio-demo/video.mp4');
    assert.equal(example.width, 1920);
    assert.equal(example.height, 1080);
    assert.ok(Math.abs(example.duration - 15) < 0.05);
    await video.evaluate(async element => { element.muted = true; await element.play(); });
    await page.waitForFunction(() => document.querySelector('#template-video').currentTime > 0.25, undefined, { timeout: 10000 });
    await page.locator('#copy-template-prompt:enabled').waitFor();
    await page.locator('[data-close="template-dialog"]').click();
    assert.equal(await caseSelector.isVisible(), false);
    await page.screenshot({ path: path.join(evidence, 'showcase-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '首页手机布局溢出');
    await page.screenshot({ path: path.join(evidence, 'showcase-mobile.png') });
    await page.setViewportSize({ width: 1440, height: 1000 });
    // 为本轮创建独立预览目录，正式工作台正在使用的构建与选择保持原样。
    await page.route('**/build/card-style-preview/**', route => route.continue({ url: route.request().url().replace('/build/card-style-preview/', `/build/smoke-${stamp}/cards/`) }));
    await page.goto(server.url + 'web/card-studio/');
    await waitForWorkbench(page);
    console.log('工作台首次加载通过');
    assert.match(await page.locator('#save-status').innerText(), /原文件已保留/);
    assert.equal(await readFile(selectionFile, 'utf8'), '{broken');
    assert.equal(await page.locator('[data-palette]').count(), 30);
    assert.equal(await page.locator('#save').isDisabled(), true);
    await page.evaluate(() => localStorage.setItem('guanmo-card-studio-studio-demo-v1', JSON.stringify({ project:'studio-demo',palette:'porcelain',palettes:['porcelain','porcelain'],layout:'poster',back:'number',seed:'bad',time:2.75 })));
    await page.reload();
    await waitForWorkbench(page);
    console.log('工作台损坏缓存与重新加载检查通过');
    assert.equal(await page.locator('.selected-style-item').count(), 0, '损坏缓存应被忽略');

    const palettes = ['porcelain', 'look-graphite', 'look-copper', 'look-midnight'];
    for (let i = 0; i < palettes.length; i++) {
      await page.locator(`[data-palette="${palettes[i]}"]`).click();
      assert.equal(await page.locator('.selected-style-item').count(), i, '单独预览不应加入使用列表');
      await page.locator('#add-preview').click();
    }
    const counts = (await page.locator('.selected-style-item strong').allTextContents()).map(s => Number.parseInt(s));
    console.log('四种样式预览与加入检查通过');
    assert.deepEqual(counts.sort((a,b) => a-b), [5,5,5,6]);
    const before = await page.evaluate(() => window.__cardStudio.getSelection());
    await page.locator('[data-view="scene"]').click();
    await page.locator('[data-time="7.6"]').click();
    assert.equal((await page.evaluate(() => window.__cardStudio.getSelection())).seed, before.seed);
    await page.locator('#save').click();
    await page.getByText('已保存 · 制作时请使用下方命令', { exact: true }).waitFor();
    assert.deepEqual(JSON.parse(await readFile(selectionFile, 'utf8')).palettes, palettes);
    let releaseSave;
    const saveGate = new Promise(resolve => { releaseSave = resolve; });
    await page.route('**/api/card-style-selection', async route => {
      if (route.request().method() === 'POST') await saveGate;
      await route.continue();
    });
    await page.locator('#save').click();
    await page.locator('#clear-selection').click();
    assert.equal(await page.locator('#save').isDisabled(), true);
    releaseSave();
    await page.getByText('已保存先前方案 · 当前修改尚未保存', { exact: true }).waitFor();
    assert.equal(await page.locator('#save').isDisabled(), true);
    const savedBytes = await readFile(selectionFile);
    await page.locator('#restore-saved').click();
    assert.equal(await page.locator('.selected-style-item').count(), 4);
    assert.deepEqual(await readFile(selectionFile), savedBytes, '恢复方案不应写入文件');
    await page.locator('[data-view="scene"]').click();
    await page.locator('[data-time="7.6"]').click();

    assert.equal(await page.locator('#save-status').innerText(), '已保存 · 制作时请使用下方命令', '重复点击同一设置不应把已保存方案标记为修改');
    const contrast = await page.evaluate(() => {
      const luminance = color => {
        const rgb = color.match(/[\d.]+/g).slice(0,3).map(Number).map(v => { v /= 255; return v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4; });
        return rgb[0]*.2126 + rgb[1]*.7152 + rgb[2]*.0722;
      };
      const background = luminance(getComputedStyle(document.querySelector('.controls')).backgroundColor);
      return [...document.querySelectorAll('.control-note,#save-status')].map(el => {
        const foreground = luminance(getComputedStyle(el).color);
        return (Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05);
      });
    });
    assert.ok(contrast.every(ratio => ratio >= 4.5), '控制说明与保存状态对比度不足');
    await page.screenshot({ path: path.join(evidence, 'cards-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '样式工作台手机布局溢出');
    await page.screenshot({ path: path.join(evidence, 'cards-mobile.png') });
    assert.deepEqual(errors, [], '浏览器运行错误');
    await browser.close(); browser = null;
    await server.close(); server = null;
    await renderFilm(starter, { proofOnly: true, output: path.join(evidence, 'starter.mp4') });
    const brokenRoot = path.join(output, 'missing-player'); await mkdir(brokenRoot);
    await writeFile(path.join(brokenRoot, 'studio.json'), await readFile(path.join(starter, 'studio.json')));
    await writeFile(path.join(brokenRoot, 'index.html'), '<!doctype html><script src="missing-player.js"></script>');
    const failureStarted = performance.now();
    await assert.rejects(renderFilm(brokenRoot, { proofOnly: true, output: path.join(evidence, 'missing-player.mp4') }), /404/);
    assert.ok(performance.now() - failureStarted < 30000, '缺少播放器时不应等到120秒超时');

    if (values.video) {
      const draft = path.join(evidence, 'starter.draft.mp4');
      await renderFilm(starter, { draft: true, output: draft });
      const draftReport = path.join(evidence, 'starter.draft-checks/report.json');
      const draftProbe = path.join(evidence, 'starter.draft-checks/ffprobe.json');
      const [beforeReport, beforeProbe] = await Promise.all([readFile(draftReport), readFile(draftProbe)]);
      await renderFilm(starter, { draft: true, frame: 7.6, output: draft });
      assert.deepEqual(await readFile(draftReport), beforeReport);
      assert.deepEqual(await readFile(draftProbe), beforeProbe);
      assert.equal(JSON.parse(await readFile(path.join(evidence, 'starter.draft.proof-checks/report.json'), 'utf8')).mode, 'proof-only');
      const fakeEncoder = path.join(output, 'failing-encoder.mjs');
      await writeFile(fakeEncoder, `import { writeFileSync } from 'node:fs';\nif (process.argv.includes('-version')) process.exit(0);\nwriteFileSync(process.argv.at(-1), 'partial video'); process.exit(1);\n`);
      const preserved = path.join(evidence, 'preserved.mp4'), preservedChecks = path.join(evidence, 'preserved-checks');
      await mkdir(preservedChecks, { recursive: true });
      await writeFile(path.join(preservedChecks, 'report.json'), 'previous report');
      await writeFile(path.join(preservedChecks, 'frame-0.00.png'), 'previous frame');
      await writeFile(preserved, 'previous output');
      const assertPreserved = async () => {
        assert.equal(await readFile(preserved, 'utf8'), 'previous output');
        assert.equal(await readFile(path.join(preservedChecks, 'report.json'), 'utf8'), 'previous report');
        assert.equal(await readFile(path.join(preservedChecks, 'frame-0.00.png'), 'utf8'), 'previous frame');
        assert.ok(!(await readdir(evidence)).some(file => file.startsWith('studio-render-')));
      };
      try {
        await assert.rejects(renderFilm(starter, { draft: true, output: preserved, encoderCommand: { file: process.execPath, args: [fakeEncoder] } }));
        await assertPreserved();
        const waitingEncoder = path.join(output, 'waiting-encoder.mjs'), marker = path.join(output, 'encoder-pid.json');
        await writeFile(waitingEncoder, `import { writeFileSync } from 'node:fs';\nif (process.argv.includes('-version')) process.exit(0);\nwriteFileSync(${JSON.stringify(marker)}, JSON.stringify({pid:process.pid}));\nsetInterval(()=>{},1000);\n`);
        const controller = new AbortController();
        const rendering = renderFilm(starter, { draft: true, output: preserved, signal: controller.signal, encoderCommand: { file: process.execPath, args: [waitingEncoder] } });
        const completion = rendering.then(() => ({unexpectedSuccess:true}), error => ({error}));
        const began = Date.now(); let encoderPid;
        try {
          while (!encoderPid) {
            try { encoderPid = JSON.parse(await readFile(marker, 'utf8')).pid; }
            catch (error) { if (error.code !== 'ENOENT') throw error; }
            if (Date.now() - began > 30000) throw new Error('取消测试未启动编码器');
            if (!encoderPid) await new Promise(resolve => setTimeout(resolve,30));
          }
          controller.abort(new Error('smoke cancellation'));
          const result = await completion; assert.equal(result.error?.message, 'smoke cancellation');
          await assertPreserved();
          assert.throws(() => process.kill(encoderPid, 0), { code: 'ESRCH' });
        } finally {
          controller.abort(new Error('smoke cleanup')); await completion;
          if (encoderPid) { try { process.kill(encoderPid,'SIGKILL'); } catch {} }
        }
        if (process.platform !== 'win32') {
          await rm(marker, { force: true });
          const posixEncoder = path.join(output, 'posix-encoder.mjs');
          await writeFile(posixEncoder, `#!${process.execPath}\n` + await readFile(waitingEncoder,'utf8'), { mode: 0o700 });
          const child = spawn(process.execPath, [path.join(repository, 'scripts/render.mjs'), starter, '--draft', '--out', preserved], { env: { ...process.env, FFMPEG: posixEncoder }, stdio: ['ignore','pipe','pipe'], windowsHide:true });
          let childLog='',pid; child.stdout.on('data',d=>{childLog=(childLog+d).slice(-2000);}); child.stderr.on('data',d=>{childLog=(childLog+d).slice(-2000);});
          const exited=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code));});
          try {
            const started=Date.now();
            while(!pid){try{pid=JSON.parse(await readFile(marker,'utf8')).pid;}catch(e){if(e.code!=='ENOENT')throw e;}if(child.exitCode!==null||Date.now()-started>30000)throw new Error('SIGINT测试未启动：'+childLog);if(!pid)await new Promise(r=>setTimeout(r,30));}
            child.kill('SIGINT'); let timer;
            const code=await Promise.race([exited,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('SIGINT测试未结束')),10000);})]).finally(()=>clearTimeout(timer));
            assert.equal(code,130,childLog); await assertPreserved();assert.throws(()=>process.kill(pid,0),{code:'ESRCH'});
          }finally{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGTERM');if(pid){try{process.kill(pid,'SIGKILL');}catch{}}}
        }
      } finally {
        await rm(preserved,{force:true});await rm(preservedChecks,{recursive:true,force:true});
      }
    }
    await writeFile(path.join(evidence, 'report.json'), JSON.stringify({ at: new Date().toISOString(), node: process.version, platform: process.platform, arch: process.arch, skipped: values.video && process.platform === 'win32' ? ['POSIX SIGINT signal test; Windows native console Ctrl+C requires manual verification'] : [], checks: ['showcase-desktop', 'showcase-mobile', 'case-selection', 'bundled-demo-playback', '30-palettes', 'preview-before-add', 'corrupt-storage-recovery', 'corrupt-saved-file-recovery', 'control-text-contrast', 'balanced-mix', 'isolated-save', 'save-edit-race', 'restore-saved-without-write', 'cards-mobile', 'starter-proof', 'missing-player-fails-fast', ...(values.video ? ['silent-15s-draft', 'proof-preserves-video-evidence', 'failed-encoder-keeps-previous', 'failed-render-keeps-evidence', 'abort-keeps-all-outputs', ...(process.platform === 'win32' ? [] : ['sigint-keeps-all-outputs'])] : [])], errors }, null, 2) + '\n');
    console.log(`浏览器与渲染冒烟检查通过：${evidence}`);
  }
} catch (error) {
  console.error(error.stack);
  if (evidenceDirectory) {
    await writeFile(path.join(evidenceDirectory, 'failure.json'), JSON.stringify({ at: new Date().toISOString(), platform: process.platform, arch: process.arch, error: error.stack, browserErrors: errors }, null, 2) + '\n').catch(() => {});
    if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: path.join(evidenceDirectory, 'failure.png'), timeout: 10000 }).catch(() => {});
  }
  process.exitCode = 1;
}
finally {
  await browser?.close(); await server?.close();
  if (outputDirectory) await rm(outputDirectory, { recursive: true, force: true });
  if (selectionDirectory) await rm(selectionDirectory, { recursive: true, force: true });
}
