// 真实浏览器自检：试走嵌套反复、各层遍次、尾句、循环双向回绕、退出后续翻、非法换谱保留。
// 用法：node e2e/browser-check.mjs [baseURL]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:8099';
const SHOT_DIR = new URL('../selfcheck-screenshots/', import.meta.url).pathname;
mkdirSync(SHOT_DIR, { recursive: true });

const steps = [];
function check(name, cond, extra = '') {
  steps.push({ name, ok: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
  if (!cond) process.exitCode = 1;
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PW_EXECUTABLE || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('pageerror', (err) => check('页面无未捕获异常', false, String(err)));
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('  [browser console.error]', msg.text());
});

const tid = (id) => page.getByTestId(id);
const pos = async () => (await tid('position-label').innerText()).replace(/\s+/g, ' ').trim();
const measureNo = async () => (await tid('current-measure-no').innerText()).trim();

// Playwright 的点击前自动滚动可能移动窗口（测试工具行为，真实点击不会）；
// 截图前把窗口复位到顶部，保证证据图完整显示页头。
const shot = async (name) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${SHOT_DIR}${name}`, fullPage: false });
};

try {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="stage"]');

  check('首屏标题为嵌套反复示例曲', (await tid('score-title').innerText()).includes('嵌套反复示例曲'));
  check('首屏位置 1/16', /1 \/ 16/.test(await pos()), await pos());
  check('首屏第 1 小节', (await measureNo()) === '1');
  check('演奏顺序共 16 行', (await tid('seq-row').count()) === 16);
  await shot("01-initial.png");

  // ---- 逐页走反复 ----
  await tid('btn-next').click();
  check('#2 第2小节', (await measureNo()) === '2');
  check('#2 外层第1遍徽标', (await tid('pass-badges').innerText()).includes('A 段（外层） · 第 1/2 遍'));

  await tid('btn-next').click();
  check('#3 第3小节', (await measureNo()) === '3');
  let badges = await tid('pass-badges').innerText();
  check('#3 同时显示外层1/2、内层1/2', badges.includes('第 1/2 遍') && badges.includes('B 句（内层）'));
  await shot("02-pass-badges.png");

  await tid('btn-next').click();
  check('#4 第4小节(第一尾句)', (await measureNo()) === '4');
  check('#4 尾句徽标=第一尾句', (await tid('ending-badge').innerText()).includes('第一尾句'));

  // 走到 #10：外层第2遍中的第一个 m3，内层必须重置为第1遍
  for (let i = 0; i < 6; i += 1) await tid('btn-next').click();
  check('到达 #10', /10 \/ 16/.test(await pos()), await pos());
  check('#10 仍是第3小节', (await measureNo()) === '3');
  badges = await tid('pass-badges').innerText();
  check('#10 外层第2遍', badges.includes('A 段（外层） · 第 2/2 遍'));
  check('#10 内层重置为第1遍', badges.includes('B 句（内层） · 第 1/2 遍'));
  await shot("03-inner-reset.png");

  // ---- 循环：#3 与 #5，同一小节 m3 的两个不同遍 ----
  await page.locator('[data-testid="seq-row"][data-index="2"]').click();
  check('点击列表跳到 #3', /3 \/ 16/.test(await pos()));
  await tid('btn-mark-start').click();

  await page.locator('[data-testid="seq-row"][data-index="4"]').click();
  check('点击列表跳到 #5', /5 \/ 16/.test(await pos()));
  await tid('btn-mark-end').click();

  const rangeText = (await tid('loop-range').innerText()).replace(/\s+/g, ' ');
  check('循环区间 #3 第3小节 ↔ #5 第3小节', rangeText.includes('#3') && rangeText.includes('#5') && rangeText.includes('第3小节'), rangeText);
  await shot("04-loop-marked.png");

  // 下一页：尾 -> 首
  await tid('btn-next').click();
  check('尾后下一页回绕到 #3', /3 \/ 16/.test(await pos()), await pos());
  check('回绕计数=1', (await tid('loop-laps').innerText()).includes('1'));

  // 上一页：首 -> 尾（双向回绕）
  await tid('btn-prev').click();
  check('首前上一页反向回绕到 #5', /5 \/ 16/.test(await pos()), await pos());
  check('回绕计数=2', (await tid('loop-laps').innerText()).includes('2'));
  await shot("05-loop-wrap.png");

  // ---- 非法换谱：错误提示且原谱/位置/循环保留 ----
  await tid('btn-open-json').click();
  await page.waitForSelector('[data-testid="json-dialog"]');
  await tid('json-editor').fill('{ "body": [!!!不是合法JSON');
  await tid('json-apply').click();
  await page.waitForSelector('[data-testid="json-error"]');
  check('非法 JSON 显示错误', await tid('json-error').isVisible());
  check('错误信息提到 JSON', (await tid('json-error').innerText()).includes('JSON'));
  await shot("06-invalid-json-preserved.png");

  check('失败后原谱标题保留', (await tid('score-title').innerText()).includes('嵌套反复示例曲'));
  check('失败后位置保留 #5', /5 \/ 16/.test(await pos()), await pos());
  check('失败后循环区间保留', await tid('loop-range').isVisible());
  const rangeAfter = (await tid('loop-range').innerText()).replace(/\s+/g, ' ');
  check('失败后循环仍是 #3↔#5', rangeAfter.includes('#3') && rangeAfter.includes('#5'), rangeAfter);

  await tid('json-cancel').click();
  await page.waitForSelector('[data-testid="json-dialog"]', { state: 'detached' });

  // ---- 退出循环：位置不变，从原地按整首继续 ----
  await tid('btn-exit-loop').click();
  check('退出后 loop-range 消失', (await tid('loop-range').count()) === 0);
  check('退出后位置仍为 #5', /5 \/ 16/.test(await pos()), await pos());
  await tid('btn-next').click();
  check('退出后下一页到 #6（整首顺序，第5小节尾句）', /6 \/ 16/.test(await pos()) && (await measureNo()) === '5', `${await pos()} m${await measureNo()}`);
  await tid('btn-next').click();
  check('继续到 #7 第6小节', /7 \/ 16/.test(await pos()) && (await measureNo()) === '6');

  // ---- 合法换谱成功 ----
  await tid('btn-open-json').click();
  await page.waitForSelector('[data-testid="json-dialog"]');
  await tid('fill-example-twinkle').click();
  await tid('json-apply').click();
  await page.waitForSelector('[data-testid="json-dialog"]', { state: 'detached' });
  check('合法换谱后标题=小星星', (await tid('score-title').innerText()).includes('小星星'));
  check('新谱位置 1/9', /1 \/ 9/.test(await pos()), await pos());
  check('新谱循环已重置（无 loop-range）', (await tid('loop-range').count()) === 0);
  await shot("07-new-score.png");

  // 键盘翻页真实按键
  await page.keyboard.press('ArrowRight');
  check('真实键盘 → 到 2/9', /2 \/ 9/.test(await pos()), await pos());
} catch (err) {
  check('浏览器流程未抛出异常', false, err?.stack?.split('\n').slice(0, 3).join(' | ') || String(err));
  await page.screenshot({ path: `${SHOT_DIR}error.png` }).catch(() => {});
} finally {
  await browser.close();
}

const failed = steps.filter((s) => !s.ok);
console.log(`\n总计 ${steps.length} 项检查，失败 ${failed.length} 项。截图目录：selfcheck-screenshots/`);
process.exit(failed.length ? 1 : 0);
