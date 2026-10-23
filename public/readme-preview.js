/* A display-only README renderer. Never use this HTML as the editor's source. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProfileKitReadmePreview = { render: api.render };
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const TAGS = 'a abbr b blockquote br caption code dd del details div dl dt em h1 h2 h3 h4 h5 h6 hr i img input kbd li mark ol p picture pre q rp rt ruby s samp small source span strong sub summary sup table tbody td th thead tr ul var wbr'.split(' ');
  const ATTRS = 'href src srcset media type alt title width height align valign colspan rowspan start reversed open checked disabled'.split(' ');
  const CSP = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src https: http:; font-src 'none'; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
  const CSS = `
    *{box-sizing:border-box}html{color-scheme:light;background:#fff;color:#1f2328}
    html[data-theme="dark"]{color-scheme:dark;background:#0d1117;color:#e6edf3}
    body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:16px;line-height:1.5;overflow-wrap:break-word}
    .markdown-body{padding:32px;max-width:1012px;margin:auto;min-height:100vh}
    .markdown-body>:first-child{margin-top:0!important}.markdown-body>:last-child{margin-bottom:0!important}
    h1,h2,h3,h4,h5,h6{margin:24px 0 16px;font-weight:600;line-height:1.25}h1{font-size:2em}h2{font-size:1.5em}h3{font-size:1.25em}h4{font-size:1em}h5{font-size:.875em}h6{font-size:.85em;color:#59636e}
    h1,h2{padding-bottom:.3em;border-bottom:1px solid #d1d9e0}p,blockquote,ul,ol,dl,table,pre,details{margin-top:0;margin-bottom:16px}
    a{color:#0969da;text-decoration:none}a:hover{text-decoration:underline}a:not([href]){color:inherit}
    img{max-width:100%;vertical-align:middle}img:not([height]){height:auto}picture{display:inline}hr{height:1px;padding:0;margin:24px 0;border:0;background:#d1d9e0}
    ul,ol{padding-left:2em}li+li{margin-top:.25em}li>p{margin-top:16px}li>input{margin:0 .35em 0 -1.4em;vertical-align:middle}
    blockquote{padding:0 1em;border-left:.25em solid #d1d9e0;color:#59636e}blockquote>:last-child{margin-bottom:0}
    code,kbd,pre,samp{font-family:ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace}code{padding:.2em .4em;font-size:85%;background:#818b981f;border-radius:6px}
    pre{overflow:auto;padding:16px;font-size:85%;line-height:1.45;background:#f6f8fa;border-radius:6px}pre code{padding:0;font-size:100%;background:transparent;border:0;white-space:pre}
    kbd{padding:3px 5px;font-size:11px;border:1px solid #d1d9e0;border-radius:6px;box-shadow:inset 0 -1px 0 #d1d9e0}
    table{display:block;width:max-content;max-width:100%;overflow:auto;border-spacing:0;border-collapse:collapse}th,td{padding:6px 13px;border:1px solid #d1d9e0}th{font-weight:600}tr:nth-child(2n){background:#f6f8fa}
    summary{cursor:pointer}dt{font-weight:600}dd{margin-left:0;padding:0 16px}sub,sup{font-size:75%}
    [align="center"]{text-align:center}[align="left"]{text-align:left}[align="right"]{text-align:right}[align="justify"]{text-align:justify}
    img[align="left"]{float:left;margin-right:16px}img[align="right"]{float:right;margin-left:16px}[hidden]{display:none!important}
    .preview-notice,.image-placeholder{color:#59636e;background:#f6f8fa;border:1px dashed #a4adb7;border-radius:6px}
    .preview-notice{font-size:13px;padding:10px 12px;margin:0 0 20px}.image-placeholder{display:inline-block;vertical-align:middle;padding:12px;max-width:100%;font-size:13px;white-space:normal;overflow-wrap:anywhere}
    html[data-theme="dark"] a{color:#58a6ff}html[data-theme="dark"] h6,html[data-theme="dark"] blockquote{color:#9198a1}
    html[data-theme="dark"] h1,html[data-theme="dark"] h2,html[data-theme="dark"] th,html[data-theme="dark"] td,html[data-theme="dark"] kbd,html[data-theme="dark"] blockquote{border-color:#3d444d}
    html[data-theme="dark"] hr{background:#3d444d}html[data-theme="dark"] pre,html[data-theme="dark"] tr:nth-child(2n){background:#151b23}
    html[data-theme="dark"] .preview-notice,html[data-theme="dark"] .image-placeholder{background:#151b23;color:#b1bac4;border-color:#59636e}
    @media(max-width:600px){.markdown-body{padding:20px 16px}body{font-size:14px}th,td{padding:6px 10px}}
  `;

  function repositoryContext(options) {
    const repository = String(options.repository || '').trim();
    if (!/^[a-z\d](?:[a-z\d-]{0,38})\/[a-z\d_.-]{1,100}$/i.test(repository)) return null;
    if (['.', '..'].includes(repository.split('/')[1])) return null;
    const branch = String(options.branch || 'HEAD').trim();
    if (!branch || branch.length > 255 || /[\s\\?#\x00-\x1f\x7f]/.test(branch) || branch.split('/').some(part => !part || part === '.' || part === '..')) return null;
    return { repository, branch: encodeURIComponent(branch) };
  }

  // No URL can inherit the srcdoc's parent origin by accident.
  function resolveURL(value, kind, options = {}) {
    const raw = String(value || '').trim();
    if (!raw || /[\x00-\x1f\x7f\\]/.test(raw)) return null;
    if (kind === 'link' && raw.startsWith('#')) return raw;
    if (raw.startsWith('#')) return null;
    if (kind === 'link' && /^mailto:/i.test(raw)) {
      return /^mailto:[^\s<>]+$/i.test(raw) ? raw : null;
    }
    if (/^[a-z][a-z\d+.-]*:/i.test(raw) || raw.startsWith('//')) {
      try {
        const url = new URL(raw.startsWith('//') ? `https:${raw}` : raw);
        return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
      } catch { return null; }
    }
    if (kind === 'image' && /^\/api\/[a-z][a-z\d-]*(?:[?#]|$)/i.test(raw) && options.origin) {
      try {
        const origin = new URL(options.origin);
        if (['https:', 'http:'].includes(origin.protocol) && !origin.username && !origin.password) return new URL(raw, origin.origin).href;
      } catch { /* An invalid origin cannot grant access to a relative URL. */ }
    }
    const context = repositoryContext(options);
    if (!context) return null;
    const boundary = raw.search(/[?#]/);
    const pathname = boundary < 0 ? raw : raw.slice(0, boundary);
    const suffix = boundary < 0 ? '' : raw.slice(boundary);
    const parts = [];
    for (const part of pathname.split('/')) {
      let decoded;
      try { decoded = decodeURIComponent(part); } catch { return null; }
      if (!decoded || decoded === '.') continue;
      if (decoded === '..') {
        if (!parts.length) return null;
        parts.pop();
      } else {
        if (/[\\/\x00-\x1f\x7f]/.test(decoded)) return null;
        parts.push(encodeURIComponent(decoded));
      }
    }
    if (!parts.length) return null;
    const base = kind === 'image' ? `https://raw.githubusercontent.com/${context.repository}/${context.branch}/` : `https://github.com/${context.repository}/blob/${context.branch}/`;
    return base + parts.join('/') + suffix;
  }

  // A comma inside an image URL is valid (and common in ProfileKit queries).
  // srcset URL tokens end at whitespace; trailing commas separate candidates.
  function sanitizeSrcset(value, options) {
    let remaining = String(value || '');
    const candidates = [];
    while (remaining) {
      remaining = remaining.replace(/^[\s,]+/, '');
      if (!remaining) break;
      const token = /^[^\s]+/.exec(remaining)[0];
      remaining = remaining.slice(token.length);
      const trailingComma = token.endsWith(',');
      const rawURL = token.replace(/,+$/, '');
      let descriptor = '';
      if (!trailingComma) {
        const end = remaining.indexOf(',');
        descriptor = (end < 0 ? remaining : remaining.slice(0, end)).trim();
        remaining = end < 0 ? '' : remaining.slice(end + 1);
      }
      const url = resolveURL(rawURL, 'image', options);
      if (url && (!descriptor || /^(?:[1-9]\d*w|(?:\d+(?:\.\d+)?|\.\d+)x)$/.test(descriptor))) candidates.push(url + (descriptor ? ` ${descriptor}` : ''));
    }
    return candidates.join(', ');
  }

  function themeMedia(value, theme) {
    // Keep viewport/density media conditions, but remove dependence on the OS theme.
    return String(value || '').replace(/\(\s*prefers-color-scheme\s*:\s*(dark|light)\s*\)/gi,
      (_, choice) => choice.toLowerCase() === theme ? '(width >= 0px)' : '(width < 0px)');
  }

  function dimension(value) {
    if (!/^\d+(?:\.\d+)?%?$/.test(value || '')) return null;
    const percent = value.endsWith('%');
    const number = Number.parseFloat(value);
    if (!Number.isFinite(number) || number <= 0) return null;
    return `${Math.min(number, percent ? 100 : 4096)}${percent ? '%' : ''}`;
  }

  function render(source, options = {}) {
    if (!root.document || !root.marked || !root.DOMPurify || !root.DOMPurify.isSupported) throw new Error('README preview requires the bundled Marked and DOMPurify browser scripts.');
    const theme = options.theme === 'light' ? 'light' : 'dark';
    const html = root.marked.parse(String(source || ''), { gfm: true, breaks: false, async: false });
    const fragment = root.DOMPurify.sanitize(html, {
      ALLOWED_TAGS: TAGS,
      ALLOWED_ATTR: ATTRS,
      ALLOW_ARIA_ATTR: false,
      ALLOW_DATA_ATTR: false,
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.:\-]|$))/i,
      FORBID_TAGS: ['script', 'style', 'svg', 'math', 'iframe', 'object', 'embed', 'form', 'template', 'noscript'],
      FORBID_CONTENTS: ['script', 'style', 'svg', 'math', 'iframe', 'object', 'embed', 'template', 'noscript'],
      RETURN_DOM_FRAGMENT: true,
      SANITIZE_NAMED_PROPS: true,
    });
    const document = fragment.ownerDocument;
    let unresolved = 0;

    for (const element of fragment.querySelectorAll('*')) {
      for (const name of ['width', 'height']) {
        if (!element.hasAttribute(name)) continue;
        const value = dimension(element.getAttribute(name));
        if (value) element.setAttribute(name, value);
        else element.removeAttribute(name);
      }
      if (element.hasAttribute('align')) {
        const align = element.getAttribute('align').toLowerCase();
        if (['left', 'center', 'right', 'justify'].includes(align)) element.setAttribute('align', align);
        else element.removeAttribute('align');
      }
      if (element.hasAttribute('valign') && !/^(top|middle|bottom)$/i.test(element.getAttribute('valign'))) element.removeAttribute('valign');
      for (const name of ['colspan', 'rowspan']) {
        if (!element.hasAttribute(name)) continue;
        const value = Number(element.getAttribute(name));
        if (Number.isInteger(value) && value > 0) element.setAttribute(name, String(Math.min(value, 100)));
        else element.removeAttribute(name);
      }
      if (element.tagName === 'INPUT') {
        if (element.getAttribute('type') !== 'checkbox') { element.remove(); continue; }
        element.setAttribute('disabled', '');
      }
      // URL-bearing attributes are valid only on their intended elements.
      if (element.tagName !== 'A') element.removeAttribute('href');
      if (element.tagName !== 'IMG') element.removeAttribute('src');
      if (!['IMG', 'SOURCE'].includes(element.tagName)) element.removeAttribute('srcset');
    }

    for (const element of fragment.querySelectorAll('source')) {
      if (element.parentElement?.tagName !== 'PICTURE') { element.remove(); continue; }
      const srcset = sanitizeSrcset(element.getAttribute('srcset'), options);
      if (!srcset) { element.remove(); continue; }
      element.setAttribute('srcset', srcset);
      if (element.hasAttribute('media')) element.setAttribute('media', themeMedia(element.getAttribute('media'), theme));
      if (element.hasAttribute('type') && !/^image\/(?:png|jpe?g|gif|webp|avif|svg\+xml)$/i.test(element.getAttribute('type'))) element.removeAttribute('type');
    }

    for (const img of fragment.querySelectorAll('img')) {
      const raw = img.getAttribute('src') || '';
      const src = resolveURL(raw, 'image', options);
      const srcset = sanitizeSrcset(img.getAttribute('srcset'), options);
      const themeOnly = /#gh-(dark|light)-mode-only$/i.exec(raw);
      if (themeOnly && themeOnly[1].toLowerCase() !== theme) img.setAttribute('hidden', '');
      if (src) img.setAttribute('src', src);
      else img.removeAttribute('src');
      if (srcset) img.setAttribute('srcset', srcset);
      else img.removeAttribute('srcset');
      img.setAttribute('loading', 'lazy');
      img.setAttribute('decoding', 'async');
      img.setAttribute('referrerpolicy', 'no-referrer');
      if (!img.hasAttribute('alt')) img.setAttribute('alt', '');
      // Keep valid picture sources even if its fallback needs repository context.
      if (!src && !srcset && !img.closest('picture')?.querySelector('source')) {
        unresolved += 1;
        const placeholder = document.createElement('span');
        placeholder.className = 'image-placeholder';
        placeholder.setAttribute('role', 'img');
        const label = img.getAttribute('alt') || '이미지';
        placeholder.textContent = `${label} — ${raw && !/^[a-z][a-z\d+.-]*:/i.test(raw) ? '상대 경로 이미지를 보려면 GitHub 저장소를 입력하세요.' : '미리보기에서 표시할 수 없는 이미지 주소입니다.'}`;
        placeholder.setAttribute('aria-label', placeholder.textContent);
        const width = img.getAttribute('width');
        if (width) placeholder.style.width = width.endsWith('%') ? width : `${width}px`;
        if (img.hasAttribute('hidden')) placeholder.setAttribute('hidden', '');
        img.replaceWith(placeholder);
      }
    }

    for (const link of fragment.querySelectorAll('a')) {
      const raw = link.getAttribute('href');
      if (!raw) continue;
      const href = resolveURL(raw, 'link', options);
      if (!href) {
        link.removeAttribute('href');
        link.setAttribute('title', '미리보기에서 열 수 없는 링크입니다. 상대 링크는 GitHub 저장소 정보가 필요합니다.');
        continue;
      }
      link.setAttribute('href', href);
      if (!href.startsWith('#')) {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      }
    }

    const slugs = new Set();
    for (const heading of fragment.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
      const base = heading.textContent.toLowerCase().trim().replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '').replace(/\s/g, '-');
      let slug = base;
      for (let n = 1; slugs.has(slug); n += 1) slug = `${base}-${n}`;
      slugs.add(slug);
      heading.id = slug;
    }
    const container = document.createElement('div');
    container.appendChild(fragment);
    const notice = unresolved ? '<aside class="preview-notice" role="note">일부 이미지는 저장소 정보가 필요하거나 미리보기를 지원하지 않는 주소입니다. 외부 이미지는 원본 호스트 상태에 따라 표시됩니다. README 원문과 내보내기에는 영향을 주지 않습니다.</aside>' : '';
    return `<!doctype html><html lang="ko" data-theme="${theme}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width, initial-scale=1"><title>README 미리보기</title><style>${CSS}</style></head><body><main class="markdown-body">${notice}${container.innerHTML}</main></body></html>`;
  }

  return { render, resolveURL, sanitizeSrcset, themeMedia };
}));
