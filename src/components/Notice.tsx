import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

// 白板的提示訊息（例如匯出失敗）。使用的一方有自己的提示時傳 onNotice 進來，
// 沒有的話白板自己在下方顯示幾秒。

const NoticeContext = createContext<(message: string) => void>(() => {});

let nextId = 1;

export function NoticeProvider({ onNotice, children }: { onNotice?: (message: string) => void; children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; message: string }[]>([]);
  const show = useCallback(
    (message: string) => {
      if (onNotice) {
        onNotice(message);
        return;
      }
      const id = nextId++;
      setItems((prev) => [...prev.slice(-2), { id, message }]);
      window.setTimeout(() => setItems((prev) => prev.filter((item) => item.id !== id)), 3600);
    },
    [onNotice],
  );
  return (
    <NoticeContext.Provider value={show}>
      {children}
      {!onNotice && (
        <div className="toast-region" role="status" aria-live="polite">
          {items.map((item) => (
            <div key={item.id} className="toast">
              {item.message}
            </div>
          ))}
        </div>
      )}
    </NoticeContext.Provider>
  );
}

export function useNotice() {
  return useContext(NoticeContext);
}
