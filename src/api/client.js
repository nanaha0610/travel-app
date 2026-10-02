// server（受付係）に問い合わせる共通の窓口。
// 接続先は .env.local の VITE_API_BASE_URL で設定する（例：http://127.0.0.1:3001）。
// ここには DB のパスワードなどの秘密情報を入れないこと。

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

export const isApiConfigured = API_BASE !== '';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status; // 0 は「サーバーに届かなかった」
  }
}

export async function apiRequest(path, { method = 'GET', token, body } = {}) {
  if (!isApiConfigured) {
    throw new ApiError('APIの接続先（VITE_API_BASE_URL）が設定されていません。', 0);
  }

  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('サーバーに接続できません。サーバーが起動しているか確認してください。', 0);
  }

  if (response.status === 204) return null;

  let data = null;
  try {
    data = await response.json();
  } catch {
    // 本文が JSON でない場合はそのまま下のエラー処理へ
  }

  if (!response.ok) {
    throw new ApiError(data?.error || `処理に失敗しました（${response.status}）。`, response.status);
  }
  return data;
}
