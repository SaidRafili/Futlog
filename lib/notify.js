// Server-only: "someone replied to you" e-mails. Called after a comment has been saved; failures are logged, never thrown.
import { query } from './db';
import { mailEnabled, sendMail } from './mail';
import { siteUrl } from './siteurl';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clip = (s, n) => { const t = String(s).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

// Who should hear about the new comment, and what to call it:
//   replying to a comment -> that comment's author; commenting on a post / article / review -> its author. Matches have no owner.
async function recipientFor(c, repliedToId) {
  if (repliedToId) {
    const { rows } = await query(
      `SELECT u.user_id, u.email, u.display_name, u.notify_replies, x.body AS snippet
         FROM comments x JOIN users u ON u.user_id = x.user_id WHERE x.comment_id = $1`, [repliedToId]);
    return rows[0] && { ...rows[0], what: 'comment', verb: 'replied to' };
  }
  const t = {
    post: [`SELECT u.user_id, u.email, u.display_name, u.notify_replies, x.body AS snippet FROM posts x JOIN users u ON u.user_id = x.user_id WHERE x.post_id = $1`, 'post', 'replied to'],
    article: [`SELECT u.user_id, u.email, u.display_name, u.notify_replies, x.title AS snippet FROM articles x JOIN users u ON u.user_id = x.author_id WHERE x.article_id = $1`, 'article', 'commented on'],
    review: [`SELECT u.user_id, u.email, u.display_name, u.notify_replies, x.title AS snippet FROM reviews x JOIN users u ON u.user_id = x.user_id WHERE x.review_id = $1`, 'review', 'commented on'],
  }[c.target_type];
  if (!t) return null;
  const { rows } = await query(t[0], [c.target_id]);
  return rows[0] && { ...rows[0], what: t[1], verb: t[2] };
}

export async function notifyComment(commentId, repliedToId = null) {
  try {
    if (!mailEnabled()) return;
    const { rows } = await query(
      `SELECT c.comment_id, c.user_id, c.target_type, c.target_id, c.body, u.handle, u.display_name
         FROM comments c JOIN users u ON u.user_id = c.user_id WHERE c.comment_id = $1`, [commentId]);
    const c = rows[0]; if (!c) return;
    const to = await recipientFor(c, repliedToId);
    if (!to || !to.email || to.notify_replies === false) return;           // no address, or they switched it off in Settings
    if (String(to.user_id) === String(c.user_id)) return;                  // never e-mail people about their own words

    const base = siteUrl().origin;
    let path = { post: `/post/${c.target_id}`, article: `/article/${c.target_id}`, match: `/match/${c.target_id}` }[c.target_type];
    if (c.target_type === 'review') {
      const r = (await query('SELECT match_id FROM reviews WHERE review_id = $1', [c.target_id])).rows[0];
      path = r ? `/match/${r.match_id}` : '/';
    }
    const link = `${base}${path}#comment-${c.comment_id}`, settings = `${base}/settings`;
    const who = c.display_name, subject = `${who} ${to.verb} your ${to.what} on Futlog`;
    const mine = clip(to.snippet, 120), theirs = clip(c.body, 500);

    const text = `Hi ${to.display_name},\n\n${who} (@${c.handle}) ${to.verb} your ${to.what}:\n\n"${theirs}"\n\nIn reply to: "${mine}"\n\nOpen the conversation: ${link}\n\n—\nYou get this because e-mail notifications are on. Turn them off any time: ${settings}\n`;
    const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1b1b1f">
  <p>Hi ${esc(to.display_name)},</p>
  <p><b>${esc(who)}</b> <span style="color:#666">(@${esc(c.handle)})</span> ${esc(to.verb)} your ${esc(to.what)}:</p>
  <blockquote style="margin:12px 0;padding:10px 14px;border-left:4px solid #6d4aff;background:#f4f2ff;white-space:pre-wrap">${esc(theirs)}</blockquote>
  <p style="color:#666;font-size:13px">In reply to: “${esc(mine)}”</p>
  <p><a href="${esc(link)}" style="display:inline-block;background:#6d4aff;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">View the conversation</a></p>
  <p style="color:#888;font-size:12px;margin-top:28px">You get this because e-mail notifications are on. <a href="${esc(settings)}" style="color:#888">Turn them off in Settings</a>.</p>
</div>`;
    await sendMail({ to: to.email, subject, text, html });
  } catch (err) { console.error('[notify] failed:', err.message); }
}
