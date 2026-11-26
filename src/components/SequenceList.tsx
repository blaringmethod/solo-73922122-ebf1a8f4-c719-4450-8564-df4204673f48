import { useEffect, useRef } from 'react';
import type { LoopRange, PerfEvent } from '../score/types';
import { layerShort } from '../score/labels';

interface SequenceListProps {
  events: PerfEvent[];
  currentIndex: number;
  range: LoopRange | null;
  onGoto: (index: number) => void;
}

export function SequenceList({ events, currentIndex, range, onGoto }: SequenceListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const el = currentRef.current;
    const container = listRef.current;
    if (!el || !container) return;
    // 只在演奏列表面板内部滚动，避免 scrollIntoView 连带滚动整个窗口
    const elRect = el.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    const pad = 8;
    if (elRect.top < cRect.top + pad) {
      container.scrollBy?.({ top: elRect.top - cRect.top - pad, behavior: 'smooth' });
    } else if (elRect.bottom > cRect.bottom - pad) {
      container.scrollBy?.({ top: elRect.bottom - cRect.bottom + pad, behavior: 'smooth' });
    }
  }, [currentIndex]);

  return (
    <aside className="sequence-card">
      <header className="sequence-header">
        <h3>演奏顺序（展开后 {events.length} 个位置）</h3>
        <p>每一行是一次实际演奏到的小节；同一小节的不同遍分行显示，点击可直接跳转并选作循环边界。</p>
      </header>
      <div className="sequence-list" ref={listRef} data-testid="sequence-list" role="listbox" aria-label="演奏顺序">
        {events.map((ev) => {
          const isCurrent = ev.index === currentIndex;
          const isStart = range?.startIndex === ev.index;
          const isEnd = range?.endIndex === ev.index;
          const insideLoop =
            range !== null && ev.index >= range.startIndex && ev.index <= range.endIndex;
          return (
            <button
              type="button"
              key={ev.occId}
              ref={isCurrent ? currentRef : null}
              role="option"
              aria-selected={isCurrent}
              data-testid="seq-row"
              data-index={ev.index}
              data-current={isCurrent ? 'true' : 'false'}
              onClick={() => onGoto(ev.index)}
              className={[
                'seq-row',
                isCurrent ? 'current' : '',
                insideLoop ? 'in-loop' : '',
                isStart ? 'loop-start' : '',
                isEnd ? 'loop-end' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="seq-index">{ev.index + 1}</span>
              <span className="seq-body">
                <span className="seq-line1">
                  <strong>第{ev.measureNo}小节</strong>
                  <span className="seq-notes">{ev.notes.join(' / ')}</span>
                </span>
                {ev.path.length > 0 ? (
                  <span className="seq-badges">
                    {ev.path.map((layer, i) => (
                      <span key={i} className="seq-badge-wrap">
                        <span className="seq-badge">{layerShort(layer)}</span>
                        {layer.endingLabel ? (
                          <span className="seq-badge ending">{layer.endingLabel}</span>
                        ) : null}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="seq-badges">
                    <span className="seq-badge plain">主体</span>
                  </span>
                )}
              </span>
              <span className="seq-flags">
                {isStart ? <span className="flag flag-start">首</span> : null}
                {isEnd ? <span className="flag flag-end">尾</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
