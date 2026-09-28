/* ---------- sample data: replace with your API ---------- */
const T = { // team: name, abbreviation, color, text color
  rm:{n:'Real Madrid',s:'RMA',c:'#ffffff',t:'#111'}, fcb:{n:'Bayern Munich',s:'FCB',c:'#dc052d',t:'#fff'},
  bar:{n:'Barcelona',s:'BAR',c:'#a50044',t:'#fff'},   mci:{n:'Manchester City',s:'MCI',c:'#6cabdd',t:'#0b1a33'},
  ars:{n:'Arsenal',s:'ARS',c:'#ef0107',t:'#fff'},    liv:{n:'Liverpool',s:'LIV',c:'#c8102e',t:'#fff'},
  int:{n:'Inter',s:'INT',c:'#0a4a8c',t:'#fff'},      psg:{n:'Paris Saint-Germain',s:'PSG',c:'#004170',t:'#fff'},
  bvb:{n:'Borussia Dortmund',s:'BVB',c:'#fde100',t:'#111'}, atm:{n:'Atlético Madrid',s:'ATM',c:'#cb3524',t:'#fff'},
  mil:{n:'AC Milan',s:'MIL',c:'#111111',t:'#fb090b'}, juv:{n:'Juventus',s:'JUV',c:'#e8e8e8',t:'#111'}
};
const matches = [
  {id:1,h:'rm',a:'fcb',hs:4,as:2,comp:'UCL',stage:'Final',season:'23/24',img:''},
  {id:2,h:'mci',a:'ars',hs:2,as:2,comp:'Premier League',stage:'Round 33',season:'23/24'},
  {id:3,h:'bar',a:'rm',hs:3,as:2,comp:'La Liga',stage:'El Clásico',season:'23/24'},
  {id:4,h:'liv',a:'int',hs:1,as:0,comp:'UCL',stage:'Semi-final',season:'22/23'},
  {id:5,h:'psg',a:'bvb',hs:0,as:1,comp:'UCL',stage:'Semi-final',season:'23/24'},
  {id:6,h:'atm',a:'rm',hs:1,as:1,comp:'La Liga',stage:'Derby',season:'23/24'},
  {id:7,h:'mil',a:'juv',hs:2,as:0,comp:'Serie A',stage:'Round 30',season:'23/24'},
  {id:8,h:'fcb',a:'bar',hs:4,as:1,comp:'Bundesliga',stage:'Round 12',season:'22/23'},
  {id:9,h:'ars',a:'liv',hs:3,as:3,comp:'Premier League',stage:'Round 20',season:'22/23'},
  {id:10,h:'int',a:'mil',hs:1,as:2,comp:'Serie A',stage:'Derby',season:'22/23'},
  {id:11,h:'rm',a:'mci',hs:3,as:3,comp:'UCL',stage:'Quarter-final',season:'23/24'},
  {id:12,h:'bvb',a:'fcb',hs:2,as:2,comp:'Bundesliga',stage:'Der Klassiker',season:'23/24'}
];
const comments = [
  {u:'maria_10',ago:'2h',likes:214,m:1,text:'Best final in a decade. Nobody left their seat after the third goal.'},
  {u:'kenji',ago:'5h',likes:167,m:3,text:'The second half was pure chaos, and I loved every minute of it.'},
  {u:'tactician',ago:'1d',likes:129,m:11,text:'Two coaches, zero fear. This is why we watch the knockout rounds.'}
];
const articles = [
  {id:2,t:'How pressing traps are changing the Premier League',m:'Tactics · 6 min read'},
  {id:3,t:'The rise of the inverted full-back',m:'Analysis · 5 min read'},
  {id:4,t:'Ten young players to watch next season',m:'Scouting · 7 min read'}
];
const updates = [
  {t:'New match added: Real Madrid 4–2 Bayern Munich (UCL Final 23/24)',time:'2 hours ago',h:'match.html?id=1'},
  {t:'New article: What is the reason behind exceptional results of players from Latin America?',time:'Yesterday',h:'article.html?id=1'},
  {t:'Comments are now open on all matches',time:'3 days ago'}
];

/* ---------- helpers ---------- */
const NOEL=document.createElement('div'); // stands in for elements that live on other pages
const $ = id => document.getElementById(id)||NOEL;
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const byId = id => matches.find(m=>m.id===id);
const label = m => `${T[m.h].n} ${m.hs}–${m.as} ${T[m.a].n}, ${m.comp} ${m.stage} ${m.season}`;
const hue = s => [...s].reduce((a,c)=>a+c.charCodeAt(0),0)*37%360;

function matchCard(m){
  const h=T[m.h], a=T[m.a];
  const img = m.img ? `background-image:url('${esc(m.img)}'),linear-gradient(160deg,var(--a),var(--b));` : '';
  return `<a class="match" href="match.html?id=${m.id}" aria-label="${esc(label(m))}">
    <div class="m-top"><span>${esc(m.comp)} / ${esc(m.stage)}</span><span>${m.season}</span></div>
    <div class="m-photo" style="--a:${h.c};--b:${a.c};${img}"></div>
    <div class="m-score">
      <span style="background:${h.c};color:${h.t}">${cr(h)}${m.hs}</span>
      <span style="background:${a.c};color:${a.t}">${m.as}${cr(a)}</span>
    </div></a>`;
}
const cr=(t,x='')=>t.l?`<b class="crest logo${x}"><img src="${esc(t.l)}" alt="${esc(t.s)}" loading="lazy"></b>`:`<b class="crest${x}">${t.s}</b>`;
const mb=t=>t.l?`<i class="tlogo"><img src="${esc(t.l)}" alt="${esc(t.s)}" loading="lazy"></i>`:`<i style="background:${t.c};color:${t.t}">${t.s}</i>`;
const grid = list => list.map(matchCard).join('');

