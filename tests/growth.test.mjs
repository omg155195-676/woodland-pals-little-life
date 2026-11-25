// 執行：node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const Gr = createRequire(import.meta.url)('../growth.js');

test('資料完整：20 種食物、22 種型態、四類單純食物權重一致', () => {
  assert.equal(Gr.FOODS.length, 20);
  assert.equal(Gr.FORM_ORDER.length, 22);
  for (const c of Gr.CATS){
    const sum = Gr.FOODS.filter(f => f.cat === c).reduce((s, f) => s + Object.values(f.w).reduce((a, b) => a + b, 0), 0);
    assert.equal(sum, 12, `${c} 類總權重`);
  }
  for (const f of Gr.FORM_ORDER) assert.ok(Gr.FORMS[f], f);
});

test('種子亂數可重現', () => {
  assert.equal(Gr.roll('abc', 'phase1'), Gr.roll('abc', 'phase1'));
  assert.notEqual(Gr.roll('abc', 'phase1'), Gr.roll('abd', 'phase1'));
});

test('第一階段：傾向明顯時 100% 照傾向', () => {
  for (let i = 0; i < 500; i++){
    assert.equal(Gr.phase1({ G: 70, S: 10, H: 10, C: 10 }, 'p' + i).form, 'kuri');
    assert.equal(Gr.phase1({ G: 10, S: 10, H: 27, C: 53 }, 'p' + i).form, 'piko');
  }
});

test('第一階段：勢均力敵時只在接近的候選間抽，比例接近分數', () => {
  const n = 4000, cnt = {};
  for (let i = 0; i < n; i++){ const f = Gr.phase1({ G: 5, S: 46, H: 44, C: 5 }, 's' + i).form; cnt[f] = (cnt[f] || 0) + 1; }
  assert.deepEqual(Object.keys(cnt).sort(), ['dodo', 'sunny']);
  assert.ok(Math.abs(cnt.sunny / n - .511) < .03, JSON.stringify(cnt));
});

test('第一階段：差距 0.04～0.10 時 70/30', () => {
  const n = 4000; let top = 0;
  for (let i = 0; i < n; i++) if (Gr.phase1({ G: 40, S: 33, H: 14, C: 13 }, 'x' + i).form === 'kuri') top++;
  assert.ok(Math.abs(top / n - .7) < .03, String(top / n));
});

test('餵食：很飽不吃、重複打折、每小時上限、點心不累積傾向', () => {
  assert.equal(Gr.feedResult('F01', { hunger: 90, recentSame: 0, hourCount: 0 }).refused, true);
  assert.deepEqual(Gr.feedResult('F01', { hunger: 30, recentSame: 0, hourCount: 0 }).w, { G: 3 });
  assert.deepEqual(Gr.feedResult('F01', { hunger: 60, recentSame: 0, hourCount: 0 }).w, { G: 1.7999999999999998 });
  assert.deepEqual(Gr.feedResult('F01', { hunger: 30, recentSame: 2, hourCount: 0 }).w, { G: 1.5 });
  assert.deepEqual(Gr.feedResult('F01', { hunger: 30, recentSame: 0, hourCount: 3 }).w, {});
  assert.deepEqual(Gr.feedResult('T01', { hunger: 30, recentSame: 0, hourCount: 0 }).w, {});
  assert.equal(Gr.feedResult('F05', { hunger: 30, recentSame: 0, hourCount: 0, char: 'sunny' }).mood, 8); // 最愛 ×1.5
});

test('解鎖：寶寶期第 2 次有效正餐後開放混合食物', () => {
  assert.equal(Gr.unlocked('F03', 'baby', 1), false);
  assert.equal(Gr.unlocked('F03', 'baby', 2), true);
  assert.equal(Gr.unlocked('F04', 'baby', 9), false);
  assert.equal(Gr.unlocked('F04', 'child', 0), true);
});

test('連續天數', () => {
  assert.equal(Gr.maxStreak({ '2026-11-01': 5, '2026-11-02': 6, '2026-11-03': 5, '2026-11-05': 9 }, 5), 3);
  assert.equal(Gr.maxStreak({ '2026-11-01': 5, '2026-11-02': 4, '2026-11-03': 5 }, 5), 1);
});

test('隱藏型態：零失誤＋祕密條件才會出現', () => {
  const R = Gr.emptyRecords();
  Object.assign(R, { meals: 30, treats: 8, plays: 25, pats: 20, games: 25, wins: 20, mistakes: 0, poops: 20, poopsOnTime: 20, moodSum: 80 * 100, moodN: 100, favMeals: 12, clover: true });
  for (const f of Gr.FOODS) R.foods[f.id] = 1;
  assert.equal(Gr.phase2('kuri', R, 100, 'h1').form, 'kuri_h');
  assert.notEqual(Gr.phase2('kuri', { ...R, mistakes: 2 }, 100, 'h1').form, 'kuri_h');
  assert.notEqual(Gr.phase2('kuri', { ...R, clover: false }, 100, 'h1').form, 'kuri_h');
  assert.notEqual(Gr.phase2('kuri', R, 50, 'h1').form, 'kuri_h');
});
