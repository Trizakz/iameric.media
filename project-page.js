// Project pages: one renderer for the published pages (work/<id>/index.html) and the Site Manager's page builder
// (manage/builder.js shows the same HTML in its canvas, so what you build is what goes online).
//
//   pageHTML(page, project, cats)   the whole <article class="pp">: the meta head, then the sections
//   fontsURL(theme)                 the Google Fonts link for the page's two fonts
//   init(root)                      the moving parts: carousels, before/after, loops that play in view, reveals
//
// page = { theme, meta, sections: [{ ..., blocks: [{ type, col, span, ... }] }] }; see DEFAULT_PAGE and BLOCKS.

export const FONTS = {
  'DM Sans': 'DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800',
  'Inter Tight': 'Inter+Tight:ital,wght@0,300..800;1,300..800',
  'Manrope': 'Manrope:wght@300..800',
  'Space Grotesk': 'Space+Grotesk:wght@300..700',
  'Bricolage Grotesque': 'Bricolage+Grotesque:opsz,wght@12..96,300..800',
  'Syne': 'Syne:wght@400..800',
  'Unbounded': 'Unbounded:wght@300..800',
  'Archivo Black': 'Archivo+Black',
  'Anton': 'Anton',
  'Fraunces': 'Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900',
  'Playfair Display': 'Playfair+Display:ital,wght@0,400..900;1,400..900',
  'Instrument Serif': 'Instrument+Serif:ital@0;1',
  'Fira Mono': 'Fira+Mono:wght@400;500;700',
  'JetBrains Mono': 'JetBrains+Mono:ital,wght@0,300..700;1,300..700',
};

export const DEFAULT_THEME = {
  bg: '#0d0e11', surface: '#18191d', text: '#eeeae0', muted: '#a3a09a', accent: '#2f5bff',
  headFont: 'DM Sans', headWeight: 600, headTracking: -0.03, bodyFont: 'DM Sans', size: 17,
  radius: 16, width: 1200, gap: 24, metaLayout: 'split',
};
export const DEFAULT_PAGE = () => ({
  theme: { ...DEFAULT_THEME },
  meta: { intro: '', version: '', changes: [], tools: [], links: [], credits: [] },
  sections: [],
});

// every block type: its name, icon (Material Symbols, for the builder) and the props a new one starts with
export const BLOCKS = {
  heading: { name: 'Heading', icon: 'title', span: 12, props: { text: 'Heading', level: 'h2', size: 48 } },
  text: { name: 'Text', icon: 'notes', span: 8, props: { html: '<p>Write something about this part of the project.</p>', size: 0, cols: 1 } },
  image: { name: 'Image', icon: 'image', span: 12, props: { src: '', alt: '', caption: '', ratio: 'auto', fit: 'cover' } },
  gallery: { name: 'Gallery', icon: 'grid_view', span: 12, props: { items: [], cols: 3, ratio: '1/1', gapPx: 12 } },
  carousel: { name: 'Carousel', icon: 'view_carousel', span: 12, props: { items: [], ratio: '16/9', autoplay: true, interval: 4 } },
  video: { name: 'Video file', icon: 'movie', span: 12, props: { src: '', poster: '', mode: 'loop', ratio: '16/9' } },
  embed: { name: 'YouTube / Vimeo', icon: 'smart_display', span: 12, props: { url: '', ratio: '16/9' } },
  compare: { name: 'Before / after', icon: 'compare', span: 12, props: { before: '', after: '', labelA: 'Before', labelB: 'After', ratio: '16/9' } },
  quote: { name: 'Quote', icon: 'format_quote', span: 10, props: { text: 'A sentence worth a big stage.', author: '', size: 32 } },
  stats: { name: 'Numbers', icon: 'monitoring', span: 12, props: { items: [{ value: '3', label: 'weeks' }, { value: '12', label: 'shots' }] } },
  button: { name: 'Button', icon: 'smart_button', span: 4, props: { label: 'Watch it', url: '', style: 'solid' } },
  palette: { name: 'Colours', icon: 'palette', span: 12, props: { items: [{ hex: '#2f5bff', name: 'Cobalt' }, { hex: '#ff6b57', name: 'Coral' }] } },
  spacer: { name: 'Space', icon: 'height', span: 12, props: { height: 64 } },
  divider: { name: 'Line', icon: 'horizontal_rule', span: 12, props: { thickness: 1, color: '' } },
  html: { name: 'HTML', icon: 'code', span: 12, props: { code: '' } },
};
// what every block can also set
export const BLOCK_STYLE = { textAlign: 'left', valign: 'start', pad: 0, bg: '', radius: -1, anim: 'rise', mobileHide: false, color: '' };
export const SECTION_DEFAULT = () => ({ width: 'wide', bg: '', text: '', bgImage: '', overlay: 0, padTop: 64, padBottom: 64, minH: 0, valign: 'start', gap: -1, blocks: [] });

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const day = d => (d || '').split('-').reverse().join('.');
const ratio = r => (r && r !== 'auto' ? `aspect-ratio: ${esc(r)};` : '');

