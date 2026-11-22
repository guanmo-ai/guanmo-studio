import { activeThemes, filterThemes, initialThemeId } from './catalog.js';

const root = new URL('../', import.meta.url);
const asset = path => new URL(path, root).href;
const $ = selector => document.querySelector(selector);
const backgroundGallery = $('#atmospheres');
const status = $('#status');
const backgroundFilters = $('#background-filters');
const dialogs = [...document.querySelectorAll('dialog')];
const templateDialog = $('#template-dialog');
const templateVideo = $('#template-video');
const templateExamples = $('#template-examples');
const templatePrompt = $('#template-prompt');
const templateCopy = $('#copy-template-prompt');
const templatePromptStatus = $('#template-prompt-status');
const templateConfig = $('#download-template-config');
const carousel = $('#background-carousel');
const track = $('#background-grid');
const previousSlide = $('#carousel-previous');
const nextSlide = $('#carousel-next');
const slidePosition = $('#carousel-position');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let visibleSlides = [], activeSlide, mouseDrag, scrollFrame;
let templatePromptRequest;
let themes = [], current = 0, requestVersion = 0, activeFilter = 'all';
const thumbnail = theme => asset(`assets/backgrounds/previews/${theme.id}.webp`);

async function readCatalog(path, label) {
  const response = await fetch(asset(path));
  if (!response.ok) throw new Error(`${label}加载失败（${response.status}）`);
  return response.json();
}

async function readLocalCases() {
  if (!['127.0.0.1', 'localhost'].includes(location.hostname)) return [];
  try {
    const response = await fetch('/api/studio-cases');
    if (!response.ok) return [];
    const cases = await response.json();
    return Array.isArray(cases) ? cases.filter(example =>
      typeof example?.templateId === 'string' && typeof example.name === 'string' &&
      typeof example.video === 'string' && typeof example.poster === 'string'
    ) : [];
  } catch {
    return [];
  }
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function announce(text) { status.textContent = text; }

function distanceFromCenter(slide, center) {
  const { left, width } = slide.getBoundingClientRect();
  return left + width / 2 - center;
}

function trackCenter() {
  return track.getBoundingClientRect().left + track.clientWidth / 2;
}

function nearestSlide() {
  const center = trackCenter();
  return visibleSlides.reduce((nearest, slide) => {
    if (!nearest || Math.abs(distanceFromCenter(slide, center)) < Math.abs(distanceFromCenter(nearest, center))) return slide;
    return nearest;
  }, null);
}

function setActiveSlide(slide) {
  if (activeSlide !== slide) {
    activeSlide?.removeAttribute('aria-current');
    activeSlide = slide;
    activeSlide?.setAttribute('aria-current', 'true');
  }
  const index = visibleSlides.indexOf(slide);
  previousSlide.disabled = index <= 0;
  nextSlide.disabled = index < 0 || index >= visibleSlides.length - 1;
  const position = index < 0 ? '' : `${index + 1} / ${visibleSlides.length}`;
  if (slidePosition.textContent !== position) slidePosition.textContent = position;
}

function centerSlide(slide, smooth = true) {
  if (!slide) return;
  const animate = smooth && !reducedMotion.matches;
  if (!animate) setActiveSlide(slide);
  track.scrollTo({ left: track.scrollLeft + distanceFromCenter(slide, trackCenter()), behavior: animate ? 'smooth' : 'instant' });
}

function stepSlide(direction) {
  centerSlide(visibleSlides[visibleSlides.indexOf(activeSlide) + direction]);
}

track.addEventListener('scroll', () => {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = null;
    setActiveSlide(nearestSlide());
  });
}, { passive: true });
previousSlide.addEventListener('click', () => stepSlide(-1));
nextSlide.addEventListener('click', () => stepSlide(1));
carousel.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  stepSlide(event.key === 'ArrowLeft' ? -1 : 1);
});

track.addEventListener('pointerdown', event => {
  if (event.pointerType !== 'mouse' || event.button !== 0 || visibleSlides.length < 2) return;
  mouseDrag = { pointer: event.pointerId, x: event.clientX, left: track.scrollLeft, started: false };
});
track.addEventListener('pointermove', event => {
  if (mouseDrag?.pointer !== event.pointerId) return;
  const distance = event.clientX - mouseDrag.x;
  if (!mouseDrag.started) {
    if (Math.abs(distance) < 7) return;
    mouseDrag.started = true;
    track.setPointerCapture(event.pointerId);
    track.classList.add('is-dragging');
  }
  track.scrollLeft = mouseDrag.left - distance;
});
function finishDrag(event) {
  if (mouseDrag?.pointer !== event.pointerId) return;
  const started = mouseDrag.started;
  mouseDrag = null;
  if (started) {
    const nearest = nearestSlide();
    track.classList.remove('is-dragging');
    centerSlide(nearest);
  }
}
track.addEventListener('pointerup', finishDrag);
track.addEventListener('pointercancel', finishDrag);
track.addEventListener('lostpointercapture', finishDrag);
track.addEventListener('pointerleave', event => { if (mouseDrag && !mouseDrag.started) finishDrag(event); });

