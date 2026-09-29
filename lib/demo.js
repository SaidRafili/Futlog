// Demo content (ported from app.js). Replace with real data / an API later.
export const POOL = ['maria_10','kenji','tactician','nina','omar','lucas.fc','ana_k','faruk','sam.w','nora.wells','tomasreyes','anakowal','saidrafili'];

export const baseComments = [
  {u:'maria_10',ago:'2h',likes:214,m:1,text:'Best final in a decade. Nobody left their seat after the third goal.'},
  {u:'kenji',ago:'5h',likes:167,m:3,text:'The second half was pure chaos, and I loved every minute of it.'},
  {u:'tactician',ago:'1d',likes:129,m:11,text:'Two coaches, zero fear. This is why we watch the knockout rounds.'}
];
export const articles = [
  {id:2,t:'How pressing traps are changing the Premier League',m:'Tactics · 6 min read'},
  {id:3,t:'The rise of the inverted full-back',m:'Analysis · 5 min read'},
  {id:4,t:'Ten young players to watch next season',m:'Scouting · 7 min read'}
];
export const baseUpdates = [
  {t:'New match added: Real Madrid 4–2 Bayern Munich (UCL Final 23/24)',time:'2 hours ago',h:'/match/1'},
  {t:'New article: What is the reason behind exceptional results of players from Latin America?',time:'Yesterday',h:'/article/1'},
  {t:'Comments are now open on all matches',time:'3 days ago'}
];

export const COMPC = {UCL:'#0b1f6b','La Liga':'#c63a1f','Premier League':'#3d195b','Serie A':'#0a5db0','Bundesliga':'#d20515'};
export const COMPN = {UCL:'UEFA Champions League'};
export const MON = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

export const reviews = [
  {t:'The second half was the best 45 minutes of the season',u:'John Doe',ago:'2 hours ago',r:9},
  {t:'Tactical breakdown: how the midfield decided it',u:'ana_k',ago:'6 hours ago',r:8},
  {t:'The atmosphere nobody could have scripted',u:'faruk',ago:'1 day ago',r:9},
  {t:'Three things I noticed on the rewatch',u:'sam.w',ago:'2 days ago',r:7}
];
export const fillers = [
  {u:'nina',ago:'3h',likes:48,text:'Watched it live. The stadium noise alone was worth it.'},
  {u:'omar',ago:'8h',likes:31,text:'Fair result, but the last ten minutes were far too stressful.'},
  {u:'lucas.fc',ago:'1d',likes:22,text:'Keeper of the match by a distance.'}
];

export const AUTH = [
  {n:'Said Rafili',h:'saidrafili',bio:'I am a football fan who is keen to analyze each segment of football based on 90 minutes of time we are left with'},
  {n:'Nora Wells',h:'nora.wells',bio:'Writes about pressing, shape and the small details that decide matches.'},
  {n:'Tomas Reyes',h:'tomasreyes',bio:'Covers youth football and the scouting stories behind tomorrow’s stars.'},
  {n:'Ana Kowal',h:'anakowal',bio:'Tactics analyst. Believes every full-back deserves a heat map.'}
];
export const LOREM = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.',
  'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.'
];
export const baseArticles = [
  {id:1,t:'What is the reason behind exceptional results of players from Latin America?',m:'Analysis · 8 min read',au:0,ms:[3,6],body:[
    'Every few years the same question comes back: why do so many decisive players in world football come from Latin America? The easy answers are talent and passion. They are not wrong, but they explain very little.',
    'Start with where the game is learned. In many neighbourhoods across the region, football begins in the street, in small spaces, on uneven surfaces and with no referee. Players learn to solve problems in tight spaces long before anyone teaches them a formation.',
    'Then there is the pathway. Local clubs often sell young players early, which creates a culture where a teenager has to perform in senior football almost immediately. The pressure is real, and so is the education it offers.',
    'None of this is a formula, and it would be a mistake to romanticise it. The same system leaves many talented players behind. What the results suggest is not magic but a different kind of early practice, which this article looks at through three examples.',
    ...LOREM.slice(0,1)]},
  ...articles.map((a,i)=>({...a,au:i+1,ms:[[1,11],[8,12],[2,9]][i],body:LOREM}))
];

export const REVT = ['The second half was the best 45 minutes of the season','Tactical breakdown: how the midfield decided it','The atmosphere nobody could have scripted','Three things I noticed on the rewatch','Why the result flattered one side','A night the stadium will not forget'];
export const PTABS = [['matches','Matches'],['liked','Liked'],['reviews','Reviews'],['followers','Followers'],['following','Followings'],['articles','Articles'],['about','About'],['onsite','On-site']];
export const SORTS = [['new','Newest'],['old','Oldest'],['az','A–Z']];

export const FT = ['Best final in a decade. Nobody left their seat after the third goal.','The second half was pure chaos, and I loved every minute of it.','Two coaches, zero fear. This is why we watch the knockout rounds.','That equaliser came from nowhere. Still shaking.','Keeper of the match by a distance.','Watched it in a bar full of rivals. Never heard a quieter room.','Fair result, but the last ten minutes were far too stressful.','The midfield battle decided this and nobody is talking about it.','Would pay double to see that rematch.','Referee had a decent game for once.','Rewatching the build-up to the second goal. Perfect movement.','That atmosphere is why I love this sport.'];
export const FR = ['Agreed, the tempo was unreal.','Not sure about that, but fair point.','Rewatching it right now.','This is the take.'];
