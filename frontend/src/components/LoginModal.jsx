import { useEffect, useRef, useState } from 'react';

const GOOGLE_SCRIPT_ID = 'google-identity-services';
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function LoginModal({ onClose, onSubmit, onGoogleLogin }) {
  const googleButtonRef = useRef(null);
  const initializedRef = useRef(false);
  const [googleReady, setGoogleReady] = useState(false);

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
        theme: 'outline',
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

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal auth-modal">
        <div className="auth-modal-copy">
          <h2>Sign in</h2>
        </div>

        {googleClientId ? (
          <div className="auth-google-section">
            <div ref={googleButtonRef} className="auth-google-button" />
            {!googleReady && <p className="auth-google-hint">Loading...</p>}
          </div>
        ) : (
          <div className="auth-google-warning">
            Add <code>VITE_GOOGLE_CLIENT_ID</code> to enable Gmail sign-in.
          </div>
        )}

        <div className="auth-divider">
          <span>or continue manually</span>
        </div>

        <form onSubmit={onSubmit}>
          <label className="auth-field">
            <span>Full name</span>
            <input name="name" required placeholder="Your name" />
          </label>
          <label className="auth-field">
            <span>Email address</span>
            <input name="email" type="email" placeholder="email" />
          </label>

          <div className="modal-actions">
            <button type="button" className="ghost auth-secondary" onClick={onClose}>
              Back
            </button>
            <button type="submit" className="primary auth-primary">
              Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LoginModal;