async function selectTheme(index, open = false) {
  if (!themes.length) return;
  const version = ++requestVersion;
  const next = ((index % themes.length) + themes.length) % themes.length;
  const theme = themes[next];
  $('#preview-error').hidden = true;
  $('#screen').setAttribute('aria-busy', 'true');
  if (open && !$('#preview-dialog').open) $('#preview-dialog').showModal();
  const image = new Image();
  image.src = asset(theme.image);
  try { await image.decode(); }
  catch {
    if (version === requestVersion) {
      $('#screen').setAttribute('aria-busy', 'false');
      $('#preview-error').textContent = '背景图片加载失败，请重试，或切换其他背景。';
      $('#preview-error').hidden = false;
    }
    return;
  }
  if (version !== requestVersion) return;
  current = next;
  $('#screen').setAttribute('aria-busy', 'false');
  $('#preview-title').textContent = theme.name;
  document.documentElement.style.setProperty('--accent', theme.accent);
  $('#screen-image').src = image.src;
  $('#screen-image').alt = `${theme.name}：${theme.description}`;
  $('#screen-image').style.objectPosition = theme.position || '50% 50%';
  $('#screen').classList.toggle('copy-left', theme.copyAlign === 'left');
  const number = String(next + 1).padStart(2, '0');
  $('#theme-en').textContent = `${number} / ${theme.en}`;
  $('#theme-name').textContent = theme.name;
  $('#theme-description').textContent = theme.description;
  $('#screen-study').textContent = `LIGHT STUDY — ${number}`;
  $('#screen-count').textContent = `${number} / ${String(themes.length).padStart(2, '0')}`;
  $('#download-image').href = image.src;
  $('#download-image').download = `${theme.id}.png`;
  $('#theme-rail').querySelectorAll('[data-theme]').forEach(element => {
    element.setAttribute('aria-pressed', String(element.dataset.theme === theme.id));
  });
  centerSlide(visibleSlides.find(slide => slide.dataset.theme === theme.id), false);
  const url = new URL(location.href);
  url.searchParams.set('style', theme.id);
  history.replaceState(null, '', url);
  try { localStorage.setItem('guanmo-background-v2', theme.id); } catch { /* 受限存储仍可使用地址分享。 */ }
  announce(`当前背景：${theme.name}`);
}

function applyFilters(initialTheme) {
  const query = $('#background-search').value;
  const visible = new Set(filterThemes(themes, activeFilter, query).map(theme => theme.id));
  const slides = [...track.children];
  for (const slide of slides) slide.hidden = !visible.has(slide.dataset.theme);
  visibleSlides = slides.filter(slide => !slide.hidden);
  carousel.hidden = visibleSlides.length === 0;
  $('#carousel-controls').hidden = visibleSlides.length < 2;
  const preferred = visibleSlides.find(slide => slide.dataset.theme === initialTheme) || activeSlide;
  const fallback = initialTheme === '' && visibleSlides.length > 2 ? visibleSlides[1] : visibleSlides[0];
  const centered = visibleSlides.includes(preferred) ? preferred : fallback;
  if (centered) centerSlide(centered, false);
  else setActiveSlide(null);
  $('#result-count').textContent = String(visible.size);
  $('#empty-state').hidden = visible.size !== 0;
  announce(`找到 ${visible.size} 个背景`);
}

