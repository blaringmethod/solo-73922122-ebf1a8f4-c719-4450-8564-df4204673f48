import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Stage } from './components/Stage';
import { LoopBar } from './components/LoopBar';
import { SequenceList } from './components/SequenceList';
import { JsonDialog } from './components/JsonDialog';
import { HelpDialog } from './components/HelpDialog';
import { defaultExample, examples } from './score/examples';
import { expandScore, resolveLoopRange, stepIndex } from './score/expand';
import { parseScoreText } from './score/parse';
import { describeEvent } from './score/labels';
import {
  createInitialState,
  loadPersisted,
  savePersisted,
  turnerReducer,
  type TurnerState,
} from './state/turner';
import type { LoopMarks } from './score/types';

function initState(): TurnerState {
  const persisted = loadPersisted();
  if (persisted) {
    try {
      const base = createInitialState(persisted.source);
      const index = Math.max(0, Math.min(persisted.index, base.events.length - 1));
      const exists = (id: string | null) =>
        id === null || base.events.some((e) => e.occId === id);
      const marks: LoopMarks =
        exists(persisted.marks.startOccId) && exists(persisted.marks.endOccId)
          ? persisted.marks
          : { startOccId: null, endOccId: null };
      return { ...base, index, marks };
    } catch {
      // 持久化的内容若已不合法，回退到内置示例
    }
  }
  return createInitialState(defaultExample.json);
}

interface Notice {
  id: number;
  text: string;
  tone: 'info' | 'warn' | 'loop';
}

