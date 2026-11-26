import { expandScore, resolveLoopRange, stepIndex } from '../score/expand';
import { parseScoreText } from '../score/parse';
import type { LoopMarks, PerfEvent, Score } from '../score/types';

export interface TurnerState {
  /** 当前生效的、合法的 JSON 原文 */
  source: string;
  score: Score;
  events: PerfEvent[];
  index: number;
  marks: LoopMarks;
  /** 循环回绕次数（仅作可见反馈） */
  laps: number;
}

export type TurnerAction =
  | { type: 'NEXT' }
  | { type: 'PREV' }
  | { type: 'GOTO'; index: number }
  | { type: 'MARK_START' }
  | { type: 'MARK_END' }
  | { type: 'CLEAR_LOOP' }
  | { type: 'LOAD'; source: string; score: Score; events: PerfEvent[]; index?: number; marks?: LoopMarks }
  | { type: 'RESET_POSITION' };

export function createInitialState(source: string): TurnerState {
  const score = parseScoreText(source);
  const events = expandScore(score);
  return {
    source,
    score,
    events,
    index: 0,
    marks: { startOccId: null, endOccId: null },
    laps: 0,
  };
}

export function turnerReducer(state: TurnerState, action: TurnerAction): TurnerState {
  switch (action.type) {
    case 'NEXT':
    case 'PREV': {
      const range = resolveLoopRange(state.marks, state.events);
      const dir = action.type === 'NEXT' ? 1 : -1;
      const result = stepIndex(state.index, state.events.length, range, dir);
      return {
        ...state,
        index: result.index,
        laps: state.laps + (result.wrapped ? 1 : 0),
      };
    }

    case 'GOTO': {
      const index = Math.max(0, Math.min(action.index, state.events.length - 1));
      return { ...state, index };
    }

    case 'MARK_START': {
      const occId = state.events[state.index]?.occId ?? null;
      return { ...state, marks: { ...state.marks, startOccId: occId }, laps: 0 };
    }

    case 'MARK_END': {
      const occId = state.events[state.index]?.occId ?? null;
      return { ...state, marks: { ...state.marks, endOccId: occId }, laps: 0 };
    }

    case 'CLEAR_LOOP':
      // 只解除循环，index 原样保留 —— 随后即可从所在位置按整首谱继续翻
      return { ...state, marks: { startOccId: null, endOccId: null }, laps: 0 };

    case 'RESET_POSITION':
      return { ...state, index: 0, marks: { startOccId: null, endOccId: null }, laps: 0 };

    case 'LOAD':
      return {
        source: action.source,
        score: action.score,
        events: action.events,
        index: action.index ?? 0,
        marks: action.marks ?? { startOccId: null, endOccId: null },
        laps: 0,
      };

    default:
      return state;
  }
}

const STORAGE_KEY = 'jianpu-turner-state-v1';

interface PersistedState {
  source: string;
  index: number;
  marks: LoopMarks;
}

export function loadPersisted(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (typeof parsed.source !== 'string') return null;
    return {
      source: parsed.source,
      index: typeof parsed.index === 'number' ? parsed.index : 0,
      marks:
        parsed.marks && typeof parsed.marks === 'object'
          ? {
              startOccId: parsed.marks.startOccId ?? null,
              endOccId: parsed.marks.endOccId ?? null,
            }
          : { startOccId: null, endOccId: null },
    };
  } catch {
    return null;
  }
}

export function savePersisted(state: Pick<TurnerState, 'source' | 'index' | 'marks'>): void {
  try {
    const payload: PersistedState = {
      source: state.source,
      index: state.index,
      marks: state.marks,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // 隐私模式 / 存储满时忽略，不影响使用
  }
}
