import { MAX_EVENTS } from './parse';
import type { LayerPass, LoopMarks, LoopRange, PerfEvent, Score, ScoreNode } from './types';

/**
 * 把带嵌套反复 / 尾句的谱树展开成一维“演奏次序”。
 *
 * 关键语义：
 * - 反复段主体展开 times 遍；每遍主体后接该遍对应的尾句（如有）。
 * - 每开始外层新的一遍，都会重新递归展开内层节点，因此内层反复自动从第 1 遍重新起算。
 * - 同一源小节在不同遍次产生不同的 PerfEvent（不同 occId / path），可分别选为循环边界。
 */
export function expandScore(score: Score): PerfEvent[] {
  const events: PerfEvent[] = [];

  const walk = (nodes: ScoreNode[], path: LayerPass[]): void => {
    for (const node of nodes) {
      if (events.length >= MAX_EVENTS) {
        throw new Error(`展开后的演奏事件超过上限 ${MAX_EVENTS}，请检查 times 是否过大或谱面是否有误。`);
      }

      if (node.kind === 'measure') {
        events.push({
          occId: `occ-${events.length}`,
          index: events.length,
          nodeId: node.id,
          measureNo: node.no,
          autoNo: node.autoNo,
          label: node.label,
          notes: node.notes,
          path: path.map((layer) => ({ ...layer })),
        });
        continue;
      }

      for (let pass = 1; pass <= node.times; pass += 1) {
        const baseLayer: LayerPass = {
          repeatId: node.id,
          label: node.label,
          pass,
          times: node.times,
          endingLabel: null,
        };

        // 主体：每一遍都重新 walk，内层反复状态（第几遍）自然重置
        walk(node.body, [...path, baseLayer]);

        // 该遍的尾句（如有）
        const ending = node.endings.find((e) => e.passes.includes(pass));
        if (ending) {
          walk(ending.body, [
            ...path,
            { ...baseLayer, endingLabel: ending.label },
          ]);
        }
      }
    }
  };

  walk(score.body, []);

  if (events.length === 0) {
    throw new Error('展开结果为空：谱中没有可演奏的小节。');
  }
  return events;
}

/** 由两个 occId 求出按演奏顺序排列的闭区间；任一标记缺失或失效则返回 null */
export function resolveLoopRange(marks: LoopMarks, events: PerfEvent[]): LoopRange | null {
  if (!marks.startOccId || !marks.endOccId) return null;
  const start = events.find((e) => e.occId === marks.startOccId);
  const end = events.find((e) => e.occId === marks.endOccId);
  if (!start || !end) return null;

  if (start.index <= end.index) {
    return {
      startIndex: start.index,
      endIndex: end.index,
      startOccId: start.occId,
      endOccId: end.occId,
    };
  }
  return {
    startIndex: end.index,
    endIndex: start.index,
    startOccId: end.occId,
    endOccId: start.occId,
  };
}

export type Direction = 1 | -1;

export interface StepResult {
  index: number;
  /** 本次迈步是否在循环首尾发生了回绕 */
  wrapped: boolean;
  /** 非循环状态下是否撞到了整首谱的边界（位置未变） */
  atBoundary: boolean;
}

/**
 * 翻页核心规则：
 * - 有循环区间时：下一页到尾 -> 回到首；上一页到首 -> 回到尾（双向回绕）。
 * - 无循环时：在整首谱范围内移动，到首尾后停住。
 */
export function stepIndex(
  index: number,
  total: number,
  range: LoopRange | null,
  dir: Direction,
): StepResult {
  if (total <= 0) return { index: 0, wrapped: false, atBoundary: true };

  if (range) {
    if (dir === 1) {
      if (index >= range.endIndex) {
        return { index: range.startIndex, wrapped: true, atBoundary: false };
      }
      return { index: Math.min(index + 1, range.endIndex), wrapped: false, atBoundary: false };
    }
    if (index <= range.startIndex) {
      return { index: range.endIndex, wrapped: true, atBoundary: false };
    }
    return { index: Math.max(index - 1, range.startIndex), wrapped: false, atBoundary: false };
  }

  const next = index + dir;
  if (next < 0 || next > total - 1) {
    return { index, wrapped: false, atBoundary: true };
  }
  return { index: next, wrapped: false, atBoundary: false };
}
