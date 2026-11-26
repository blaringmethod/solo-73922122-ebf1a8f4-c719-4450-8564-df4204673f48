interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

const schemaExample = `{
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
}`;

export function HelpDialog({ open, onClose }: HelpDialogProps) {
  if (!open) return null;
  return (
    <div
      className="modal-overlay"
      data-testid="help-dialog"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal wide" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <header className="modal-header">
          <h2 id="help-title">JSON 简谱格式与操作说明</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭说明">
            ✕
          </button>
        </header>
        <div className="modal-body help-body">
          <section>
            <h3>数据结构</h3>
            <ul>
              <li>
                顶层可以直接是节点数组，也可以是 <code>{`{ "title": ..., "body": [...] }`}</code>；
                <code>body / measures / nodes / sections</code> 等字段名都可识别。
              </li>
              <li>
                <strong>小节</strong>：<code>{`{ "no": 3, "notes": "5 6 5-" }`}</code>。
                <code>no</code> 可省略（按文档顺序自动编号）；<code>notes</code> 支持字符串、
                多行文本（<code>\n</code>）或字符串数组，<code>|</code> 会渲染成小节线。
              </li>
              <li>
                <strong>反复段</strong>：
                <code>{`{ "type": "repeat", "times": 2, "body": [ ...小节或反复段... ], "endings": [...] }`}</code>。
                <code>times</code> 默认 2；主体里可以继续嵌套反复段。
              </li>
              <li>
                <strong>尾句（房子）</strong>：
                <code>{`{ "passes": [1], "label": "一房", "body": [ ... ] }`}</code>，
                表示第几遍弹完主体后接这一句；<code>passes</code> 也可直接写数字。
              </li>
            </ul>
            <pre className="help-code">{schemaExample}</pre>
          </section>

          <section>
            <h3>演奏与翻页规则</h3>
            <ol>
              <li>系统先把谱面按反复 / 尾句展开成一维“演奏顺序”，一页对应一次实际演奏到的小节。</li>
              <li>反复段主体弹 <code>times</code> 遍；每遍主体结束后接该遍对应的尾句（如有）。</li>
              <li>外层反复每重来一次，内层反复都从第一遍重新起算。</li>
              <li>页面徽标会显示当前位置在每一层反复中的遍次，以及是否正处在某条尾句中。</li>
            </ol>
          </section>

          <section>
            <h3>循环标记</h3>
            <ol>
              <li>翻到目标位置，点“设为循环首 / 循环尾”（或按 <code>[</code> / <code>]</code>）。</li>
              <li>标记绑定的是<strong>演奏事件</strong>而不是小节号，所以同一小节的第一遍、第二遍可以分别选作首尾。</li>
              <li>循环内向前 / 向后翻页都会在首 / 尾之间回绕。</li>
              <li>点“退出循环”（或按 <code>Esc</code>）只清除区间、不移动当前页；之后继续翻页就是按整首谱进行。</li>
            </ol>
          </section>

          <section>
            <h3>快捷键</h3>
            <p>
              <kbd>←</kbd> / <kbd>PageUp</kbd> 上一页；<kbd>→</kbd> / <kbd>Space</kbd> /{' '}
              <kbd>PageDown</kbd> 下一页；<kbd>[</kbd> 设循环首；<kbd>]</kbd> 设循环尾；
              <kbd>Esc</kbd> 退出循环；<kbd>Home</kbd>/<kbd>End</kbd> 全曲开头/结尾。
            </p>
          </section>
        </div>
        <footer className="modal-footer">
          <button type="button" className="btn primary" onClick={onClose} data-testid="help-close">
            明白了
          </button>
        </footer>
      </div>
    </div>
  );
}