function commentCard(c){
  const m=byId(c.m), h=T[m.h], a=T[m.a];
  return `<article class="comment">
    <div class="c-head"><div class="c-avatar" style="background:hsl(${hue(c.u)} 55% 42%)">${esc(c.u[0].toUpperCase())}</div>
      <div><a class="c-name" href="profile.html?u=${c.u==='you'?'saidrafili':esc(c.u)}">${esc(c.u)}</a><div class="c-time">${c.ago} ago</div></div></div>
    <p class="c-text">“${esc(c.text)}”</p>
    <div class="c-foot">
      <a class="chip" href="match.html?id=${m.id}" aria-label="${esc(label(m))}">
        <span class="mini">${mb(h)}${m.hs}–${m.as}${mb(a)}</span>
        <span class="t">${esc(m.comp)} ${esc(m.stage)}</span></a>
      <button class="like" aria-pressed="false" data-n="${c.likes}"><svg width="15" height="15" viewBox="0 0 24 24"><path d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.700-8 11-8 11z"/></svg><span>${c.likes}</span></button>
    </div></article>`;
}

/* ---------- home ---------- */
$('topMatches').innerHTML = grid(matches.slice(0,6));
$('commentList').innerHTML = comments.map(commentCard).join('');
$('articleList').innerHTML = articles.map(a=>`<a href="article.html?id=${a.id}"><b>${esc(a.t)}</b><span>${esc(a.m)}</span></a>`).join('');
$('updates').innerHTML = updates.map(u=>`<li><a href="${u.h||'#'}">${esc(u.t)}</a><time>${u.time}</time></li>`).join('');

$('commentList').addEventListener('click',e=>{
  const b=e.target.closest('.like'); if(!b) return;
  const on=b.classList.toggle('on'); b.setAttribute('aria-pressed',on);
  b.querySelector('span').textContent = +b.dataset.n + (on?1:0);
});

/* ---------- search + results ---------- */
const uniq = k => [...new Set(matches.map(m=>m[k]))].sort();
const fill = (el,first,list) => el.innerHTML = `<option value="">${first}</option>` + list.map(v=>`<option>${esc(v)}</option>`).join('');
fill($('fLeague'),'League',uniq('comp'));
fill($('fSeason'),'Season',uniq('season'));

function search(q,league,season){
  // "real madrid vs bayern" -> both terms must appear in the match
  const terms = q.toLowerCase().split(/\s+(?:vs?\.?|-)\s+/).map(s=>s.trim()).filter(Boolean);
  return matches.filter(m=>{
    const hay = [T[m.h].n,T[m.a].n,m.comp,m.stage,m.season].join(' ').toLowerCase();
    return terms.every(t=>hay.includes(t)) && (!league||m.comp===league) && (!season||m.season===season);
  });
}
function showResults(q,league,season){
  $('home').hidden=true; $('matchPage').hidden=true; $('articlePage').hidden=true; $('results').hidden=false;
  $('q').value=q; $('rq').textContent=q;
  $('fLeague').value=league; $('fSeason').value=season;
  const r=search(q,league,season);
  $('resultGrid').innerHTML=grid(r);
  $('empty').hidden=r.length>0;
  $('empty').textContent=`No matches found for “${q}”. Try a team name like “Real Madrid”, or clear the filters.`;
}
function go(q,league='',season=''){
  const p=new URLSearchParams({q}); if(league)p.set('league',league); if(season)p.set('season',season);
  location.href='search.html?'+p;
}
$('searchForm').addEventListener('submit',e=>{e.preventDefault(); const q=$('q').value.trim(); if(q) go(q);});
[$('fLeague'),$('fSeason')].forEach(s=>s.addEventListener('change',()=>go($('q').value.trim(),$('fLeague').value,$('fSeason').value)));
$('allMatches').addEventListener('click',e=>{e.preventDefault(); go('');});
/* ---------- match page ---------- */
const COMPC={UCL:'#0b1f6b','La Liga':'#c63a1f','Premier League':'#3d195b','Serie A':'#0a5db0','Bundesliga':'#d20515'};
const COMPN={UCL:'UEFA Champions League'};
const V={rm:['Santiago Bernabéu','Madrid','Spain'],fcb:['Allianz Arena','Munich','Germany'],bar:['Camp Nou','Barcelona','Spain'],mci:['Etihad Stadium','Manchester','England'],ars:['Emirates Stadium','London','England'],liv:['Anfield','Liverpool','England'],int:['San Siro','Milan','Italy'],psg:['Parc des Princes','Paris','France'],bvb:['Signal Iduna Park','Dortmund','Germany'],atm:['Metropolitano','Madrid','Spain'],mil:['San Siro','Milan','Italy'],juv:['Allianz Stadium','Turin','Italy']};
const MON=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const fmt=n=>n>=1000?(n/1000).toFixed(n>=10000?0:1).replace(/\.0$/,'')+'k':String(n);
const ord=n=>n===1?'1st':n===2?'2nd':n===3?'3rd':n+'th';
const agoText=a=>/^\d/.test(a)?a+' ago':a;
const reviews=[
  {t:'The second half was the best 45 minutes of the season',u:'John Doe',ago:'2 hours ago',r:9},
  {t:'Tactical breakdown: how the midfield decided it',u:'ana_k',ago:'6 hours ago',r:8},
  {t:'The atmosphere nobody could have scripted',u:'faruk',ago:'1 day ago',r:9},
  {t:'Three things I noticed on the rewatch',u:'sam.w',ago:'2 days ago',r:7}
];
const fillers=[
  {u:'nina',ago:'3h',likes:48,text:'Watched it live. The stadium noise alone was worth it.'},
  {u:'omar',ago:'8h',likes:31,text:'Fair result, but the last ten minutes were far too stressful.'},
  {u:'lucas.fc',ago:'1d',likes:22,text:'Keeper of the match by a distance.'}
];
const MS={}; const st=id=>MS[id]||(MS[id]={watched:false,liked:false,rating:0,posted:[]});
let cur=null;

