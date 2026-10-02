// ログイン・新規登録のフォーム（どの画面からでも使える共通部品）。
import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import './LoginPanel.css';

export default function LoginPanel() {
  const { login, register, authNotice } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegister = mode === 'register';

  function switchMode(nextMode) {
    setMode(nextMode);
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      if (isRegister) {
        await register({ email, password, displayName });
      } else {
        await login({ email, password });
      }
      setPassword('');
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-panel">
      <div className="login-tabs" role="group" aria-label="ログインまたは新規登録">
        <button type="button" aria-pressed={!isRegister} onClick={() => switchMode('login')}>ログイン</button>
        <button type="button" aria-pressed={isRegister} onClick={() => switchMode('register')}>新規登録</button>
      </div>

      {authNotice && <p className="login-notice" role="status">{authNotice}</p>}

      <form className="login-form" onSubmit={handleSubmit}>
        {isRegister && (
          <label>
            表示名
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={100}
              autoComplete="nickname"
              required
            />
          </label>
        )}
        <label>
          メールアドレス
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label>
          パスワード
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={12}
            maxLength={128}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            required
          />
          <span className="login-hint">12〜128文字</span>
        </label>

        {error && <p className="login-error" role="alert">{error}</p>}

        <button type="submit" className="login-submit" disabled={isSubmitting}>
          {isSubmitting ? '送信中…' : isRegister ? '登録してはじめる' : 'ログイン'}
        </button>
      </form>
    </div>
  );
}
