import { describe, expect, it } from 'vitest';
import { expandScore, resolveLoopRange, stepIndex } from './expand';
import { parseScoreText } from './parse';
import { examples } from './examples';
import type { LoopMarks } from './types';

const nestedJson = examples[0].json;

function nestedEvents() {
  return expandScore(parseScoreText(nestedJson));
}

describe('parse + expand: 嵌套反复与尾句', () => {
  it('按“两遍主体 + 各遍尾句”展开成 16 个演奏位置', () => {
    const events = nestedEvents();
    expect(events).toHaveLength(16);
    expect(events.map((e) => e.measureNo)).toEqual([
      1, 2, 3, 4, 3, 5, 6, 7, 2, 3, 4, 3, 5, 6, 8, 9,
    ]);
  });

  it('每个演奏位置拥有唯一 occId，同一小节不同遍共享 nodeId', () => {
    const events = nestedEvents();
    const occIds = new Set(events.map((e) => e.occId));
    expect(occIds.size).toBe(events.length);

    const m3 = events.filter((e) => e.measureNo === 3);
    expect(m3).toHaveLength(4);
    expect(new Set(m3.map((e) => e.nodeId)).size).toBe(1);
    expect(new Set(m3.map((e) => e.occId)).size).toBe(4);
  });

  it('徽标路径正确：外层第 1 遍 -> 内层第 1/2 遍与尾句', () => {
    const events = nestedEvents();

    // #3 m3：外1 内1，无尾句
    expect(events[2].path.map((p) => [p.pass, p.times])).toEqual([
      [1, 2],
      [1, 2],
    ]);
    expect(events[2].path.some((p) => p.endingLabel)).toBe(false);

    // #4 m4：内1 的第一尾句
    const innerEnding1 = events[3].path[1];
    expect(innerEnding1.pass).toBe(1);
    expect(innerEnding1.endingLabel).toContain('第一尾句');

    // #6 m5：内2 的第二尾句
    expect(events[5].path[1].pass).toBe(2);
    expect(events[5].path[1].endingLabel).toContain('第二尾句');

    // #8 m7：外层第 1 遍尾句
    expect(events[7].path[0].pass).toBe(1);
    expect(events[7].path[0].endingLabel).toContain('外层一');
  });

  it('外层重来时，内层反复从第一遍重新起算', () => {
    const events = nestedEvents();
    // #9 是外层第 2 遍的 m2
    expect(events[8].path[0].pass).toBe(2);
    // #10 是外层第 2 遍中的第一个 m3：内层 pass 必须重新为 1
    const firstM3InOuter2 = events[9];
    expect(firstM3InOuter2.measureNo).toBe(3);
    expect(firstM3InOuter2.path[0].pass).toBe(2);
    expect(firstM3InOuter2.path[1].pass).toBe(1);
    // #12 是同一外层遍里的第二个 m3：内层 pass=2
    expect(events[11].path[1].pass).toBe(2);
  });

  it('小星星示例：普通反复 + 一房二房顺序正确', () => {
    const events = expandScore(parseScoreText(examples[1].json));
    const nos = events.map((e) => e.measureNo);
    // m1,m2, [m3,m4,m5(一房), m3,m4,m6(二房)], m7
    expect(nos).toEqual([1, 2, 3, 4, 5, 3, 4, 6, 7]);
  });
});

