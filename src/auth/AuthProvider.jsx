// ログイン状態を全画面で共有する仕組み（チームで1つ）。
// 入館証（トークン）は React のメモリだけに持つ。
// localStorage・URL・console.log には絶対に出さないこと。
// そのため、ページを再読み込みすると再ログインが必要（server の仕様どおり）。

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ApiError, apiRequest } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null); // { user, token, expiresAt }
  const [authNotice, setAuthNotice] = useState('');

  const startSession = useCallback((data) => {
    setSession({ user: data.user, token: data.token, expiresAt: data.expiresAt });
    setAuthNotice('');
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const data = await apiRequest('/api/auth/login', { method: 'POST', body: { email, password } });
    startSession(data);
  }, [startSession]);

  const register = useCallback(async ({ email, password, displayName }) => {
    const data = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: { email, password, displayName },
    });
    startSession(data);
  }, [startSession]);

  const logout = useCallback(async () => {
    const token = session?.token;
    try {
      if (token) await apiRequest('/api/auth/logout', { method: 'POST', token });
    } catch {
      // サーバーに届かなくても、画面上はログアウトする
    } finally {
      setSession(null);
      setAuthNotice('');
    }
  }, [session]);

  // ログインが必要な API を呼ぶときはこれを使う。
  // 401（期限切れなど）が返ったらログイン状態を消して、ログインを案内する。
  const authRequest = useCallback(async (path, options = {}) => {
    if (!session) throw new ApiError('ログインしてください。', 401);
    try {
      return await apiRequest(path, { ...options, token: session.token });
    } catch (error) {
      if (error.status === 401) {
        setSession(null);
        setAuthNotice('ログインの有効期限が切れました。もう一度ログインしてください。');
      }
      throw error;
    }
  }, [session]);

  const value = useMemo(() => ({
    user: session?.user ?? null,
    isLoggedIn: session !== null,
    authNotice,
    login,
    register,
    logout,
    authRequest,
  }), [session, authNotice, login, register, logout, authRequest]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth は AuthProvider の内側で使ってください。');
  return context;
}
