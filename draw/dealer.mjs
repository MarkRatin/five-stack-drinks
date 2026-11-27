const leftReady = [-44, 51, 24, 0];
const rightReady = [44, 51, -24, 0];
const leftAway = [-126, 123, 14, 2, 0];
const rightAway = [126, 123, -14, 2, 0];
const stack = i => [0, -14 + i * .8, 0];
const side = i => i % 2 ? 1 : -1;

export const shuffleMoves = [
  {
    name: '過手洗牌',
    duration: 1830,
    card: i => {
      const release = .26 + Math.floor(i / 2) * .105;
      const held = [47, -46 + i * 1.3, -28, 24];
      const received = [-47, 16 + i * 1.3, -17, 4];
      return [[.18, held], [release, held], [release + .05, [6, -52 + i * 2, -43, 28]],
        [release + .14, received], [.88, received]];
    },
    hands: [
      [[.2, [-61, 62, 30, 0]], [.78, [-63, 64, 29, 1]], [.89, [-51, 56, 25, 0]]],
      [[.18, [68, -3, -29, 1]], [.7, [75, 7, -32, 1]], [.89, [39, 54, -23, 0]]],
    ],
  },
  {
    name: '印度洗牌',
    duration: 1860,
    card: i => {
      const release = .25 + Math.floor(i / 2) * .109;
      const held = [18, -54 + i, 12, 12];
      const received = [-19, 25 + i, 8];
      return [[.19, held], [release, held], [release + .055, [-26, -16, -12, -23]],
        [release + .15, received], [.88, received]];
    },
    hands: [
      [[.19, [-44, 42, 43, 1]], [.55, [-47, 74, 19, 0]], [.8, [-37, 66, 24, 1]]],
      [[.19, [48, -7, -21, 0]], [.75, [49, 1, -19, 1]], [.89, [43, 45, -19, 0]]],
    ],
  },
  {
    name: '桌面洗牌',
    duration: 1770,
    card: i => [[.22, [67 * side(i), -16, 80 * side(i)]],
      [.4, [62 * side(i), -15, 84 * side(i), 7 + i]],
      [.49 + i * .019, [26 * side(i), -13 + i * .7, 90 * side(i)]],
      [.79, [0, -15 + i * .8, 90]]],
    hands: [
      [[.23, [-94, 43, 30, 0]], [.66, [-54, 44, 37, 1]], [.8, [-34, 46, 29, 2]]],
      [[.23, [94, 43, -30, 0]], [.66, [54, 44, -37, 1]], [.8, [34, 46, -29, 2]]],
    ],
  },
  {
    name: '鴿尾洗牌',
    duration: 2090,
    card: i => [[.22, [65 * side(i), -34, 85 * side(i), 17]],
      [.4 + i * .014, [34 * side(i), -45, 90, 40 - i * 4]],
      [.61, [(i - 4.5) * 5.4, -55 + Math.abs(i - 4.5) * 6, 90, -11, (i - 4.5) * 10]],
      [.69 + i * .012, [0, -14 + i * .8, 90]]],
    hands: [
      [[.23, [-93, 20, 40, 1]], [.6, [-54, 21, 51, 1]], [.81, [-41, 39, 27, 2]]],
      [[.23, [93, 20, -40, 1]], [.6, [54, 21, -51, 1]], [.81, [41, 39, -27, 2]]],
    ],
  },
  {
    name: '單手桌面洗牌',
    duration: 1860,
    card: i => [[.21, [54 * side(i), 4, 90]],
      [.45, [36 * side(i), -24 + i * .9, 90, 0, 62 * side(i)]],
      [.64, [12 * side(i), -17 + i * .8, 90, 0, 22 * side(i)]],
      [.84, [0, -14 + i * .8, 90]]],
    hands: [
      [[.22, leftAway], [.78, leftAway]],
      [[.21, [26, 56, -11, 2]], [.47, [4, 32, -9, 1]], [.69, [11, 39, 2, 1]],
        [.84, [26, 50, -10, 0]]],
    ],
  },
  {
    name: '單手洗牌',
    duration: 2030,
    card: i => {
      const packet = Math.floor(i / 4);
      const spread = [[-57, -18, -70, 22, -40], [35, -55, 31, 16, 38], [48, 10, 65, 27, 36]];
      const pivot = [[44, -31, 27, -8, 31], [-30, -54, -45, 15, -24], [19, 7, 13, 29, -16]];
      return [[.19, [9, -38 + i, -17, 28]], [.4, spread[packet]], [.62, pivot[packet]],
        [.8, [5, -34 + i, 10, 13]]];
    },
    hands: [
      [[.2, leftAway], [.83, leftAway]],
      [[.2, [18, 27, -9, 1]], [.44, [14, 17, -24, 2]], [.65, [27, 29, 10, 1]], [.82, [23, 43, -13, 0]]],
    ],
  },
  {
    name: '完美洗牌',
    duration: 2180,
    card: i => [[.24, [55 * side(i), -27 + i * 1.9, 0, 0, -13 * side(i)]],
      [.55, [27 * side(i), -25 + i * 2, 0]],
      [.7, [3 * side(i), -15 + i * 1.6, 0]],
      [.85, [(i - 4.5) * 7, -19 + Math.abs(i - 4.5) * 2, (i - 4.5) * 8]]],
    hands: [
      [[.24, [-77, 30, 21, 0]], [.65, [-45, 42, 34, 1]], [.86, [-55, 41, 25, 2]]],
      [[.24, [77, 30, -21, 0]], [.65, [45, 42, -34, 1]], [.86, [55, 41, -25, 2]]],
    ],
  },
];

