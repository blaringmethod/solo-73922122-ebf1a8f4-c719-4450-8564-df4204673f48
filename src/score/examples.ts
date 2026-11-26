import type { Score } from './types';

/** 嵌套反复 + 内外两层尾句的示例，便于一眼验证所有规则 */
export const nestedExample: Score = {
  title: '嵌套反复示例曲',
  composer: '翻谱器自检用',
  body: [
    { no: 1, notes: '1 2 3 1' },
    {
      type: 'repeat',
      label: 'A 段（外层）',
      times: 2,
      body: [
        { no: 2, notes: '3 4 5 -' },
        {
          type: 'repeat',
          label: 'B 句（内层）',
          times: 2,
          body: [{ no: 3, notes: '5 6 5 4 3 1' }],
          endings: [
            { passes: [1], label: '第一尾句', body: [{ no: 4, notes: '2 3 2 -' }] },
            { passes: [2], label: '第二尾句', body: [{ no: 5, notes: '2 5 1 -' }] },
          ],
        },
        { no: 6, notes: '4 3 2 -' },
      ],
      endings: [
        { passes: [1], label: '外层一', body: [{ no: 7, notes: '1 3 5 -' }] },
        { passes: [2], label: '外层二', body: [{ no: 8, notes: '5 4 3 2 1 - - -' }] },
      ],
    },
    { no: 9, notes: '1 - - -' },
  ],
} as unknown as Score;

/** 最简单的普通反复 + 一房 / 二房（小星星片段） */
export const twinkleExample: Score = {
  title: '小星星（反复与一房二房示例）',
  body: [
    { no: 1, notes: '1 1 5 5 | 6 6 5 -' },
    { no: 2, notes: '4 4 3 3 | 2 2 1 -' },
    {
      type: 'repeat',
      label: '副歌',
      times: 2,
      body: [
        { no: 3, notes: '5 5 4 4 | 3 3 2 -' },
        { no: 4, notes: '5 5 4 4 | 3 3 2 -' },
      ],
      endings: [
        { passes: [1], label: '一房', body: [{ no: 5, notes: '2 2 1 -' }] },
        { passes: [2], label: '二房', body: [{ no: 6, notes: '2 2 1 - | 结束句' }] },
      ],
    },
    { no: 7, notes: '1 1 5 5 | 6 6 5 -' },
  ],
} as unknown as Score;

export interface ExampleDef {
  id: string;
  name: string;
  description: string;
  json: string;
}

export const examples: ExampleDef[] = [
  {
    id: 'nested',
    name: '嵌套反复示例',
    description: '外层反复 2 遍，主体内含内层反复与两层尾句',
    json: JSON.stringify(nestedExample, null, 2),
  },
  {
    id: 'twinkle',
    name: '小星星 · 一房二房',
    description: '普通反复段 + 第一 / 第二尾句',
    json: JSON.stringify(twinkleExample, null, 2),
  },
];

export const defaultExample = examples[0];
