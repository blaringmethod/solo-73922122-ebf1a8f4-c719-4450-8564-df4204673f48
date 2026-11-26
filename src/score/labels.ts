import type { LoopRange, PerfEvent } from './types';

/** 完整的反复层遍次描述，例如 “A 段（外层）· 第 1 / 2 遍” */
export function layerText(layer: PerfEvent['path'][number]): string {
  return `${layer.label} · 第 ${layer.pass}/${layer.times} 遍`;
}

/** 序列列表里的紧凑标记，例如 “A段 ①/②” 太复杂，用 “A段·1遍” */
export function layerShort(layer: PerfEvent['path'][number]): string {
  const name = layer.label.length > 8 ? `${layer.label.slice(0, 8)}…` : layer.label;
  return `${name} 第${layer.pass}遍`;
}

export function measureTitle(ev: PerfEvent): string {
  return `第 ${ev.measureNo} 小节`;
}

/** 生成循环标记 / 提示中使用的位置描述 */
export function describeEvent(ev: PerfEvent): string {
  const passes = ev.path.map((l) => `「${l.label}」第${l.pass}遍`).join('，');
  const ending = ev.path
    .filter((l) => l.endingLabel)
    .map((l) => l.endingLabel)
    .join(' / ');
  const extras = [passes, ending ? `正在${ending}` : null].filter(Boolean).join('；');
  return `#${ev.index + 1} 第${ev.measureNo}小节${extras ? `（${extras}）` : ''}`;
}

export function loopRangeLabel(range: LoopRange, events: PerfEvent[]): string {
  const a = events[range.startIndex];
  const b = events[range.endIndex];
  if (!a || !b) return '';
  return `#${range.startIndex + 1} 第${a.measureNo}小节 ↔ #${range.endIndex + 1} 第${b.measureNo}小节`;
}