function transform(pose, scale) {
  const [x, y, angle, pitch = 0, yaw = 0] = pose;
  return `translate(${x * scale}px,${y}px) rotate(${angle}deg) rotateX(${pitch}deg) rotateY(${yaw}deg)`;
}

function playCard(card, path, duration, scale) {
  card.animate(path.map(([offset, pose]) => ({
    offset, transform: transform(pose, scale), easing: 'ease-in-out',
  })), {duration, fill: 'forwards'});
}

function playHand(hand, path, duration, scale) {
  hand.animate(path.map(([offset, [x, y, angle, , opacity = 1]]) => ({
    offset, transform: transform([x, y, angle], scale), opacity, easing: 'ease-in-out',
  })), {duration, fill: 'forwards'});
  hand.firstElementChild.animate(path.map(([offset, pose]) => ({
    offset, backgroundPositionX: `${pose[3] * 50}%`, easing: 'steps(1,end)',
  })), {duration, fill: 'forwards'});
}

export function shuffleDeck(scene, move, entering) {
  const scale = Math.min(1, scene.clientWidth / 365);
  scene.querySelectorAll('.riffle-card').forEach((card, i) => {
    playCard(card, [[0, stack(i)], ...move.card(i), [1, stack(i)]], move.duration, scale);
  });
  scene.querySelectorAll('.dealer-hand').forEach((hand, i) => {
    const ready = i ? rightReady : leftReady;
    const away = i ? rightAway : leftAway;
    playHand(hand, [[0, entering ? away : ready], ...move.hands[i], [1, ready]], move.duration, scale);
  });
}

export const dealDuration = 1350;

export function dealCard(scene) {
  const scale = Math.min(1, scene.clientWidth / 365);
  scene.style.setProperty('--deal-x', `${-53 * scale}px`);
  scene.querySelectorAll('.riffle-card').forEach((card, i) => {
    playCard(card, [[0, stack(i)], [.35, [-53, 29 + i * .8, -14]], [1, [-53, 29 + i * .8, -14]]], dealDuration, scale);
  });
  playHand(scene.querySelector('.dealer-left'), [[0, leftReady], [.35, [-73, 77, 24, 1]], [1, leftAway]], dealDuration, scale);
  playHand(scene.querySelector('.dealer-right'), [[0, rightReady], [.35, [-29, 77, -25, 2]], [.65, [19, 50, -13, 2]], [1, rightAway]], dealDuration, scale);
  scene.classList.add('dealer-dealing');
}
