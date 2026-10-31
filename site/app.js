/* Static documentation; URLs stay relative to the GitHub Pages project path. */
const base = new URL('./', location.href);
let config;
let renderVersion = 0;

function pageUrl(kind, path, anchor = '') {
  const url = new URL(base);
  url.searchParams.set(kind, path);
  url.hash = anchor;
  return url;
}

function navigate(url) {
  history.pushState(null, '', url);
  renderPage();
}

function menu(id, items, kind) {
  const container = document.getElementById(id);
  for (const item of items) {
    const link = document.createElement('a');
    link.href = pageUrl(kind, item.path);
    link.dataset.path = item.path;
    link.textContent = item.title;
    container.append(link);
  }
}

async function fetchText(path) {
  const response = await fetch(new URL(path, base));
  if (!response.ok) throw new Error(`Не удалось открыть ${path}: HTTP ${response.status}`);
  return response.text();
}

function prepareMarkdown(article, path) {
  const slugs = new Map();
  for (const heading of article.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    const slug = heading.textContent.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');
    const count = slugs.get(slug) || 0;
    heading.id = slug + (count ? `-${count}` : '');
    slugs.set(slug, count + 1);
  }
  for (const link of article.querySelectorAll('a[href]')) {
    const original = link.getAttribute('href');
    if (original.startsWith('#')) continue;
    const target = new URL(original, new URL(path, base));
    if (target.origin !== location.origin) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      continue;
    }
    const targetPath = decodeURIComponent(target.pathname.slice(base.pathname.length));
    if (config.documents.some(item => item.path === targetPath)) {
      link.href = pageUrl('doc', targetPath, target.hash);
    } else if (config.specs.some(item => item.path === targetPath)) {
      link.href = pageUrl('spec', targetPath);
    } else {
      link.href = target.href;
      link.target = '_blank';
      link.rel = 'noopener';
    }
  }
  for (const img of article.querySelectorAll('img[src]')) {
    img.src = new URL(img.getAttribute('src'), new URL(path, base));
  }
}

async function renderPage() {
  const version = ++renderVersion;
  const params = new URLSearchParams(location.search);
  const isSpec = params.has('spec');
  const path = params.get(isSpec ? 'spec' : 'doc') || 'README.md';
  const item = (isSpec ? config.specs : config.documents).find(item => item.path === path);
  const markdown = document.getElementById('markdown');
  const swagger = document.getElementById('swagger');
  const error = document.getElementById('error');
  error.hidden = true;
  markdown.hidden = true;
  swagger.hidden = true;
  document.getElementById('example-note').hidden = !isSpec;
  swagger.replaceChildren();
  for (const link of document.querySelectorAll('nav a')) {
    const active = link.dataset.path === path;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  try {
    if (!item) throw new Error('Раздел не найден. Выберите документ в меню.');
    document.title = `${item.title} — Ситилинк / Karelia API`;
    document.getElementById('page-title').textContent = item.title;
    const sourceLink = document.getElementById('source-link');
    sourceLink.href = new URL(path, base);
    sourceLink.textContent = isSpec ? 'Скачать OpenAPI JSON ↓' : 'Исходный Markdown ↗';
    if (isSpec) sourceLink.setAttribute('download', path);
    else sourceLink.removeAttribute('download');
    const source = await fetchText(path);
    if (version !== renderVersion) return;
    if (isSpec) {
      swagger.hidden = false;
      SwaggerUIBundle({
        spec: JSON.parse(source),
        dom_id: '#swagger',
        layout: 'BaseLayout',
        deepLinking: false,
        filter: true,
        displayOperationId: true,
        docExpansion: 'list',
        defaultModelsExpandDepth: 0,
        supportedSubmitMethods: [],
        validatorUrl: null,
        persistAuthorization: false,
        queryConfigEnabled: false,
      });
    } else {
      markdown.innerHTML = DOMPurify.sanitize(marked.parse(source, { gfm: true }));
      prepareMarkdown(markdown, path);
      markdown.hidden = false;
    }
    window.scrollTo(0, 0);
    if (location.hash && !isSpec) {
      document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
    }
  } catch (cause) {
    if (version !== renderVersion) return;
    error.textContent = cause.message;
    error.hidden = false;
  }
}

document.addEventListener('click', event => {
  const link = event.target.closest('a[href]');
  if (!link || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target === '_blank') return;
  const url = new URL(link.href);
  if (url.origin === base.origin && url.pathname === base.pathname && (url.searchParams.has('doc') || url.searchParams.has('spec'))) {
    event.preventDefault();
    navigate(url);
  }
});
window.addEventListener('popstate', () => renderPage());

async function start() {
  try {
    const response = await fetch(new URL('config.json', base));
    if (!response.ok) throw new Error('Не удалось загрузить меню документации.');
    config = await response.json();
    menu('documents', config.documents, 'doc');
    menu('contracts', config.specs, 'spec');
    await renderPage();
  } catch (cause) {
    const error = document.getElementById('error');
    error.textContent = cause.message;
    error.hidden = false;
  }
}
start();
