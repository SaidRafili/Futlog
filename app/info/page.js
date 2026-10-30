export const metadata = { title: 'About · Futlog' };

export default function Page() {
  return (
    <main className="info">
      <section id="about">
        <h1>About Futlog</h1>
        <p className="lead">Futlog is a diary for football fans. Log the matches you watch, rate them, write reviews, and see what other people made of the same 90 minutes.</p>
      </section>

      <section id="how">
        <div className="sec-head"><h2>What you can do</h2></div>
        <ul>
          <li>Search matches by team, competition or season, and mark them as watched or liked.</li>
          <li>Rate a match out of 10 and join the discussion in comments and reviews.</li>
          <li>Read match analysis and tactics articles from the community.</li>
          <li>Follow other fans and keep up with them in your feed.</li>
        </ul>
      </section>

      <section id="faq">
        <div className="sec-head"><h2>FAQ</h2></div>
        <div className="card"><b>Is Futlog free?</b><p>Yes. Browsing, logging and commenting are free.</p></div>
        <div className="card"><b>Where does the match data come from?</b><p>Team and match details are loaded from our own data files and are added by hand for now, so some matches may be missing.</p></div>
        <div className="card"><b>How do I report a mistake?</b><p>Use the contact details below and include a link to the match or article.</p></div>
      </section>

      <section id="contact">
        <div className="sec-head"><h2>Contact</h2></div>
        <p>Questions, corrections or ideas? Email <a className="lnk" href="mailto:hello@futlog.example">hello@futlog.example</a> or message us on <a className="lnk" href="https://x.com/futlog" target="_blank" rel="noopener noreferrer">X</a>.</p>
      </section>

      <section id="copyright">
        <div className="sec-head"><h2>Copyright &amp; author rights</h2><span className="muted">Last updated 30 October 2026</span></div>
        <div className="card"><b>What belongs to Futlog</b><p>The Futlog name, logo, site design, layout, source code, and the text we write ourselves (such as this page and our help content) are © 2026 Futlog. All rights reserved. You may not copy, resell or republish them without our written permission.</p></div>
        <div className="card"><b>What belongs to you</b><p>You keep full ownership and author rights over everything you post: your articles, reviews, comments, ratings, bio, profile photo, banner and post pictures. Futlog does not claim ownership of your work, and your name or username stays attached to it as its author.</p></div>
        <div className="card"><b>The licence you give us</b><p>To run the site, you give Futlog a free, non-exclusive, worldwide licence to store, display, resize and distribute your content on Futlog and in its previews (for example when a post is shared as a link). This licence only exists to operate the service, and it ends when you delete the content or your account, apart from copies that others have already quoted or shared, and routine backups that expire on their own schedule.</p></div>
        <div className="card"><b>Other people&apos;s content</b><p>Other members own what they post. Do not copy their articles, reviews or pictures elsewhere without their permission, other than short quotations with credit, as the law allows. Only post pictures, text or media that you created or have the right to share, and credit the source where one exists.</p></div>
        <div className="card"><b>Football names, crests and logos</b><p>Team names, club crests, competition logos and player names belong to their respective owners (clubs, leagues, federations and rights holders). They appear on Futlog only to identify teams and matches. Futlog is an independent fan project and is not affiliated with, sponsored by or endorsed by any club, league or governing body.</p></div>
        <div className="card"><b>Match facts and data</b><p>Facts such as fixtures, dates and final scores are not owned by anyone. Our selection, arrangement and descriptions of them, and the ratings and reviews on top of them, are protected as described above. We do not show match footage, broadcast images or commentary.</p></div>
        <div className="card"><b>Copyright complaints</b><p>If you believe something on Futlog copies your work or infringes your rights, email <a className="lnk" href="mailto:hello@futlog.example">hello@futlog.example</a> with a link to the content, a description of your work, and your contact details. We review reports promptly, may remove or disable the content while we do, and may close the accounts of people who repeatedly infringe.</p></div>
      </section>

      <section id="privacy">
        <div className="sec-head"><h2>Privacy &amp; terms</h2></div>
        <p>To create an account we store your name, username, email address and a securely hashed password (we never keep your password in readable form). We also store what you choose to post: your profile, ratings, comments, reviews, articles and pictures. We use a single sign-in cookie to keep you logged in, and we do not sell your personal data. Your email address is never shown publicly.</p>
        <p>By using Futlog you agree to be respectful to other fans, to post only content you have the right to share, and not to post anything unlawful, abusive or misleading. We may remove content or accounts that break these rules. You can edit or delete your posts and profile at any time. To have your account and data removed, email us at the address above. This is a short summary and will be replaced with full terms before launch; this page is not legal advice.</p>
      </section>
    </main>
  );
}