export function fontsURL(theme) {
  const fams = [...new Set([theme.headFont, theme.bodyFont])].filter(f => FONTS[f]).map(f => `family=${FONTS[f]}`);
  return `https://fonts.googleapis.com/css2?${fams.join('&')}&display=swap`;
}
const fontStack = f => `"${f}", ${/Mono/.test(f) ? 'ui-monospace, monospace' : /Serif|Fraunces|Playfair/.test(f) ? 'Georgia, serif' : 'system-ui, sans-serif'}`;

// YouTube and Vimeo links -> their embed address
export function embedSrc(url) {
  const u = String(url || '').trim();
  let m = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(u);
  if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0`;
  m = /vimeo\.com\/(?:video\/)?(\d+)/.exec(u);
  if (m) return `https://player.vimeo.com/video/${m[1]}?dnt=1`;
  return '';
}

// text from the builder's rich text: only a few tags and plain links survive
export function cleanHTML(html) {
  const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  const OK = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'A', 'UL', 'OL', 'LI', 'H3', 'H4', 'SPAN']);
  const walk = el => [...el.children].forEach(c => {
    walk(c);
    if (!OK.has(c.tagName)) { c.replaceWith(...c.childNodes); return; }
    [...c.attributes].forEach(a => { if (!(c.tagName === 'A' && a.name === 'href')) c.removeAttribute(a.name); });
    if (c.tagName === 'A') {
      if (!/^(https?:|mailto:|\/|#)/i.test(c.getAttribute('href') || '')) c.removeAttribute('href');
      c.setAttribute('target', '_blank'); c.setAttribute('rel', 'noopener');
    }
  });
  const root = doc.body.firstElementChild;
  walk(root);
  return root.innerHTML;
}

const img = (src, alt = '', extra = '') => (src ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async"${extra}>` : '<span class="pp-empty" aria-hidden="true"></span>');

function blockInner(b) {
  switch (b.type) {
    case 'heading': {
      const tag = ['h2', 'h3', 'p'].includes(b.level) ? b.level : 'h2';
      return `<${tag} class="pp-h" style="--fs: ${+b.size || 48}px" data-edit="text">${esc(b.text)}</${tag}>`;
    }
    case 'text': return `<div class="pp-text" style="${b.size ? `font-size: ${+b.size}px;` : ''}${b.cols > 1 ? `columns: ${+b.cols};` : ''}" data-edit="html">${cleanHTML(b.html)}</div>`;
    case 'image': return `<figure class="pp-fig"><div class="pp-media" style="${ratio(b.ratio)}--fit: ${b.fit === 'contain' ? 'contain' : 'cover'}" data-drop="src">${img(b.src, b.alt)}</div>${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</figure>`;
    case 'gallery': return `<div class="pp-gallery" style="--cols: ${+b.cols || 3}; --g: ${+b.gapPx || 0}px" data-drop="items">${(b.items.length ? b.items : [{}, {}, {}]).map(i => `<div class="pp-media" style="${ratio(b.ratio)}">${img(i.src, i.alt)}</div>`).join('')}</div>`;
    case 'carousel': return `<div class="pp-carousel" data-auto="${b.autoplay ? +b.interval || 4 : 0}" data-drop="items"><div class="pp-track">${(b.items.length ? b.items : [{}]).map(i => `<div class="pp-slide pp-media" style="${ratio(b.ratio)}">${img(i.src, i.alt)}</div>`).join('')}</div>${b.items.length > 1 ? `<div class="pp-dots">${b.items.map((_, i) => `<button type="button" aria-label="slide ${i + 1}"${i ? '' : ' aria-current="true"'}></button>`).join('')}</div>` : ''}</div>`;
    case 'video': return `<div class="pp-media" style="${ratio(b.ratio)}" data-drop="src">${b.src ? (b.mode === 'loop'
      ? `<video src="${esc(b.src)}"${b.poster ? ` poster="${esc(b.poster)}"` : ''} muted loop playsinline preload="metadata" data-inview></video>`
      : `<video src="${esc(b.src)}"${b.poster ? ` poster="${esc(b.poster)}"` : ''} controls playsinline preload="metadata"></video>`) : '<span class="pp-empty" aria-hidden="true"></span>'}</div>`;
    case 'embed': { const src = embedSrc(b.url);
      return `<div class="pp-media pp-embed" style="${ratio(b.ratio || '16/9')}">${src ? `<iframe src="${esc(src)}" title="video" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>` : '<span class="pp-empty" aria-hidden="true"></span>'}</div>`; }
    case 'compare': return `<div class="pp-compare pp-media" style="${ratio(b.ratio)}--at: 50%">${img(b.after, b.labelB)}<div class="pp-before">${img(b.before, b.labelA)}</div>`
      + `<span class="pp-tag a">${esc(b.labelA)}</span><span class="pp-tag b">${esc(b.labelB)}</span><input type="range" min="0" max="100" value="50" aria-label="before and after"></div>`;
    case 'quote': return `<blockquote class="pp-quote" style="font-size: ${+b.size || 32}px"><p data-edit="text">${esc(b.text)}</p>${b.author ? `<cite>${esc(b.author)}</cite>` : ''}</blockquote>`;
    case 'stats': return `<dl class="pp-stats">${b.items.map(i => `<div><dt>${esc(i.value)}</dt><dd>${esc(i.label)}</dd></div>`).join('')}</dl>`;
    case 'button': return `<a class="pp-btn ${esc(b.style)}" href="${esc(b.url || '#')}"${/^https?:/.test(b.url) ? ' target="_blank" rel="noopener"' : ''}>${esc(b.label)}<span aria-hidden="true">↗</span></a>`;
    case 'palette': return `<ul class="pp-palette">${b.items.map(i => `<li><span style="background: ${esc(i.hex)}"></span><b>${esc(i.name)}</b><code>${esc(i.hex)}</code></li>`).join('')}</ul>`;
    case 'spacer': return `<div class="pp-spacer" style="height: ${+b.height || 0}px"></div>`;
    case 'divider': return `<hr class="pp-hr" style="border-top-width: ${+b.thickness || 1}px;${b.color ? ` border-color: ${esc(b.color)}` : ''}">`;
    case 'html': return `<div class="pp-html">${b.code || ''}</div>`;
  }
  return '';
}

function blockHTML(b) {
  const st = [`--col: ${+b.col || 1}`, `--span: ${+b.span || 12}`, `align-self: ${b.valign || 'start'}`, `text-align: ${b.textAlign || 'left'}`];
  if (b.pad) st.push(`padding: ${+b.pad}px`);
  if (b.bg) st.push(`background: ${b.bg}`);
  if (b.color) st.push(`color: ${b.color}`);
  if (b.radius >= 0) st.push(`--r: ${+b.radius}px`);
  const cls = ['pp-b', `pp-${b.type}-b`, b.anim && b.anim !== 'none' ? `pp-anim ${b.anim}` : '', b.mobileHide ? 'pp-mhide' : ''].filter(Boolean).join(' ');
  return `<div class="${cls}" data-blk="${esc(b.id)}" style="${esc(st.join('; '))}">${blockInner(b)}</div>`;
}

function sectionHTML(s) {
  const st = [`padding-top: ${+s.padTop || 0}px`, `padding-bottom: ${+s.padBottom || 0}px`];
  if (s.bg) st.push(`background-color: ${s.bg}`);
  if (s.text) st.push(`color: ${s.text}`, `--pp-muted: color-mix(in srgb, ${s.text} 62%, transparent)`);
  if (s.minH) st.push(`min-height: ${+s.minH}vh`);
  if (s.gap >= 0) st.push(`--g: ${+s.gap}px`);
  const bgImg = s.bgImage ? `<div class="pp-sbg" aria-hidden="true"><img src="${esc(s.bgImage)}" alt="">${s.overlay ? `<i style="opacity: ${+s.overlay / 100}"></i>` : ''}</div>` : '';
  return `<section class="pp-sec ${esc(s.width || 'wide')}" data-sec="${esc(s.id)}" style="${esc(st.join('; '))}">${bgImg}`
    + `<div class="pp-grid" style="align-items: ${esc(s.valign || 'start')}">${s.blocks.map(blockHTML).join('')}</div></section>`;
}

// the head of every project page: title, categories, date, version, tools, links, the thumbnail, then credits and
// the changes per version
function metaHTML(page, project, cats) {
  const m = page.meta, t = page.theme;
  const chips = (project.categories || []).filter(c => cats[c]).map(c => `<span class="pp-chip">${esc(cats[c].label)}</span>`).join('');
  const facts = [`<span><i>released</i>${day(project.date)}</span>`, m.version ? `<span><i>version</i>${esc(m.version)}</span>` : ''].join('');
  const tools = m.tools.length ? `<div class="pp-row"><i>tools</i><span class="pp-tools">${m.tools.map(x => `<span class="pp-chip">${esc(x)}</span>`).join('')}</span></div>` : '';
  const links = m.links.length ? `<div class="pp-links">${m.links.map(l => `<a class="pp-btn solid" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}<span aria-hidden="true">↗</span></a>`).join('')}</div>` : '';
  const thumb = t.metaLayout !== 'minimal' && project.thumb ? `<div class="pp-thumb pp-media">${img(project.thumb, '')}</div>` : '';
  const credits = m.credits.length ? `<div class="pp-credits"><h2>credits</h2><dl>${m.credits.map(c => `<div><dt>${esc(c.role)}</dt><dd>${esc(c.name)}</dd></div>`).join('')}</dl></div>` : '';
  const changes = m.changes.length ? `<div class="pp-changes"><h2>changes</h2>${m.changes.map((c, i) => `<details${i ? '' : ' open'}><summary><b>${esc(c.version)}</b>${esc(c.title)}<time>${day(c.date)}</time></summary>`
    + `<ul>${(c.changes || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>`).join('')}</div>` : '';
  return `<header class="pp-meta ${esc(t.metaLayout || 'split')}" data-meta>${t.metaLayout === 'cover' ? thumb : ''}<div class="pp-meta-main">`
    + `<div class="pp-chips">${chips}</div><h1 class="pp-title">${esc(project.title)}</h1>${m.intro ? `<p class="pp-intro">${esc(m.intro)}</p>` : ''}`
    + `<div class="pp-facts">${facts}</div>${tools}${links}</div>${t.metaLayout === 'split' ? thumb : ''}`
    + (credits || changes ? `<div class="pp-meta-foot">${credits}${changes}</div>` : '') + '</header>';
}

export function themeStyle(t) {
  return [`--pp-bg: ${t.bg}`, `--pp-surface: ${t.surface}`, `--pp-text: ${t.text}`, `--pp-muted: ${t.muted}`, `--pp-accent: ${t.accent}`,
    `--pp-head: ${fontStack(t.headFont)}`, `--pp-body: ${fontStack(t.bodyFont)}`, `--pp-hw: ${+t.headWeight}`, `--pp-ht: ${+t.headTracking}em`,
    `--pp-size: ${+t.size}px`, `--r: ${+t.radius}px`, `--pp-w: ${+t.width}px`, `--g: ${+t.gap}px`,
    // the site's footer reads these
    `--bg: ${t.bg}`, `--text: ${t.text}`, `--muted: ${t.muted}`, `--panel: ${t.surface}`].join('; ');
}

export function pageHTML(page, project, cats) {
  return `<article class="pp" style="${esc(themeStyle(page.theme))}">${metaHTML(page, project, cats)}${page.sections.map(sectionHTML).join('')}</article>`;
}

// ---------------------------------------------------------------------------------------------------------------
// the moving parts, on the published page and in the builder's canvas
export function init(root, { edit = false } = {}) {
  const off = [];
  // carousels: scroll-snap tracks, dots, optional autoplay
  root.querySelectorAll('.pp-carousel').forEach(c => {
    const track = c.querySelector('.pp-track'), dots = [...c.querySelectorAll('.pp-dots button')];
    const go = i => track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
    dots.forEach((d, i) => d.addEventListener('click', () => go(i)));
    track.addEventListener('scroll', () => {
      const i = Math.round(track.scrollLeft / track.clientWidth);
      dots.forEach((d, j) => d.toggleAttribute('aria-current', i === j));
    }, { passive: true });
    const auto = +c.dataset.auto;
    if (auto && dots.length && !edit) {
      const t = setInterval(() => { if (!c.matches(':hover')) go((Math.round(track.scrollLeft / track.clientWidth) + 1) % dots.length); }, auto * 1000);
      off.push(() => clearInterval(t));
    }
  });
  // before / after
  root.querySelectorAll('.pp-compare input').forEach(r => r.addEventListener('input', () => r.parentElement.style.setProperty('--at', `${r.value}%`)));
  // loops play only while they can be seen; blocks rise in once
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.target.tagName === 'VIDEO') { if (e.isIntersecting) e.target.play().catch(() => {}); else e.target.pause(); }
    else if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.15 });
  root.querySelectorAll('video[data-inview]').forEach(v => io.observe(v));
  if (edit || matchMedia('(prefers-reduced-motion: reduce)').matches) root.querySelectorAll('.pp-anim').forEach(b => b.classList.add('in'));
  else root.querySelectorAll('.pp-anim').forEach(b => io.observe(b));
  return () => { io.disconnect(); off.forEach(f => f()); };
}