export default function App() {
  const [state, dispatch] = useReducer(turnerReducer, undefined, initState);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeTimer = useRef<number | null>(null);

  const range = useMemo(
    () => resolveLoopRange(state.marks, state.events),
    [state.marks, state.events],
  );
  const current = state.events[state.index] ?? state.events[0];

  useEffect(() => {
    savePersisted(state);
  }, [state.source, state.index, state.marks]);

  const notify = useCallback((text: string, tone: Notice['tone'] = 'info') => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    setNotice({ id: Date.now(), text, tone });
    noticeTimer.current = window.setTimeout(() => setNotice(null), 3200);
  }, []);

  const handleStep = useCallback(
    (dir: 1 | -1) => {
      const result = stepIndex(state.index, state.events.length, range, dir);
      dispatch(dir === 1 ? { type: 'NEXT' } : { type: 'PREV' });
      if (result.wrapped && range) {
        notify(
          dir === 1
            ? `到达循环尾，回绕到循环首（第 ${range.startIndex + 1} 个位置）`
            : `到达循环首，反向回绕到循环尾（第 ${range.endIndex + 1} 个位置）`,
          'loop',
        );
      } else if (result.atBoundary) {
        notify(
          dir === 1 ? '已经是整首谱的最后一个位置' : '已经是整首谱的最前一个位置',
          'warn',
        );
      }
    },
    [state.index, state.events.length, range, notify],
  );

  const handleMarkStart = useCallback(() => {
    dispatch({ type: 'MARK_START' });
    notify(`已设循环首：${describeEvent(current)}`, 'loop');
  }, [current, notify]);

  const handleMarkEnd = useCallback(() => {
    const nextMarks: LoopMarks = { ...state.marks, endOccId: current.occId };
    const nextRange = resolveLoopRange(nextMarks, state.events);
    dispatch({ type: 'MARK_END' });
    if (nextRange) {
      notify(
        `已设循环尾，循环区间生效：#${nextRange.startIndex + 1} ↔ #${nextRange.endIndex + 1}，翻页将双向回绕`,
        'loop',
      );
    } else {
      notify(`已设循环尾：${describeEvent(current)}`, 'loop');
    }
  }, [current, state.marks, state.events, notify]);

  const handleClearLoop = useCallback(() => {
    if (!state.marks.startOccId && !state.marks.endOccId) return;
    dispatch({ type: 'CLEAR_LOOP' });
    notify('已退出循环，当前位置保持不变；继续翻页按整首谱进行。', 'info');
  }, [state.marks, notify]);

  const handleGoto = useCallback(
    (index: number) => {
      dispatch({ type: 'GOTO', index });
    },
    [],
  );

  /** 换谱：解析成功才 dispatch；失败返回错误，现有 state（谱/位置/循环）原封不动 */
  const handleApplyJson = useCallback(
    (text: string): string | null => {
      try {
        const score = parseScoreText(text);
        const events = expandScore(score);
        dispatch({ type: 'LOAD', source: text, score, events });
        setJsonOpen(false);
        notify(`已载入《${score.title}》：展开为 ${events.length} 个演奏位置，位置与循环已重置。`);
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    },
    [notify],
  );

  const loadExample = useCallback(
    (json: string) => {
      const error = handleApplyJson(json);
      if (error) notify(error, 'warn');
    },
    [handleApplyJson, notify],
  );

  // 键盘翻页（输入框 / 对话框打开时不抢占）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Esc 优先：关闭打开的对话框；没有对话框时退出循环
      if (e.key === 'Escape') {
        if (helpOpen) {
          setHelpOpen(false);
          return;
        }
        if (jsonOpen) {
          setJsonOpen(false);
          return;
        }
        handleClearLoop();
        return;
      }

      if (jsonOpen || helpOpen) return;
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);
      if (typing) return;

      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
          e.preventDefault();
          handleStep(1);
          break;
        case ' ':
          e.preventDefault();
          handleStep(1);
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          handleStep(-1);
          break;
        case '[':
          e.preventDefault();
          handleMarkStart();
          break;
        case ']':
          e.preventDefault();
          handleMarkEnd();
          break;
        case 'Home':
          e.preventDefault();
          dispatch({ type: 'GOTO', index: range ? range.startIndex : 0 });
          break;
        case 'End':
          e.preventDefault();
          dispatch({
            type: 'GOTO',
            index: range ? range.endIndex : state.events.length - 1,
          });
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    jsonOpen,
    helpOpen,
    handleStep,
    handleMarkStart,
    handleMarkEnd,
    handleClearLoop,
    range,
    state.events.length,
  ]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ♪
          </span>
          <div>
            <h1>简谱翻谱器</h1>
            <p className="brand-sub">JSON 简谱 · 嵌套反复 / 尾句 · 演奏位置循环</p>
          </div>
        </div>
        <div className="header-actions">
          <label className="example-picker">
            <span className="sr-only">载入示例谱</span>
            <select
              data-testid="example-select"
              defaultValue=""
              onChange={(e) => {
                const ex = examples.find((x) => x.id === e.target.value);
                if (ex) loadExample(ex.json);
                e.target.value = '';
              }}
            >
              <option value="" disabled>
                选择示例谱…
              </option>
              {examples.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn ghost"
            data-testid="btn-help"
            onClick={() => setHelpOpen(true)}
          >
            格式说明
          </button>
          <button
            type="button"
            className="btn primary"
            data-testid="btn-open-json"
            onClick={() => setJsonOpen(true)}
          >
            粘贴 JSON 换谱
          </button>
        </div>
      </header>

      <div className="score-title-bar">
        <h2 data-testid="score-title">{state.score.title}</h2>
        {state.score.composer ? <span className="composer">{state.score.composer}</span> : null}
      </div>

      <LoopBar
        marks={state.marks}
        range={range}
        events={state.events}
        laps={state.laps}
        onMarkStart={handleMarkStart}
        onMarkEnd={handleMarkEnd}
        onClear={handleClearLoop}
      />

      <main className="layout">
        <Stage
          event={current}
          index={state.index}
          total={state.events.length}
          inLoop={range !== null}
          onPrev={() => handleStep(-1)}
          onNext={() => handleStep(1)}
        />
        <SequenceList
          events={state.events}
          currentIndex={state.index}
          range={range}
          onGoto={handleGoto}
        />
      </main>

      <footer className="app-footer">
        <span>
          快捷键：<kbd>←</kbd>/<kbd>→</kbd> 翻页 · <kbd>[</kbd>/<kbd>]</kbd> 标记循环首/尾 ·{' '}
          <kbd>Esc</kbd> 退出循环
        </span>
      </footer>

      <div
        className={`toast ${notice ? `show tone-${notice.tone}` : ''}`}
        data-testid="notice"
        role="status"
        aria-live="polite"
      >
        {notice?.text ?? ''}
      </div>

      <JsonDialog
        open={jsonOpen}
        currentSource={state.source}
        onClose={() => setJsonOpen(false)}
        onApply={handleApplyJson}
        onOpenHelp={() => setHelpOpen(true)}
      />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
