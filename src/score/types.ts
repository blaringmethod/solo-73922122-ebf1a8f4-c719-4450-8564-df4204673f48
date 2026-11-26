// 简谱数据模型与演奏事件类型

/** 小节节点：一页展示一个“实际演奏到的小节 occurrence” */
export interface MeasureNode {
  kind: 'measure';
  /** 规范化后的稳定 id（同一源小节的不同遍共享 nodeId） */
  id: string;
  /** 显式小节号（JSON 中给出时），否则用 autoNo */
  no: number | string;
  /** 文档顺序自动小节号（源小节只数一次，不按演奏重复计数） */
  autoNo: number;
  label?: string;
  /** 简谱文本，按行保存 */
  notes: string[];
}

/** 尾句 / 房子：在反复段的指定遍次弹完主体后演奏 */
export interface Ending {
  id: string;
  /** 该尾句适用于哪些遍次，例如 [1] 或 [2, 3] */
  passes: number[];
  label: string;
  body: ScoreNode[];
}

/** 反复段节点：主体按 times 展开多遍，每遍后可接对应尾句 */
export interface RepeatNode {
  kind: 'repeat';
  id: string;
  label: string;
  /** 总遍数，普通反复段为 2 */
  times: number;
  body: ScoreNode[];
  endings: Ending[];
}

export type ScoreNode = MeasureNode | RepeatNode;

export interface Score {
  title: string;
  composer?: string;
  body: ScoreNode[];
}

/** 当前演奏事件所处的某一层反复的遍次信息 */
export interface LayerPass {
  repeatId: string;
  label: string;
  /** 当前是该反复段的第几遍（从 1 开始） */
  pass: number;
  times: number;
  /** 若事件位于该层某遍的尾句中，这里是尾句名称，否则为 null */
  endingLabel: string | null;
}

/** 展开后的一次演奏位置（同一源小节在不同遍次是不同的 PerfEvent） */
export interface PerfEvent {
  /** 演奏顺序内唯一，例如 occ-3 */
  occId: string;
  /** 在展开序列中的下标 */
  index: number;
  /** 源小节节点 id，不同遍次的同一小节相同 */
  nodeId: string;
  measureNo: number | string;
  autoNo: number;
  label?: string;
  notes: string[];
  /** 由外到内的反复层遍次路径 */
  path: LayerPass[];
}

/** 循环标记：绑定到具体演奏事件（因此同一小节的不同遍可分别选中） */
export interface LoopMarks {
  startOccId: string | null;
  endOccId: string | null;
}

export interface LoopRange {
  startIndex: number;
  endIndex: number;
  startOccId: string;
  endOccId: string;
}
