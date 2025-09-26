window.auth = (function () {
  async function login(username, password, persist = true) {
    const base = (window.api && window.api.BASE) ? window.api.BASE : '';
    const res = await fetch(base + '/api/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      throw new Error('用户名或密码错误');
    }
    const data = await res.json();
    const access = data.access;
    const refresh = data.refresh;
    window.api.setTokens({ access, refresh, persist });

    // 解析JWT载荷中的角色
    const payload = JSON.parse(atob(access.split('.')[1]));
    const role = payload.role;
    if (role === 'admin') {
      window.location.href = '/admin.html';
    } else if (role === 'leader') {
      window.location.href = '/leader.html';
    } else {
      window.location.href = '/index.html';
    }
  }

  return { login };
})();


