// 补充截图：桌面格式说明弹窗 + 移动端首屏/循环态
import { chromium } from 'playwright';

const EXEC = process.env.PW_EXECUTABLE || undefined;
const DIR = '/workspace/selfcheck-screenshots/';
const browser = await chromium.launch({
  headless: true,
  executablePath: EXEC,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

// 桌面：格式说明
let page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto('http://localhost:8099', { waitUntil: 'networkidle' });
await page.getByTestId('btn-help').click();
await page.waitForSelector('[data-testid="help-dialog"]');
await page.waitForTimeout(150);
await page.screenshot({ path: `${DIR}08-help-dialog.png` });
await page.keyboard.press('Escape');
await page.waitForSelector('[data-testid="help-dialog"]', { state: 'detached' });

// 桌面：修正后的小节线（小星星）
await page.getByTestId('example-select').selectOption('twinkle');
await page.waitForTimeout(250);
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: `${DIR}09-barline.png` });
await page.close();

// 移动：iPhone 尺寸首屏
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
page = await ctx.newPage();
await page.goto('http://localhost:8099', { waitUntil: 'networkidle' });
await page.waitForTimeout(200);
await page.screenshot({ path: `${DIR}10-mobile-top.png` });

// 移动：翻两页后的徽标
await page.getByTestId('btn-next').click();
await page.getByTestId('btn-next').click();
await page.waitForTimeout(200);
await page.screenshot({ path: `${DIR}11-mobile-badges.png` });

console.log('extra screenshots done');
await browser.close();