function detail(m){
  const b=new Date(Date.UTC(m.season==='22/23'?2023:2024,0,1)+m.id*17*864e5);
  const goals=[];
  for(let i=0;i<m.hs;i++)goals.push({min:(m.id*7+i*29)%86+3,t:m.h});
  for(let i=0;i<m.as;i++)goals.push({min:(m.id*11+i*31+13)%86+3,t:m.a});
  goals.sort((x,y)=>x.min-y.min);
  const views=8000+(m.id*7919)%40000;
  const key=x=>[x.h,x.a].sort().join();
  const pair=matches.filter(x=>key(x)===key(m));
  return {date:`${String(b.getUTCDate()).padStart(2,'0')} ${MON[b.getUTCMonth()]} ${String(b.getUTCFullYear()).slice(2)}`,
    goals,views,likes:Math.round(views*.27),ccount:300+(m.id*37)%2900,avg:6.5+((m.id*13)%30)/10,rcount:Math.round(views*.06),
    venue:V[m.h].join(' / '),pair,n:pair.indexOf(m)+1,att:(35000+(m.id*4111)%45000).toLocaleString('en-US'),ko:`${19+m.id%3}:${m.id%2?'00':'45'}`};
}

function showMatch(id){
  const m=byId(id); if(!m){location.href='index.html';return;}
  cur=m; const h=T[m.h],a=T[m.a],d=detail(m);
  $('home').hidden=true; $('results').hidden=true; $('articlePage').hidden=true; $('matchPage').hidden=false;
  document.title=`${h.n} ${m.hs}–${m.as} ${a.n} · Futlog`;
  for(const [el,t] of [[$('mpHome'),h],[$('mpAway'),a]]){
    el.style.cssText=`background:${t.c};color:${t.t}`;
    el.innerHTML=`${cr(t,' big')}${esc(t.n)}`;
  }
  $('mpDate').textContent=d.date; $('mpScore').textContent=`${m.hs} - ${m.as}`;
  const full=COMPN[m.comp]||m.comp;
  $('mpCred').innerHTML=`<div class="cred-strip" style="background:${COMPC[m.comp]||'#222'}">${esc(m.comp)}</div>
    <div class="cred-body"><div>${esc(m.stage)} / ${m.season}
      <small>${d.pair.length>1?`<span class="red">${ord(d.n)}</span> of ${d.pair.length} meetings on record`:`<span class="red">Only</span> meeting on record`}</small></div>
      <div>${esc(d.venue)}</div></div>
    <div class="emblem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="10"/><path d="M12 7l4 3-1.5 5h-5L8 10z"/></svg>${esc(full)}</div>`;
  const ph=$('mpPhoto'); ph.style.setProperty('--a',h.c); ph.style.setProperty('--b',a.c);
  ph.style.backgroundImage=m.img?`url('${esc(m.img)}')`:'';
  $('mpMore').innerHTML=`<dt>Kick-off</dt><dd>${d.ko}</dd><dt>Attendance</dt><dd>${d.att}</dd><dt>Competition</dt><dd>${esc(full)}</dd>`;
  $('mpGoals').innerHTML=d.goals.length?d.goals.map(g=>`<li><b>${g.min}'</b>${mb(T[g.t])}Goal</li>`).join(''):'<li>No goals</li>';
  $('mpReviews').innerHTML=reviews.map((r,i)=>{
    const col=r.r>=9?'#6ee7a0':r.r===8?'#ffd84a':'#ff9f6b';
    return `<a class="review" href="match.html?id=${m.id}" style="--stripe:${col};--a:${i%2?a.c:h.c};--b:${i%2?h.c:a.c}"><i></i>
      <div class="r-body"><h3>${esc(r.t)}</h3><div class="r-by"><span class="r-avatar" style="background:hsl(${hue(r.u)} 55% 42%)"></span>${esc(r.u)}<b>${r.r}/10</b></div><time>${r.ago}</time></div>
      <div class="r-thumb"></div></a>`}).join('');
  renderStats(); renderComments(); setTab('reviews'); scrollTo(0,0);
}

