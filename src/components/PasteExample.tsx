import { useState } from 'react';
import { useI18n } from '../i18n';
import { Dialog } from './Dialog';

/** 貼上整段範例的對話框：貼題目的 Input，按「畫出來」；看不懂時留在原地顯示原因 */
export function PasteExampleDialog({ open, onClose, onDraw }: { open: boolean; onClose: () => void; onDraw: (text: string) => string | null }) {
  const { t } = useI18n();
  const p = t.board.pasteExample;
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const close = () => {
    setError('');
    onClose();
  };
  const submit = () => {
    const problem = onDraw(text);
    if (problem) {
      setError(problem);
      return;
    }
    setText('');
    setError('');
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      title={p.title}
      footer={
        <>
          <button type="button" className="btn btn-quiet" onClick={close}>
            {t.common.cancel}
          </button>
          <button type="submit" form="board-paste-example" className="btn btn-primary" disabled={!text.trim()}>
            {p.draw}
          </button>
        </>
      }
    >
      <form
        id="board-paste-example"
        className="board-paste-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <p className="board-paste-hint">{p.hint}</p>
        <textarea
          className="input board-text-outline"
          value={text}
          aria-label={p.label}
          placeholder={p.placeholder}
          rows={5}
          maxLength={6000}
          autoFocus
          spellCheck={false}
          onChange={(e) => {
            setText(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            // Ctrl+Enter 直接畫；一般的 Enter 留給多行的範例
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {error && (
          <span className="board-text-error" role="alert">
            {error}
          </span>
        )}
      </form>
    </Dialog>
  );
}
