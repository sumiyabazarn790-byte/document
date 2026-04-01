import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/i18n';

const GOOGLE_SCRIPT_ID = 'google-identity-services';
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function LoginModal({ onClose, onSubmit, onGoogleLogin }) {
  const { t } = useI18n();
  const formRef = useRef(null);
  const googleButtonRef = useRef(null);
  const nameInputRef = useRef(null);
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const initializedRef = useRef(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [mode, setMode] = useState('login');

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) return undefined;

    const initializeGoogle = () => {
      const google = window.google;
      if (!google?.accounts?.id || initializedRef.current) return;
      const buttonWidth = Math.max(220, Math.min(360, googleButtonRef.current?.offsetWidth || 0));

      google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => {
          if (!response?.credential) return;
          onGoogleLogin?.(response.credential);
        },
      });

      googleButtonRef.current.innerHTML = '';
      google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'filled_blue',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        logo_alignment: 'left',
        width: buttonWidth,
      });

      initializedRef.current = true;
      setGoogleReady(true);
    };

    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID);
    if (existingScript) {
      if (window.google?.accounts?.id) {
        initializeGoogle();
      } else {
        existingScript.addEventListener('load', initializeGoogle, { once: true });
      }

      return () => existingScript.removeEventListener('load', initializeGoogle);
    }

    const script = document.createElement('script');
    script.id = GOOGLE_SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogle;
    document.head.appendChild(script);

    return () => script.removeEventListener('load', initializeGoogle);
  }, [onGoogleLogin]);

  useEffect(() => {
    const clearFields = () => {
      [nameInputRef.current, emailInputRef.current, passwordInputRef.current].forEach((input) => {
        if (!input) return;
        input.value = '';
        input.setAttribute('value', '');
      });

      formRef.current?.reset();
    };

    clearFields();
    const timer = window.setTimeout(clearFields, 60);

    return () => window.clearTimeout(timer);
  }, [mode]);

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal auth-modal">
        <div className="auth-modal-copy">
          <h2>{t('login_title')}</h2>
        </div>

        {googleClientId ? (
          <div className="auth-google-section">
            <div className="auth-google-shell">
              <div className="auth-google-ghost" aria-hidden="true">
                <span className="auth-google-mark">
                  <svg viewBox="0 0 18 18" aria-hidden="true" focusable="false">
                    <path
                      fill="#4285F4"
                      d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62Z"
                    />
                    <path
                      fill="#34A853"
                      d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M3.97 10.72A5.41 5.41 0 0 1 3.69 9c0-.6.1-1.18.28-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M9 3.58c1.32 0 2.5.45 3.44 1.33l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33c.71-2.12 2.69-3.7 5.03-3.7Z"
                    />
                  </svg>
                </span>
                <span className="auth-google-copy">Continue with Google</span>
              </div>
              <div ref={googleButtonRef} className="auth-google-button" />
            </div>
            {!googleReady && <p className="auth-google-hint">{t('login_google_loading')}</p>}
          </div>
        ) : (
          <div className="auth-google-warning">
            {t('login_google_missing')}
          </div>
        )}

        <div className="auth-divider">
          <span>{t('login_manual')}</span>
        </div>

        <div className="auth-mode-toggle">
          <button
            type="button"
            className={mode === 'login' ? 'primary auth-primary' : 'ghost auth-secondary'}
            onClick={() => setMode('login')}
          >
            {t('login_sign_in_tab')}
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'primary auth-primary' : 'ghost auth-secondary'}
            onClick={() => setMode('register')}
          >
            {t('login_register_tab')}
          </button>
        </div>

        <form ref={formRef} onSubmit={onSubmit} autoComplete="off">
          <input type="text" name="fake-email" autoComplete="username" tabIndex="-1" hidden />
          <input type="password" name="fake-password" autoComplete="current-password" tabIndex="-1" hidden />
          <input type="hidden" name="mode" value={mode} />
          {mode === 'register' && (
            <label className="auth-field">
              <span>{t('login_full_name')}</span>
              <input
                ref={nameInputRef}
                name="name"
                required
                placeholder={t('login_full_name_placeholder')}
                autoComplete="off"
              />
            </label>
          )}
          <label className="auth-field">
            <span>{mode === 'login' ? t('login_identifier') : t('login_email')}</span>
            <input
              ref={emailInputRef}
              name={mode === 'login' ? 'identifier' : 'email'}
              type={mode === 'login' ? 'text' : 'email'}
              required
              placeholder={mode === 'login' ? t('login_identifier_placeholder') : t('login_email_placeholder')}
              autoComplete={mode === 'login' ? 'username' : 'email'}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
          <label className="auth-field">
            <span>{t('login_password')}</span>
            <input
              ref={passwordInputRef}
              name="password"
              type="password"
              required
              minLength={mode === 'register' ? 8 : undefined}
              placeholder={t('login_password_placeholder')}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
          </label>

          <div className="modal-actions">
            <button type="button" className="ghost auth-secondary" onClick={onClose}>
              {t('login_back')}
            </button>
            <button type="submit" className="primary auth-primary">
              {mode === 'login' ? t('login_continue') : t('login_create_account')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LoginModal;