describe('parser 容错与报错', () => {
  it('接受顶层数组与常见别名字段', () => {
    const score = parseScoreText(
      JSON.stringify([
        { number: 1, notation: '1 2 3' },
        { type: 'repeat', count: 2, nodes: [{ no: 2, jianpu: '4 5 6' }] },
      ]),
    );
    const events = expandScore(score);
    expect(events.map((e) => e.measureNo)).toEqual([1, 2, 2]);
  });

  it('接受单个小节对象、对象音符与嵌套 token 数组', () => {
    const score = parseScoreText(
      JSON.stringify({ no: 8, notes: [{ pitch: '1' }, { pitch: '2' }, ['3', '4']] }),
    );
    expect(score.body).toHaveLength(1);
    expect(score.body[0].kind).toBe('measure');
    if (score.body[0].kind === 'measure') {
      expect(score.body[0].notes.join(' ')).toContain('1 2 3 4');
    }
  });

  it('缺少主体时给出中文错误', () => {
    expect(() => parseScoreText(JSON.stringify({ title: '空' }))).toThrow(/body/);
  });

  it('JSON 语法错误时抛出包含原因的错误', () => {
    expect(() => parseScoreText('{ not json')).toThrow(/JSON/);
  });

  it('times 非法时报错并带路径', () => {
    expect(() =>
      parseScoreText(JSON.stringify({ body: [{ type: 'repeat', times: 99, body: [{ notes: '1' }] }] })),
    ).toThrow(/times/);
  });

  it('同一遍绑定两条尾句时报错', () => {
    expect(() =>
      parseScoreText(
        JSON.stringify({
          body: [
            {
              type: 'repeat',
              body: [{ notes: '1' }],
              endings: [
                { passes: [1], body: [{ notes: '2' }] },
                { passes: 1, body: [{ notes: '3' }] },
              ],
            },
          ],
        }),
      ),
    ).toThrow(/只能有一条尾句/);
  });
});

describe('loop range 与翻页规则', () => {
  const total = 16;
  const marks: LoopMarks = { startOccId: 'occ-2', endOccId: 'occ-4' };
  const events = nestedEvents();
  const range = resolveLoopRange(marks, events)!;

  it('由 occId 解析出按演奏顺序的闭区间', () => {
    expect(range.startIndex).toBe(2);
    expect(range.endIndex).toBe(4);
  });

  it('标记顺序点反了时自动按演奏次序归一化', () => {
    const reversed = resolveLoopRange({ startOccId: 'occ-4', endOccId: 'occ-2' }, events)!;
    expect(reversed.startIndex).toBe(2);
    expect(reversed.endIndex).toBe(4);
  });

  it('循环内向后翻：到尾回绕到首', () => {
    expect(stepIndex(2, total, range, 1).index).toBe(3);
    const wrap = stepIndex(4, total, range, 1);
    expect(wrap.index).toBe(2);
    expect(wrap.wrapped).toBe(true);
  });

  it('循环内向前翻：到首反向回绕到尾', () => {
    expect(stepIndex(4, total, range, -1).index).toBe(3);
    const wrap = stepIndex(2, total, range, -1);
    expect(wrap.index).toBe(4);
    expect(wrap.wrapped).toBe(true);
  });

  it('退出循环（range=null）后从所在位置继续按整首谱翻', () => {
    // 假设退出时停在循环尾 #5(index=4)
    expect(stepIndex(4, total, null, 1)).toEqual({
      index: 5,
      wrapped: false,
      atBoundary: false,
    });
    expect(stepIndex(5, total, null, 1).index).toBe(6);
  });

  it('无循环时在整首谱两端停住', () => {
    const atStart = stepIndex(0, total, null, -1);
    expect(atStart.index).toBe(0);
    expect(atStart.atBoundary).toBe(true);
    const atEnd = stepIndex(total - 1, total, null, 1);
    expect(atEnd.index).toBe(total - 1);
    expect(atEnd.atBoundary).toBe(true);
  });

  it('同一小节的不同遍可分别作为循环首尾（m3 的第 1、2 遍）', () => {
    // occ-2 = m3 外1内1；occ-4 = m3 外1内2
    const r = resolveLoopRange({ startOccId: 'occ-2', endOccId: 'occ-4' }, events)!;
    expect(events[r.startIndex].measureNo).toBe(3);
    expect(events[r.endIndex].measureNo).toBe(3);
    expect(events[r.startIndex].occId).not.toBe(events[r.endIndex].occId);
  });
});
