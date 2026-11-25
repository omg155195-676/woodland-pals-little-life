/* =====================================================================
   WOODLAND PALS: Little Life — 成長規則（純函式）
   遊戲（index.html）、測試（tests/）、平衡模擬（tools/simulate.mjs）共用同一份。
   規則來源：docs/food-system.md、docs/evolution-rules.md、docs/gameplay-system.md
   這個檔案只放資料與計算，不碰畫面、不讀時間、不用 Math.random。
   ===================================================================== */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Growth = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- 時間與數值常數（調平衡只改這裡） ---------- */
  const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;
  const T = {
    eggMin: 5,                 // 蛋孵化（分鐘）
    babyMin: 24 * 60,          // 森林寶寶期
    babyExtraMax: 12 * 60,     // 正餐不夠時最多延後
    babyMinMeals: 6,           // 第一階段需要的有效正餐
    childMin: 4 * 24 * 60,     // 幼年角色期
    offlineCapMin: 12 * 60,    // 離線最多補算
    wakeHour: 7, bedOpenHour: 19, autoSleepHour: 22,
    napStart: 13, napEnd: 14,  // 寶寶午睡
  };
  // 每小時下降（醒著）
  const DECAY = {
    baby:  { hunger: 12, mood: 8 },
    child: { hunger: 8,  mood: 6 },
    adult: { hunger: 4,  mood: 3 },
  };
  const POOP_CHANCE = { baby: 1, child: 1, adult: .5 };

  /* ---------- 食物 ---------- */
  // cat：G 菜園 / S 陽光 / H 蜂蜜 / C 好奇 / T 點心；w：四個隱藏傾向的權重
  // unlock：start 開始就有 / baby2 寶寶期有效正餐 2 次後 / child 幼年期
  const FOODS = [
    { id:'F01', name:'胡蘿蔔',   icon:'🥕', cat:'G', hunger:20, mood:3, w:{G:3},      unlock:'start' },
    { id:'F02', name:'三葉草',   icon:'☘️', cat:'G', hunger:15, mood:4, w:{G:3},      unlock:'start' },
    { id:'F03', name:'嫩葉沙拉', icon:'🥗', cat:'G', hunger:20, mood:2, w:{G:2,S:1},  unlock:'baby2' },
    { id:'F04', name:'小南瓜',   icon:'🎃', cat:'G', hunger:25, mood:2, w:{G:2,H:1},  unlock:'child' },
    { id:'F05', name:'紅莓果',   icon:'🍓', cat:'S', hunger:15, mood:5, w:{S:3},      unlock:'start' },
    { id:'F06', name:'太陽橘',   icon:'🍊', cat:'S', hunger:20, mood:4, w:{S:3},      unlock:'start' },
    { id:'F07', name:'蘋果片',   icon:'🍎', cat:'S', hunger:20, mood:3, w:{S:2,C:1},  unlock:'baby2' },
    { id:'F08', name:'莓果優格', icon:'🍨', cat:'S', hunger:20, mood:4, w:{S:2,H:1},  unlock:'child' },
    { id:'F09', name:'蜂蜜',     icon:'🍯', cat:'H', hunger:15, mood:5, w:{H:3},      unlock:'start' },
    { id:'F10', name:'橡實',     icon:'🌰', cat:'H', hunger:25, mood:3, w:{H:3},      unlock:'start' },
    { id:'F11', name:'核桃麵包', icon:'🍞', cat:'H', hunger:30, mood:2, w:{H:2,C:1},  unlock:'baby2' },
    { id:'F12', name:'燕麥粥',   icon:'🥣', cat:'H', hunger:30, mood:2, w:{G:1,H:2},  unlock:'child' },
    { id:'F13', name:'小菇菇',   icon:'🍄', cat:'C', hunger:20, mood:3, w:{C:3},      unlock:'start' },
    { id:'F14', name:'葵花子',   icon:'🌻', cat:'C', hunger:15, mood:4, w:{C:3},      unlock:'start' },
    { id:'F15', name:'神秘果',   icon:'🫐', cat:'C', hunger:15, mood:5, w:{S:1,C:2},  unlock:'baby2' },
    { id:'F16', name:'花生',     icon:'🥜', cat:'C', hunger:25, mood:3, w:{H:1,C:2},  unlock:'child' },
    { id:'T01', name:'蜂蜜蛋糕', icon:'🍰', cat:'T', hunger:10, mood:15, w:{}, unlock:'start' },
    { id:'T02', name:'莓果果凍', icon:'🍮', cat:'T', hunger:5,  mood:15, w:{}, unlock:'start' },
    { id:'T03', name:'胡蘿蔔餅乾', icon:'🍪', cat:'T', hunger:10, mood:12, w:{}, unlock:'start' },
    { id:'T04', name:'橡實糖',   icon:'🍬', cat:'T', hunger:5,  mood:18, w:{}, unlock:'child' },
  ];
  const FOOD = Object.fromEntries(FOODS.map(f => [f.id, f]));
  const CATS = ['G', 'S', 'H', 'C'];
  const CAT_LABEL = { G:'菜園', S:'陽光', H:'蜂蜜', C:'好奇', T:'點心' };

  /* ---------- 型態 ---------- */
  const CHAR_OF_CAT = { G:'kuri', S:'sunny', H:'dodo', C:'piko' };
  const FAVORITE = {               // 最愛 ×1.5、喜歡 ×1.2
    kuri:  { fav:'G', like:'S' },
    sunny: { fav:'S', like:'C' },
    dodo:  { fav:'H', like:'S' },
    piko:  { fav:'C', like:'G' },
  };
  const STYLES = ['P', 'R', 'F'];  // 玩樂 / 規律 / 美食
  const STYLE_LABEL = { P:'玩樂', R:'規律', F:'美食' };
  const FORMS = {
    egg:   { stage:'egg',   name:'橡實蛋',     en:'Acorn Egg' },
    baby:  { stage:'baby',  name:'森林寶寶',   en:'Forest Baby' },
    kuri:  { stage:'child', char:'kuri',  name:'KURI',  en:'KURI' },
    sunny: { stage:'child', char:'sunny', name:'SUNNY', en:'SUNNY' },
    dodo:  { stage:'child', char:'dodo',  name:'DODO',  en:'DODO' },
    piko:  { stage:'child', char:'piko',  name:'PIKO',  en:'PIKO' },
    kuri_p:  { stage:'adult', char:'kuri',  style:'P', name:'草原跳跳郵差', en:'Meadow Messenger', badge:'✉️' },
    kuri_r:  { stage:'adult', char:'kuri',  style:'R', name:'小園丁',       en:'Garden Keeper',    badge:'🌱' },
    kuri_f:  { stage:'adult', char:'kuri',  style:'F', name:'胡蘿蔔甜點師', en:'Carrot Baker',     badge:'🎂' },
    kuri_h:  { stage:'adult', char:'kuri',  style:'H', name:'四葉草 KURI',  en:'Lucky Clover',     badge:'🍀', hidden:true },
    sunny_p: { stage:'adult', char:'sunny', style:'P', name:'晨光探險家',   en:'Sunrise Ranger',   badge:'🔭' },
    sunny_r: { stage:'adult', char:'sunny', style:'R', name:'晨間小隊長',   en:'Morning Captain',  badge:'🎖️' },
    sunny_f: { stage:'adult', char:'sunny', style:'F', name:'莓果野餐家',   en:'Berry Picnicker',  badge:'🧺' },
    sunny_h: { stage:'adult', char:'sunny', style:'H', name:'彩虹尾 SUNNY', en:'Rainbow Tail',     badge:'🌈', hidden:true },
    dodo_p:  { stage:'adult', char:'dodo',  style:'P', name:'橡實滾球王',   en:'Acorn Roller',     badge:'⚽' },
    dodo_r:  { stage:'adult', char:'dodo',  style:'R', name:'暖暖守護熊',   en:'Cozy Guardian',    badge:'🧣' },
    dodo_f:  { stage:'adult', char:'dodo',  style:'F', name:'蜂蜜大廚',     en:'Honey Chef',       badge:'🍯' },
    dodo_h:  { stage:'adult', char:'dodo',  style:'H', name:'大橡樹 DODO',  en:'Old Oak',          badge:'🌳', hidden:true },
    piko_p:  { stage:'adult', char:'piko',  style:'P', name:'森林小偵探',   en:'Forest Detective', badge:'🕵️' },
    piko_r:  { stage:'adult', char:'piko',  style:'R', name:'小小發明家',   en:'Little Tinker',    badge:'🔧' },
    piko_f:  { stage:'adult', char:'piko',  style:'F', name:'菇菇博士',     en:'Mushroom Scholar', badge:'📚' },
    piko_h:  { stage:'adult', char:'piko',  style:'H', name:'星空觀測家',   en:'Star Gazer',       badge:'🌟', hidden:true },
  };
  const FORM_ORDER = ['egg', 'baby', 'kuri', 'sunny', 'dodo', 'piko',
    'kuri_p', 'kuri_r', 'kuri_f', 'kuri_h', 'sunny_p', 'sunny_r', 'sunny_f', 'sunny_h',
    'dodo_p', 'dodo_r', 'dodo_f', 'dodo_h', 'piko_p', 'piko_r', 'piko_f', 'piko_h'];

  /* ---------- 種子亂數（可重現） ---------- */
  function hash(str){
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++){ h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
    h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }
  function mulberry32(a){
    return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const rngFor = (seed, tag) => mulberry32(hash(String(seed) + ':' + tag));
  const roll = (seed, tag) => rngFor(seed, tag)();

  /* ---------- 共用的「有規則的隨機」 ---------- */
  // scores：{ key: 分數 }；sure：差距 ≥ sure 時 100% 第一名；near：差距 < near 時在接近者間依分數抽
  function decide(scores, sure, near, r){
    const keys = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
    const [k1, k2] = keys, d = scores[k1] - scores[k2];
    if (d >= sure) return { pick: k1, mode: 'sure', d };
    if (d >= near) return { pick: r < .7 ? k1 : k2, mode: '70/30', d };
    const pool = keys.filter(k => scores[k1] - scores[k] < near);
    const sum = pool.reduce((s, k) => s + Math.max(scores[k], 1e-9), 0);
    let acc = 0;
    for (const k of pool){ acc += Math.max(scores[k], 1e-9) / sum; if (r < acc) return { pick: k, mode: 'draw', d, pool }; }
    return { pick: pool[pool.length - 1], mode: 'draw', d, pool };
  }

  /* ---------- 餵食 ---------- */
  // 傳回這次餵食的結果；不改動傳入的資料。
  // ctx：{ hunger, stage, char, recentSame（3 小時內同食物已吃幾次）, hourCount（這小時已計入幾次傾向）}
  function feedResult(food, ctx){
    const f = typeof food === 'string' ? FOOD[food] : food;
    if (f.cat !== 'T' && ctx.hunger > 80) return { refused: true, overfeed: true, hunger: 0, mood: -5, w: {}, valid: false };
    const hungerMul = ctx.hunger <= 40 ? 1 : ctx.hunger <= 80 ? .6 : 0;
    const repeatMul = ctx.recentSame >= 2 ? .5 : 1;
    const counts = f.cat !== 'T' && ctx.hourCount < 3;
    const w = {};
    if (counts) for (const c of CATS) if (f.w[c]) w[c] = f.w[c] * hungerMul * repeatMul;
    let moodMul = 1;
    if (ctx.char && f.cat !== 'T'){
      const fv = FAVORITE[ctx.char];
      moodMul = f.cat === fv.fav ? 1.5 : f.cat === fv.like ? 1.2 : 1;
    }
    return {
      refused: false, overfeed: false,
      hunger: f.hunger, mood: Math.round(f.mood * moodMul),
      w, counts,
      valid: f.cat !== 'T' && ctx.hunger <= 75,   // 有效正餐：餵的時候飽足 ≤ 3 顆心
      favorite: !!ctx.char && f.cat !== 'T' && f.cat === FAVORITE[ctx.char].fav,
    };
  }
  function unlocked(food, stage, validMeals){
    const f = typeof food === 'string' ? FOOD[food] : food;
    if (f.unlock === 'start') return true;
    if (f.unlock === 'baby2') return stage !== 'baby' || validMeals >= 2;
    return stage === 'child' || stage === 'adult';
  }

  /* ---------- 第一階段：森林寶寶 → 四角色 ---------- */
  function shares(hidden){
    const tot = CATS.reduce((s, c) => s + (hidden[c] || 0), 0);
    const p = {}; for (const c of CATS) p[c] = tot ? (hidden[c] || 0) / tot : .25;
    return { p, tot };
  }
  function phase1(hidden, seed){
    const { p, tot } = shares(hidden);
    const r = roll(seed, 'phase1');
    const res = tot === 0 ? decide({ G:1, S:1, H:1, C:1 }, 1, 1, r) : decide(p, .10, .04, r);
    return { form: CHAR_OF_CAT[res.pick], cat: res.pick, shares: p, total: tot, roll: r, mode: res.mode };
  }
  // 寶寶嫩芽提示：0 沒變化 / 1 偶爾閃現 / 2 穩定呈現
  function babyHint(hidden){
    const { p, tot } = shares(hidden);
    if (!tot) return { level: 0, cat: null };
    const top = CATS.reduce((a, c) => p[c] > p[a] ? c : a, 'G');
    return { level: p[top] > .45 ? 2 : p[top] >= .30 ? 1 : 0, cat: top };
  }

  /* ---------- 第二階段：幼年 → 成年 ---------- */
  // 正規化參考值：模擬測試（tools/simulate.mjs）用來校準
  const NORM = { playRatio: .45, treatRatio: .30 };
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  // R：幼年期紀錄（見 gameplay-system.md 第 10 節）
  function metrics(R, discipline){
    const inter = R.meals + R.treats + R.plays + R.pats;
    const foodsTried = Object.keys(R.foods || {}).length;
    const childFoods = FOODS.length;
    return {
      playRatio: inter ? R.plays / inter : 0,
      avgMood: R.moodN ? R.moodSum / R.moodN / 100 : .5,
      winRate: R.games ? R.wins / R.games : 0,
      mistakes: R.mistakes,
      discipline: (discipline || 0) / 100,
      poopRate: R.poops ? R.poopsOnTime / R.poops : 1,
      variety: foodsTried / childFoods,
      treatRatio: (R.meals + R.treats) ? R.treats / (R.meals + R.treats) : 0,
      favRatio: R.meals ? R.favMeals / R.meals : 0,
      overfeed: R.overfeed,
    };
  }
  function styleScores(m){
    const P = .6 * clamp01(m.playRatio / NORM.playRatio) + .2 * m.avgMood + .2 * m.winRate;
    // 規律分：主要看「管教」與「不放縱」（玩太多或點心太多都會降低），照顧品質佔小部分
    const careQ = .5 * clamp01(1 - m.mistakes / 5) + .5 * m.poopRate;
    const indulge = Math.max(clamp01(m.playRatio / NORM.playRatio), clamp01(m.treatRatio / NORM.treatRatio));
    const Rr = .2 * careQ + .5 * m.discipline + .3 * (1 - indulge);
    const F = clamp01(.4 * m.variety + .3 * clamp01(m.treatRatio / NORM.treatRatio) + .3 * m.favRatio - .02 * m.overfeed);
    return { P, R: Rr, F };
  }
  // 角色專屬祕密條件（條件 B）
  const SECRET = {
    kuri:  R => ['F01','F02','F03','F04'].every(id => R.foods[id]) && !!R.clover,
    sunny: R => ['F05','F06','F07','F08'].every(id => R.foods[id]) && (R.morningPlayDays || []).length >= 3,
    dodo:  R => ['F09','F10','F11','F12'].every(id => R.foods[id]) && maxStreak(R.patDays || {}, 5) >= 3,
    piko:  R => ['F13','F14','F15','F16'].every(id => R.foods[id]) && (R.guessWins || 0) >= 10,
  };
  const SECRET_TEXT = {
    kuri: '吃過全部菜園食物，並在接果子接到四葉草',
    sunny: '3 個不同的早晨（7–9 點）陪玩，並吃過全部陽光食物',
    dodo: '連續 3 天每天摸摸 5 次以上，並吃過全部蜂蜜食物',
    piko: '猜猜往哪邊累計贏 10 次，並吃過全部好奇食物',
  };
  // patDays：{ 'YYYY-MM-DD': 次數 }，算連續達標天數
  function maxStreak(days, need){
    const ok = Object.keys(days).filter(k => days[k] >= need).sort();
    let best = 0, cur = 0, prev = null;
    for (const k of ok){
      const t = Date.parse(k + 'T12:00:00');
      cur = prev !== null && Math.round((t - prev) / DAY) === 1 ? cur + 1 : 1;
      best = Math.max(best, cur); prev = t;
    }
    return best;
  }
  function hiddenCheck(char, R, discipline){
    const m = metrics(R, discipline), s = styleScores(m);
    const A = m.mistakes <= 1 && m.discipline >= .75 && s.P >= .5 && s.R >= .5 && s.F >= .5 && m.avgMood >= .70;
    const B = SECRET[char](R);
    return { A, B, count: (A ? 1 : 0) + (B ? 1 : 0) + 1 /* 條件 C：判定當下，進行中視為成立 */, all: A && B };
  }
  function phase2(char, R, discipline, seed){
    const m = metrics(R, discipline), s = styleScores(m), h = hiddenCheck(char, R, discipline);
    if (h.all) return { form: char + '_h', style: 'H', scores: s, metrics: m, hidden: h, mode: 'hidden' };
    const r = roll(seed, 'phase2');
    const res = decide(s, .08, .03, r);
    return { form: char + '_' + res.pick.toLowerCase(), style: res.pick, scores: s, metrics: m, hidden: h, roll: r, mode: res.mode };
  }
  // 幼年期提示：領先的風格（差距 ≥ 0.08 才算）
  function childHint(R, discipline){
    const s = styleScores(metrics(R, discipline));
    const k = STYLES.slice().sort((a, b) => s[b] - s[a]);
    return s[k[0]] - s[k[1]] >= .08 ? k[0] : null;
  }

  function emptyRecords(){
    return { meals:0, treats:0, plays:0, pats:0, games:0, wins:0, mistakes:0, poops:0, poopsOnTime:0,
      moodSum:0, moodN:0, foods:{}, cats:{G:0,S:0,H:0,C:0}, favMeals:0, overfeed:0,
      morningPlayDays:[], patDays:{}, guessWins:0, clover:false };
  }

  return { MIN, HOUR, DAY, T, DECAY, POOP_CHANCE, FOODS, FOOD, CATS, CAT_LABEL, CHAR_OF_CAT, FAVORITE,
    STYLES, STYLE_LABEL, FORMS, FORM_ORDER, SECRET_TEXT, NORM,
    hash, mulberry32, rngFor, roll, decide, feedResult, unlocked, shares, phase1, babyHint,
    metrics, styleScores, hiddenCheck, phase2, childHint, maxStreak, emptyRecords };
});