function renderStats(){
  const m=cur,d=detail(m),s=st(m.id);
  const ic={
    eye:'<svg viewBox="0 0 64 44"><path d="M2 22C10 8 22 2 32 2s22 6 30 20c-8 14-20 20-30 20S10 36 2 22z" fill="currentColor"/><circle cx="32" cy="22" r="11" fill="#030305"/><circle cx="32" cy="22" r="5" fill="currentColor"/></svg>',
    heart:'<svg viewBox="0 0 64 60"><path d="M32 58S4 40 4 20A14 14 0 0 1 32 14a14 14 0 0 1 28 6c0 20-28 38-28 38z" fill="currentColor"/></svg>',
    chat:'<svg viewBox="0 0 64 60"><path d="M6 6h52a4 4 0 0 1 4 4v30a4 4 0 0 1-4 4H30L14 58V44H6a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4z" fill="currentColor"/></svg>'};
  $('mpActions').innerHTML=`
    <button data-act="watch" class="${s.watched?'on':''}" aria-pressed="${s.watched}" aria-label="Watched" title="Mark as watched" style="color:var(--accent)">${ic.eye}<span>${fmt(d.views+(s.watched?1:0))}</span></button><i class="div"></i>
    <button data-act="like" class="${s.liked?'on':''}" aria-pressed="${s.liked}" aria-label="Like" title="Like this match" style="color:#ef2b3a">${ic.heart}<span>${fmt(d.likes+(s.liked?1:0))}</span></button><i class="div"></i>
    <button data-act="jump" class="on" aria-label="Go to comments" title="Go to comments" style="color:var(--accent)">${ic.chat}<span>${fmt(d.ccount+s.posted.length)}</span></button>`;
  const shown=s.rating||Math.round(d.avg);
  let segs=''; for(let i=10;i>=1;i--) segs+=`<button class="seg ${i<=shown?'on':''} ${s.rating?'mine':''}" data-act="rate" data-v="${i}" style="height:${8+i*2.6}px" aria-label="Rate ${i} out of 10"></button>`;
  const avg=s.rating?(d.avg*d.rcount+s.rating)/(d.rcount+1):d.avg;
  $('mpRate').innerHTML=`<div class="rate-bars" role="group" aria-label="Rate this match">${segs}</div>
    <div class="rate-text"><b>${avg.toFixed(1)}</b>average · ${fmt(d.rcount+(s.rating?1:0))} ratings<br>${s.rating?`You rated ${s.rating}/10 · tap it again to remove`:'Tap a bar to rate this match'}</div>`;
}

const mpComment=c=>`<article class="comment"><div class="c-head"><div class="c-avatar" style="background:hsl(${hue(c.u)} 55% 42%)">${esc(c.u[0].toUpperCase())}</div>
  <div><a class="c-name" href="profile.html?u=${c.u==='you'?'saidrafili':esc(c.u)}">${esc(c.u)}</a><div class="c-time">${agoText(c.ago)}</div></div></div>
  <p class="c-text">“${esc(c.text)}”</p>
  <div class="c-foot"><button class="like" aria-pressed="false" data-n="${c.likes}"><svg width="15" height="15" viewBox="0 0 24 24"><path d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z"/></svg><span>${c.likes}</span></button></div></article>`;
