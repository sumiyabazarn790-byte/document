import { useI18n } from '../i18n/i18n';

function ToastStack({ toasts, onDismiss }) {
  const { t } = useI18n();
  if (!toasts?.length) {
    return null;
  }

  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-card ${toast.type || 'info'}`}>
          <div className="toast-copy">
            <strong>{toast.title}</strong>
            {toast.message ? <p>{toast.message}</p> : null}
          </div>
          <button
            type="button"
            className="toast-close"
            onClick={() => onDismiss(toast.id)}
            aria-label={t('toast_dismiss')}
          >
            x
          </button>
        </div>
      ))}
    </div>
  );
}

export default ToastStack;
