import type { Ending, Score, ScoreNode } from './types';

/** 解析并校验粘贴的 JSON 文本；任何问题都抛出带中文说明（含路径）的 Error */
export function parseScoreText(text: string): Score {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('内容为空：请粘贴简谱 JSON 后再应用。');
  }

  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`JSON 语法有误，无法解析：${msg}`);
  }

  return normalizeScore(data);
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined) return obj[k];
  }
  return undefined;
}

function pickArray(obj: Record<string, unknown>, keys: string[]): unknown[] | undefined {
  const v = pick(obj, keys);
  if (v === undefined) return undefined;
  if (Array.isArray(v)) return v;
  return undefined;
}

const BODY_KEYS = ['body', 'nodes', 'children', 'measures', 'bars', 'sections', 'items', '乐谱', '小节'];
const NOTES_KEYS = ['notes', 'notation', 'jianpu', 'content', 'score', 'text', '简谱', '音符'];
const NO_KEYS = ['no', 'number', 'measureNo', 'measureNumber', 'bar', '小节号'];
const TYPE_KEYS = ['type', 'kind', 'nodeType', '类型'];
const TIMES_KEYS = ['times', 'repeatTimes', 'passesCount', 'count', 'plays', '遍数'];
const ENDINGS_KEYS = ['endings', 'branches', 'voltas', 'tails', '尾句'];
const PASSES_KEYS = ['passes', 'pass', 'when', '遍次'];

const MAX_TIMES = 20;
export const MAX_EVENTS = 20000;

function noteTokenToString(token: unknown, path: string): string {
  if (typeof token === 'string') return token;
  if (typeof token === 'number' && Number.isFinite(token)) return String(token);
  if (isRecord(token)) {
    const v = pick(token, [
      'text',
      'note',
      'jianpu',
      'notation',
      'pitch',
      'name',
      'token',
      'value',
      '唱名',
      '音符',
    ]);
    if (typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v))) {
      return String(v);
    }
  }
  throw new Error(`${path}：notes 中的音符应为字符串、数字，或带 note/text/pitch 字段的对象。`);
}

function normalizeNotes(raw: unknown, path: string): string[] {
  if (raw === undefined || raw === null) {
    throw new Error(`${path}：小节缺少简谱内容字段 notes（字符串或字符串数组）。`);
  }
  let lines: unknown[];
  if (typeof raw === 'string') lines = raw.split('\n');
  else if (Array.isArray(raw)) lines = raw;
  else if (typeof raw === 'number') lines = [String(raw)];
  else throw new Error(`${path}：notes 应为字符串或数组。`);

  const out = lines
    .map((line, i) => {
      if (typeof line === 'string') return line.trim();
      if (typeof line === 'number' && Number.isFinite(line)) return String(line);
      if (Array.isArray(line)) {
        return line.map((tok) => noteTokenToString(tok, `${path}[${i}]`)).join(' ').trim();
      }
      return noteTokenToString(line, `${path}[${i}]`).trim();
    })
    .filter((line) => line.length > 0);

  if (out.length === 0) throw new Error(`${path}：notes 不能为空。`);
  return out;
}

