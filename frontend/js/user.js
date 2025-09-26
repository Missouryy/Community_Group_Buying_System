(() => {
  async function loadActiveGroupBuys() {
    const el = document.getElementById('groupbuy-list');
    if (!el) return;
    const res = await window.api.fetchAPI('/api/groupbuys/');
    if (!res.ok) return;
    const data = await res.json();
    el.innerHTML = '';
    data.forEach(g => {
      const progress = Math.min(100, Math.round((g.current_participants / Math.max(1, g.target_participants)) * 100));
      const col = document.createElement('div');
      col.className = 'col-12 col-md-6 col-lg-4';
      col.innerHTML = `
        <div class="card h-100">
          <div class="card-body">
            ${g.product_image_url ? `<img src="${g.product_image_url}" class="img-fluid rounded mb-2" alt="">` : ''}
            <h5 class="card-title">${g.product_name || g.product}</h5>
            <p class="card-text">目标：${g.target_participants}，当前：${g.current_participants}</p>
            <div class="progress mb-2"><div class="progress-bar" style="width:${progress}%">${progress}%</div></div>
            <button class="btn btn-primary" data-join="${g.id}">参团</button>
          </div>
        </div>`;
      el.appendChild(col);
    });
  }

  async function joinGroupBuy(group_buy_id) {
    const tokens = window.api.getTokens();
    if (!tokens.access) {
      alert('请先登录');
      window.location.href = '/login.html';
      return;
    }
    const quantity = parseInt(prompt('请输入购买数量', '1') || '1', 10);
    const res = await window.api.fetchAPI(`/api/group-buys/${group_buy_id}/join/`, { method: 'POST', body: { quantity } });
    if (res.ok) {
      alert('参团成功');
      loadActiveGroupBuys();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || '参团失败');
    }
  }

  async function loadMyOrders() {
    const el = document.getElementById('orders-list');
    if (!el) return;
    const tokens = window.api.getTokens();
    if (!tokens.access) {
      window.location.href = '/login.html';
      return;
    }
    const res = await window.api.fetchAPI('/api/me/orders/');
    if (!res.ok) return;
    const data = await res.json();
    el.innerHTML = '';
    data.forEach(o => {
      const badgeClass = o.status === 'awaiting_group_success' ? 'text-bg-warning' : (o.status === 'successful' || o.status === 'completed') ? 'text-bg-success' : 'text-bg-secondary';
      const card = document.createElement('div');
      card.className = 'card shadow-sm';
      card.innerHTML = `
        <div class="card-body d-flex align-items-center">
          <div class="flex-grow-1">
            <div class="d-flex align-items-center mb-1">
              <div class="fw-semibold me-2">订单 #${o.id}</div>
              <span class="badge ${badgeClass}">${o.status}</span>
            </div>
            <div class="text-muted small">总价：${o.total_price}</div>
          </div>
          <div class="ms-3 d-flex gap-2">
            ${o.status === 'successful' || o.status === 'ready_for_pickup' ? `<button class="btn btn-primary btn-sm" data-confirm="${o.id}">确认收货</button>` : ''}
            ${o.status === 'completed' ? `<button class="btn btn-secondary btn-sm" data-review="${o.id}">发表评价</button>` : ''}
          </div>
        </div>`;
      el.appendChild(card);
    });
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-join]');
    if (btn) {
      const id = parseInt(btn.getAttribute('data-join'), 10);
      joinGroupBuy(id);
    }
    const confirmBtn = e.target.closest('button[data-confirm]');
    if (confirmBtn) {
      const id = parseInt(confirmBtn.getAttribute('data-confirm'), 10);
      window.api.fetchAPI(`/api/orders/${id}/confirm/`, { method: 'POST' }).then(res => {
        if (res.ok) loadMyOrders();
      });
    }
    const reviewBtn = e.target.closest('button[data-review]');
    if (reviewBtn) {
      const id = parseInt(reviewBtn.getAttribute('data-review'), 10);
      const rating = parseInt(prompt('请给出评分（1-5）', '5') || '5', 10);
      const comment = prompt('评价内容（可选）', '') || '';
      window.api.fetchAPI(`/api/orders/${id}/review/`, { method: 'POST', body: { rating, comment } }).then(res => {
        if (res.ok) alert('评价成功');
      });
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    loadActiveGroupBuys();
    loadMyOrders();
  });
})();


