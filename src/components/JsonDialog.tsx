import { useEffect, useRef, useState } from 'react';
import { examples } from '../score/examples';

interface JsonDialogProps {
  open: boolean;
  currentSource: string;
  onClose: () => void;
  /** 返回 null 表示应用成功；返回字符串表示错误信息（原谱/位置/循环均保留） */
  onApply: (text: string) => string | null;
  onOpenHelp: () => void;
}

export function JsonDialog({ open, currentSource, onClose, onApply, onOpenHelp }: JsonDialogProps) {
  const [draft, setDraft] = useState(currentSource);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 每次打开都以“当前生效的合法谱面”为草稿，并清掉上次错误
  useEffect(() => {
    if (open) {
      setDraft(currentSource);
      setError(null);
      window.setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.select();
      }, 30);
    }
  }, [open, currentSource]);

  if (!open) return null;

  const handleApply = () => {
    const err = onApply(draft);
    if (err) setError(err);
  };

  return (
    <div
      className="modal-overlay"
      data-testid="json-dialog"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="json-dialog-title">
        <header className="modal-header">
          <h2 id="json-dialog-title">粘贴 JSON 简谱 / 换谱</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </header>

        <div className="modal-body">
          <div className="example-row">
            <span>填入示例：</span>
            {examples.map((ex) => (
              <button
                key={ex.id}
                type="button"
                className="chip-btn"
                data-testid={`fill-example-${ex.id}`}
                title={ex.description}
                onClick={() => {
                  setDraft(ex.json);
                  setError(null);
                }}
              >
                {ex.name}
              </button>
            ))}
            <button type="button" className="link-btn" onClick={onOpenHelp} data-testid="open-help">
              查看 JSON 格式说明 →
            </button>
          </div>

          <textarea
            ref={textareaRef}
            className="json-editor"
            data-testid="json-editor"
            spellCheck={false}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleApply();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              }
            }}
            aria-label="JSON 简谱输入框"
          />

          {error ? (
            <div className="error-box" role="alert" data-testid="json-error">
              <strong>换谱失败，已保留原谱、当前位置与循环标记。</strong>
              <pre>{error}</pre>
            </div>
          ) : (
            <p className="save-hint">
              应用时若 JSON 有误，会在此提示，背后显示的原谱、翻页位置和循环都不会改变。
              Ctrl/⌘ + Enter 可快速应用。
            </p>
          )}
        </div>

        <footer className="modal-footer">
          <button type="button" className="btn ghost" onClick={onClose} data-testid="json-cancel">
            取消
          </button>
          <button type="button" className="btn primary" onClick={handleApply} data-testid="json-apply">
            校验并应用新谱
          </button>
        </footer>
      </div>
    </div>
  );
}