function normalizePasses(raw: unknown, fallbackLastPass: number | null, path: string): number[] {
  if (raw === undefined || raw === null) {
    if (fallbackLastPass != null) return [fallbackLastPass];
    throw new Error(`${path}：尾句缺少 passes（例如 [1] 表示第一遍）。`);
  }
  const values = Array.isArray(raw) ? raw : [raw];
  const passes: number[] = [];
  for (const v of values) {
    const n = typeof v === 'string' ? Number(v.trim()) : v;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) {
      throw new Error(`${path}：passes 中的遍次必须是 ≥1 的整数，收到 ${JSON.stringify(v)}。`);
    }
    passes.push(n);
  }
  if (passes.length === 0) throw new Error(`${path}：passes 不能为空数组。`);
  return Array.from(new Set(passes)).sort((a, b) => a - b);
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function normalizeEnding(raw: unknown, index: number, times: number, path: string): Ending {
  if (!isRecord(raw)) throw new Error(`${path}[${index}]：尾句必须是对象。`);
  const p = `${path}.endings[${index}]`;
  const passes = normalizePasses(pick(raw, PASSES_KEYS), times, p);
  for (const pass of passes) {
    if (pass > times) {
      throw new Error(`${p}：尾句指定了第 ${pass} 遍，但该反复段总共只有 ${times} 遍。`);
    }
  }
  const bodyRaw = pickArray(raw, BODY_KEYS);
  if (!bodyRaw || bodyRaw.length === 0) {
    throw new Error(`${p}：尾句缺少非空的 body（小节数组）。`);
  }
  const id = (() => {
    const v = pick(raw, ['id', 'key']);
    return typeof v === 'string' && v ? v : nextId('ending');
  })();
  const labelRaw = pick(raw, ['label', 'name', 'title', '尾句名']);
  const label =
    typeof labelRaw === 'string' && labelRaw.trim()
      ? labelRaw.trim()
      : `第${passes.join('、')}遍尾句`;

  return {
    id,
    passes,
    label,
    body: bodyRaw.map((node, i) => normalizeNode(node, i, `${p}.body`, `${id}-${i}`)),
  };
}

function normalizeNode(raw: unknown, index: number, parentPath: string, idSeed: string): ScoreNode {
  const path = `${parentPath}[${index}]`;
  if (!isRecord(raw)) throw new Error(`${path}：节点必须是对象。`);

  const typeRaw = pick(raw, TYPE_KEYS);
  const type = typeof typeRaw === 'string' ? typeRaw.toLowerCase() : undefined;
  const repeatTypeNames = ['repeat', 'section', 'loop', '反复', '反复段'];
  const measureTypeNames = ['measure', 'bar', 'note', '小节'];

  const notesRaw = pick(raw, NOTES_KEYS);
  const bodyRaw = pickArray(raw, BODY_KEYS);
  const isRepeatType = repeatTypeNames.includes(type ?? '');
  const isMeasureType = measureTypeNames.includes(type ?? '');

  // 有显式类型按类型；否则按字段推断：没有 notes 但有 body 数组 => 反复段
  const looksLikeRepeat = isRepeatType
    ? true
    : isMeasureType
      ? false
      : notesRaw === undefined && bodyRaw !== undefined;

  const explicitId = pick(raw, ['id', 'key']);
  const id =
    typeof explicitId === 'string' && explicitId.trim() ? explicitId.trim() : `node-${idSeed}`;

  if (looksLikeRepeat) {
    if (!bodyRaw || bodyRaw.length === 0) {
      throw new Error(`${path}：反复段必须包含非空的 body（节点数组）。`);
    }

    let times = 2;
    const timesRaw = pick(raw, TIMES_KEYS) ?? pick(raw, ['repeat']);
    if (timesRaw === true) times = 2;
    else if (timesRaw !== undefined && timesRaw !== false) {
      const n = typeof timesRaw === 'string' ? Number(timesRaw.trim()) : timesRaw;
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 2 || n > MAX_TIMES) {
        throw new Error(`${path}：反复遍数 times 必须是 2–${MAX_TIMES} 的整数（普通反复段为 2）。`);
      }
      times = n;
    }

    const labelRaw = pick(raw, ['label', 'name', 'title', 'caption', '名称']);
    const label =
      typeof labelRaw === 'string' && labelRaw.trim() ? labelRaw.trim() : `反复段 ${idSeed}`;

    const endingsRaw = pickArray(raw, ENDINGS_KEYS) ?? [];
    const endings = endingsRaw.map((e, i) => normalizeEnding(e, i, times, path));

    const seen = new Map<number, number>();
    endings.forEach((e, ei) => {
      for (const pass of e.passes) {
        const prev = seen.get(pass);
        if (prev !== undefined) {
          throw new Error(
            `${path}.endings：第 ${pass} 遍同时绑定到了 endings[${prev}] 和 endings[${ei}]，每遍只能有一条尾句。`,
          );
        }
        seen.set(pass, ei);
      }
    });

    return {
      kind: 'repeat',
      id,
      label,
      times,
      body: bodyRaw.map((node, i) => normalizeNode(node, i, `${path}.body`, `${idSeed}-${i}`)),
      endings,
    };
  }

  // 小节节点
  if (notesRaw === undefined) {
    throw new Error(
      `${path}：无法识别的节点——小节需要 notes（简谱文本），反复段需要 body（节点数组）。`,
    );
  }
  const notes = normalizeNotes(notesRaw, path);
  const noRaw = pick(raw, NO_KEYS);
  let no: number | string | undefined;
  if (noRaw !== undefined && noRaw !== null && noRaw !== '') {
    if (typeof noRaw === 'number' && Number.isFinite(noRaw)) no = noRaw;
    else if (typeof noRaw === 'string' && noRaw.trim()) no = noRaw.trim();
    else throw new Error(`${path}：小节号 no 应为数字或非空字符串。`);
  }
  const labelRaw = pick(raw, ['label', 'name', 'title', '标记']);
  const label =
    typeof labelRaw === 'string' && labelRaw.trim() ? labelRaw.trim() : undefined;

  return {
    kind: 'measure',
    id,
    no: no ?? 0, // autoNo 稍后回填
    autoNo: 0,
    label,
    notes,
  };
}

