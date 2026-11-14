// Tiny markdown renderer shared by the article editor preview and the article page.
// Builds React elements (never raw HTML), so article text cannot inject scripts. Only http(s) and /-relative links/images are allowed.
const safeUrl = u => (/^(https?:\/\/|\/(?!\/))/i.test(u) ? u : '#');   // http(s), or a /path (not //host)

// inline: ![alt](url)  [text](url)  **bold**  *italic*   (unmatched markers stay as plain text)
export function inline(text, key = '') {
  const re = /!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*/g;
  const out = [];
  let last = 0, m, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = key + i++;
    if (m[2]) out.push(<img key={k} src={safeUrl(m[2])} alt={m[1]} className="w-img" />);
    else if (m[4]) out.push(<a key={k} href={safeUrl(m[4])} target="_blank" rel="noopener noreferrer">{m[3]}</a>);
    else if (m[5]) out.push(<strong key={k}>{m[5]}</strong>);
    else out.push(<em key={k}>{m[6]}</em>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// Each blank-line separated paragraph is rendered on its own; consecutive list items are merged into one list.
export function renderMarkdown(src) {
  const lines = src.split('\n');
  const nodes = [];
  let list = null, para = [];
  const flushPara = () => { if (para.length) { nodes.push(<p key={nodes.length}>{inline(para.join(' '), 'p' + nodes.length)}</p>); para = []; } };
  const flushList = () => { if (list) { const L = list; nodes.push(L.ordered
    ? <ol key={nodes.length}>{L.items.map((t, i) => <li key={i}>{inline(t, 'o' + i)}</li>)}</ol>
    : <ul key={nodes.length}>{L.items.map((t, i) => <li key={i}>{inline(t, 'u' + i)}</li>)}</ul>); list = null; } };

  for (const raw of lines) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { flushPara(); continue; }          // blank line: paragraph break (list may continue)
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      flushPara(); flushList();
      const H = 'h' + (m[1].length + 1);                   // # -> h2, ## -> h3, ### -> h4 (page title is the h1)
      nodes.push(<H key={nodes.length}>{inline(m[2], 'h' + nodes.length)}</H>);
    } else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      flushPara();
      if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] }; }
      list.items.push(m[1]);
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      flushPara();
      if (!list || !list.ordered) { flushList(); list = { ordered: true, items: [] }; }
      list.items.push(m[1]);
    } else if ((m = line.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/))) {   // image on its own line
      flushPara(); flushList();
      nodes.push(<img key={nodes.length} src={safeUrl(m[2])} alt={m[1]} className="w-img" />);
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      flushPara(); flushList();
      nodes.push(<blockquote key={nodes.length}>{inline(m[1], 'q' + nodes.length)}</blockquote>);
    } else { flushList(); para.push(line.trim()); }
  }
  flushPara(); flushList();
  return nodes;
}
