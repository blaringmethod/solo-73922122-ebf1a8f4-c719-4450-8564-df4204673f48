import type { LoopMarks, LoopRange, PerfEvent } from '../score/types';
import { describeEvent, loopRangeLabel } from '../score/labels';

interface LoopBarProps {
  marks: LoopMarks;
  range: LoopRange | null;
  events: PerfEvent[];
  laps: number;
  onMarkStart: () => void;
  onMarkEnd: () => void;
  onClear: () => void;
}

function markSummary(occId: string | null, events: PerfEvent[]): string {
  if (!occId) return '未标记';
  const ev = events.find((e) => e.occId === occId);
  return ev ? describeEvent(ev) : '标记已失效';
}

export function LoopBar({
  marks,
  range,
  events,
  laps,
  onMarkStart,
  onMarkEnd,
  onClear,
}: LoopBarProps) {
  const active = range !== null;
  return (
    <section className={`loop-bar ${active ? 'is-active' : ''}`} data-testid="loop-bar">
      <div className="loop-actions">
        <button
          type="button"
          className="chip-btn mark-start"
          data-testid="btn-mark-start"
          onClick={onMarkStart}
          title="把当前演奏位置设为循环首（快捷键 [）"
        >
          ① 设为循环首
        </button>
        <button
          type="button"
          className="chip-btn mark-end"
          data-testid="btn-mark-end"
          onClick={onMarkEnd}
          title="把当前演奏位置设为循环尾（快捷键 ]）"
        >
          ② 设为循环尾
        </button>
        <button
          type="button"
          className="chip-btn exit-loop"
          data-testid="btn-exit-loop"
          onClick={onClear}
          disabled={!marks.startOccId && !marks.endOccId}
          title="清除两个标记并退出循环，当前页位置不变（快捷键 Esc）"
        >
          ✕ 退出循环
        </button>
      </div>

      <div className="loop-status" data-testid="loop-status" aria-live="polite">
        {active ? (
          <>
            <span className="loop-tag">循环中</span>
            <span className="loop-range" data-testid="loop-range">
              {loopRangeLabel(range, events)}
            </span>
            <span className="loop-laps" data-testid="loop-laps">
              已回绕 {laps} 次
            </span>
            <span className="loop-tip">← / → 到首尾即双向回绕；退出后从当前位置继续按整首谱翻</span>
          </>
        ) : (
          <>
            <span className="loop-tag idle">未开启循环</span>
            <span className="mark-line" data-testid="mark-start-summary">
              首：{markSummary(marks.startOccId, events)}
            </span>
            <span className="mark-line" data-testid="mark-end-summary">
              尾：{markSummary(marks.endOccId, events)}
            </span>
            <span className="loop-tip">
              按演奏次序把当前页标为首 / 尾；同一小节的不同遍是不同位置，可分别选取
            </span>
          </>
        )}
      </div>
    </section>
  );
}
