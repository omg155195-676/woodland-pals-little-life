// 平衡模擬（M3）：用「機器人玩家」照遊戲規則跑上千次，確認餵食與照顧真的會影響結果。
// 執行：node tools/simulate.mjs [每種策略次數，預設 2000]
// 規則計算全部用 growth.js；照顧循環（下降、便便、生病、照顧失誤、假撒嬌、作息）照 index.html 的 tickMinute 重寫一份精簡版。
import { createRequire } from 'node:module';
const Gr = createRequire(import.meta.url)('../growth.js');
const { T, FOODS, FOOD, MIN, HOUR } = Gr;
const N = +process.argv[2] || 2000;
const clamp = (v, a = 0, b = 100) => v < a ? a : v > b ? b : v;

// 線上時段：上學日的小朋友（早上、午休、放學後）
const SCHOOL = h => (h >= 7 && h < 8) || (h >= 12 && h < 12.5) || (h >= 16 && h < 21.5);
const ALLDAY = h => h >= 7 && h < 22;
const RARE = h => (h >= 7.5 && h < 8) || (h >= 19 && h < 20);

function run(bot, phase, seed, rnd){
  const s = { t: Date.parse('2026-12-01T09:00:00'), hunger: 70, mood: 70, sick: false, sickSince: 0, sickMistakeAt: 0, med: 0,
    sleeping: false, poops: [], poopDue: null, fake: null, fakeToday: 0, day: '', discipline: 0,
    hidden: { G:0, S:0, H:0, C:0 }, babyMeals: 0, R: Gr.emptyRecords(), feedLog: [], zH: null, zM: null, hM: false, mM: false,
    char: phase === 2 ? bot.char || ['kuri', 'sunny', 'dodo', 'piko'][Math.floor(rnd() * 4)] : null, stageMin: 0, foodIdx: 0, patLog: [] };
  const stage = phase === 1 ? 'baby' : 'child';
  const total = phase === 1 ? T.babyMin : T.childMin;
  const hourOf = t => { const d = new Date(t); return d.getHours() + d.getMinutes() / 60; };
  const dk = t => new Date(t).toISOString().slice(0, 10);
  const recent = ms => s.feedLog.filter(f => s.t - f.t <= ms);
  const mistake = () => { s.R.mistakes++; };

  function feed(f){
    if (f.cat !== 'T' && s.fake) return;
    const r = Gr.feedResult(f, { hunger: s.hunger, char: s.char, recentSame: recent(3 * HOUR).filter(x => x.id === f.id).length, hourCount: recent(HOUR).filter(x => x.counted).length });
    if (r.refused){ s.mood = clamp(s.mood + r.mood); s.R.overfeed++; return; }
    s.feedLog.push({ t: s.t, id: f.id, counted: !!r.counts && f.cat !== 'T', treat: f.cat === 'T' }); s.feedLog = recent(3 * HOUR);
    s.hunger = clamp(s.hunger + r.hunger); s.mood = clamp(s.mood + r.mood);
    if (f.cat === 'T'){ s.R.treats++; s.R.foods[f.id] = 1; if (recent(HOUR).filter(x => x.treat).length >= 3 && !s.sick){ s.sick = true; s.sickSince = s.t; s.sickMistakeAt = 0; s.med = 0; } return; }
    if (rnd() < Gr.POOP_CHANCE[stage] && !s.poopDue) s.poopDue = s.t + (20 + Math.floor(rnd() * 20)) * MIN;
    if (stage === 'baby'){ for (const c in r.w) s.hidden[c] += r.w[c]; if (r.valid) s.babyMeals++; }
    else { s.R.meals++; s.R.foods[f.id] = 1; if (r.favorite) s.R.favMeals++; }
  }
  function play(kind){
    const win = rnd() < bot.win;
    s.mood = clamp(s.mood + (win ? 25 : 12.5)); s.hunger = clamp(s.hunger - 4);
    s.R.plays++; s.R.games++; if (win) s.R.wins++;
    if (kind === 'catch' && bot.secret && rnd() < .6) s.R.clover = true;
    if (kind === 'guess' && win) s.R.guessWins++;
    const h = hourOf(s.t); if (h >= 7 && h < 9 && !s.R.morningPlayDays.includes(dk(s.t))) s.R.morningPlayDays.push(dk(s.t));
  }
  function pat(){ const rc = s.patLog.filter(t => s.t - t < 10 * MIN); if (rc.length < 3) s.mood = clamp(s.mood + 4); s.patLog = [...rc, s.t]; s.R.pats++; const k = dk(s.t); s.R.patDays[k] = (s.R.patDays[k] || 0) + 1; }
  const unlocked = f => Gr.unlocked(f, stage, s.babyMeals);
  function chooseMeal(){
    const list = FOODS.filter(f => f.cat !== 'T' && unlocked(f));
    if (phase === 1){
      const c = bot.cat(rnd, s);
      const pool = list.filter(f => f.cat === c && Object.keys(f.w).length === 1); // 單純食物
      return pool[s.foodIdx++ % pool.length];
    }
    if (bot.meal === 'fav'){ const fav = Gr.FAVORITE[s.char].fav; const pool = list.filter(f => f.cat === fav); return pool[s.foodIdx++ % pool.length]; }
    if (bot.meal === 'variety') return list[s.foodIdx++ % list.length];
    return list[(s.foodIdx++ % 2) * 4];                                               // 只吃兩三種
  }

  for (let m = 0; m < total + 12 * 60; m++){
    s.t += MIN;
    const h = hourOf(s.t), k = dk(s.t);
    if (k !== s.day){ s.day = k; s.fakeToday = 0; s.treatsToday = 0; }
    if (s.sleeping){ if (h >= T.wakeHour && h < T.bedOpenHour) s.sleeping = false; }
    else if (h >= T.autoSleepHour || h < T.wakeHour) s.sleeping = true;
    if (!s.sick) s.stageMin++;
    if (phase === 1 && s.stageMin >= T.babyMin && (s.babyMeals >= T.babyMinMeals || s.stageMin >= T.babyMin + T.babyExtraMax)) break;
    if (phase === 2 && s.stageMin >= T.childMin && !s.sick) break;
    if (s.sleeping) continue;
    const online = bot.online(h);
    const d = Gr.DECAY[stage]; let mm = 1 + .2 * s.poops.length; if (s.sick) mm *= 1.5;
    s.hunger = clamp(s.hunger - d.hunger / 60); s.mood = clamp(s.mood - d.mood / 60 * mm);
    if (!online){ s.hunger = Math.max(s.hunger, 12.5); s.mood = Math.max(s.mood, 12.5); }
    if (s.poopDue && s.t >= s.poopDue){ s.poopDue = null; if (s.poops.length < (online ? 3 : 2)){ s.poops.push({ born: s.t, cleanBy: s.t + 30 * MIN }); s.R.poops++; } }
    if (online && !s.sick && s.poops.some(p => s.t - p.born > 2 * HOUR)){ s.sick = true; s.sickSince = s.t; s.sickMistakeAt = 0; s.med = 0; }
    if (!online){ for (const p of s.poops){ p.born = Math.max(p.born, s.t - 90 * MIN); p.cleanBy = Math.max(p.cleanBy, s.t + 30 * MIN); } continue; }
    // 照顧失誤
    if (s.hunger <= 0){ s.zH ??= s.t; if (!s.hM && s.t - s.zH >= 15 * MIN){ s.hM = true; mistake(); } } else { s.zH = null; s.hM = false; }
    if (s.mood <= 0){ s.zM ??= s.t; if (!s.mM && s.t - s.zM >= 15 * MIN){ s.mM = true; mistake(); } } else { s.zM = null; s.mM = false; }
    if (s.sick && s.t - (s.sickMistakeAt || s.sickSince) >= HOUR){ s.sickMistakeAt = s.t; mistake(); }
    if (s.fake && s.t > s.fake.until) s.fake = null;
    if (!s.fake && !s.sick && s.fakeToday < 4 && s.hunger >= 50 && s.mood >= 50 && rnd() < 3 / 720){ s.fake = { until: s.t + 15 * MIN }; s.fakeToday++; }
    if (phase === 2){ s.R.moodSum += s.mood; s.R.moodN++; }
    // 機器人每 bot.every 分鐘看一次
    if (m % bot.every) continue;
    if (s.sick){ s.med++; if (s.med >= 2 || rnd() < .5) s.sick = false; continue; }
    if (s.poops.length && rnd() < bot.clean){ s.R.poopsOnTime += s.poops.filter(p => s.t <= p.cleanBy).length; s.poops = []; }
    if (s.fake && rnd() < bot.scold){ s.fake = null; s.discipline = Math.min(100, s.discipline + 25); }
    if (s.hunger <= bot.feedAt) feed(chooseMeal());
    if ((s.treatsToday || 0) < bot.treats && rnd() < bot.treats / 40 && recent(HOUR).filter(x => x.treat).length < 2){ feed(FOODS.filter(f => f.cat === 'T' && unlocked(f))[s.foodIdx % 3]); s.treatsToday = (s.treatsToday || 0) + 1; }
    if (s.mood <= bot.playAt || rnd() < bot.play) play(bot.secret && s.char === 'piko' ? 'guess' : rnd() < .5 ? 'catch' : 'guess');
    if (rnd() < bot.pat) pat();
  }
  if (phase === 1) return Gr.phase1(s.hidden, seed).form;
  const res = Gr.phase2(s.char, s.R, s.discipline, seed);
  return res.style + (res.mode === 'hidden' ? '' : '') ;
}

