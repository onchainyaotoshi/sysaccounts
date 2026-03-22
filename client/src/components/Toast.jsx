import { useState, useCallback, createContext, useContext } from 'react';

const ToastContext = createContext();
export function useToast() { return useContext(ToastContext); }

let toastCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = 'info') => {
    const id = ++toastCounter;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== id)); }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div style={{ position: 'fixed', bottom: 40, right: 20, zIndex: 200 }}>
        {toasts.map(t => (
          <div key={t.id} style={{ padding: '10px 16px', marginTop: 8, borderRadius: 4, fontSize: 13, border: '1px solid',
            borderColor: t.type === 'error' ? 'var(--accent-red)' : t.type === 'success' ? 'var(--accent-green)' : 'var(--border)',
            color: t.type === 'error' ? 'var(--accent-red)' : t.type === 'success' ? 'var(--accent-green)' : 'var(--text-primary)',
            background: 'var(--bg-secondary)' }}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