function renderThemes(initialTheme) {
  const rail = $('#theme-rail');
  const categories = new Map(themes.map(theme => [theme.category, theme.label]));
  if (categories.size > 1) {
    for (const [id, label] of [['all', '全部'], ...categories]) {
      const button = node('button', 'chip', label);
      button.type = 'button';
      button.dataset.filter = id;
      button.setAttribute('aria-pressed', String(id === activeFilter));
      backgroundFilters.append(button);
    }
    backgroundFilters.hidden = false;
  }
  themes.forEach((theme, index) => {
    const quick = node('button', 'rail-item');
    quick.type = 'button'; quick.dataset.theme = theme.id;
    quick.setAttribute('aria-pressed', 'false');
    quick.setAttribute('aria-label', `选择${theme.name}`);
    const thumb = node('img');
    thumb.src = thumbnail(theme); thumb.alt = ''; thumb.width = 76; thumb.height = 48; thumb.loading = 'lazy';
    quick.append(thumb, node('span', '', theme.name));
    quick.addEventListener('click', () => selectTheme(index));
    rail.append(quick);
    const card = node('article', 'background-card');
    card.dataset.category = theme.category; card.dataset.theme = theme.id; card.dataset.family = theme.family || '';
    card.style.setProperty('--card-accent', theme.accent);
    const media = node('div', 'card-media');
    const image = node('img');
    image.src = thumbnail(theme); image.alt = `${theme.name}：${theme.description}`;
    image.width = 960; image.height = 540; image.loading = index < 3 ? 'eager' : 'lazy'; image.decoding = 'async'; image.draggable = false;
    media.append(image);
    const title = node('h3', 'card-title');
    const button = node('button', 'card-preview-button', theme.name);
    button.type = 'button'; button.setAttribute('aria-label', `预览${theme.name}`);
    button.addEventListener('click', () => {
      if (card === activeSlide) selectTheme(index, true);
      else centerSlide(card);
    });
    title.append(button);
    const details = node('div', 'card-details');
    if (theme.tags?.length) details.append(node('span', '', theme.tags.slice(-2).join(' · ')));
    if (['pending', 'accepted'].includes(theme.status)) {
      details.append(node('span', 'card-review', theme.status === 'pending' ? '待定' : '已认可'));
    }
    const caption = node('div', 'card-caption'); caption.append(title, details);
    const arrow = node('span', 'card-preview', '↗'); arrow.setAttribute('aria-hidden', 'true');
    const meta = node('div', 'card-meta'); meta.append(caption, arrow);
    card.append(media, meta); track.append(card);
  });
  track.setAttribute('aria-busy', 'false');
  applyFilters(initialTheme);
}

function templateSpecs(template) {
  return `${template.duration} 秒 · ${template.resolution} · ${template.fps} fps`;
}

async function showTemplate(template, examples) {
  $('#template-dialog-title').textContent = template.name;
  const exampleButtons = examples.map((example, index) => {
    const button = node('button', '', example.name);
    button.type = 'button';
    button.addEventListener('click', () => selectExample(index));
    return button;
  });
  function selectExample(index) {
    if (exampleButtons[index].getAttribute('aria-pressed') === 'true') return;
    const example = examples[index];
    exampleButtons.forEach((button, position) => button.setAttribute('aria-pressed', String(position === index)));
    $('#template-dialog-specs').textContent = `${example.name} · ${templateSpecs(template)}`;
    $('#template-video-error').hidden = true;
    templateVideo.setAttribute('aria-label', example.name);
    templateVideo.poster = asset(example.poster);
    templateVideo.src = asset(example.video);
  }
  templateExamples.replaceChildren(...exampleButtons);
  templateExamples.hidden = exampleButtons.length < 2;
  selectExample(0);

  templatePrompt.value = '';
  templatePrompt.placeholder = '正在加载提示词…';
  templateCopy.disabled = true;
  templatePromptStatus.hidden = true;
  templateConfig.hidden = !template.config;
  if (template.config) templateConfig.href = asset(template.config);
  else templateConfig.removeAttribute('href');
  templateDialog.showModal();

  const request = new AbortController();
  templatePromptRequest = request;
  try {
    const response = await fetch(asset(template.prompt), { cache: 'no-store', signal: request.signal });
    if (!response.ok) throw new Error('提示词加载失败');
    const prompt = await response.text();
    if (request.signal.aborted) return;
    templatePrompt.value = prompt;
    templateCopy.disabled = !prompt;
    templatePrompt.placeholder = '';
  } catch {
    if (!request.signal.aborted) templatePrompt.placeholder = '提示词加载失败，请关闭详情后重试。';
  }
}

templateCopy.addEventListener('click', async () => {
  const request = templatePromptRequest;
  let copied = false;
  try {
    await navigator.clipboard.writeText(templatePrompt.value);
    copied = true;
  } catch { /* 浏览器未允许剪贴板写入时保留手动复制。 */ }
  if (request.signal.aborted) return;
  if (!copied) {
    templatePrompt.focus();
    templatePrompt.select();
  }
  templatePromptStatus.textContent = copied ? '已复制完整提示词' : '已选中全文，可使用复制快捷键。';
  templatePromptStatus.hidden = false;
});

