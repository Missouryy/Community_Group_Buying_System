(() => {
  const productsTableBody = () => document.querySelector('#products-table tbody');
  const modalEl = document.getElementById('productModal');
  const modal = modalEl ? new bootstrap.Modal(modalEl) : null;

  function ensureAuth() {
    const { access } = window.api.getTokens();
    if (!access) window.location.href = '/login.html';
  }
  
  // 统一的状态标签映射
  const STATUS_BADGES = {
    groupbuy: {
      'pending': { badge: 'warning', icon: '⏰', text: '待开始' },
      'active': { badge: 'success', icon: '🔥', text: '进行中' },
      'successful': { badge: 'primary', icon: '✅', text: '已成团' },
      'failed': { badge: 'danger', icon: '❌', text: '已失败' },
      'canceled': { badge: 'secondary', icon: '🚫', text: '已取消' }
    },
    order: {
      'pending_payment': { badge: 'warning', icon: '💳', text: '待支付' },
      'awaiting_group_success': { badge: 'info', icon: '⏳', text: '待成团' },
      'successful': { badge: 'success', icon: '✅', text: '已成团' },
      'ready_for_pickup': { badge: 'primary', icon: '📦', text: '待提货' },
      'completed': { badge: 'success', icon: '🎉', text: '已完成' },
      'canceled': { badge: 'secondary', icon: '❌', text: '已取消' }
    }
  };
  
  // 获取状态标签HTML
  function getStatusBadge(type, status) {
    const statusConfig = STATUS_BADGES[type]?.[status] || { badge: 'secondary', icon: '', text: status };
    return `<span class="badge text-bg-${statusConfig.badge}" style="font-size: 0.8rem; padding: 0.35rem 0.65rem;">
      ${statusConfig.icon} ${statusConfig.text}
    </span>`;
  }

  async function loadProducts() {
    const res = await window.api.fetchAPI('/api/admin/products/');
    if (!res.ok) return;
    const data = await res.json();
    const tbody = productsTableBody();
    tbody.innerHTML = '';
    
    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5">
        <div class="mb-3" style="font-size: 3rem;">📦</div>
        <div class="text-muted">暂无商品数据</div>
        <div class="text-muted small mt-1">点击上方"添加新商品"按钮开始添加</div>
      </td></tr>`;
      return;
    }
    
    data.forEach(p => {
      const tr = document.createElement('tr');
      tr.style.cssText = 'transition: all 0.2s ease; border-bottom: 1px solid #f0f0f0;';
      
      // 库存状态判断
      const stockClass = p.stock_quantity <= 10 ? 'danger' : p.stock_quantity <= 50 ? 'warning' : 'success';
      const stockIcon = p.stock_quantity <= 10 ? '⚠️' : p.stock_quantity <= 50 ? '⚡' : '✅';
      
      // 分类图标和名称
      const categoryMap = {
        1: { icon: '🍎', name: '果蔬' },
        2: { icon: '🥩', name: '肉蛋' },
        3: { icon: '🧴', name: '日用' }
      };
      const category = categoryMap[p.category] || { icon: '📦', name: '未分类' };
      
      tr.innerHTML = `
        <td class="px-4 py-3">
          <span class="fw-semibold text-primary" style="font-family: 'SF Mono', Monaco, monospace;">#${p.id}</span>
        </td>
        <td class="px-4 py-3">
          ${p.image ? `<img src="${p.image}" alt="${p.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;">` : '<div style="width: 60px; height: 60px; background: #f0f0f0; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #999;">📷</div>'}
        </td>
        <td class="px-4 py-3">
          <div class="fw-semibold" style="color: #1d1d1f;">${p.name}</div>
          ${p.description ? `<div class="text-muted small" style="font-size: 0.8rem; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.description}</div>` : ''}
        </td>
        <td class="px-4 py-3 text-center">
          <span class="badge text-bg-light text-dark" style="font-size: 0.85rem; padding: 0.4rem 0.75rem;">
            ${category.icon} ${category.name}
          </span>
        </td>
        <td class="px-4 py-3 text-center">
          <span class="fw-bold" style="color: #34C759; font-size: 1rem;">¥${parseFloat(p.price).toFixed(2)}</span>
        </td>
        <td class="px-4 py-3 text-center">
          <span class="badge text-bg-${stockClass}" style="font-size: 0.85rem; padding: 0.4rem 0.75rem;">
            ${stockIcon} ${p.stock_quantity}
          </span>
        </td>
        <td class="px-4 py-3 text-center">
          <div class="d-flex gap-2 justify-content-center">
            <button class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${p.id}" 
                    style="border-radius: 8px; padding: 0.375rem 0.875rem; font-size: 0.875rem;">
              编辑
            </button>
            <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${p.id}"
                    style="border-radius: 8px; padding: 0.375rem 0.875rem; font-size: 0.875rem;">
              删除
            </button>
          </div>
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
    document.getElementById('product-category').value = product?.category || '';
    document.getElementById('product-price').value = product?.price || '';
    document.getElementById('product-stock').value = product?.stock_quantity || '';
    document.getElementById('product-image').value = '';
    
    // 重置图片选择按钮
    const selectBtn = document.getElementById('select-image-btn');
    if (selectBtn) {
      selectBtn.innerHTML = '📁 选择图片';
      selectBtn.classList.remove('btn-success');
      selectBtn.classList.add('btn-outline-primary');
    }
    
    // 显示现有图片预览
    const previewContainer = document.getElementById('image-preview-container');
    const previewImg = document.getElementById('image-preview');
    if (product?.image) {
      previewImg.src = product.image;
      previewContainer.style.display = 'block';
      // 如果有现有图片，显示为"更换图片"
      if (selectBtn) {
        selectBtn.innerHTML = '🔄 更换图片';
      }
    } else {
      previewContainer.style.display = 'none';
    }
    
    modal.show();
  }

  async function saveProduct() {
    const id = document.getElementById('product-id').value;
    const name = document.getElementById('product-name').value.trim();
    const category = document.getElementById('product-category').value;
    const price = document.getElementById('product-price').value;
    const stock = document.getElementById('product-stock').value;
    
    // 表单验证
    if (!name) {
      alert('请输入商品名称');
      return;
    }
    if (!price || parseFloat(price) <= 0) {
      alert('请输入有效的商品价格');
      return;
    }
    if (!stock || parseInt(stock, 10) < 0) {
      alert('请输入有效的库存数量');
      return;
    }
    
    // 图片验证
    const file = document.getElementById('product-image').files[0];
    if (file) {
      // 验证文件类型
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        alert('图片格式不支持，请上传 JPG、PNG 或 WEBP 格式的图片');
        return;
      }
      
      // 验证文件大小（最大5MB）
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        alert('图片文件过大，请上传小于 5MB 的图片');
        return;
      }
    }
    
    const form = new FormData();
    form.append('name', name);
    if (category) form.append('category', category);
    form.append('price', String(parseFloat(price)));
    form.append('stock_quantity', String(parseInt(stock, 10)));
    if (file) form.append('image', file);
    
    try {
      let res;
      if (id) {
        res = await window.api.fetchAPI(`/api/admin/products/${id}/`, { method: 'PUT', body: form });
      } else {
        res = await window.api.fetchAPI('/api/admin/products/', { method: 'POST', body: form });
      }
      
      if (res.ok) {
        alert(id ? '商品更新成功！' : '商品添加成功！');
        modal.hide();
        loadProducts();
      } else {
        const errorData = await res.json().catch(() => ({}));
        const errorMsg = errorData.detail || errorData.message || '操作失败，请重试';
        alert(`错误：${errorMsg}`);
      }
    } catch (error) {
      console.error('保存商品时出错:', error);
      alert('网络错误，请检查连接后重试');
    }
  }

  function bindEvents() {
    document.getElementById('btn-create')?.addEventListener('click', () => openModal(null));
    document.getElementById('save-product')?.addEventListener('click', saveProduct);
    
    // 图片选择按钮
    document.getElementById('select-image-btn')?.addEventListener('click', () => {
      document.getElementById('product-image')?.click();
    });
    
    // 图片实时预览
    document.getElementById('product-image')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      const previewContainer = document.getElementById('image-preview-container');
      const previewImg = document.getElementById('image-preview');
      const selectBtn = document.getElementById('select-image-btn');
      
      if (file) {
        // 验证文件类型
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
          alert('图片格式不支持，请上传 JPG、PNG 或 WEBP 格式的图片');
          e.target.value = '';
          previewContainer.style.display = 'none';
          if (selectBtn) selectBtn.innerHTML = '📁 选择图片';
          return;
        }
        
        // 验证文件大小
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
          alert('图片文件过大，请上传小于 5MB 的图片');
          e.target.value = '';
          previewContainer.style.display = 'none';
          if (selectBtn) selectBtn.innerHTML = '📁 选择图片';
          return;
        }
        
        // 更新按钮文本
        if (selectBtn) {
          selectBtn.innerHTML = '✅ 已选择图片';
          selectBtn.classList.remove('btn-outline-primary');
          selectBtn.classList.add('btn-success');
        }
        
        // 显示预览
        const reader = new FileReader();
        reader.onload = (event) => {
          previewImg.src = event.target.result;
          previewContainer.style.display = 'block';
        };
        reader.readAsDataURL(file);
      } else {
        previewContainer.style.display = 'none';
        if (selectBtn) {
          selectBtn.innerHTML = '📁 选择图片';
          selectBtn.classList.remove('btn-success');
          selectBtn.classList.add('btn-outline-primary');
        }
      }
    });
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

    // 页面内标签切换（支持左侧导航）
    document.querySelectorAll('.sidebar-nav .nav-link, .page-tabs .nav-link')?.forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const page = tab.getAttribute('data-page');
        const pageId = 'page-' + page;
        
        // 隐藏所有页面
        document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
        
        // 显示目标页面
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
          targetPage.style.display = '';
        }
        
        // 更新标签激活状态（支持左侧导航）
        document.querySelectorAll('.sidebar-nav .nav-link, .page-tabs .nav-link').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // 加载对应数据
        if (page === 'dashboard') loadDashboard();
        else if (page === 'orders') loadOrders();
        else if (page === 'products') loadProducts();
        else if (page === 'leaders') loadLeaderApplications();
        else if (page === 'inventory') loadAlerts();
      });
    });
    
    // 订单筛选和搜索
    const filterElement = document.getElementById('order-status-filter');
    const searchElement = document.getElementById('order-search');
    
    if (filterElement) {
      filterElement.addEventListener('change', (e) => {
        console.log('订单状态筛选器改变:', e.target.value);
        loadOrders();
      });
    }
    
    if (searchElement) {
      searchElement.addEventListener('input', debounce(() => {
        console.log('订单搜索输入:', searchElement.value);
        loadOrders();
      }, 500));
    }
  }
  
  // 防抖函数
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
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
        <div class="border rounded-3 p-4 text-center">
          <div class="fs-3 mb-2">👥</div>
          <div class="fw-semibold mb-1">暂无团长申请</div>
          <div class="text-muted small">当有用户申请成为团长时，审核信息将显示在这里</div>
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
        <div class="card shadow-community">
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0 table-apple" style="border-collapse: separate; border-spacing: 0;">
              <thead>
                <tr>
                  <th class="px-4 py-3 fw-semibold" style="border-top-left-radius: 12px;">团长信息</th>
                  <th class="px-4 py-3 fw-semibold text-center">拼单数</th>
                  <th class="px-4 py-3 fw-semibold text-center">月收益</th>
                  <th class="px-4 py-3 fw-semibold text-center">状态</th>
                  <th class="px-4 py-3 fw-semibold text-center" style="border-top-right-radius: 12px;">操作</th>
                </tr>
              </thead>
              <tbody id="approved-leaders-tbody"></tbody>
            </table>
          </div>
        </div>`;
      container.appendChild(approvedSection);
      
      const tbody = document.getElementById('approved-leaders-tbody');
      approvedLeaders.forEach(u => {
        const tr = document.createElement('tr');
        tr.style.cssText = 'transition: all 0.2s ease; border-bottom: 1px solid #f0f0f0;';
        tr.innerHTML = `
          <td class="px-4 py-3">
            <div class="d-flex align-items-center">
              <div class="rounded-circle bg-success bg-opacity-10 d-flex align-items-center justify-content-center me-3" style="width:44px;height:44px">
                <span class="text-success" style="font-size: 1.25rem;">👑</span>
              </div>
              <div>
                <div class="fw-semibold" style="color: #1d1d1f;">${u.real_name || u.username}</div>
                <div class="text-muted small" style="font-size: 0.8rem;">${u.email || '无邮箱'}</div>
              </div>
            </div>
          </td>
          <td class="px-4 py-3 text-center">
            <div class="fw-bold" style="font-size: 1.1rem; color: #1d1d1f;">${u.groupbuy_count || 0}</div>
            <div class="text-muted small" style="font-size: 0.8rem;">个拼单</div>
          </td>
          <td class="px-4 py-3 text-center">
            <div class="fw-bold" style="font-size: 1.1rem; color: #34C759;">¥${u.monthly_commission || 0}</div>
            <div class="text-muted small" style="font-size: 0.8rem;">本月</div>
          </td>
          <td class="px-4 py-3 text-center">
            <span class="badge text-bg-${u.is_active !== false ? 'success' : 'secondary'}" style="font-size: 0.8rem; padding: 0.4rem 0.75rem;">${u.is_active !== false ? '✅活跃' : '⛔️停用'}</span>
          </td>
          <td class="px-4 py-3 text-center">
            <div class="d-flex gap-2 justify-content-center">
              <button class="btn btn-sm btn-outline-primary" data-view-details="${u.id}"
                      style="border-radius: 8px; padding: 0.375rem 0.875rem; font-size: 0.875rem;">
                详情
              </button>
              <button class="btn btn-sm ${u.is_active !== false ? 'btn-outline-danger' : 'btn-outline-primary'}" data-toggle-status="${u.id}" data-current-status="${u.is_active !== false}"
                      style="border-radius: 8px; padding: 0.375rem 0.875rem; font-size: 0.875rem;">
                ${u.is_active !== false ? '停用' : '启用'}
              </button>
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
      const reason = prompt('请输入拒绝原因：');
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
    
    // 切换团长状态（停用/启用）
    const toggleStatusBtn = e.target.closest('button[data-toggle-status]');
    if (toggleStatusBtn) {
      const userId = toggleStatusBtn.getAttribute('data-toggle-status');
      const isCurrentlyActive = toggleStatusBtn.getAttribute('data-current-status') === 'true';
      const action = isCurrentlyActive ? '停用' : '启用';
      const confirmMsg = isCurrentlyActive ? '确认停用该团长？停用后将无法发起新的拼单。' : '确认启用该团长？';
      
      if (confirm(confirmMsg)) {
        const res = await window.api.fetchAPI(`/api/admin/leaders/${userId}/deactivate/`, { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          alert(data.message || `已${action}`);
          loadLeaderApplications();
        } else {
          alert('操作失败，请重试');
        }
      }
    }
  });
  
  // 显示团长详情
  async function showLeaderDetails(userId) {
    try {
      const res = await window.api.fetchAPI(`/api/admin/leaders/${userId}/details/`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMsg = errorData.error || errorData.detail || '获取详情失败';
        alert(`错误：${errorMsg}`);
        console.error('获取团长详情失败:', res.status, errorData);
        return;
      }
      
      const details = await res.json();
      console.log('团长详情数据:', details);
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
                                <td>${getStatusBadge('groupbuy', gb.status)}</td>
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
    } catch (error) {
      console.error('显示团长详情时出错:', error);
      alert('加载团长详情失败: ' + error.message);
    }
  }

  // 订单管理功能
  async function loadOrders(page = 1) {
    // 如果传入的是事件对象，重置为页码1
    if (typeof page === 'object') {
      page = 1;
    }
    
    const tbody = document.querySelector('#orders-table tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4">
        <div class="spinner-border spinner-border-sm me-2" role="status"></div>
        <span class="text-muted">正在加载订单...</span>
      </td></tr>`;
    }
    
    const statusFilter = document.getElementById('order-status-filter')?.value || '';
    const search = document.getElementById('order-search')?.value || '';
    
    const params = new URLSearchParams({
      page: page,
      page_size: 20
    });
    
    if (statusFilter) params.append('status', statusFilter);
    if (search) params.append('search', search);
    
    try {
      const res = await window.api.fetchAPI(`/api/admin/orders/?${params.toString()}`);
      if (!res.ok) {
        let errorMsg = `HTTP ${res.status}`;
        try {
          const errorData = await res.json();
          errorMsg = errorData.detail || errorData.error || errorData.message || errorMsg;
        } catch (e) {
          const errorText = await res.text().catch(() => '');
          if (errorText) errorMsg = errorText;
        }
        console.error('订单加载失败:', res.status, errorMsg);
        const tbody = document.querySelector('#orders-table tbody');
        if (tbody) {
          tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger py-4">
            <div class="mb-2">❌ 加载订单失败</div>
            <div class="text-muted small">错误信息: ${errorMsg}</div>
            <div class="text-muted small mt-1">请检查您的管理员权限或联系系统管理员</div>
          </td></tr>`;
        }
        return;
      }
      
      const data = await res.json();
      const tbody = document.querySelector('#orders-table tbody');
      if (!tbody) return;
      
      tbody.innerHTML = '';
      
      // 检查是否有results字段
      const orders = data.results || data || [];
      
      if (orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-5">
          <div class="mb-3" style="font-size: 3rem;">📦</div>
          <div class="text-muted">暂无订单数据</div>
          <div class="text-muted small mt-1">当用户下单后，订单信息将显示在这里</div>
        </td></tr>`;
        // 清空分页
        const paginationContainer = document.getElementById('orders-pagination');
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
      }
    
    orders.forEach((order, index) => {
      
      const tr = document.createElement('tr');
      tr.style.cssText = 'transition: all 0.2s ease; border-bottom: 1px solid #f0f0f0;';
      tr.innerHTML = `
        <td class="px-4 py-3">
          <span class="fw-semibold text-primary" style="font-family: 'SF Mono', Monaco, monospace;">#${order.id}</span>
        </td>
        <td class="px-4 py-3">
          <div class="fw-semibold" style="color: #1d1d1f;">${order.user_name}</div>
          <div class="text-muted small" style="font-size: 0.8rem;">${order.user_phone || '无电话'}</div>
        </td>
        <td class="px-4 py-3">
          <span style="color: #1d1d1f;">${order.product_name}</span>
        </td>
        <td class="px-4 py-3">
          <span class="text-muted">${order.leader_name}</span>
        </td>
        <td class="px-4 py-3 text-center">
          <span class="badge bg-light text-dark" style="font-size: 0.85rem; padding: 0.4rem 0.75rem;">${order.quantity}</span>
        </td>
        <td class="px-4 py-3">
          <span class="fw-bold" style="color: #34C759; font-size: 1rem;">¥${parseFloat(order.total_price).toFixed(2)}</span>
        </td>
        <td class="px-4 py-3 text-center">${getStatusBadge('order', order.status)}</td>
        <td class="px-4 py-3">
          <div class="text-muted small" style="font-size: 0.8rem; line-height: 1.4;">
            ${new Date(order.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}<br>
            ${new Date(order.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </td>
        <td class="px-4 py-3 text-center">
          <div class="d-flex gap-2 justify-content-center">
            <button class="btn btn-sm btn-outline-primary" data-view-order="${order.id}" style="border-radius: 8px; padding: 0.375rem 0.875rem; font-size: 0.875rem;">
              详情
            </button>
            ${order.status !== 'canceled' && order.status !== 'completed' ? 
              `<button class="btn btn-sm btn-outline-danger" data-cancel-order="${order.id}" style="border-radius: 8px; padding: 0.375rem 0.875rem; font-size: 0.875rem;">取消</button>` : ''}
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
    
      // 分页
      renderOrdersPagination(data.total || orders.length, data.page || page, data.page_size || 20);
    } catch (error) {
      console.error('加载订单出错:', error);
      const tbody = document.querySelector('#orders-table tbody');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger py-4">
          网络错误: ${error.message}
        </td></tr>`;
      }
    }
  }
  
  function renderOrdersPagination(total, currentPage, pageSize) {
    const container = document.getElementById('orders-pagination');
    if (!container) return;
    
    const totalPages = Math.ceil(total / pageSize);
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }
    
    let html = '<nav aria-label="订单分页"><ul class="pagination pagination-apple" style="gap: 0.5rem;">';
    
    // 上一页
    const prevDisabled = currentPage === 1;
    html += `<li class="page-item ${prevDisabled ? 'disabled' : ''}">
      <a class="page-link" href="#" data-order-page="${currentPage - 1}" 
         style="border-radius: 10px; padding: 0.5rem 1rem; border: 1px solid #e0e0e0; ${prevDisabled ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
        ← 上一页
      </a>
    </li>`;
    
    // 页码
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    // 第一页（如果不在可见范围内）
    if (startPage > 1) {
      html += `<li class="page-item">
        <a class="page-link" href="#" data-order-page="1" 
           style="border-radius: 10px; padding: 0.5rem 0.875rem; border: 1px solid #e0e0e0; min-width: 42px; text-align: center;">
          1
        </a>
      </li>`;
      if (startPage > 2) {
        html += `<li class="page-item disabled">
          <span class="page-link" style="border: none; background: none;">...</span>
        </li>`;
      }
    }
    
    for (let i = startPage; i <= endPage; i++) {
      const isActive = i === currentPage;
      html += `<li class="page-item ${isActive ? 'active' : ''}">
        <a class="page-link" href="#" data-order-page="${i}" 
           style="border-radius: 10px; padding: 0.5rem 0.875rem; min-width: 42px; text-align: center; 
                  border: 1px solid ${isActive ? '#34C759' : '#e0e0e0'}; 
                  background: ${isActive ? 'linear-gradient(135deg, #34C759 0%, #30D158 100%)' : 'white'}; 
                  color: ${isActive ? 'white' : '#1d1d1f'}; 
                  font-weight: ${isActive ? '600' : '500'};">
          ${i}
        </a>
      </li>`;
    }
    
    // 最后一页（如果不在可见范围内）
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        html += `<li class="page-item disabled">
          <span class="page-link" style="border: none; background: none;">...</span>
        </li>`;
      }
      html += `<li class="page-item">
        <a class="page-link" href="#" data-order-page="${totalPages}" 
           style="border-radius: 10px; padding: 0.5rem 0.875rem; border: 1px solid #e0e0e0; min-width: 42px; text-align: center;">
          ${totalPages}
        </a>
      </li>`;
    }
    
    // 下一页
    const nextDisabled = currentPage === totalPages;
    html += `<li class="page-item ${nextDisabled ? 'disabled' : ''}">
      <a class="page-link" href="#" data-order-page="${currentPage + 1}" 
         style="border-radius: 10px; padding: 0.5rem 1rem; border: 1px solid #e0e0e0; ${nextDisabled ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
        下一页 →
      </a>
    </li>`;
    
    html += '</ul></nav>';
    
    container.innerHTML = html;
  }
  
  // 处理订单操作
  document.addEventListener('click', async (e) => {
    // 查看订单详情
    const viewBtn = e.target.closest('button[data-view-order]');
    if (viewBtn) {
      const orderId = viewBtn.getAttribute('data-view-order');
      await showOrderDetails(orderId);
    }
    
    // 取消订单
    const cancelBtn = e.target.closest('button[data-cancel-order]');
    if (cancelBtn) {
      const orderId = cancelBtn.getAttribute('data-cancel-order');
      if (confirm('确认取消该订单？')) {
        const res = await window.api.fetchAPI(`/api/admin/orders/${orderId}/cancel/`, { method: 'POST' });
        if (res.ok) {
          alert('订单已取消');
          loadOrders();
        } else {
          alert('取消订单失败');
        }
      }
    }
    
    // 分页点击
    const pageLink = e.target.closest('a[data-order-page]');
    if (pageLink) {
      e.preventDefault();
      const page = parseInt(pageLink.getAttribute('data-order-page'));
      loadOrders(page);
    }
  });
  
  // 显示订单详情
  async function showOrderDetails(orderId) {
    const res = await window.api.fetchAPI(`/api/admin/orders/${orderId}/`);
    if (!res.ok) {
      alert('获取订单详情失败');
      return;
    }
    
    const order = await res.json();
    
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">订单详情 #${order.id}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="row g-4">
              <div class="col-md-6">
                <div class="card">
                  <div class="card-body">
                    <h6 class="card-title">用户信息</h6>
                    <div class="vstack gap-2">
                      <div><strong>姓名：</strong>${order.user.real_name || order.user.username}</div>
                      <div><strong>电话：</strong>${order.user.phone || '未设置'}</div>
                      <div><strong>邮箱：</strong>${order.user.email || '未设置'}</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="col-md-6">
                <div class="card">
                  <div class="card-body">
                    <h6 class="card-title">订单信息</h6>
                    <div class="vstack gap-2">
                      <div><strong>商品：</strong>${order.group_buy.product_name}</div>
                      <div><strong>团长：</strong>${order.group_buy.leader_name}</div>
                      <div><strong>数量：</strong>${order.items && order.items.length > 0 ? order.items.reduce((sum, item) => sum + item.quantity, 0) : (order.quantity || 0)}</div>
                      <div><strong>总价：</strong>¥${order.total_price}</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="col-12">
                <div class="card">
                  <div class="card-body">
                    <h6 class="card-title">支付信息</h6>
                    <div class="row g-3">
                      <div class="col-md-4">
                        <div><strong>支付状态：</strong>${order.payment_status}</div>
                      </div>
                      <div class="col-md-4">
                        <div><strong>支付方式：</strong>${order.payment_method || '未支付'}</div>
                      </div>
                      <div class="col-md-4">
                        <div><strong>支付时间：</strong>${order.payment_time ? new Date(order.payment_time).toLocaleString('zh-CN') : '未支付'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              ${order.pickup_address ? `
                <div class="col-12">
                  <div class="card">
                    <div class="card-body">
                      <h6 class="card-title">提货地址</h6>
                      <p class="mb-0">${order.pickup_address}</p>
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
      </div>
    `;
    
    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    modal.addEventListener('hidden.bs.modal', () => modal.remove());
  }

  // 暴露函数到全局作用域，供统一导航系统调用
  window.loadDashboard = loadDashboard;
  window.loadOrders = loadOrders;
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


