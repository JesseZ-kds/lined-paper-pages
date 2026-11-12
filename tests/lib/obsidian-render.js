// A stand-in for Obsidian's MarkdownRenderer, close enough for cue cards: paragraphs (a line each,
// as Obsidian shows them with line breaks), lists (- * +, nested by indent), ==highlight==, **bold**,
// <font>, <mark>, [[links]], [text](url), and embeds ![[Page#^block]] of a page in `pages` (its
// callout, built as Obsidian builds a block embed: <div>s inside the <p>). Like Obsidian, it runs the
// plugin's markdown post-processors on what it made.
module.exports = `
window.__pages = window.__pages || {};
window.__mdInline = (s) => s
  .replace(/\\[\\[([^\\]|#]+)(?:#[^\\]|]*)?(?:\\|([^\\]]+))?\\]\\]/g, (m, l, a) => '<a data-href="' + l + '" href="' + l + '" class="internal-link">' + (a || l) + '</a>')
  .replace(/\\[([^\\]]+)\\]\\((https?:[^)]+)\\)/g, '<a href="$2" class="external-link" rel="noopener nofollow" target="_blank">$1</a>')
  .replace(/==(.+?)==/g, '<mark>$1</mark>').replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
window.__mdEmbed = (link, block) => {
  const span = document.createElement('span');
  span.className = 'internal-embed markdown-embed inline-embed is-loaded';
  span.setAttribute('src', link + (block ? '#^' + block : ''));
  span.setAttribute('alt', link);
  const page = window.__pages[link] || '';
  const lines = page.replace(/^---[\\s\\S]*?---\\n/, '').split('\\n');
  const head = lines.findIndex((l) => /^> \\[!/.test(l));
  let callout = '';
  if (head >= 0) {
    const m = /^> \\[!(\\w+)\\]\\s*(.*)$/.exec(lines[head]);
    const body = []; for (let i = head + 1; i < lines.length && /^>/.test(lines[i]); i++) body.push(lines[i].replace(/^>\\s?/, ''));
    callout = '<div data-callout-metadata="" data-callout-fold="" data-callout="' + m[1] + '" class="callout"><div class="callout-title" dir="auto"><div class="callout-icon"><svg width="24" height="24"></svg></div><div class="callout-title-inner">' + window.__mdInline(m[2]) + '</div></div><div class="callout-content"><p dir="auto">' + window.__mdInline(body.join('<br>')) + '</p></div></div>';
  }
  span.innerHTML = '<div class="markdown-embed-title"></div><div class="markdown-preview-view markdown-rendered node-insert-event"><div class="markdown-embed-content"><div class="markdown-preview-sizer markdown-preview-section"><div>' + callout + '</div></div></div></div><div class="markdown-embed-link"></div>';
  return span;
};
window.__mdRender = (md, el) => {
  const lines = md.split('\\n');
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    const sec = document.createElement('div');
    const embed = /^!\\[\\[([^\\]#|]+)(?:#\\^([\\w-]+))?\\]\\]\\s*$/.exec(l.trim());
    if (embed) { const p = document.createElement('p'); p.appendChild(window.__mdEmbed(embed[1], embed[2])); sec.appendChild(p); el.appendChild(sec); i++; continue; }
    if (/^\\s*[-*+] /.test(l)) {
      const root = document.createElement('ul'); root.className = 'has-list-bullet';
      const stack = [{ ind: -1, ul: root }];
      while (i < lines.length && /^\\s*[-*+] /.test(lines[i])) {
        const m = /^(\\s*)[-*+] (.*)$/.exec(lines[i]);
        const ind = m[1].length;
        while (stack.length > 1 && ind <= stack[stack.length - 1].ind) stack.pop();
        let parent = stack[stack.length - 1];
        if (ind > parent.ind && parent.li) { const ul = document.createElement('ul'); ul.className = 'has-list-bullet'; parent.li.appendChild(ul); parent = { ind, ul }; stack.push(parent); }
        else if (parent.ind < 0 || ind > parent.ind) { parent = { ind, ul: parent.ul }; stack.push(parent); }
        const li = document.createElement('li'); li.setAttribute('dir', 'auto');
        li.innerHTML = '<span class="list-bullet"></span>' + window.__mdInline(m[2].replace(/ {2}$/, ''));
        parent.ul.appendChild(li); parent.li = li;
        i++;
      }
      sec.appendChild(root); el.appendChild(sec); continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^\\s*[-*+] /.test(lines[i])) para.push(lines[i++].replace(/ {2}$/, ''));
    const p = document.createElement('p'); p.setAttribute('dir', 'auto'); p.innerHTML = para.map(window.__mdInline).join('<br>');
    sec.appendChild(p); el.appendChild(sec);
  }
  for (const f of window.__processors || []) { try { f(el, { sourcePath: '', getSectionInfo: () => null, frontmatter: undefined }); } catch (e) { console.error(e); } }
};
`;