function renderTemplates(templates, localCases) {
  const grid = $('#template-grid');
  templates.forEach((template, index) => {
    const localExamples = localCases.filter(example => example.templateId === template.id);
    const card = node('article', 'template-card');
    const trigger = node('button', 'template-trigger');
    trigger.type = 'button';
    trigger.setAttribute('aria-label', `查看${template.name}详情`);
    trigger.setAttribute('aria-haspopup', 'dialog');
    const media = node('span', 'template-media');
    const poster = node('img');
    poster.src = asset(localExamples[0]?.poster ?? template.poster); poster.alt = '';
    poster.width = 1920; poster.height = 1080; poster.loading = index < 3 ? 'eager' : 'lazy';
    media.append(poster);
    const content = node('span', 'template-content');
    const info = node('span', 'template-info');
    info.append(node('span', 'template-title', template.name), node('span', 'template-specs', templateSpecs(template)));
    const expand = node('span', 'template-expand', '↗');
    expand.setAttribute('aria-hidden', 'true');
    content.append(info, expand);
    trigger.append(media, content);
    trigger.addEventListener('click', () => showTemplate(template, [...localExamples, ...template.examples]));
    card.append(trigger);
    grid.append(card);
  });
}

document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-mode]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  const pure = button.dataset.mode === 'pure';
  $('#screen').classList.toggle('pure', pure);
  document.querySelectorAll('.screen-copy, .screen-top, .screen-caption').forEach(element => element.setAttribute('aria-hidden', String(pure)));
  announce(pure ? '已切换为纯背景' : '已切换为标题叠加');
}));
backgroundFilters.addEventListener('click', event => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  backgroundFilters.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  activeFilter = button.dataset.filter;
  applyFilters();
});
$('#background-search').addEventListener('input', () => applyFilters());
$('#reset-search').addEventListener('click', () => {
  $('#background-search').value = '';
  activeFilter = 'all';
  document.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === 'all')));
  applyFilters();
  $('#background-search').focus();
});
document.addEventListener('keydown', event => {
  if (backgroundGallery.hidden) return;
  const editing = event.target instanceof Element && event.target.matches('input, textarea, [contenteditable=true]');
  if (event.key === '/' && !editing && !dialogs.some(dialog => dialog.open)) {
    event.preventDefault(); $('#background-search').focus();
  }
  if ($('#preview-dialog').open && !$('#image-dialog').open && !editing && !event.altKey && !event.ctrlKey && !event.metaKey) {
    if (event.key === 'ArrowLeft') { event.preventDefault(); selectTheme(current - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); selectTheme(current + 1); }
  }
});
$('#previous').addEventListener('click', () => { if (themes.length) selectTheme(current - 1); });
$('#next').addEventListener('click', () => { if (themes.length) selectTheme(current + 1); });
$('#view-image').addEventListener('click', () => {
  if (!themes.length) return;
  const theme = themes[current];
  $('#full-image').src = asset(theme.image); $('#full-image').alt = `${theme.name}：${theme.description}`;
  $('#image-dialog-title').textContent = theme.name;
  $('#image-dialog-caption').textContent = `${theme.en} · ${theme.description}`;
  $('#image-dialog').showModal();
});
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.close).close()));
dialogs.forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } }));
templateDialog.addEventListener('close', () => {
  templatePromptRequest?.abort();
  templateVideo.pause();
  templateVideo.removeAttribute('src');
  templateVideo.load();
});
templateVideo.addEventListener('error', () => { if (templateDialog.open) $('#template-video-error').hidden = false; });
$('#year').textContent = String(new Date().getFullYear());

try {
  const [templateCatalog, localCases] = await Promise.all([
    readCatalog('templates/catalog.json', '模板'),
    readLocalCases(),
  ]);
  renderTemplates(templateCatalog.templates, localCases);
  if (location.hash === '#templates') $('#templates').scrollIntoView({ behavior: 'instant', block: 'start' });
} catch (error) {
  $('#template-load-error').hidden = false;
  $('#template-load-error').textContent = `${error.message}。请刷新页面重试。`;
}

if (!backgroundGallery.hidden) {
  try {
    const backgroundCatalog = await readCatalog('assets/backgrounds/catalog.json', '背景库');
    themes = activeThemes(backgroundCatalog.backgrounds);
    if (!themes.length) throw new Error('风格库中暂时没有背景');
    let saved = null;
    try { saved = localStorage.getItem('guanmo-background-v2'); } catch { /* 不依赖本地存储。 */ }
    const params = new URL(location.href).searchParams;
    const sharedTheme = params.get('style');
    const target = initialThemeId(backgroundCatalog.backgrounds, sharedTheme || saved);
    const index = themes.findIndex(theme => theme.id === target);
    current = Math.max(0, index);
    renderThemes(sharedTheme ? target : '');
    if (location.hash === '#atmospheres') backgroundGallery.scrollIntoView({ behavior: 'instant', block: 'start' });
    if (params.get('preview') === '1') await selectTheme(current, true);
  } catch (error) {
    track.setAttribute('aria-busy', 'false');
    $('#load-error').hidden = false;
    $('#load-error').textContent = `${error.message}。请刷新页面重试。`;
  }
}
