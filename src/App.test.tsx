import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';
import { examples } from './score/examples';

function row(index: number): HTMLElement {
  const rows = screen.getAllByTestId('seq-row');
  return rows[index];
}

function positionText(): string {
  return screen.getByTestId('position-label').textContent ?? '';
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('翻谱器网页交互（jsdom 集成）', () => {
  it('首屏载入嵌套示例：16 个演奏位置，当前为第 1 小节', () => {
    render(<App />);
    expect(screen.getByTestId('score-title')).toHaveTextContent('嵌套反复示例曲');
    expect(screen.getByTestId('current-measure-no')).toHaveTextContent('1');
    expect(positionText()).toMatch(/1\s*\/\s*16/);
    expect(screen.getAllByTestId('seq-row')).toHaveLength(16);
  });

  it('逐页前后翻：能看到小节号与各层反复遍次 / 尾句', () => {
    render(<App />);
    const next = screen.getByTestId('btn-next');
    const prev = screen.getByTestId('btn-prev');

    fireEvent.click(next); // #2 m2 外1
    expect(screen.getByTestId('current-measure-no')).toHaveTextContent('2');
    expect(screen.getByTestId('pass-badges')).toHaveTextContent('第 1/2 遍');
    expect(screen.getByTestId('pass-badges')).not.toHaveTextContent('尾句');

    fireEvent.click(next); // #3 m3 外1内1
    expect(screen.getByTestId('current-measure-no')).toHaveTextContent('3');
    expect(screen.getByTestId('pass-badges')).toHaveTextContent('A 段（外层） · 第 1/2 遍');
    expect(screen.getByTestId('pass-badges')).toHaveTextContent('B 句（内层） · 第 1/2 遍');

    fireEvent.click(next); // #4 m4 内1尾句
    expect(screen.getByTestId('current-measure-no')).toHaveTextContent('4');
    expect(screen.getByTestId('ending-badge')).toHaveTextContent('第一尾句');

    fireEvent.click(next); // #5 m3 内2
    expect(screen.getByTestId('current-measure-no')).toHaveTextContent('3');
    expect(screen.getByTestId('pass-badges')).toHaveTextContent('B 句（内层） · 第 2/2 遍');

    // 一直翻到外层第二遍，确认内层重置为第 1 遍
    for (let i = 0; i < 5; i += 1) fireEvent.click(next); // #6..#10 => index9 (#10)
    expect(positionText()).toMatch(/10\s*\/\s*16/);
    expect(screen.getByTestId('current-measure-no')).toHaveTextContent('3');
    const badges = screen.getByTestId('pass-badges').textContent ?? '';
    expect(badges).toContain('A 段（外层） · 第 2/2 遍');
    expect(badges).toContain('B 句（内层） · 第 1/2 遍');

    fireEvent.click(prev); // #9 m2
    expect(positionText()).toMatch(/9\s*\/\s*16/);
    expect(screen.getByTestId('current-measure-no')).toHaveTextContent('2');
  });

  it('循环：选 m3 的两个不同遍作首尾，前后翻双向回绕；退出后从原地继续整首翻', () => {
    render(<App />);

    // 选 #3 (index2, m3 外1内1) 为首
    fireEvent.click(row(2));
    expect(positionText()).toMatch(/3\s*\/\s*16/);
    fireEvent.click(screen.getByTestId('btn-mark-start'));

    // 选 #5 (index4, m3 外1内2) 为尾 —— 同一小节的另一遍
    fireEvent.click(row(4));
    fireEvent.click(screen.getByTestId('btn-mark-end'));

    expect(screen.getByTestId('loop-range')).toHaveTextContent('#3 第3小节');
    expect(screen.getByTestId('loop-range')).toHaveTextContent('#5 第3小节');

    // 尾 -> 下一页 回绕到首
    fireEvent.click(screen.getByTestId('btn-next'));
    expect(positionText()).toMatch(/3\s*\/\s*16/);
    expect(screen.getByTestId('current-measure-no')).toHaveTextContent('3');
    expect(screen.getByTestId('loop-laps')).toHaveTextContent('已回绕 1 次');

    // 首 -> 上一页 反向回绕到尾
    fireEvent.click(screen.getByTestId('btn-prev'));
    expect(positionText()).toMatch(/5\s*\/\s*16/);
    expect(screen.getByTestId('loop-laps')).toHaveTextContent('已回绕 2 次');

    // 退出循环：位置保持 #5
    fireEvent.click(screen.getByTestId('btn-exit-loop'));
    expect(screen.queryByTestId('loop-range')).toBeNull();
    expect(positionText()).toMatch(/5\s*\/\s*16/);

    // 从所在位置继续按整首谱：#5 -> #6 (m5 第二尾句)
    fireEvent.click(screen.getByTestId('btn-next'));
    expect(positionText()).toMatch(/6\s*\/\s*16/);
    expect(screen.getByTestId('current-measure-no')).toHaveTextContent('5');
  });

  it('键盘方向键也能翻页', () => {
    render(<App />);
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(positionText()).toMatch(/2\s*\/\s*16/);
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(positionText()).toMatch(/1\s*\/\s*16/);
  });

  it('换谱输入有误：提示错误，且原谱、位置、循环都保留', () => {
    render(<App />);

    // 先建立循环 #1..#3
    fireEvent.click(row(0));
    fireEvent.click(screen.getByTestId('btn-mark-start'));
    fireEvent.click(row(2));
    fireEvent.click(screen.getByTestId('btn-mark-end'));
    expect(screen.getByTestId('loop-range')).toBeInTheDocument();

    // 打开换谱框，输入非法 JSON 并应用
    fireEvent.click(screen.getByTestId('btn-open-json'));
    const editor = screen.getByTestId('json-editor') as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: '{ "body": [???' } });
    fireEvent.click(screen.getByTestId('json-apply'));

    // 出现错误提示
    const error = screen.getByTestId('json-error');
    expect(error).toBeInTheDocument();
    expect(error.textContent).toMatch(/JSON/);

    // 对话框仍在；背后原谱 / 位置 / 循环未变
    expect(screen.getByTestId('json-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('score-title')).toHaveTextContent('嵌套反复示例曲');
    expect(positionText()).toMatch(/3\s*\/\s*16/);
    expect(screen.getByTestId('loop-range')).toHaveTextContent('#1 第1小节');
    expect(screen.getByTestId('loop-range')).toHaveTextContent('#3 第3小节');

    // 再换成合法的小星星：成功关闭并重置为 9 个位置
    fireEvent.change(editor, { target: { value: examples[1].json } });
    fireEvent.click(screen.getByTestId('json-apply'));
    expect(screen.queryByTestId('json-dialog')).toBeNull();
    expect(screen.getByTestId('score-title')).toHaveTextContent('小星星');
    expect(positionText()).toMatch(/1\s*\/\s*9/);
  });

  it('示例下拉可直接载入小星星', () => {
    render(<App />);
    const select = screen.getByTestId('example-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'twinkle' } });
    expect(screen.getByTestId('score-title')).toHaveTextContent('小星星');
    expect(screen.getAllByTestId('seq-row')).toHaveLength(9);
  });

  it('演奏顺序列表点击可跳转，当前行被高亮且带 aria-selected', () => {
    render(<App />);
    fireEvent.click(row(7));
    expect(positionText()).toMatch(/8\s*\/\s*16/);
    const selected = within(screen.getByTestId('sequence-list')).getByRole('option', {
      selected: true,
    });
    expect(selected.getAttribute('data-index')).toBe('7');
  });
});
