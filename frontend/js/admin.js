(() => {
  const productsTableBody = () => document.querySelector('#products-table tbody');
  const modalEl = document.getElementById('productModal');
  const modal = modalEl ? new bootstrap.Modal(modalEl) : null;

  function ensureAuth() {
    const { access } = window.api.getTokens();
    if (!access) window.location.href = '/login.html';
  }

  async function loadProducts() {
    const res = await window.api.fetchAPI('/api/admin/products/');
    if (!res.ok) return;
    const data = await res.json();
    const tbody = productsTableBody();
    tbody.innerHTML = '';
    data.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${p.id}</td><td>${p.name}</td><td>${p.price}</td><td>${p.stock_quantity}</td>
        <td>
          <button class="btn btn-sm btn-secondary me-2" data-action="edit" data-id="${p.id}">编辑</button>
          <button class="btn btn-sm btn-danger" data-action="delete" data-id="${p.id}">删除</button>
        </td>`;
      tbody.appendChild(tr);
    });
  }

  async function deleteProduct(id) {
    if (!confirm('确认删除该商品？')) return;
    const res = await window.api.fetchAPI(`/api/admin/products/${id}/`, { method: 'DELETE' });
    if (res.ok) loadProducts();
  }

  function openModal(product) {
    document.getElementById('product-id').value = product?.id || '';
    document.getElementById('product-name').value = product?.name || '';
    document.getElementById('product-price').value = product?.price || '';
    document.getElementById('product-stock').value = product?.stock_quantity || '';
    document.getElementById('product-image').value = '';
    modal.show();
  }

  async function saveProduct() {
    const id = document.getElementById('product-id').value;
    const form = new FormData();
    form.append('name', document.getElementById('product-name').value);
    form.append('price', String(parseFloat(document.getElementById('product-price').value)));
    form.append('stock_quantity', String(parseInt(document.getElementById('product-stock').value, 10)));
    const file = document.getElementById('product-image').files[0];
    if (file) form.append('image', file);
    let res;
    if (id) {
      res = await window.api.fetchAPI(`/api/admin/products/${id}/`, { method: 'PUT', body: form });
    } else {
      res = await window.api.fetchAPI('/api/admin/products/', { method: 'POST', body: form });
    }
    if (res.ok) {
      modal.hide();
      loadProducts();
    }
  }

  function bindEvents() {
    document.getElementById('btn-create')?.addEventListener('click', () => openModal(null));
    document.getElementById('save-product')?.addEventListener('click', saveProduct);
    productsTableBody()?.addEventListener('click', async (e) => {
      const target = e.target.closest('button');
      if (!target) return;
      const id = target.getAttribute('data-id');
      const action = target.getAttribute('data-action');
      if (action === 'delete') return deleteProduct(id);
      if (action === 'edit') {
        const res = await window.api.fetchAPI(`/api/admin/products/${id}/`);
        if (res.ok) {
          const data = await res.json();
          openModal(data);
        }
      }
    });

    // 页面导航现在由统一导航系统处理
  }

  async function loadDashboard() {
    const cards = document.getElementById('stats-cards');
    const salesEl = document.getElementById('sales-daily');
    if (!cards) return;
    const [statsRes, dailyRes] = await Promise.all([
      window.api.fetchAPI('/api/admin/stats/'),
      window.api.fetchAPI('/api/admin/sales/daily/?days=7')
    ]);
    if (statsRes.ok) {
      const s = await statsRes.json();
      cards.innerHTML = '';
      const items = [
        { label: '总销售额', value: s.total_sales },
        { label: '总订单', value: s.total_orders },
        { label: '已完成订单', value: s.completed_orders },
        { label: '活跃拼单', value: s.active_groupbuys },
        { label: '待审核团长', value: s.pending_leaders },
        { label: '低库存商品数', value: s.low_stock_count },
      ];
      items.forEach(it => {
        const col = document.createElement('div');
        col.className = 'col-12 col-md-4';
        col.innerHTML = `<div class="card"><div class="card-body"><div class="text-muted small">${it.label}</div><div class="fs-4">${it.value}</div></div></div>`;
        cards.appendChild(col);
      });
    }
    if (dailyRes.ok && salesEl) {
      const d = await dailyRes.json();
      salesEl.innerHTML = '';
      d.items.forEach(it => {
        const row = document.createElement('div');
        row.className = 'd-flex justify-content-between align-items-center border rounded p-2';
        row.innerHTML = `<div class="text-muted small">${it.day}</div><div class="fw-semibold">${it.total}</div><div class="text-muted small">${it.count} 单</div>`;
        salesEl.appendChild(row);
      });
    }
  }

  async function loadAlerts() {
    const container = document.getElementById('alerts-list');
    if (!container) return;
    const res = await window.api.fetchAPI('/api/admin/alerts/');
    if (!res.ok) return;
    const alerts = await res.json();
    container.innerHTML = '';
    alerts.forEach(a => {
      const row = document.createElement('div');
      row.className = 'd-flex justify-content-between align-items-center border rounded p-2';
      row.innerHTML = `
        <div>
          <div class="fw-semibold">${a.message}</div>
          <div class="text-muted small">创建时间：${a.created_at || ''}</div>
        </div>
        <div>
          ${a.is_read ? '<span class="badge text-bg-secondary">已读</span>' : `<button class="btn btn-sm btn-primary" data-read="${a.id}">标记已读</button>`}
        </div>`;
      container.appendChild(row);
    });
  }

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-read]');
    if (btn) {
      const id = btn.getAttribute('data-read');
      const res = await window.api.fetchAPI(`/api/admin/alerts/${id}/read/`, { method: 'POST' });
      if (res.ok) loadAlerts();
    }
  });

  async function loadLeaderApplications() {
    const container = document.getElementById('leaders-table');
    if (!container) return;
    
    // Try multiple endpoints for leader applications
    const endpoints = [
      '/api/admin/leader-applications/',
      '/api/admin/leaders/',
      '/api/users/?role=leader'
    ];
    
    let data = [];
    for (const endpoint of endpoints) {
      const res = await window.api.fetchAPI(endpoint);
      if (res.ok) {
        data = await res.json();
        break;
      }
    }
    
    container.innerHTML = '';
    
    if (data.length === 0) {
      container.innerHTML = `
        <div class="community-highlight">
          <h6>👥 暂无团长申请</h6>
          <p class="text-muted mb-0">当有用户申请成为团长时，审核信息将显示在这里</p>
        </div>`;
      return;
    }
    
    // 添加统计概览
    const statsCard = document.createElement('div');
    statsCard.className = 'card shadow-community mb-4';
    const pendingCount = data.filter(u => u.leader_status === 'pending' || u.status === 'pending').length;
    const approvedCount = data.filter(u => u.leader_status === 'approved' || u.role === 'leader').length;
    
    statsCard.innerHTML = `
      <div class="card-body">
        <h6 class="card-title mb-3">👨‍💼 团长管理概览</h6>
        <div class="row g-3">
          <div class="col-4">
            <div class="text-center">
              <div class="fs-4 fw-bold text-warning">${pendingCount}</div>
              <div class="text-muted small">待审核</div>
            </div>
          </div>
          <div class="col-4">
            <div class="text-center">
              <div class="fs-4 fw-bold text-success">${approvedCount}</div>
              <div class="text-muted small">已批准</div>
            </div>
          </div>
          <div class="col-4">
            <div class="text-center">
              <div class="fs-4 fw-bold">${data.length}</div>
              <div class="text-muted small">总数</div>
            </div>
          </div>
        </div>
      </div>`;
    container.appendChild(statsCard);
    
    // 分类显示团长申请
    const pendingApplications = data.filter(u => u.leader_status === 'pending' || u.status === 'pending');
    const approvedLeaders = data.filter(u => u.leader_status === 'approved' || u.role === 'leader');
    
    // 待审核申请
    if (pendingApplications.length > 0) {
      const pendingSection = document.createElement('div');
      pendingSection.innerHTML = `
        <h6 class="mb-3">🕐 待审核申请 (${pendingApplications.length})</h6>
        <div class="row g-3 mb-4" id="pending-applications"></div>`;
      container.appendChild(pendingSection);
      
      const pendingRow = document.getElementById('pending-applications');
      pendingApplications.forEach(u => {
        const col = document.createElement('div');
        col.className = 'col-12 col-md-6 col-lg-4';
        col.innerHTML = `
          <div class="card h-100 lift shadow-deal">
            <div class="card-body d-flex flex-column">
              <div class="d-flex align-items-center mb-3">
                <div class="rounded-circle bg-warning bg-opacity-10 d-flex align-items-center justify-content-center me-3" style="width:48px;height:48px">
                  <span class="text-warning">👤</span>
                </div>
                <div>
                  <div class="fw-semibold">${u.real_name || u.username}</div>
                  <div class="text-muted small">${u.email || '无邮箱'}</div>
                </div>
              </div>
              
              ${u.phone ? `<div class="text-muted small mb-2">📞 ${u.phone}</div>` : ''}
              ${u.address ? `<div class="text-muted small mb-2">📍 ${u.address}</div>` : ''}
              ${u.application_reason ? `<div class="text-muted small mb-3">"${u.application_reason}"</div>` : ''}
              
              <div class="d-flex align-items-center mb-3">
                <span class="badge text-bg-warning">待审核</span>
                <span class="text-muted small ms-2">${new Date(u.created_at || u.date_joined).toLocaleDateString()}</span>
              </div>
              
              <div class="mt-auto d-flex gap-2">
                <button class="btn btn-success flex-fill" data-approve="${u.id}">
                  ✅ 批准
                </button>
                <button class="btn btn-outline-danger flex-fill" data-reject="${u.id}">
                  ❌ 拒绝
                </button>
              </div>
            </div>
          </div>`;
        pendingRow.appendChild(col);
      });
    }
    
    // 已批准团长
    if (approvedLeaders.length > 0) {
      const approvedSection = document.createElement('div');
      approvedSection.innerHTML = `
        <h6 class="mb-3">✅ 已批准团长 (${approvedLeaders.length})</h6>
        <div class="table-responsive">
          <table class="table table-borderless">
            <thead>
              <tr class="bg-light">
                <th>团长信息</th>
                <th>拼单数</th>
                <th>月收益</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody id="approved-leaders-tbody"></tbody>
          </table>
        </div>`;
      container.appendChild(approvedSection);
      
      const tbody = document.getElementById('approved-leaders-tbody');
      approvedLeaders.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            <div class="d-flex align-items-center">
              <div class="rounded-circle bg-success bg-opacity-10 d-flex align-items-center justify-content-center me-3" style="width:40px;height:40px">
                <span class="text-success">👑</span>
              </div>
              <div>
                <div class="fw-semibold">${u.real_name || u.username}</div>
                <div class="text-muted small">${u.email || '无邮箱'}</div>
              </div>
            </div>
          </td>
          <td>
            <div class="fw-semibold">${u.groupbuy_count || 0}</div>
            <div class="text-muted small">个拼单</div>
          </td>
          <td>
            <div class="fw-semibold text-success">¥${u.monthly_commission || 0}</div>
            <div class="text-muted small">本月</div>
          </td>
          <td>
            <span class="badge text-bg-success">活跃</span>
          </td>
          <td>
            <div class="d-flex gap-1">
              <button class="btn btn-outline-primary btn-sm" data-view-details="${u.id}">详情</button>
              <button class="btn btn-outline-danger btn-sm" data-deactivate="${u.id}">停用</button>
            </div>
          </td>`;
        tbody.appendChild(tr);
      });
    }
  }

  // 处理团长审核操作
  document.addEventListener('click', async (e) => {
    // 批准团长申请
    const approveBtn = e.target.closest('button[data-approve]');
    if (approveBtn) {
      const userId = approveBtn.getAttribute('data-approve');
      if (confirm('确认批准该用户成为团长？')) {
        const res = await window.api.fetchAPI(`/api/admin/leaders/${userId}/approve/`, { method: 'POST' });
        if (res.ok) {
          alert('批准成功！');
          loadLeaderApplications();
        } else {
          alert('操作失败，请重试');
        }
      }
    }
    
    // 拒绝团长申请
    const rejectBtn = e.target.closest('button[data-reject]');
    if (rejectBtn) {
      const userId = rejectBtn.getAttribute('data-reject');
      const reason = prompt('请输入拒绝原因（可选）：');
      if (reason !== null) {
        const res = await window.api.fetchAPI(`/api/admin/leaders/${userId}/reject/`, { 
          method: 'POST', 
          body: { reason }
        });
        if (res.ok) {
          alert('已拒绝申请');
          loadLeaderApplications();
        } else {
          alert('操作失败，请重试');
        }
      }
    }
    
    // 查看团长详情
    const viewDetailsBtn = e.target.closest('button[data-view-details]');
    if (viewDetailsBtn) {
      const userId = viewDetailsBtn.getAttribute('data-view-details');
      showLeaderDetails(userId);
    }
    
    // 停用团长
    const deactivateBtn = e.target.closest('button[data-deactivate]');
    if (deactivateBtn) {
      const userId = deactivateBtn.getAttribute('data-deactivate');
      if (confirm('确认停用该团长？停用后将无法发起新的拼单。')) {
        const res = await window.api.fetchAPI(`/api/admin/leaders/${userId}/deactivate/`, { method: 'POST' });
        if (res.ok) {
          alert('已停用');
          loadLeaderApplications();
        } else {
          alert('操作失败，请重试');
        }
      }
    }
  });
  
  // 显示团长详情
  async function showLeaderDetails(userId) {
    const res = await window.api.fetchAPI(`/api/admin/leaders/${userId}/details/`);
    if (!res.ok) {
      alert('获取详情失败');
      return;
    }
    
    const details = await res.json();
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">👑 团长详情</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="row g-4">
              <div class="col-md-6">
                <div class="card">
                  <div class="card-body">
                    <h6 class="card-title">基本信息</h6>
                    <div class="vstack gap-2">
                      <div><strong>姓名：</strong>${details.real_name || details.username}</div>
                      <div><strong>邮箱：</strong>${details.email || '未设置'}</div>
                      <div><strong>电话：</strong>${details.phone || '未设置'}</div>
                      <div><strong>地址：</strong>${details.address || '未设置'}</div>
                      <div><strong>加入时间：</strong>${new Date(details.date_joined).toLocaleDateString()}</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="col-md-6">
                <div class="card">
                  <div class="card-body">
                    <h6 class="card-title">业务数据</h6>
                    <div class="vstack gap-2">
                      <div><strong>发起拼单：</strong>${details.groupbuy_count || 0} 个</div>
                      <div><strong>成功拼单：</strong>${details.successful_groupbuys || 0} 个</div>
                      <div><strong>总订单量：</strong>${details.total_orders || 0} 单</div>
                      <div><strong>总收益：</strong>¥${details.total_commission || 0}</div>
                      <div><strong>本月收益：</strong>¥${details.monthly_commission || 0}</div>
                    </div>
                  </div>
                </div>
              </div>
              
              ${details.recent_groupbuys && details.recent_groupbuys.length > 0 ? `
                <div class="col-12">
                  <div class="card">
                    <div class="card-body">
                      <h6 class="card-title">最近拼单</h6>
                      <div class="table-responsive">
                        <table class="table table-sm">
                          <thead>
                            <tr>
                              <th>商品</th>
                              <th>目标/当前</th>
                              <th>状态</th>
                              <th>创建时间</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${details.recent_groupbuys.map(gb => `
                              <tr>
                                <td>${gb.product_name}</td>
                                <td>${gb.current_participants}/${gb.target_participants}</td>
                                <td><span class="badge text-bg-${gb.status === 'active' ? 'success' : 'secondary'}">${gb.status}</span></td>
                                <td>${new Date(gb.created_at).toLocaleDateString()}</td>
                              </tr>
                            `).join('')}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
          </div>
        </div>
      </div>`;
    
    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    modal.addEventListener('hidden.bs.modal', () => modal.remove());
  }

  // 暴露函数到全局作用域，供统一导航系统调用
  window.loadDashboard = loadDashboard;
  window.loadProducts = loadProducts;
  window.loadLeaderApplications = loadLeaderApplications;
  window.loadAlerts = loadAlerts;

  document.addEventListener('DOMContentLoaded', () => {
    ensureAuth();
    bindEvents();
    loadDashboard();
    // 登出逻辑现在由统一导航系统处理
  });
})();