function renderComments(){
  $('mpComments').innerHTML=[...st(cur.id).posted,...comments.filter(c=>c.m===cur.id),...fillers].map(mpComment).join('');
}
function setTab(name){
  document.querySelectorAll('#mpTabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===name));
  $('panelComments').hidden=name!=='comments'; $('panelReviews').hidden=name!=='reviews';
}
$('matchPage').addEventListener('click',e=>{
  const lk=e.target.closest('.like');
  if(lk){const on=lk.classList.toggle('on'); lk.setAttribute('aria-pressed',on); lk.querySelector('span').textContent=+lk.dataset.n+(on?1:0); return;}
  const b=e.target.closest('[data-act]'); if(!b||!cur) return;
  const s=st(cur.id), act=b.dataset.act;
  if(act==='tab') return setTab(b.dataset.tab);
  if(act==='jump'){setTab('comments'); return $('mpTabs').scrollIntoView({behavior:'smooth'});}
  if(act==='watch') s.watched=!s.watched;
  if(act==='like') s.liked=!s.liked;
  if(act==='rate') s.rating = s.rating===+b.dataset.v ? 0 : +b.dataset.v;
  renderStats();
});
$('mpForm').addEventListener('submit',e=>{
  e.preventDefault(); const text=$('mpInput').value.trim(); if(!text||!cur) return;
  st(cur.id).posted.unshift({u:'you',ago:'just now',likes:0,text}); // TODO: send to your backend
  $('mpInput').value=''; renderComments(); renderStats();
});

/* ---------- article page ---------- */
const AUTH=[
  {n:'Said Rafili',h:'saidrafili',bio:'I am a football fan who is keen to analyze each segment of football based on 90 minutes of time we are left with'},
  {n:'Nora Wells',h:'nora.wells',bio:'Writes about pressing, shape and the small details that decide matches.'},
  {n:'Tomas Reyes',h:'tomasreyes',bio:'Covers youth football and the scouting stories behind tomorrow’s stars.'},
  {n:'Ana Kowal',h:'anakowal',bio:'Tactics analyst. Believes every full-back deserves a heat map.'}];
const LOREM=[
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.',
  'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.'];
const allArticles=[
  {id:1,t:'What is the reason behind exceptional results of players from Latin America?',m:'Analysis · 8 min read',au:0,ms:[3,6],body:[
    'Every few years the same question comes back: why do so many decisive players in world football come from Latin America? The easy answers are talent and passion. They are not wrong, but they explain very little.',
    'Start with where the game is learned. In many neighbourhoods across the region, football begins in the street, in small spaces, on uneven surfaces and with no referee. Players learn to solve problems in tight spaces long before anyone teaches them a formation.',
    'Then there is the pathway. Local clubs often sell young players early, which creates a culture where a teenager has to perform in senior football almost immediately. The pressure is real, and so is the education it offers.',
    'None of this is a formula, and it would be a mistake to romanticise it. The same system leaves many talented players behind. What the results suggest is not magic but a different kind of early practice, which this article looks at through three examples.',
    ...LOREM.slice(0,1)]},
  ...articles.map((a,i)=>({...a,au:i+1,ms:[[1,11],[8,12],[2,9]][i],body:LOREM}))
];
const AS={}; const ast=id=>AS[id]||(AS[id]={liked:false,saved:false,posted:[]});
const FOLLOW=new Set(); let curA=null;
const ARI={
  heart:'<svg viewBox="0 0 24 24"><path d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z"/></svg>',
  chat:'<svg viewBox="0 0 24 24"><path d="M4 4h16v12H9l-5 4z"/></svg>',
  share:'<svg viewBox="0 0 24 24"><path d="M4 12v8h16v-8M12 3v13M7 8l5-5 5 5"/></svg>',
  save:'<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg>'};

function showArticle(id){
  const a=allArticles.find(x=>x.id===id); if(!a){location.href='index.html';return;}
  curA=a; const au=AUTH[a.au];
  $('home').hidden=true; $('results').hidden=true; $('matchPage').hidden=true; $('articlePage').hidden=false;
  document.title=`${a.t} · Futlog`;
  $('arHero').style.backgroundImage=a.img?`url('${esc(a.img)}')`:'';
  $('arTitle').textContent=a.t;
  const [cat,read]=a.m.split(' · ');
  const date=new Date(Date.UTC(2026,5,28-a.id*3)).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'2-digit',timeZone:'UTC'});
  $('arBy').innerHTML=`<a href="profile.html?u=${esc(au.h)}">${esc(au.n)}</a> <span>· ${esc(cat)} · ${date} · ${esc(read)}</span>`;
  $('arBody').innerHTML=a.body.map(p=>`<p>${esc(p)}</p>`).join('');
  renderArSide(); renderArComments(); scrollTo(0,0);
}
function renderArSide(){
  const a=curA, au=AUTH[a.au], s=ast(a.id), f=FOLLOW.has(a.au);
  $('arSide').innerHTML=`
    <div class="ar-author">
      <a class="ar-av" href="profile.html?u=${esc(au.h)}" style="background:hsl(${hue(au.n)} 45% 38%)">${esc(au.n[0])}</a><div class="ar-bar"></div>
      <div><h3><a href="profile.html?u=${esc(au.h)}">${esc(au.n)}</a></h3><div class="handle">@${esc(au.h)}</div><p>${esc(au.bio)}</p>
        <button class="follow ${f?'on':''}" data-act="afollow" aria-pressed="${f}">${f?'Following':'Follow'}</button></div>
    </div>
    <div class="ar-actions">
      <button class="${s.liked?'on':''}" data-act="alike" aria-pressed="${s.liked}">${ARI.heart}<span>${fmt(900+a.id*310+(s.liked?1:0))}</span></button>
      <button data-act="ajump">${ARI.chat}<span>${fmt(20+a.id*7+s.posted.length)}</span></button>
      <button data-act="ashare">${ARI.share}<span>Share</span></button>
      <button class="${s.saved?'on':''}" data-act="asave" aria-pressed="${s.saved}">${ARI.save}<span>${s.saved?'Saved':'Save'}</span></button>
    </div>
    <div><h4>Matches in this article</h4><div class="ar-matches">${a.ms.map(i=>matchCard(byId(i))).join('')}</div></div>`;
}
function renderArComments(){
  $('arCommentList').innerHTML=[...ast(curA.id).posted,...fillers].map(mpComment).join('');
}
$('articlePage').addEventListener('click',e=>{
  const lk=e.target.closest('.like');
  if(lk){const on=lk.classList.toggle('on'); lk.setAttribute('aria-pressed',on); lk.querySelector('span').textContent=+lk.dataset.n+(on?1:0); return;}
  const b=e.target.closest('[data-act]'); if(!b||!curA) return;
  const s=ast(curA.id), act=b.dataset.act;
  if(act==='ajump') return $('arCommentsHead').scrollIntoView({behavior:'smooth'});
  if(act==='ashare'){
    navigator.clipboard?.writeText(location.href).catch(()=>{});
    const t=b.querySelector('span'); t.textContent='Link copied';
    setTimeout(()=>{ if(b.isConnected) t.textContent='Share'; },1600); return;
  }
  if(act==='alike') s.liked=!s.liked;
  if(act==='asave') s.saved=!s.saved;
  if(act==='afollow') FOLLOW.has(curA.au)?FOLLOW.delete(curA.au):FOLLOW.add(curA.au);
  renderArSide();
});
$('arForm').addEventListener('submit',e=>{
  e.preventDefault(); const text=$('arInput').value.trim(); if(!text||!curA) return;
  ast(curA.id).posted.unshift({u:'you',ago:'just now',likes:0,text}); // TODO: send to your backend
  $('arInput').value=''; renderArComments(); renderArSide();
});
addEventListener('scroll',()=>{
  if($('articlePage').hidden) return;
  const h=document.documentElement;
  $('arProg').style.width=Math.min(100,scrollY/((h.scrollHeight-innerHeight)||1)*100)+'%';
},{passive:true});

