# 简谱翻谱器（JSON Jianpu Page Turner）

乐手粘贴 JSON 简谱后，按**实际演奏次序**前后翻页：看到简谱、小节号，以及当前位置在
**每一层反复中的遍次**和所处尾句。支持嵌套反复、各遍尾句（房子）、按演奏事件标记循环，
以及换谱失败时完整保留原谱 / 位置 / 循环。

- 技术栈：Vite + React 18 + TypeScript（纯函数谱面引擎 + Vitest + Testing Library）
- 交付：多阶段 Dockerfile + Docker Compose（构建静态包，nginx 托管）

---

## 一、用 Docker Compose 启动（推荐）

```bash
docker compose up --build -d
```

启动后访问：

- <http://localhost:8080>（默认）
- <http://localhost:5173>（同样映射到容器的 80 端口，方便环境探测）

停止：

```bash
docker compose down
```

> 若本机没有 Docker，也可以直接本地运行：`npm install && npm run dev`，
> 打开 Vite 提示的 <http://localhost:5173>。生产构建：`npm run build && npm run preview`。

---

## 二、它如何理解“演奏次序”

谱面是一棵可嵌套的树。系统先把它**展开成一维演奏事件序列**，一页 = 一次实际演奏到的小节：

1. 反复段主体弹 `times`（默认 2）遍；
2. 每遍弹完主体，接上该遍 `passes` 对应的尾句（如有）；
3. 外层反复每重来一遍，都会重新展开内层，因此**内层反复自动从第一遍起算**；
4. 同一源小节在不同遍次是序列中的不同事件（独立 `occId`），所以
   **同一小节的不同遍可以分别选为循环首 / 尾**。

内置“嵌套反复示例”展开后共 16 个位置：

```
小节号: 1 | 2 3 4 3 5 6 7 | 2 3 4 3 5 6 8 | 9
         \____ 外层第1遍(含尾句7) ____/   \ 外层第2遍(含尾句8) /
```

其中第 3 小节出现 4 次（外1内1、外1内2、外2内1、外2内2），页面徽标会分别标明。

---

## 三、JSON 格式

最简形式（顶层也可以直接是数组）：

```json
{
  "title": "曲名（可选）",
  "body": [
    { "no": 1, "notes": "1 2 3 1" },
    {
      "type": "repeat",
      "label": "A段",
      "times": 2,
      "body": [
        { "no": 2, "notes": "3 4 5 -" },
        {
          "type": "repeat",
          "label": "B句",
          "times": 2,
          "body": [{ "no": 3, "notes": "5 6 5 4 3 1" }],
          "endings": [
            { "passes": [1], "body": [{ "no": 4, "notes": "2 3 2 -" }] },
            { "passes": [2], "body": [{ "no": 5, "notes": "2 5 1 -" }] }
          ]
        }
      ],
      "endings": [
        { "passes": [1], "body": [{ "no": 6, "notes": "1 3 5 -" }] },
        { "passes": [2], "body": [{ "no": 7, "notes": "1 - - -" }] }
      ]
    },
    { "no": 8, "notes": "1 - - -" }
  ]
}
```

字段说明与容错：

| 概念 | 规范字段 | 也兼容的写法 |
| --- | --- | --- |
| 乐谱主体 | `body` | `measures` / `nodes` / `sections` / `items`，或顶层直接给数组 |
| 小节简谱 | `notes` | `notation` / `jianpu` / `content` / `text`；字符串、多行文本或数组 |
| 小节号 | `no` | `number` / `measureNo` / `measureNumber`；省略时按文档顺序自动编号 |
| 反复遍数 | `times` | `repeatTimes` / `count` / `repeat`（`true` 视为 2），默认 2 |
| 尾句 | `endings` | `branches` / `voltas`；`passes` 可写 `1` 或 `[1, 2]` |
| 节点类型 | `"type": "repeat"` | 省略 `type` 时：有 `body` 数组且无 `notes` 即视为反复段 |

校验失败会给出带路径的中文错误（例如 `body[2].endings[0]：…`）。
**换谱失败时不会改动当前状态**：原谱、翻页位置、循环首尾全部保留，错误显示在输入框下方。

---

## 四、操作

- `→` / `空格` / `PageDown`：下一页；`←` / `PageUp`：上一页
- `[`：把当前演奏事件设为循环首；`]`：设为循环尾
- `Esc` 或“退出循环”：清除循环区间，**当前页位置不变**，之后按整首谱继续翻
- `Home` / `End`：跳到循环首 / 尾（无循环时为全曲开头 / 结尾）
- 右侧“演奏顺序”列表列出全部展开事件，点击任意行直接跳转；`首` / `尾` 标记循环边界

循环规则：

- 循环区间是两个**演奏事件**之间的闭区间；两个标记点反了会自动按演奏顺序归一化。
- 循环内：下一页到尾 → 回绕到首；上一页到首 → 反向回绕到尾。
- 退出循环后，从当前所在位置继续，后续翻页走整首谱顺序。

---

## 五、自测

```bash
npm test        # 25 个用例：引擎 18 + 组件集成 7
npm run build   # 类型检查 + 生产构建
```

真实浏览器走查脚本（需先 `npm run build` 并启动 `npx vite preview --port 8099`；
若 Playwright 自带 Chromium 下载慢，可用 `PW_EXECUTABLE=/path/to/chromium` 指定系统浏览器）：

```bash
node e2e/browser-check.mjs http://localhost:8099
```

35 项浏览器断言覆盖：嵌套展开、各层遍次 / 尾句徽标、外层重来后内层重置、
同一小节不同遍设为首尾、双向回绕、非法 JSON 保留原状态、退出循环后续翻、合法换谱与键盘翻页；
截图写到 `selfcheck-screenshots/`（含桌面循环态、错误保留态与移动端）。

Docker 镜像内执行的也是 `npm ci && npm run build`，因此类型检查或测试外的构建错误会直接中断镜像构建。

---

## 六、目录结构

```
src/
  score/
    types.ts        # 数据模型
    parse.ts        # JSON 解析 / 别名兼容 / 中文校验
    expand.ts       # 谱树 -> 演奏事件序列；循环区间与迈步规则
    labels.ts       # 徽标 / 位置描述
    examples.ts     # 两首内置示例
    engine.test.ts  # 引擎单测
  state/turner.ts   # useReducer 状态、localStorage 持久化
  components/       # Stage / LoopBar / SequenceList / 两个对话框
  App.tsx
e2e/browser-check.mjs
Dockerfile / nginx.conf / docker-compose.yml
```

## 七、已知边界 / 后续可做

- 一页对应一个“实际演奏到的小节事件”；尚未做整页多小节排版与自动缩放。
- 简谱按文本渲染（数字、`-` 延音、`|` 小节线有基础样式），尚未渲染高低音点、减时线、连音线等二维谱面符号。
- 循环为手动标记的两点闭区间，暂不支持“循环 N 遍后自动退出”和多个循环段。
- 本环境没有 Docker 守护进程，compose 文件只做了结构校验；镜像构建步骤已在宿主机用等价的 `npm ci` / `npm run build` 验证，尚未在本机实际执行 `docker compose up`。
