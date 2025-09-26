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

    // sidebar switching
    document.querySelectorAll('#sidebarMenu [data-page]')?.forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const pageId = 'page-' + a.getAttribute('data-page');
        document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
        document.getElementById(pageId).style.display = '';
        if (pageId === 'page-products') loadProducts();
        if (pageId === 'page-leaders') loadLeaderApplications();
        if (pageId === 'page-inventory') loadAlerts();
      });
    });
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
    const res = await window.api.fetchAPI('/api/admin/leader-applications/');
    if (!res.ok) return;
    const data = await res.json();
    container.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'row g-3';
    data.forEach(u => {
      const col = document.createElement('div');
      col.className = 'col-12 col-md-6 col-lg-4';
      col.innerHTML = `
        <div class="card h-100">
          <div class="card-body d-flex flex-column">
            <div class="d-flex align-items-center mb-3">
              <div class="rounded-circle bg-light me-3" style="width:48px;height:48px"></div>
              <div>
                <div class="fw-semibold">${u.real_name || u.username}</div>
                <div class="text-muted small">${u.email || ''}</div>
              </div>
            </div>
            <div class="text-muted small mb-3">状态：${u.leader_status || 'pending'}</div>
            <div class="mt-auto d-flex gap-2">
              <button class="btn btn-primary flex-fill" data-approve="${u.id}">批准</button>
              <button class="btn btn-secondary flex-fill" data-reject="${u.id}">拒绝</button>
            </div>
          </div>
        </div>`;
      row.appendChild(col);
    });
    container.appendChild(row);
  }

  document.addEventListener('click', async (e) => {
    const approve = e.target.closest('button[data-approve]');
    if (approve) {
      const id = approve.getAttribute('data-approve');
      const res = await window.api.fetchAPI(`/api/admin/leader-applications/${id}/`, { method: 'PATCH', body: { status: 'approved' } });
      if (res.ok) loadLeaderApplications();
    }
    const reject = e.target.closest('button[data-reject]');
    if (reject) {
      const id = reject.getAttribute('data-reject');
      const res = await window.api.fetchAPI(`/api/admin/leader-applications/${id}/`, { method: 'PATCH', body: { status: 'rejected' } });
      if (res.ok) loadLeaderApplications();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    ensureAuth();
    bindEvents();
    loadDashboard();
  });
})();


