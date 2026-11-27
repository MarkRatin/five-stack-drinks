// Each row lists the illustrations from left to right on its atlas.
const atlases = [
  [
    ['star', 'kills', 'damage'],
    ['tank', 'assists', 'gold'],
    ['tower', 'attendance', 'live'],
    [null, null, 'back']
  ],
  [
    ['last-hit-share', 'miracle', 'broke'],
    ['vampire', null, 'both'],
    [null, null, 'charity'],
    ['poor', 'destiny', 'mean']
  ],
  [
    ['balance', 'two-for-one', 'perfect-ten'],
    [null, 'overtime', 'quiet'],
    ['freeze', 'doctor', 'tower-main'],
    ['borrowed', 'field-er']
  ],
  [
    [null, 'big-comeback'],
    ['small-comeback']
  ],
  [
    ['one-for-zero', 'tourist', 'gear-display'],
    ['leaky-health', 'receipt-lottery', 'clock-out']
  ],
  [
    ['chosen', 'team-double'],
    ['swap']
  ],
  [
    ['full-kda', 'survival'],
    ['all-damage', 'one-cut']
  ]
];

export const tarotArtwork = Object.fromEntries(atlases.flatMap((rows, sheet) =>
  rows.flatMap((row, y) => row.flatMap((id, x) => {
    if(!id) return [];
    return [[id, {sheet:sheet+1, x, y, columns:rows[0].length, rows:rows.length}]];
  }))
));

export function tarotArt(id, className = '') {
  if (id === 'survival') return `<span class="tarot-art atlas-survival ${className}" aria-hidden="true"></span>`;
  if (id === 'budget-clinic') return `<span class="tarot-art atlas-budget-clinic ${className}" aria-hidden="true"></span>`;
  if (id === 'team-double') return `<span class="tarot-art atlas-team-double ${className}" aria-hidden="true"></span>`;
  if (id === 'empty-promise') return `<span class="tarot-art atlas-empty-promise ${className}" aria-hidden="true"></span>`;
  if (id === 'reverse') return `<span class="tarot-art atlas-reverse ${className}" aria-hidden="true"></span>`;
  if (id === 'first-loser') return `<span class="tarot-art atlas-first-loser ${className}" aria-hidden="true"></span>`;
  if (['teamfight-opener','hit-and-run','all-five-pass','human-punching-bag'].includes(id)) {
    return `<span class="tarot-art atlas-new-fun atlas-${id} ${className}" aria-hidden="true"></span>`;
  }
  if (['operator-zero','too-long','roll-call'].includes(id)) {
    return `<span class="tarot-art atlas-new-chaos atlas-${id} ${className}" aria-hidden="true"></span>`;
  }
  const {sheet,x,y,columns,rows} = tarotArtwork[id==='last-hit'?'last-hit-share':id] ?? tarotArtwork.back;
  return `<span class="tarot-art atlas-${sheet} ${className}" style="--art-x:${100*x/(columns-1)}%;--art-y:${100*y/(rows-1)}%" aria-hidden="true"></span>`;
}