/* ---------- profile page ---------- */
const POOL=['maria_10','kenji','tactician','nina','omar','lucas.fc','ana_k','faruk','sam.w','nora.wells','tomasreyes','anakowal','saidrafili'];
const REVT=['The second half was the best 45 minutes of the season','Tactical breakdown: how the midfield decided it','The atmosphere nobody could have scripted','Three things I noticed on the rewatch','Why the result flattered one side','A night the stadium will not forget'];
const PTABS=[['matches','Matches'],['liked','Liked'],['reviews','Reviews'],['followers','Followers'],['following','Followings'],['articles','Articles'],['about','About'],['onsite','On-site']];
const SORTS=[['new','Newest'],['old','Oldest'],['az','A–Z']];
const PU={},PF=new Set(); let PR={h:'',tab:'',q:'',f:'',s:'new'};
const aIdx=h=>AUTH.findIndex(a=>a.h===h);
const fol=h=>aIdx(h)>=0?FOLLOW.has(aIdx(h)):PF.has(h);
const tog=h=>{const i=aIdx(h),S=i>=0?FOLLOW:PF,k=i>=0?i:h; S.has(k)?S.delete(k):S.add(k);};
const ago=d=>d===1?'1 day ago':d+' Days ago';
function getUser(h){
  if(PU[h])return PU[h];
  const ai=aIdx(h), seed=[...h].reduce((s,c)=>(s*31+c.charCodeAt(0))%100003,7);
  const r=(k,n)=>(seed*(k+5)*(k+11)+k*7919)%n;
  const name=ai>=0?AUTH[ai].n:(h.replace(/[._\d]+/g,' ').trim().replace(/\b\w/g,c=>c.toUpperCase())||h);
  const watched=matches.filter((m,k)=>h==='saidrafili'||r(k,5)<3);
  const pick=(k,n)=>{const l=watched.filter((m,i)=>r(i+k,n)===0);return l.length?l:watched.slice(0,1)};
  const others=POOL.filter(p=>p!==h), list=(k)=>{const l=others.filter((p,i)=>r(i+k,2)===0);return l.length>2?l:others.slice(0,3)};
  return PU[h]={h,name,watched,onsite:pick(20,6),liked:pick(40,3),
    reviews:watched.slice(0,1+r(3,4)).map((m,i)=>({t:REVT[(i+r(4,6))%6],m,r:6+r(i+30,5),d:2+r(m.id+50,60)})),
    followers:list(60),following:list(80),arts:allArticles.filter(a=>AUTH[a.au].h===h),
    bio:ai>=0?AUTH[ai].bio:'Football fan. Here for the matches, the arguments and the replays.',
    fav:T[Object.keys(T)[r(9,12)]],loc:['Baku','Madrid','Manchester','Milan','Munich','Lisbon'][r(10,6)],joined:2019+r(11,6)};
}
function showProfile(h,tab){
  if(!PTABS.some(t=>t[0]===tab))tab='matches';
  for(const id of ['home','results','matchPage','articlePage'])$(id).hidden=true;
  $('profilePage').hidden=false;
  const u=getUser(h); document.title=`${u.name} (@${h}) · Futlog`;
  if(PR.h!==h||PR.tab!==tab)PR={h,tab,q:'',f:'',s:'new'};
  $('pfCover').style.setProperty('--h',hue(h));
  $('pfSide').innerHTML=PTABS.map(([k,l])=>`<a href="profile.html?u=${esc(h)}&tab=${k}" class="${k===tab?'on':''}">${l}</a>`).join('');
  renderPfHead(); renderPfTools(); renderPfList(); scrollTo(0,0);
}
function renderPfHead(){
  const u=getUser(PR.h), me=u.h==='saidrafili';
  const st=[['matches',u.watched.length,'Matches'],['onsite',u.onsite.length,'On-site'],['liked',u.liked.length,'Liked'],['reviews',u.reviews.length,'Reviews']];
  $('pfHead').innerHTML=`<div class="pf-av" style="background:hsl(${hue(u.name)} 45% 38%)">${esc(u.name[0])}</div>
    <div class="pf-id"><h1>${esc(u.name)}</h1><div class="handle">@${esc(u.h)}</div>${me?'':followBtn(u.h)}</div>
    <div class="pf-stats">${st.map(([k,n,l])=>`<a href="profile.html?u=${esc(u.h)}&tab=${k}"><b>${n}</b>${l}</a>`).join('')}</div>`;
}
const followBtn=h=>`<button class="follow ${fol(h)?'on':''}" data-follow="${esc(h)}" style="margin-top:6px">${fol(h)?'Following':'Follow'}</button>`;
function renderPfTools(){
  const t=PR.tab, opts=['matches','liked','onsite'].includes(t)?['League',...uniq('comp')].map((c,i)=>[i?c:'',c]):t==='reviews'?[['','All ratings'],['8','8+ rating'],['9','9+ rating']]:null;
  $('pfTools').innerHTML=`<input id="pfQ" type="search" placeholder="Search" aria-label="Search this page" value="${esc(PR.q)}"><span class="sp"></span>
    ${opts?`<select id="pfF" aria-label="Filter">${opts.map(([v,l])=>`<option value="${esc(v)}" ${v===PR.f?'selected':''}>${esc(l)}</option>`).join('')}</select>`:''}
    <button id="pfS">Sort by: ${SORTS.find(x=>x[0]===PR.s)[1]} ⇅</button>`;
}
const pcard=(href,t,meta,d,a,b)=>`<a class="pcard" href="${href}"><div class="pc-img" style="--a:${a};--b:${b}"></div><h3>${esc(t)}</h3><div class="pc-m"><span>${esc(meta)}</span><time>${ago(d)}</time></div></a>`;
const ucard=h=>{const u=getUser(h);return `<div class="ucard"><a class="uc-l" href="profile.html?u=${esc(h)}"><span class="c-avatar" style="background:hsl(${hue(u.name)} 45% 38%)">${esc(u.name[0])}</span><span><b>${esc(u.name)}</b><small>@${esc(h)}</small></span></a>${h==='saidrafili'?'':followBtn(h)}</div>`};
function renderPfList(){
  const u=getUser(PR.h), t=PR.tab, q=PR.q.toLowerCase(); let items=[], mode='cards';
  const dOf=m=>1+(m.id*37+u.h.length*11)%90;
  if(['matches','liked','onsite'].includes(t)){mode='grid';items=({matches:u.watched,liked:u.liked,onsite:u.onsite})[t].map(m=>({d:dOf(m),x:label(m),f:m.comp,html:matchCard(m)}));}
  else if(t==='reviews')items=u.reviews.map(v=>({d:v.d,x:v.t+' '+label(v.m),f:v.r,html:pcard('match.html?id='+v.m.id,v.t,`${T[v.m.h].n} ${v.m.hs}–${v.m.as} ${T[v.m.a].n} · ${v.r}/10`,v.d,T[v.m.h].c,T[v.m.a].c)}));
  else if(t==='articles')items=u.arts.map(a=>({d:a.id*6,x:a.t,html:pcard('article.html?id='+a.id,a.t,a.m,a.id*6,`hsl(${hue(a.t)} 50% 35%)`,`hsl(${hue(a.t)+60} 50% 25%)`)}));
  else if(t==='followers'||t==='following'){mode='users';items=u[t].map(h=>({d:0,x:getUser(h).name+' '+h,html:ucard(h)}));}
  else{
    const rec=u.watched.slice(0,3);
    $('pfList').innerHTML=`<div class="pf-about"><p>${esc(u.bio)}</p><dl><dt>Joined</dt><dd>${u.joined}</dd><dt>Location</dt><dd>${u.loc}</dd>
      <dt>Favourite team</dt><dd><a href="search.html?q=${encodeURIComponent(u.fav.n)}">${esc(u.fav.n)}</a></dd><dt>Recently watched</dt><dd>${rec.map(m=>`<a href="match.html?id=${m.id}">${esc(label(m))}</a>`).join('<br>')}</dd></dl>
      <div class="pf-chips">${PTABS.slice(0,6).map(([k,l])=>`<a href="profile.html?u=${esc(u.h)}&tab=${k}">${l}</a>`).join('')}</div></div>`;
    return;
  }
  if(PR.f)items=items.filter(i=>t==='reviews'?i.f>=+PR.f:i.f===PR.f);
  if(q)items=items.filter(i=>i.x.toLowerCase().includes(q));
  items.sort(PR.s==='az'?(a,b)=>a.x.localeCompare(b.x):PR.s==='old'?(a,b)=>b.d-a.d:(a,b)=>a.d-b.d);
  $('pfList').innerHTML=items.length?`<div class="${mode==='grid'?'match-grid':mode==='users'?'pf-users':'pf-cards'}">${items.map(i=>i.html).join('')}</div>`
    :`<p class="empty">${q||PR.f?'Nothing matches your search or filter.':`${esc(u.name)} has nothing here yet.`}</p>`;
}
$('profilePage').addEventListener('input',e=>{if(e.target.id==='pfQ'){PR.q=e.target.value;renderPfList();}});
$('profilePage').addEventListener('change',e=>{if(e.target.id==='pfF'){PR.f=e.target.value;renderPfList();}});
$('profilePage').addEventListener('click',e=>{
  if(e.target.closest('#pfS')){PR.s=SORTS[(SORTS.findIndex(x=>x[0]===PR.s)+1)%3][0];renderPfTools();renderPfList();return;}
  const b=e.target.closest('[data-follow]'); if(b){tog(b.dataset.follow);renderPfHead();renderPfList();}
});
document.querySelector('.avatar-btn').addEventListener('click',()=>location.href='profile.html?u=saidrafili');