const base = { online: SCHOOL, every: 10, clean: .9, scold: .3, feedAt: 50, treats: 1, playAt: 25, play: .05, pat: .1, win: .6, meal: 'plain' };
const P1 = {
  '只餵菜園': { ...base, cat: () => 'G', expect: 'kuri' },
  '只餵陽光': { ...base, cat: () => 'S', expect: 'sunny' },
  '只餵蜂蜜': { ...base, cat: () => 'H', expect: 'dodo' },
  '只餵好奇': { ...base, cat: () => 'C', expect: 'piko' },
  '菜園為主（7 成）': { ...base, cat: r => r() < .7 ? 'G' : ['S', 'H', 'C'][Math.floor(r() * 3)], expect: 'kuri' },
  '四類輪流': { ...base, cat: (r, s) => 'GSHC'[s.foodIdx % 4], expect: null },
  '亂餵（隨機）': { ...base, cat: r => 'GSHC'[Math.floor(r() * 4)], expect: null },
};
const P2 = {
  '愛玩型玩家': { ...base, play: .35, playAt: 60, pat: .2, scold: .1, treats: 1, meal: 'plain', expect: 'P' },
  '規律型玩家': { ...base, every: 5, clean: 1, scold: 1, play: .03, playAt: 20, treats: 0, pat: .15, meal: 'plain', expect: 'R' },
  '美食型玩家': { ...base, play: .03, playAt: 20, treats: 4, scold: .4, meal: 'variety', feedAt: 60, expect: 'F' },
  '美食型（只餵最愛）': { ...base, play: .03, playAt: 20, treats: 3, scold: .3, meal: 'fav', feedAt: 60, expect: 'F' },
  '整天陪玩又愛餵點心': { ...base, online: ALLDAY, play: .3, playAt: 60, treats: 4, scold: .5, meal: 'variety', expect: null },
  '很少上線': { ...base, online: RARE, every: 15, clean: .6, scold: .2, expect: null },
  '完美照顧＋祕密條件': { ...base, online: ALLDAY, every: 5, clean: 1, scold: 1, play: .12, playAt: 60, treats: 3, pat: .35, win: .75, meal: 'variety', secret: true, expect: 'H' },
  '完美照顧但沒做祕密條件': { ...base, online: ALLDAY, every: 5, clean: 1, scold: 1, play: .12, playAt: 60, treats: 3, pat: .02, win: .75, meal: 'plain', expect: 'notH' },
};

function report(title, table, phase){
  console.log(`\n=== ${title}（每種 ${N} 次）===`);
  for (const [name, bot] of Object.entries(table)){
    const cnt = {};
    for (let i = 0; i < N; i++){
      const seed = name + i, rnd = Gr.rngFor(seed, 'sim');
      const r = run(bot, phase, seed, rnd); cnt[r] = (cnt[r] || 0) + 1;
    }
    const dist = Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / N * 100).toFixed(1)}%`).join('　');
    let ok = '';
    if (bot.expect === 'notH') ok = (cnt.H || 0) === 0 ? '✅' : '❌';
    else if (bot.expect){ const pct = (cnt[bot.expect] || 0) / N; const need = phase === 1 ? (name.includes('為主') ? .8 : .95) : bot.expect === 'H' ? .5 : .8; ok = pct >= need ? '✅' : '❌'; }
    console.log(`${ok || '・'} ${name}：${dist}`);
  }
}
report('第一階段：寶寶 → 四角色', P1, 1);
report('第二階段：幼年 → 成年（P 玩樂 / R 規律 / F 美食 / H 隱藏）', P2, 2);
