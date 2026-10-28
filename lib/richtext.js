// Turns the text of a post into pieces the feed can render: plain text, #hashtags, @mentions and links.
// Only http(s) links are made clickable; everything else stays plain text (React escapes it).
const RE = /(https?:\/\/[\w\-.~:/?#\[\]@!$&'()*+,;=%]+)|(^|[^\w@])@([a-z0-9._]{3,30})|(^|[^\w#&])#([\p{L}\p{N}_]{2,50})/giu;

export function richParts(text) {
  const s = String(text ?? ''), out = []; let last = 0, m;
  const push = (t, extra) => { if (t) out.push({ t, ...extra }); };
  RE.lastIndex = 0;
  while ((m = RE.exec(s))) {
    push(s.slice(last, m.index), {});
    if (m[1]) {                                                      // link: keep trailing punctuation out of it
      let url = m[1], tail = '';
      const t = /[.,!?;:)\]]+$/.exec(url); if (t) { tail = t[0]; url = url.slice(0, -tail.length); }
      push(url, { link: url }); push(tail, {});
    } else if (m[3]) {                                               // @mention
      let h = m[3].toLowerCase(), tail = '';
      const t = /[._]+$/.exec(h); if (t) { tail = t[0]; h = h.slice(0, -tail.length); }
      push(m[2], {});
      if (h.length >= 3) push('@' + h, { handle: h }); else push('@' + h, {});
      push(tail, {});
    } else {                                                         // #hashtag
      push(m[4], {}); push('#' + m[5], { tag: m[5] });
    }
    last = m.index + m[0].length;
  }
  push(s.slice(last), {});
  return out;
}