/* ---------- teams.json ---------- */
// Each team is added to T under the key "t<teamId>" (e.g. t3), so matches can use { h:'t3', a:'t4', ... }
async function loadTeams(url='teams.json'){
  try{
    const res=await fetch(url); if(!res.ok) throw new Error(res.status);
    for(const x of await res.json()){
      const c='#'+String(x.color||'333333').padStart(6,'0');
      const n=parseInt(c.slice(1),16), lum=((n>>16)*299+((n>>8)&255)*587+(n&255)*114)/1000;
      T['t'+x.teamId]={id:x.teamId,n:x.displayName||x.name,s:x.abbreviation,c,t:lum>150?'#111':'#fff',
        alt:'#'+String(x.alternateColor||'000000').padStart(6,'0'),l:x.logoURL,slug:x.slug,venueId:x.venueId,short:(x.shortDisplayName||'').trim()};
    }
    if(typeof route==='function') route(); // re-render with the loaded teams
  }catch(err){ console.warn('Could not load '+url+' (use a local server, not file://):',err); }
}
/* ---------- feed ---------- */
const FT=['Best final in a decade. Nobody left their seat after the third goal.','The second half was pure chaos, and I loved every minute of it.','Two coaches, zero fear. This is why we watch the knockout rounds.','That equaliser came from nowhere. Still shaking.','Keeper of the match by a distance.','Watched it in a bar full of rivals. Never heard a quieter room.','Fair result, but the last ten minutes were far too stressful.','The midfield battle decided this and nobody is talking about it.','Would pay double to see that rematch.','Referee had a decent game for once.','Rewatching the build-up to the second goal. Perfect movement.','That atmosphere is why I love this sport.'];
const FR=['Agreed, the tempo was unreal.','Not sure about that, but fair point.','Rewatching it right now.','This is the take.'];
const FEED=FT.map((text,i)=>({id:i+1,u:POOL[i%12],m:matches[(i*5)%12].id,min:[12,35,90,180,300,600,900,1500,2200,3000,4200,6000][i],likes:20+(i*53)%230,text,
  rep:i%2?[]:[{u:POOL[(i+3)%12],text:FR[i%4],min:i*7+5}]}));
