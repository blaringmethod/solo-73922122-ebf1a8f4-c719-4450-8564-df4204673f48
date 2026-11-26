import type { PerfEvent } from '../score/types';
import { layerText, measureTitle } from '../score/labels';

function NotationLine({ line }: { line: string }) {
  const parts = line.split(/(\|)/g);
  const tokens: string[] = [];
  for (const part of parts) {
    if (part === '|') tokens.push('|');
    else tokens.push(...part.trim().split(/\s+/).filter(Boolean));
  }

  return (
    <div className="notation-line">
      {tokens.map((token, i) =>
        token === '|' ? (
          <span key={i} className="token barline" aria-hidden="true">
            |
          </span>
        ) : (
          <span
            key={i}
            className={
              /^[-—]+$/.test(token) ? 'token sustain' : /[0-9]/.test(token) ? 'token note' : 'token'
            }
          >
            {token}
          </span>
        ),
      )}
    </div>
  );
}

interface StageProps {
  event: PerfEvent;
  index: number;
  total: number;
  inLoop: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export function Stage({ event, index, total, inLoop, onPrev, onNext }: StageProps) {
  return (
    <section className="stage-card" data-testid="stage" aria-label="当前谱页">
      <div className="stage-top">
        <div className="measure-heading">
          <span className="measure-no" data-testid="current-measure-no">
            {event.measureNo}
          </span>
          <div className="measure-meta">
            <h2>{measureTitle(event)}</h2>
            {event.label ? <span className="measure-label">{event.label}</span> : null}
            <span className="occurrence-hint">
              源小节序号 {event.autoNo} · 演奏中的第 {index + 1} 个位置
            </span>
          </div>
        </div>
        <div className="position-pill" data-testid="position-label">
          演奏位置 <strong>{index + 1}</strong> / {total}
          {inLoop ? <span className="in-loop-dot" title="当前处于循环区间内">循环中</span> : null}
        </div>
      </div>

      <div className="badges" data-testid="pass-badges" aria-label="各层反复遍次">
        {event.path.length === 0 ? (
          <span className="badge badge-plain">主体（不在反复段内）</span>
        ) : (
          event.path.map((layer, i) => (
            <span className="badge-chain" key={layer.repeatId + i}>
              {i > 0 ? <span className="badge-arrow">└</span> : null}
              <span className="badge badge-repeat" data-testid="pass-badge">
                {layerText(layer)}
              </span>
              {layer.endingLabel ? (
                <span className="badge badge-ending" data-testid="ending-badge">
                  ♪ {layer.endingLabel}
                </span>
              ) : null}
            </span>
          ))
        )}
      </div>

      <div className="notation" data-testid="current-notes" aria-label="简谱内容">
        {event.notes.map((line, i) => (
          <NotationLine key={i} line={line} />
        ))}
      </div>

      <div className="stage-nav">
        <button
          type="button"
          className="nav-btn prev"
          data-testid="btn-prev"
          onClick={onPrev}
          aria-label="上一个演奏位置"
        >
          <span className="nav-arrow">‹</span>
          <span className="nav-text">
            上一页
            <kbd>←</kbd>
          </span>
        </button>
        <div className="nav-center-hint">
          {inLoop ? '循环区间内：两端继续翻页会回绕' : '使用 ← → 方向键 / 空格翻页'}
        </div>
        <button
          type="button"
          className="nav-btn next"
          data-testid="btn-next"
          onClick={onNext}
          aria-label="下一个演奏位置"
        >
          <span className="nav-text">
            下一页
            <kbd>→</kbd>
          </span>
          <span className="nav-arrow">›</span>
        </button>
      </div>
    </section>
  );
}
