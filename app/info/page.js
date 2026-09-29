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

      <section id="privacy">
        <div className="sec-head"><h2>Privacy &amp; terms</h2></div>
        <p>We only store what you choose to post: your profile, ratings, comments and reviews. Be respectful to other fans, and don&apos;t post content you don&apos;t have the right to share. This section is a short summary and will be replaced with full terms before launch.</p>
      </section>
    </main>
  );
}