const FS={tab:'latest',m:0,liked:new Set(),open:new Set()}; let fid=100;
const tAgo=n=>n<1?'just now':n<60?n+'m':n<1440?Math.floor(n/60)+'h':Math.floor(n/1440)+'d';
const uHref=u=>'profile.html?u='+(u==='you'?'saidrafili':esc(u));
const fdMatch=m=>{const h=T[m.h],a=T[m.a];return `<a class="p-match" href="match.html?id=${m.id}" style="--a:${h.c};--b:${a.c}" aria-label="${esc(label(m))}"><span class="mini">${mb(h)}${m.hs}–${m.as}${mb(a)}</span><span>${esc(m.comp)} · ${esc(m.stage)} · ${m.season}</span></a>`};
const ICO={heart:'<svg width="15" height="15" viewBox="0 0 24 24"><path d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z"/></svg>',chat:'<svg width="15" height="15" viewBox="0 0 24 24"><path d="M4 4h16v12H9l-5 4z"/></svg>',link:'<svg width="15" height="15" viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>'};
$('fdMatch').innerHTML='<option value="0">Tag a match (optional)</option>'+matches.map(m=>`<option value="${m.id}">${esc(label(m))}</option>`).join('');
function showFeed(){
  for(const id of ['home','results','matchPage','articlePage']) $(id).hidden=true;
  $('feedPage').hidden=false; document.title='Feed · Futlog'; renderFeed(); scrollTo(0,0);
}
function renderFeed(){
  document.querySelectorAll('#fdTabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.v===FS.tab));
  const lk=p=>p.likes+(FS.liked.has(p.id)?1:0);
  let l=FEED.filter(p=>(!FS.m||p.m===FS.m)&&(FS.tab!=='following'||fol(p.u)));
  l.sort(FS.tab==='top'?(a,b)=>lk(b)-lk(a):(a,b)=>a.min-b.min);
  $('fdFilter').hidden=!FS.m; if(FS.m) $('fdFilter').innerHTML=`Showing posts about <b>${esc(label(byId(FS.m)))}</b><button data-fa="clear">Clear</button>`;
  $('fdList').innerHTML=l.length?l.map(p=>{
    const m=p.m&&byId(p.m), open=FS.open.has(p.id), un=getUser(p.u).name;
    return `<article class="post" style="--hc:hsl(${hue(p.u)} 55% 45%)"><a class="p-av" href="${uHref(p.u)}" style="background:hsl(${hue(p.u)} 55% 42%)">${esc(un[0])}</a>
      <div><div class="p-top"><a href="${uHref(p.u)}">${esc(un)}</a><small>@${esc(p.u)}</small><time>${tAgo(p.min)}</time></div>
      <p class="p-text">${esc(p.text)}</p>${m?fdMatch(m):''}
      <div class="p-acts"><button data-fa="like" data-id="${p.id}" class="${FS.liked.has(p.id)?'on':''}" aria-pressed="${FS.liked.has(p.id)}">${ICO.heart}${lk(p)}</button>
        <button data-fa="reply" data-id="${p.id}" class="${open?'on':''}">${ICO.chat}${p.rep.length}</button>
        <button data-fa="share" data-id="${p.id}">${ICO.link}<span>Share</span></button></div>
      ${open?`<div class="replies">${p.rep.map(r=>`<div><b><a href="${uHref(r.u)}">${esc(r.u)}</a></b><span>${tAgo(r.min)}</span><br>${esc(r.text)}</div>`).join('')}
        <form data-id="${p.id}"><input placeholder="Write a reply" aria-label="Write a reply" maxlength="280"><button>Reply</button></form></div>`:''}
      </div></article>`}).join(''):`<p class="empty">${FS.tab==='following'?'Follow some people and their posts will show up here.':'No posts yet. Be the first.'}</p>`;
  const cnt={}; FEED.forEach(p=>p.m&&(cnt[p.m]=(cnt[p.m]||0)+1));
  const hot=Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id])=>byId(+id));
  const sug=POOL.filter(x=>x!=='saidrafili'&&!fol(x)).slice(0,3);
  $('fdSide').innerHTML=`<div class="fd-box"><h2>Hot matches</h2>${hot.map(m=>`<button class="hm ${FS.m===m.id?'on':''}" data-fa="hot" data-id="${m.id}">${esc(T[m.h].n)} ${m.hs}–${m.as} ${esc(T[m.a].n)}<span>${cnt[m.id]}</span></button>`).join('')}</div>
    <div class="fd-box"><h2>Who to follow</h2>${sug.map(ucard).join('')||'<span style="color:var(--muted)">You follow everyone.</span>'}</div>`;
}
$('feedPage').addEventListener('click',e=>{
  const fb=e.target.closest('[data-follow]'); if(fb){tog(fb.dataset.follow);return renderFeed();}
  const b=e.target.closest('[data-fa]'); if(!b) return; const a=b.dataset.fa, id=+b.dataset.id;
  if(a==='tab') FS.tab=b.dataset.v;
  else if(a==='clear') FS.m=0;
  else if(a==='hot') FS.m=FS.m===id?0:id;
  else if(a==='like') FS.liked.has(id)?FS.liked.delete(id):FS.liked.add(id);
  else if(a==='reply') FS.open.has(id)?FS.open.delete(id):FS.open.add(id);
  else if(a==='share'){navigator.clipboard?.writeText(location.origin+location.pathname).catch(()=>{});const t=b.querySelector('span');t.textContent='Link copied';return setTimeout(()=>{if(b.isConnected)t.textContent='Share'},1600);}
  renderFeed();
});
$('feedPage').addEventListener('submit',e=>{
  e.preventDefault();
  if(e.target.id==='fdForm'){
    const text=$('fdInput').value.trim(); if(!text) return;
    FEED.unshift({id:++fid,u:'you',m:+$('fdMatch').value,min:0,likes:0,text,rep:[]}); // TODO: send to your backend
    $('fdInput').value=''; $('fdMatch').value='0'; FS.tab='latest'; return renderFeed();
  }
  const inp=e.target.querySelector('input'), text=inp.value.trim(); if(!text) return;
  FEED.find(p=>p.id===+e.target.dataset.id).rep.push({u:'you',text,min:0}); renderFeed();
});


