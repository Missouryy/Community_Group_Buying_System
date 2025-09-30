(() => {
  const list = () => document.getElementById('leader-groupbuys');
  const newGbModalEl = document.getElementById('newGbModal');
  const newGbModal = newGbModalEl ? new bootstrap.Modal(newGbModalEl) : null;

  function ensureAuth() {
    const { access } = window.api.getTokens();
    if (!access) window.location.href = '/login.html';
  }

  async function loadGroupBuys() {
    const res = await window.api.fetchAPI('/api/leader/groupbuys/');
    if (!res.ok) return;
    const data = await res.json();
    const container = list();
    container.innerHTML = '';
    data.forEach(g => {
      const progress = Math.min(100, Math.round((g.current_participants / Math.max(1, g.target_participants)) * 100));
      const card = document.createElement('div');
      card.className = 'col-12 col-md-6 col-lg-4';
      card.innerHTML = `
        <div class="card h-100">
          <div class="card-body">
            <h5 class="card-title">${g.product}</h5>
            <p class="card-text">目标：${g.target_participants}，当前：${g.current_participants}</p>
            <div class="progress"><div class="progress-bar" style="width:${progress}%">${progress}%</div></div>
            <div class="mt-2 d-flex gap-2">
              <button class="btn btn-outline-primary btn-sm" data-view-orders="${g.id}">查看订单</button>
            </div>
          </div>
        </div>`;
      container.appendChild(card);
    });
  }

  async function loadLeaderDashboard() {
    const el = document.getElementById('leader-stats');
    if (!el) return;
    
    // Load leader-specific stats
    const [statsRes, commissionsRes] = await Promise.all([
      window.api.fetchAPI('/api/leader/stats/'),
      window.api.fetchAPI('/api/leader/commissions/summary/')
    ]);
    
    el.innerHTML = '';
    
    if (statsRes.ok) {
      const s = await statsRes.json();
      const items = [
        { label: '我的拼单', value: s.my_groupbuys || 0, icon: '📦', color: 'shadow-community' },
        { label: '待提货订单', value: s.pending_pickups || 0, icon: '🚚', color: 'shadow-deal' },
        { label: '本月提成', value: `¥${s.monthly_commission || 0}`, icon: '💰', color: 'shadow-community' },
        { label: '总收益', value: `¥${s.total_earnings || 0}`, icon: '💎', color: 'shadow-deal' }
      ];
      
      items.forEach((it, idx) => {
        const col = document.createElement('div');
        col.className = 'col-12 col-md-6 col-lg-3';
        col.innerHTML = `
          <div class="card h-100 lift ${it.color}">
            <div class="card-body text-center">
              <div class="fs-1 mb-2">${it.icon}</div>
              <div class="text-muted small mb-1">${it.label}</div>
              <div class="fs-3 fw-bold community-highlight-text">${it.value}</div>
            </div>
          </div>`;
        el.appendChild(col);
      });
    } else {
      // Fallback to basic stats if leader-specific endpoint doesn't exist
      const basicRes = await window.api.fetchAPI('/api/admin/stats/');
      if (basicRes.ok) {
        const s = await basicRes.json();
        const items = [
          { label: '活跃拼单', value: s.active_groupbuys || 0, icon: '📦' },
          { label: '待处理订单', value: s.pending_orders || 0, icon: '📋' },
          { label: '本月销量', value: s.monthly_sales || 0, icon: '📈' }
        ];
        
        items.forEach(it => {
          const col = document.createElement('div');
          col.className = 'col-12 col-md-4';
          col.innerHTML = `
            <div class="card h-100 lift">
              <div class="card-body text-center">
                <div class="fs-2 mb-2">${it.icon}</div>
                <div class="text-muted small mb-1">${it.label}</div>
                <div class="fs-4 fw-bold">${it.value}</div>
              </div>
            </div>`;
          el.appendChild(col);
        });
      }
    }
  }

  async function loadProductsForSelect() {
    const res = await window.api.fetchAPI('/api/products/');
    if (!res.ok) return;
    const data = await res.json();
    const sel = document.getElementById('gb-product');
    sel.innerHTML = '';
    data.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id; opt.textContent = `${p.name} (${p.price})`;
      sel.appendChild(opt);
    });
  }

  async function createGroupBuy() {
    const payload = {
      product: parseInt(document.getElementById('gb-product').value, 10),
      target_participants: parseInt(document.getElementById('gb-target').value, 10),
      start_time: document.getElementById('gb-start').value,
      end_time: document.getElementById('gb-end').value
    };
    const res = await window.api.fetchAPI('/api/leader/groupbuys/', { method: 'POST', body: payload });
    if (res.ok) {
      newGbModal.hide();
      loadGroupBuys();
    }
  }

  function bindEvents() {
    document.getElementById('btn-new-gb')?.addEventListener('click', async () => {
      await loadProductsForSelect();
      newGbModal.show();
    });
    document.getElementById('save-gb')?.addEventListener('click', createGroupBuy);

    // 页面导航现在由统一导航系统处理

    document.addEventListener('click', async (e) => {
      const viewBtn = e.target.closest('button[data-view-orders]');
      if (viewBtn) {
        const id = parseInt(viewBtn.getAttribute('data-view-orders'), 10);
        const res = await window.api.fetchAPI(`/api/leader/groupbuys/${id}/orders/`);
        if (!res.ok) return;
        const orders = await res.json();
        const modalHtml = document.createElement('div');
        modalHtml.className = 'modal fade';
        modalHtml.innerHTML = `
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header"><h5 class="modal-title">订单列表</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
              <div class="modal-body">
                <div class="vstack gap-2">
                  ${orders.map(o => `
                    <div class=\"d-flex justify-content-between align-items-center border rounded p-2\">
                      <div>
                        <div class=\"fw-semibold\">订单 #${o.id}</div>
                        <div class=\"text-muted small\">状态：${o.status}，总价：${o.total_price}</div>
                      </div>
                      <div>
                        ${o.status === 'successful' ? `<button class=\"btn btn-primary btn-sm\" data-pickup=\"${o.id}\">确认提货</button>` : ''}
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>`;
        document.body.appendChild(modalHtml);
        const modal = new bootstrap.Modal(modalHtml);
        modal.show();
        modalHtml.addEventListener('hidden.bs.modal', () => modalHtml.remove());
      }

      const pickupBtn = e.target.closest('button[data-pickup]');
      if (pickupBtn) {
        const id = parseInt(pickupBtn.getAttribute('data-pickup'), 10);
        const res = await window.api.fetchAPI(`/api/leader/orders/${id}/pickup/`, { method: 'POST' });
        if (res.ok) {
          alert('提货已确认');
          loadGroupBuys();
          const mdl = document.querySelector('.modal.show');
          if (mdl) bootstrap.Modal.getInstance(mdl)?.hide();
        }
      }
      
      // 确认提货按钮
      const confirmPickupBtn = e.target.closest('button[data-confirm-pickup]');
      if (confirmPickupBtn) {
        const orderId = parseInt(confirmPickupBtn.getAttribute('data-confirm-pickup'), 10);
        if (confirm('确认用户已提货？')) {
          const res = await window.api.fetchAPI(`/api/leader/orders/${orderId}/pickup/`, { method: 'POST' });
          if (res.ok) {
            alert('提货确认成功！');
            loadPickupManagement();
          } else {
            alert('操作失败，请重试');
          }
        }
      }
      
      // 联系用户按钮
      const contactBtn = e.target.closest('button[data-contact-user]');
      if (contactBtn) {
        const contact = contactBtn.getAttribute('data-contact-user');
        if (contact.includes('@')) {
          window.location.href = `mailto:${contact}`;
        } else if (contact.match(/^\d+$/)) {
          window.location.href = `tel:${contact}`;
        } else {
          alert(`联系方式：${contact}`);
        }
      }
    });
  }

  // 提货管理功能
  async function loadPickupManagement() {
    const container = document.getElementById('leader-pickups');
    if (!container) return;
    
    const res = await window.api.fetchAPI('/api/leader/pickups/');
    if (!res.ok) {
      container.innerHTML = '<div class="alert alert-info">暂无提货数据</div>';
      return;
    }
    
    const pickups = await res.json();
    container.innerHTML = '';
    
    if (pickups.length === 0) {
      container.innerHTML = '<div class="community-highlight"><h6>📦 暂无待提货订单</h6><p class="text-muted mb-0">当拼单成功后，订单将出现在这里</p></div>';
      return;
    }
    
    pickups.forEach(pickup => {
      const statusClass = pickup.status === 'ready_for_pickup' ? 'success' : pickup.status === 'picked_up' ? 'primary' : 'warning';
      const statusText = pickup.status === 'ready_for_pickup' ? '待提货' : pickup.status === 'picked_up' ? '已提货' : '处理中';
      
      const card = document.createElement('div');
      card.className = 'card lift shadow-community mb-3';
      card.innerHTML = `
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-3">
            <div>
              <h6 class="card-title mb-1">订单 #${pickup.order_id}</h6>
              <div class="text-muted small">${pickup.user_name || '用户'} · ${pickup.product_name}</div>
            </div>
            <span class="badge text-bg-${statusClass}">${statusText}</span>
          </div>
          
          <div class="row g-3 mb-3">
            <div class="col-6">
              <div class="text-muted small">数量</div>
              <div class="fw-semibold">${pickup.quantity}</div>
            </div>
            <div class="col-6">
              <div class="text-muted small">金额</div>
              <div class="fw-semibold">¥${pickup.total_price}</div>
            </div>
          </div>
          
          ${pickup.pickup_address ? `
            <div class="mb-3">
              <div class="text-muted small">提货地址</div>
              <div class="small">${pickup.pickup_address}</div>
            </div>
          ` : ''}
          
          <div class="d-flex gap-2">
            ${pickup.status === 'ready_for_pickup' ? `
              <button class="btn btn-primary btn-sm" data-confirm-pickup="${pickup.order_id}">
                <i class="bi bi-check-circle me-1"></i>确认提货
              </button>
              <button class="btn btn-outline-secondary btn-sm" data-contact-user="${pickup.user_phone || pickup.user_id}">
                <i class="bi bi-telephone me-1"></i>联系用户
              </button>
            ` : ''}
            ${pickup.status === 'picked_up' ? `
              <small class="text-success">✅ 已于 ${pickup.pickup_time} 完成提货</small>
            ` : ''}
          </div>
        </div>`;
      container.appendChild(card);
    });
  }
  
  // 提成明细功能
  async function loadCommissions() {
    const container = document.getElementById('leader-commissions');
    if (!container) return;
    
    const [summaryRes, detailsRes] = await Promise.all([
      window.api.fetchAPI('/api/leader/commissions/summary/'),
      window.api.fetchAPI('/api/leader/commissions/')
    ]);
    
    container.innerHTML = '';
    
    // 提成概览卡片
    if (summaryRes.ok) {
      const summary = await summaryRes.json();
      const summaryCard = document.createElement('div');
      summaryCard.className = 'card shadow-deal mb-4';
      summaryCard.innerHTML = `
        <div class="card-body">
          <h6 class="card-title mb-3">💰 收益概览</h6>
          <div class="row g-3">
            <div class="col-6 col-md-3">
              <div class="text-center">
                <div class="fs-4 fw-bold text-success">¥${summary.total_earnings || 0}</div>
                <div class="text-muted small">总收益</div>
              </div>
            </div>
            <div class="col-6 col-md-3">
              <div class="text-center">
                <div class="fs-4 fw-bold text-primary">¥${summary.monthly_earnings || 0}</div>
                <div class="text-muted small">本月收益</div>
              </div>
            </div>
            <div class="col-6 col-md-3">
              <div class="text-center">
                <div class="fs-4 fw-bold text-warning">¥${summary.pending_earnings || 0}</div>
                <div class="text-muted small">待结算</div>
              </div>
            </div>
            <div class="col-6 col-md-3">
              <div class="text-center">
                <div class="fs-4 fw-bold">${summary.commission_rate || 10}%</div>
                <div class="text-muted small">提成比例</div>
              </div>
            </div>
          </div>
        </div>`;
      container.appendChild(summaryCard);
    }
    
    // 提成明细列表
    if (detailsRes.ok) {
      const details = await detailsRes.json();
      
      if (details.length === 0) {
        const emptyCard = document.createElement('div');
        emptyCard.className = 'community-highlight';
        emptyCard.innerHTML = '<h6>📊 暂无提成记录</h6><p class="text-muted mb-0">完成拼单后，提成记录将显示在这里</p>';
        container.appendChild(emptyCard);
        return;
      }
      
      const detailsCard = document.createElement('div');
      detailsCard.className = 'card';
      detailsCard.innerHTML = `
        <div class="card-header">
          <h6 class="mb-0">📋 提成明细</h6>
        </div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-borderless mb-0">
              <thead>
                <tr class="bg-light">
                  <th>日期</th>
                  <th>拼单</th>
                  <th>订单金额</th>
                  <th>提成金额</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                ${details.map(d => `
                  <tr>
                    <td>
                      <div class="fw-semibold">${new Date(d.created_at).toLocaleDateString()}</div>
                      <div class="text-muted small">${new Date(d.created_at).toLocaleTimeString()}</div>
                    </td>
                    <td>
                      <div class="fw-semibold">${d.groupbuy_name || `拼单 #${d.groupbuy_id}`}</div>
                      <div class="text-muted small">${d.product_name || ''}</div>
                    </td>
                    <td class="fw-semibold">¥${d.order_amount || 0}</td>
                    <td class="fw-semibold text-success">¥${d.commission_amount || 0}</td>
                    <td>
                      <span class="badge ${d.status === 'settled' ? 'text-bg-success' : 'text-bg-warning'}">
                        ${d.status === 'settled' ? '已结算' : '待结算'}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>`;
      container.appendChild(detailsCard);
    }
  }

  // 暴露函数到全局作用域，供统一导航系统调用
  window.loadLeaderDashboard = loadLeaderDashboard;
  window.loadGroupBuys = loadGroupBuys;
  window.loadPickupManagement = loadPickupManagement;
  window.loadCommissions = loadCommissions;

  document.addEventListener('DOMContentLoaded', () => {
    ensureAuth();
    bindEvents();
    loadLeaderDashboard();
    
    // 登出逻辑现在由统一导航系统处理
  });
})();


