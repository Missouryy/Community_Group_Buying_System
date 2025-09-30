window.api = (function () {
  const BASE = 'http://127.0.0.1:8000';

  function getTokens() {
    return {
      access: localStorage.getItem('access') || sessionStorage.getItem('access'),
      refresh: localStorage.getItem('refresh') || sessionStorage.getItem('refresh'),
      persist: !!localStorage.getItem('access')
    };
  }

  function setTokens({ access, refresh, persist }) {
    if (persist) {
      if (access) localStorage.setItem('access', access);
      if (refresh) localStorage.setItem('refresh', refresh);
    } else {
      if (access) sessionStorage.setItem('access', access);
      if (refresh) sessionStorage.setItem('refresh', refresh);
    }
  }

  async function refreshToken(tokens) {
    if (!tokens.refresh) throw new Error('缺少刷新令牌');
    const res = await fetch(`${BASE}/api/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: tokens.refresh })
    });
    if (!res.ok) throw new Error('刷新令牌失败');
    const data = await res.json();
    setTokens({ access: data.access, refresh: tokens.refresh, persist: tokens.persist });
    return data.access;
  }

  async function fetchAPI(endpoint, { method = 'GET', body = null, headers = {} } = {}) {
    const tokens = getTokens();
    const isFormData = (typeof FormData !== 'undefined') && (body instanceof FormData);
    const authHeaders = isFormData ? { ...headers } : { 'Content-Type': 'application/json', ...headers };
    if (tokens.access) authHeaders['Authorization'] = `Bearer ${tokens.access}`;

    let res = await fetch(`${BASE}${endpoint}`, {
      method,
      headers: authHeaders,
      body: body ? (isFormData ? body : JSON.stringify(body)) : null
    });

    if (res.status === 401 && tokens.refresh) {
      try {
        const newAccess = await refreshToken(tokens);
        authHeaders['Authorization'] = `Bearer ${newAccess}`;
        res = await fetch(`${BASE}${endpoint}`, {
          method,
          headers: authHeaders,
          body: body ? (isFormData ? body : JSON.stringify(body)) : null
        });
      } catch (e) {
        localStorage.clear();
        sessionStorage.clear();
        // 跳转到主页面而不是登录页，让用户可以浏览内容
        if (window.location.pathname !== '/index.html' && window.location.pathname !== '/') {
          window.location.href = '/index.html';
        }
        throw e;
      }
    }
    return res;
  }

  return { fetchAPI, getTokens, setTokens, BASE };
})();