/** 遍历源树，按文档顺序给小节编自动小节号，并在 no 缺省时回填 */
function assignAutoNumbers(nodes: ScoreNode[], counter: { n: number }): void {
  for (const node of nodes) {
    if (node.kind === 'measure') {
      counter.n += 1;
      node.autoNo = counter.n;
      if (node.no === 0) node.no = counter.n;
    } else {
      assignAutoNumbers(node.body, counter);
      for (const ending of node.endings) assignAutoNumbers(ending.body, counter);
    }
  }
}

function normalizeScore(data: unknown): Score {
  idCounter = 0;

  let root: unknown = data;
  if (isRecord(root)) {
    // 兼容常见外层包裹：{ score: {...} } / { data: {...} }
    const wrapper = pick(root, ['score', 'data', '乐谱']);
    if (
      (isRecord(wrapper) || Array.isArray(wrapper)) &&
      pickArray(root as Record<string, unknown>, BODY_KEYS) === undefined
    ) {
      root = wrapper;
    }
  }

  let rootRecord: Record<string, unknown> = {};
  let bodyRaw: unknown[] | undefined;

  if (Array.isArray(root)) {
    bodyRaw = root;
  } else if (isRecord(root)) {
    rootRecord = root;
    bodyRaw = pickArray(root, BODY_KEYS);
    // 直接粘贴了单个小节 / 单个节点对象：{ no:1, notes:'...' }
    if (!bodyRaw && pick(root, NOTES_KEYS) !== undefined) {
      bodyRaw = [root];
    }
  } else {
    throw new Error('顶层结构无效：请直接粘贴节点数组，或包含 body / measures 数组的对象。');
  }

  if (!bodyRaw) {
    throw new Error(
      '未找到乐谱主体：顶层需要 body（或 measures / nodes / sections）数组。点击“格式说明”查看示例。',
    );
  }
  if (bodyRaw.length === 0) {
    throw new Error('乐谱主体为空：body 数组至少要包含一个小节。');
  }

  const titleRaw = pick(rootRecord, ['title', 'name', '曲名', '标题']);
  const title = typeof titleRaw === 'string' && titleRaw.trim() ? titleRaw.trim() : '未命名曲谱';
  const composerRaw = pick(rootRecord, ['composer', 'author', 'artist', '作曲']);
  const composer =
    typeof composerRaw === 'string' && composerRaw.trim() ? composerRaw.trim() : undefined;

  const body = bodyRaw.map((node, i) => normalizeNode(node, i, 'body', `r${i}`));
  assignAutoNumbers(body, { n: 0 });

  const score: Score = { title, body };
  if (composer) score.composer = composer;
  return score;
}

/** 供 UI 做轻量校验：只解析不抛异常 */
export function tryParseScore(text: string): { ok: true; score: Score } | { ok: false; error: string } {
  try {
    return { ok: true, score: parseScoreText(text) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
