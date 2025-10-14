(() => {
  const groupBuysById = new Map();

  async function loadActiveGroupBuys() {
    const el = document.getElementById('groupbuy-list');
    if (!el) return;
    const res = await window.api.fetchAPI('/api/groupbuys/');
    if (!res.ok) {
      el.innerHTML = '<div class="col-12"><div class="border rounded-3 p-4 text-center"><div class="fs-3 mb-2">🛒</div><div class="fw-semibold mb-1">暂无活跃拼单</div><div class="text-muted small">精彩拼单即将上线，敬请期待</div></div></div>';
      return;
    }
    
    const data = await res.json();
    el.innerHTML = '';
    groupBuysById.clear();
    
    if (data.length === 0) {
      el.innerHTML = '<div class="col-12"><div class="border rounded-3 p-4 text-center"><div class="fs-3 mb-2">🛒</div><div class="fw-semibold mb-1">暂无活跃拼单</div><div class="text-muted small">精彩拼单即将上线，敬请期待</div></div></div>';
      return;
    }
    
    data.forEach(g => {
      groupBuysById.set(g.id, g);
      const progress = Math.min(100, Math.round((g.current_participants / Math.max(1, g.target_participants)) * 100));
      const timeLeft = g.end_time ? Math.max(0, Math.floor((new Date(g.end_time) - new Date()) / (1000 * 60 * 60))) : 0;
      const isHot = progress > 70 || g.current_participants > 10;
      const isAlmostFull = progress >= 90;
      
      const col = document.createElement('div');
      col.className = 'col-12 col-md-6 col-lg-4';
      col.innerHTML = `
        <div class="card h-100 lift ${isHot ? 'shadow-deal' : 'shadow-community'}">
          <div class="card-body">
            ${g.product_image_url ? `
              <div class="ratio ratio-4x3 mb-3 position-relative">
                <img src="${g.product_image_url}" alt="${g.product_name || g.product}" class="rounded w-100 h-100" style="object-fit: cover;">
                ${isHot ? '<span class="badge deal-badge position-absolute top-0 end-0 m-2">🔥 热门</span>' : ''}
                ${isAlmostFull ? '<span class="badge text-bg-warning position-absolute top-0 start-0 m-2">⚡ 即将成团</span>' : ''}
              </div>
            ` : ''}
            
            <div class="d-flex align-items-start justify-content-between mb-2">
              <h5 class="card-title mb-0">${g.product_name || g.product}</h5>
              ${g.leader_name ? `<span class="badge text-bg-secondary">👑 ${g.leader_name}</span>` : ''}
            </div>
            
            <div class="row g-2 mb-3">
              <div class="col-6">
                <div class="text-muted small">拼单价</div>
                <div class="fw-bold text-success fs-5">¥${g.product_price ?? '-'}</div>
              </div>
              <div class="col-6">
                <div class="text-muted small">原价</div>
                <div class="text-decoration-line-through text-muted">¥${g.original_price || (g.product_price * 1.2).toFixed(2)}</div>
              </div>
            </div>
            
            <div class="mb-3">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="small text-muted">拼单进度</span>
                <span class="small fw-semibold">${g.current_participants}/${g.target_participants}人</span>
              </div>
              <div class="progress">
                <div class="progress-bar ${progress >= 90 ? 'bg-warning' : ''}" style="width:${progress}%">${progress}%</div>
              </div>
            </div>
            
            ${timeLeft > 0 ? `
              <div class="text-muted small mb-2">
                ⏰ 剩余 ${timeLeft > 24 ? Math.floor(timeLeft/24) + '天' : timeLeft + '小时'}
              </div>
            ` : ''}
            
            <div class="d-flex gap-2">
              <button class="btn btn-primary flex-fill" data-join="${g.id}">
                ${isAlmostFull ? '🚀 立即参团' : '🛒 参加拼单'}
              </button>
              <button class="btn btn-outline-secondary" data-share="${g.id}" title="分享给好友">
                📤
              </button>
            </div>
          </div>
        </div>`;
      el.appendChild(col);
    });
  }

  async function submitJoin(group_buy_id, quantity, paymentMethod = 'wechat') {
    try {
      console.log('参团请求:', { group_buy_id, quantity });
      
      const res = await window.api.fetchAPI(`/api/group-buys/${group_buy_id}/join/`, { 
        method: 'POST', 
        body: { quantity: parseInt(quantity) } 
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log('参团响应:', data);
        
        // 关闭参团模态框
        const mdl = document.getElementById('joinModal');
        if (mdl) {
          const modalInstance = bootstrap.Modal.getInstance(mdl);
          if (modalInstance) modalInstance.hide();
        }
        
        // 显示成功消息
        if (window.websocket && window.websocket.showNotificationToast) {
          window.websocket.showNotificationToast('✅ 参团成功', data.message || '订单已创建，请及时支付', 'success');
        } else {
          alert(data.message || '参团成功！');
        }
        
        // 刷新拼单列表
        loadActiveGroupBuys();
        
        // 如果有订单ID，可以跳转到订单页面
        if (data.order_id) {
          if (confirm('参团成功！是否前往订单页面？')) {
            window.location.href = '/orders.html';
          }
        }
      } else {
        const data = await res.json().catch(() => ({}));
        const errorMsg = data.error || '参团失败，请重试';
        
        // 如果是名额不足，提供更详细的信息
        if (data.remaining_slots !== undefined) {
          const remaining = data.remaining_slots;
          if (remaining > 0) {
            const retry = confirm(`${errorMsg}\n\n当前剩余 ${remaining} 个名额，是否修改数量为 ${remaining} 后重新参团？`);
            if (retry) {
              // 自动调整数量并重试
              submitJoin(group_buy_id, remaining, paymentMethod);
              return;
            }
          } else {
            alert('抱歉，该拼单已满员，无法参团。');
          }
        } else {
          alert(errorMsg);
        }
        console.error('参团失败:', res.status, data);
      }
    } catch (error) {
      console.error('参团错误:', error);
      alert('参团失败: ' + error.message);
    }
  }
  
  function showPaymentModal(orderId, totalPrice, defaultMethod = 'wechat') {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">💰 选择支付方式</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="community-highlight mb-3">
              <h6>订单已创建，请选择支付方式</h6>
              <p class="text-muted mb-0">订单号：${orderId} · 金额：¥${totalPrice}</p>
            </div>
            
            <div class="d-grid gap-2">
              <button class="btn btn-success btn-lg" data-payment-method="wechat">
                <div class="d-flex align-items-center justify-content-center">
                  <span class="fs-4 me-2">💬</span>
                  <div>
                    <div class="fw-bold">微信支付</div>
                    <small class="text-muted">推荐使用</small>
                  </div>
                </div>
              </button>
              
              <button class="btn btn-primary btn-lg" data-payment-method="alipay">
                <div class="d-flex align-items-center justify-content-center">
                  <span class="fs-4 me-2">💰</span>
                  <div>
                    <div class="fw-bold">支付宝支付</div>
                    <small class="text-muted">安全便捷</small>
                  </div>
                </div>
              </button>
              
              <button class="btn btn-outline-secondary" data-payment-method="later">
                稍后支付
              </button>
            </div>
          </div>
        </div>
      </div>`;
    
    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    
    // 处理支付方式选择
    modal.addEventListener('click', async (e) => {
      const paymentBtn = e.target.closest('[data-payment-method]');
      if (paymentBtn) {
        const method = paymentBtn.getAttribute('data-payment-method');
        
        if (method === 'later') {
          bsModal.hide();
          window.websocket.showNotificationToast('⏰ 提醒', '订单已保存，请及时完成支付', 'warning');
          return;
        }
        
        try {
          paymentBtn.disabled = true;
          paymentBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>处理中...';
          
          await window.payment.initiatePayment(orderId, method);
          bsModal.hide();
        } catch (error) {
          alert('支付失败: ' + error.message);
          paymentBtn.disabled = false;
          paymentBtn.innerHTML = method === 'wechat' ? '💬 微信支付' : '💰 支付宝支付';
        }
      }
    });
    
    modal.addEventListener('hidden.bs.modal', () => modal.remove());
  }

  async function joinGroupBuy(group_buy_id) {
    const tokens = window.api.getTokens();
    if (!tokens.access) {
      if (confirm('参团需要登录，是否前往登录？')) {
        window.location.href = '/login.html';
      }
      return;
    }
    const modalEl = document.getElementById('joinModal');
    const gb = groupBuysById.get(group_buy_id);
    if (modalEl && gb) {
      document.getElementById('join-id').value = String(gb.id);
      document.getElementById('join-name').textContent = gb.product_name || gb.product || '';
      document.getElementById('join-price').textContent = gb.product_price ?? '-';
      document.getElementById('join-current').textContent = gb.current_participants ?? 0;
      document.getElementById('join-target').textContent = gb.target_participants ?? 0;
      const img = document.getElementById('join-image');
      if (img) { img.src = gb.product_image_url || ''; }
      
      // 计算剩余名额
      const currentParticipants = parseInt(gb.current_participants ?? 0, 10);
      const targetParticipants = parseInt(gb.target_participants ?? 0, 10);
      const remainingSlots = Math.max(0, targetParticipants - currentParticipants);
      
      // 设定数量输入的最大值：取库存和剩余名额的较小值
      const qtyInput = document.getElementById('join-qty');
      const stock = parseInt(gb.product_stock ?? '0', 10);
      const maxQty = Math.min(stock || Infinity, remainingSlots);
      
      qtyInput.value = '1';
      if (maxQty > 0) {
        qtyInput.max = String(maxQty);
      } else {
        qtyInput.max = '0';
      }
      
      // 显示剩余名额提示
      const modalBody = qtyInput.closest('.modal-body');
      modalBody.querySelector('#remaining-slots-info')?.remove();
      const slotsInfo = document.createElement('div');
      slotsInfo.id = 'remaining-slots-info';
      slotsInfo.className = 'small text-muted mt-2';
      slotsInfo.innerHTML = `
        📊 剩余名额：<strong class="${remainingSlots === 0 ? 'text-danger' : 'text-primary'}">${remainingSlots}</strong> 个
        ${remainingSlots === 0 ? '<span class="text-danger">（已满员）</span>' : ''}
      `;
      qtyInput.parentElement.insertBefore(slotsInfo, qtyInput.nextSibling);
      
      // 实时显示小计
      qtyInput.oninput = () => {
        const qty = Math.max(1, Math.min(parseInt(qtyInput.value || '1', 10), maxQty));
        qtyInput.value = String(qty);
        const price = parseFloat(gb.product_price || 0) || 0;
        const subtotal = (price * qty).toFixed(2);
        modalBody.querySelector('#join-subtotal')?.remove();
        const sub = document.createElement('div');
        sub.id = 'join-subtotal';
        sub.className = 'text-muted small mt-2';
        sub.textContent = `小计：¥${subtotal}`;
        qtyInput.parentElement.appendChild(sub);
      };
      qtyInput.oninput();
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    } else {
      const quantity = parseInt(prompt('请输入购买数量', '1') || '1', 10);
      submitJoin(group_buy_id, quantity);
    }
  }

  async function loadMyOrders() {
    const el = document.getElementById('orders-list');
    if (!el) return;
    const tokens = window.api.getTokens();
    if (!tokens.access) {
      return; // 未登录时不加载订单，但不跳转
    }
    const res = await window.api.fetchAPI('/api/me/orders/');
    if (!res.ok) return;
    const data = await res.json();
    el.innerHTML = '';
    
    // 状态翻译映射
    const statusMap = {
      'pending_payment': '待支付',
      'awaiting_group_success': '待成团',
      'successful': '已成团',
      'ready_for_pickup': '待提货',
      'completed': '已完成',
      'canceled': '已取消'
    };
    
    data.forEach(o => {
      const badgeClass = o.status === 'awaiting_group_success' ? 'text-bg-warning' : (o.status === 'successful' || o.status === 'completed') ? 'text-bg-success' : 'text-bg-secondary';
      const card = document.createElement('div');
      card.className = 'card shadow-sm';
      card.innerHTML = `
        <div class="card-body d-flex align-items-center">
          <div class="flex-grow-1">
            <div class="d-flex align-items-center mb-1">
              <div class="fw-semibold me-2">订单 #${o.id}</div>
              <span class="badge ${badgeClass}">${statusMap[o.status] || o.status}</span>
            </div>
            <div class="text-muted small">总价：${o.total_price}</div>
          </div>
          <div class="ms-3 d-flex gap-2">
            <button class="btn btn-outline-primary btn-sm" data-view-order="${o.id}">查看详情</button>
            ${o.status === 'successful' || o.status === 'ready_for_pickup' ? `<button class="btn btn-primary btn-sm" data-confirm="${o.id}">确认收货</button>` : ''}
            ${o.status === 'completed' ? `<button class="btn btn-secondary btn-sm" data-review="${o.id}">发表评价</button>` : ''}
          </div>
        </div>`;
      el.appendChild(card);
    });
  }

  async function loadRecommendations() {
    const el = document.getElementById('reco-list');
    if (!el) return;
    
    console.log('开始加载推荐商品...');
    
    // 显示加载状态
    el.innerHTML = '<div class="col-12 text-center py-4"><div class="spinner-border spinner-border-sm me-2"></div><span class="text-muted">正在加载推荐...</span></div>';
    
    // 尝试个性化推荐，如果失败则使用商品列表
    const endpoints = ['/api/recommendations/', '/api/products/'];
    let data = [];
    
    for (const endpoint of endpoints) {
      const res = await window.api.fetchAPI(endpoint);
      if (res.ok) {
        data = await res.json();
        console.log(`从 ${endpoint} 获取到 ${data.length} 个商品`);
        break;
      }
    }
    
    el.innerHTML = '';
    
    if (data.length === 0) {
      el.innerHTML = '<div class="col-12"><div class="text-muted text-center py-4">暂无推荐商品</div></div>';
      return;
    }
    
    // 随机打乱数组（Fisher-Yates 洗牌算法）
    const shuffled = [...data];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    console.log('已随机打乱商品顺序');
    
    // 显示前6个
    shuffled.slice(0, 6).forEach(p => {
      const col = document.createElement('div');
      col.className = 'col-12 col-md-6 col-lg-4';
      
      // 计算节省金额
      const savings = p.original_price ? (p.original_price - p.price) : (p.price * 0.2);
      const savingsPercent = p.original_price ? Math.round(((p.original_price - p.price) / p.original_price) * 100) : 20;
      
      col.innerHTML = `
        <div class="card h-100 lift shadow-community">
          <div class="card-body">
            <div class="position-relative mb-3">
              ${p.image ? `<div class="ratio ratio-4x3"><img src="${p.image}" alt="${p.name}" class="rounded w-100 h-100" style="object-fit: cover;"></div>` : 
                '<div class="ratio ratio-4x3 bg-light rounded d-flex align-items-center justify-content-center"><span class="text-muted fs-1">🛍️</span></div>'}
              ${savings > 0 ? `<span class="badge deal-badge position-absolute top-0 end-0 m-2">省¥${savings.toFixed(0)}</span>` : ''}
            </div>
            
            <h6 class="fw-semibold mb-2">${p.name}</h6>
            
            <div class="row g-2 mb-3">
              <div class="col-6">
                <div class="text-muted small">拼单价</div>
                <div class="fw-bold text-success">¥${p.price}</div>
              </div>
              <div class="col-6">
                <div class="text-muted small">预计节省</div>
                <div class="text-primary fw-semibold">${savingsPercent}%</div>
              </div>
            </div>
            
            <div class="d-flex gap-2">
              <button class="btn btn-outline-primary btn-sm flex-fill" data-product-reviews="${p.id}">
                ⭐ 查看评价
              </button>
              <button class="btn btn-outline-secondary btn-sm" data-notify-groupbuy="${p.id}" title="有新拼单时通知我">
                🔔
              </button>
            </div>
            
            ${p.stock_quantity <= 5 ? '<div class="text-warning small mt-2">⚠️ 库存紧张</div>' : ''}
          </div>
        </div>`;
      el.appendChild(col);
    });
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-join]');
    if (btn) {
      const id = parseInt(btn.getAttribute('data-join'), 10);
      joinGroupBuy(id);
    }
    
    // 查看订单详情
    const viewOrderBtn = e.target.closest('button[data-view-order]');
    if (viewOrderBtn) {
      const orderId = parseInt(viewOrderBtn.getAttribute('data-view-order'), 10);
      showOrderDetails(orderId);
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
      let mdl = document.getElementById('reviewModal');
      if (!mdl) {
        mdl = document.createElement('div');
        mdl.id = 'reviewModal';
        mdl.className = 'modal fade';
        mdl.innerHTML = `
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header"><h5 class="modal-title">发表评价</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
              <div class="modal-body">
                <div class="mb-2"><label class="form-label">评分（1-5）</label><input type="number" class="form-control" id="review-rating" min="1" max="5" value="5"></div>
                <div class="mb-2"><label class="form-label">评价内容</label><textarea class="form-control" id="review-comment" rows="3" placeholder="写下你的评价（可选）"></textarea></div>
              </div>
              <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">取消</button><button class="btn btn-primary" id="review-submit">提交</button></div>
            </div>
          </div>`;
        document.body.appendChild(mdl);
      }
      const modal = new bootstrap.Modal(mdl);
      modal.show();
      const submit = mdl.querySelector('#review-submit');
      submit.onclick = async () => {
        const rating = parseInt(document.getElementById('review-rating').value || '5', 10);
        const comment = document.getElementById('review-comment').value || '';
        const res = await window.api.fetchAPI(`/api/orders/${id}/review/`, { method: 'POST', body: { rating, comment } });
        if (res.ok) {
          modal.hide();
          alert('评价成功');
        }
      };
    }

    const productReviewsBtn = e.target.closest('button[data-product-reviews]');
    if (productReviewsBtn) {
      const id = parseInt(productReviewsBtn.getAttribute('data-product-reviews'), 10);
      (async () => {
        const res = await window.api.fetchAPI(`/api/products/${id}/reviews/`);
        if (!res.ok) return;
        const list = await res.json();
        const mdl = document.createElement('div');
        mdl.className = 'modal fade';
        mdl.innerHTML = `
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header"><h5 class="modal-title">商品评价</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
              <div class="modal-body">
                <div class="vstack gap-2">
                  ${list.map(r => `
                    <div class="border rounded p-2">
                      <div class="d-flex align-items-center mb-1"><div class="badge text-bg-secondary me-2">${r.rating}</div><div class="fw-semibold">${r.user_username || ''}</div></div>
                      <div class="text-muted small">${r.comment || ''}</div>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>`;
        document.body.appendChild(mdl);
        const modal = new bootstrap.Modal(mdl);
        modal.show();
        mdl.addEventListener('hidden.bs.modal', () => mdl.remove());
      })();
    }

    const joinSubmit = e.target.closest('#join-submit');
    if (joinSubmit) {
      const id = parseInt(document.getElementById('join-id').value, 10);
      const qtyInput = document.getElementById('join-qty');
      const max = parseInt(qtyInput.max || '0', 10) || Infinity;
      const qty = Math.max(1, Math.min(parseInt(qtyInput.value || '1', 10), max));
      if (!isFinite(qty) || qty <= 0) {
        alert('请输入有效数量');
        return;
      }
      submitJoin(id, qty);
    }
    
    // 分享拼单
    const shareBtn = e.target.closest('button[data-share]');
    if (shareBtn) {
      const id = parseInt(shareBtn.getAttribute('data-share'), 10);
      const groupbuy = groupBuysById.get(id);
      if (groupbuy) {
        shareGroupBuy(groupbuy);
      }
    }
    
    // 商品拼单通知
    const notifyBtn = e.target.closest('button[data-notify-groupbuy]');
    if (notifyBtn) {
      const productId = parseInt(notifyBtn.getAttribute('data-notify-groupbuy'), 10);
      notifyForProduct(productId, notifyBtn);
    }
  });

  // 新增功能函数
  let allGroupBuys = [];
  let currentFilter = 'all';
  let currentSort = 'time';
  
  // 加载统计数据
  async function loadStats() {
    try {
      const res = await window.api.fetchAPI('/api/stats/');
      if (res.ok) {
        const stats = await res.json();
        document.getElementById('total-active-groups').textContent = stats.active_groups || 0;
        document.getElementById('total-participants').textContent = stats.total_participants || 0;
        document.getElementById('total-savings').textContent = `¥${stats.total_savings || 0}`;
      }
    } catch (error) {
      console.log('加载统计数据失败');
    }
  }
  
  // 加载成功案例
  async function loadSuccessStories() {
    const container = document.getElementById('success-stories');
    if (!container) return;
    
    try {
      console.log('开始加载成功案例...');
      const res = await window.api.fetchAPI('/api/groupbuys/successful/?limit=6');
      console.log('成功案例API响应状态:', res.status, res.ok);
      
      if (res.ok) {
        const stories = await res.json();
        console.log('成功案例数据:', stories);
        container.innerHTML = '';
        
        if (!Array.isArray(stories) || stories.length === 0) {
          container.innerHTML = '<div class="col-12 text-center text-muted py-3">暂无成功案例</div>';
          return;
        }
        
        stories.forEach(story => {
          const col = document.createElement('div');
          col.className = 'col-12 col-md-6 col-lg-4';
          
          // 安全地格式化日期
          let dateStr = '未知时间';
          try {
            if (story.completed_at) {
              dateStr = new Date(story.completed_at).toLocaleDateString('zh-CN');
            }
          } catch (e) {
            console.error('日期格式化失败:', e);
          }
          
          col.innerHTML = `
            <div class="card h-100 shadow-community">
              <div class="card-body">
                <div class="d-flex align-items-center mb-2">
                  <span class="me-2" style="font-size: 1.5rem;">✅</span>
                  <h6 class="card-title mb-0 fw-semibold">${story.product_name || '未知商品'}</h6>
                </div>
                <div class="text-muted small mb-2">
                  👥 成团人数：<span class="fw-semibold">${story.final_participants || 0}</span> 人
                </div>
                <div class="text-success small mb-2">
                  💰 共节省：<span class="fw-bold">¥${story.total_savings || 0}</span>
                </div>
                <div class="text-muted small">
                  🕐 ${dateStr} 成功完成
                </div>
              </div>
            </div>`;
          container.appendChild(col);
        });
      } else {
        console.error('加载成功案例失败，状态码:', res.status);
        const errorData = await res.json().catch(() => ({}));
        console.error('错误详情:', errorData);
        container.innerHTML = '<div class="col-12 text-center text-muted py-3">暂无成功案例</div>';
      }
    } catch (error) {
      console.error('加载成功案例时出错:', error);
      container.innerHTML = '<div class="col-12 text-center text-muted py-3">暂无成功案例</div>';
    }
  }
  
  // 加载优秀团长
  async function loadFeaturedLeaders() {
    const container = document.getElementById('featured-leaders');
    if (!container) return;
    
    try {
      const res = await window.api.fetchAPI('/api/leaders/featured/?limit=3');
      if (res.ok) {
        const leaders = await res.json();
        container.innerHTML = '';
        
        if (leaders.length === 0) {
          container.innerHTML = '<div class="col-12 text-center text-muted py-3">暂无推荐团长</div>';
          return;
        }
        
        leaders.forEach(leader => {
          const col = document.createElement('div');
          col.className = 'col-12 col-md-4';
          col.innerHTML = `
            <div class="d-flex align-items-center">
              <div class="rounded-circle bg-warning bg-opacity-10 d-flex align-items-center justify-content-center me-3" style="width:48px;height:48px">
                <span class="text-warning">👑</span>
              </div>
              <div>
                <div class="fw-semibold">${leader.name}</div>
                <div class="text-muted small">${leader.successful_groupbuys || 0}个成功拼单</div>
              </div>
            </div>`;
          container.appendChild(col);
        });
      }
    } catch (error) {
      container.innerHTML = '<div class="col-12 text-center text-muted py-3">加载失败</div>';
    }
  }
  
  // 过滤和排序功能
  window.filterGroupBuys = function(category) {
    currentFilter = category;
    const buttons = document.querySelectorAll('[onclick^="filterGroupBuys"]');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    displayFilteredGroupBuys();
  };
  
  window.sortGroupBuys = function(sortBy) {
    currentSort = sortBy;
    displayFilteredGroupBuys();
  };
  
  function displayFilteredGroupBuys() {
    let filtered = [...allGroupBuys];
    
    // 应用过滤
    if (currentFilter !== 'all') {
      filtered = filtered.filter(g => {
        const category = (g.category || '').toLowerCase();
        // 'fresh' 分类包含 food 和 fruit
        if (currentFilter === 'fresh') {
          return category.includes('food') || category.includes('fruit') || category.includes('vegetable') || category.includes('fresh');
        }
        return category.includes(currentFilter);
      });
    }
    
    // 应用排序
    switch (currentSort) {
      case 'progress':
        filtered.sort((a, b) => b.current_participants - a.current_participants);
        break;
      case 'price':
        filtered.sort((a, b) => (a.product_price || 0) - (b.product_price || 0));
        break;
      case 'ending':
        filtered.sort((a, b) => {
          const timeA = a.end_time ? new Date(a.end_time).getTime() : Infinity;
          const timeB = b.end_time ? new Date(b.end_time).getTime() : Infinity;
          return timeA - timeB;
        });
        break;
      default: // time
        filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }
    
    // 重新渲染列表
    const el = document.getElementById('groupbuy-list');
    if (!el) return;
    
    el.innerHTML = '';
    groupBuysById.clear();
    
    if (filtered.length === 0) {
      el.innerHTML = '<div class="col-12"><div class="border rounded-3 p-4 text-center"><div class="fs-3 mb-2">🔍</div><div class="fw-semibold mb-1">没有找到相关拼单</div><div class="text-muted small">试试其他分类或稍后再来看看</div></div></div>';
      return;
    }
    
    filtered.forEach(g => {
      groupBuysById.set(g.id, g);
      const progress = Math.min(100, Math.round((g.current_participants / Math.max(1, g.target_participants)) * 100));
      const timeLeft = g.end_time ? Math.max(0, Math.floor((new Date(g.end_time) - new Date()) / (1000 * 60 * 60))) : 0;
      const isHot = progress > 70 || g.current_participants > 10;
      const isAlmostFull = progress >= 90;
      
      const col = document.createElement('div');
      col.className = 'col-12 col-md-6 col-lg-4';
      col.innerHTML = `
        <div class="card h-100 lift ${isHot ? 'shadow-deal' : 'shadow-community'}">
          <div class="card-body">
            ${g.product_image_url ? `
              <div class="ratio ratio-4x3 mb-3 position-relative">
                <img src="${g.product_image_url}" alt="${g.product_name || g.product}" class="rounded w-100 h-100" style="object-fit: cover;">
                ${isHot ? '<span class="badge deal-badge position-absolute top-0 end-0 m-2">🔥 热门</span>' : ''}
                ${isAlmostFull ? '<span class="badge text-bg-warning position-absolute top-0 start-0 m-2">⚡ 即将成团</span>' : ''}
              </div>
            ` : ''}
            
            <div class="d-flex align-items-start justify-content-between mb-2">
              <h5 class="card-title mb-0">${g.product_name || g.product}</h5>
              ${g.leader_name ? `<span class="badge text-bg-secondary">👑 ${g.leader_name}</span>` : ''}
            </div>
            
            <div class="row g-2 mb-3">
              <div class="col-6">
                <div class="text-muted small">拼单价</div>
                <div class="fw-bold text-success fs-5">¥${g.product_price ?? '-'}</div>
              </div>
              <div class="col-6">
                <div class="text-muted small">原价</div>
                <div class="text-decoration-line-through text-muted">¥${g.original_price || (g.product_price * 1.2).toFixed(2)}</div>
              </div>
            </div>
            
            <div class="mb-3">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="small text-muted">拼单进度</span>
                <span class="small fw-semibold">${g.current_participants}/${g.target_participants}人</span>
              </div>
              <div class="progress">
                <div class="progress-bar ${progress >= 90 ? 'bg-warning' : ''}" style="width:${progress}%">${progress}%</div>
              </div>
            </div>
            
            ${timeLeft > 0 ? `
              <div class="text-muted small mb-2">
                ⏰ 剩余 ${timeLeft > 24 ? Math.floor(timeLeft/24) + '天' : timeLeft + '小时'}
              </div>
            ` : ''}
            
            <div class="d-flex gap-2">
              <button class="btn btn-primary flex-fill" data-join="${g.id}">
                ${isAlmostFull ? '🚀 立即参团' : '🛒 参加拼单'}
              </button>
              <button class="btn btn-outline-secondary" data-share="${g.id}" title="分享给好友">
                📤
              </button>
            </div>
          </div>
        </div>`;
      el.appendChild(col);
    });
  }

  // 初始化函数
  function initPage() {
    console.log('初始化首页...');
    
    // 加载所有数据
    loadStats();
    loadActiveGroupBuys().then(() => {
      // 保存原始数据用于过滤排序
      allGroupBuys = Array.from(groupBuysById.values());
    });
    loadMyOrders();
    loadRecommendations();
    // loadSuccessStories(); // 已隐藏成功案例区块
    loadFeaturedLeaders();
    
    // 绑定"换一批"按钮事件
    const refreshBtn = document.getElementById('refresh-recos');
    console.log('找到换一批按钮:', refreshBtn);
    if (refreshBtn) {
      // 移除可能存在的旧事件监听器
      const newRefreshBtn = refreshBtn.cloneNode(true);
      refreshBtn.parentNode.replaceChild(newRefreshBtn, refreshBtn);
      
      // 绑定新的事件
      newRefreshBtn.addEventListener('click', () => {
        console.log('🔄 换一批按钮被点击！');
        loadRecommendations();
      });
      console.log('✅ 换一批按钮事件已绑定');
    } else {
      console.warn('❌ 未找到换一批按钮！');
    }
  }
  
  // 确保DOM完全加载后执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
  } else {
    // DOM已经加载完成，直接执行
    initPage();
  }

  // 分享拼单功能
  function shareGroupBuy(groupbuy) {
    const shareText = `🛒 ${groupbuy.product_name || groupbuy.product} 正在拼单！\n💰 拼单价：¥${groupbuy.product_price}\n👥 还需 ${groupbuy.target_participants - groupbuy.current_participants} 人即可成团\n⏰ 机会有限，快来参加！`;
    const shareUrl = `${window.location.origin}/index.html#groupbuy-${groupbuy.id}`;
    
    if (navigator.share) {
      navigator.share({
        title: '社区团购 - ' + (groupbuy.product_name || groupbuy.product),
        text: shareText,
        url: shareUrl,
      }).catch(console.error);
    } else {
      // 显示分享模态框
      const modal = document.createElement('div');
      modal.className = 'modal fade';
      modal.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">📤 分享拼单</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="community-highlight mb-3">
                <h6>${groupbuy.product_name || groupbuy.product}</h6>
                <p class="text-muted mb-0">分享给好友，一起参团更优惠！</p>
              </div>
              
              <div class="mb-3">
                <label class="form-label">分享链接</label>
                <div class="input-group">
                  <input type="text" class="form-control" value="${shareUrl}" readonly id="share-url">
                  <button class="btn btn-outline-secondary" onclick="copyToClipboard('share-url')">复制</button>
                </div>
              </div>
              
              <div class="mb-3">
                <label class="form-label">分享文案</label>
                <textarea class="form-control" rows="4" readonly id="share-text">${shareText}</textarea>
              </div>
              
              <div class="d-flex gap-2">
                <button class="btn btn-success flex-fill" onclick="shareToWeChat()">
                  💬 微信分享
                </button>
                <button class="btn btn-primary flex-fill" onclick="copyToClipboard('share-text')">
                  📋 复制文案
                </button>
              </div>
            </div>
          </div>
        </div>`;
      
      document.body.appendChild(modal);
      const bsModal = new bootstrap.Modal(modal);
      bsModal.show();
      modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }
  }
  
  // 显示订单详情
  async function showOrderDetails(orderId) {
    try {
      const res = await window.api.fetchAPI(`/api/me/orders/${orderId}/`);
      if (!res.ok) {
        alert('获取订单详情失败');
        return;
      }
      
      const order = await res.json();
      
      // 状态翻译映射
      const statusMap = {
        'pending_payment': '待支付',
        'awaiting_group_success': '待成团',
        'successful': '已成团',
        'ready_for_pickup': '待提货',
        'completed': '已完成',
        'canceled': '已取消'
      };
      
      const modal = document.createElement('div');
      modal.className = 'modal fade';
      modal.innerHTML = `
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">📦 订单详情 #${order.id}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="row g-4">
                <div class="col-12">
                  <div class="card">
                    <div class="card-body">
                      <h6 class="card-title">订单状态</h6>
                      <div class="d-flex align-items-center gap-3">
                        <span class="badge ${order.status === 'awaiting_group_success' ? 'text-bg-warning' : (order.status === 'successful' || order.status === 'completed') ? 'text-bg-success' : 'text-bg-secondary'}" style="font-size: 1rem; padding: 0.5rem 1rem;">
                          ${statusMap[order.status] || order.status}
                        </span>
                        <div class="text-muted small">
                          下单时间：${new Date(order.created_at).toLocaleString('zh-CN')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div class="col-md-6">
                  <div class="card">
                    <div class="card-body">
                      <h6 class="card-title">商品信息</h6>
                      <div class="vstack gap-2">
                        <div><strong>商品名称：</strong>${order.product_name || order.group_buy?.product_name || '未知商品'}</div>
                        <div><strong>单价：</strong>¥${order.price_per_unit || order.group_buy?.product_price || '0.00'}</div>
                        <div><strong>数量：</strong>${order.quantity || 0}</div>
                        <div class="border-top pt-2 mt-2">
                          <strong>总价：</strong><span class="text-success fs-5 fw-bold">¥${order.total_price}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div class="col-md-6">
                  <div class="card">
                    <div class="card-body">
                      <h6 class="card-title">团购信息</h6>
                      <div class="vstack gap-2">
                        <div><strong>团长：</strong>${order.leader_name || order.group_buy?.leader_name || '未知'}</div>
                        <div><strong>拼单进度：</strong>${order.group_buy ? `${order.group_buy.current_participants || 0}/${order.group_buy.target_participants || 0}人` : '未知'}</div>
                        ${order.pickup_address ? `<div><strong>提货地址：</strong>${order.pickup_address}</div>` : ''}
                      </div>
                    </div>
                  </div>
                </div>
                
                ${order.payment_status ? `
                  <div class="col-12">
                    <div class="card">
                      <div class="card-body">
                        <h6 class="card-title">支付信息</h6>
                        <div class="row g-3">
                          <div class="col-md-4">
                            <div><strong>支付状态：</strong><span class="badge text-bg-${order.payment_status === 'paid' ? 'success' : order.payment_status === 'pending' ? 'warning' : 'secondary'}">${order.payment_status === 'paid' ? '已支付' : order.payment_status === 'pending' ? '待支付' : order.payment_status}</span></div>
                          </div>
                          ${order.payment_method ? `<div class="col-md-4"><div><strong>支付方式：</strong>${order.payment_method === 'wechat' ? '微信支付' : order.payment_method === 'alipay' ? '支付宝' : order.payment_method}</div></div>` : ''}
                          ${order.payment_time ? `<div class="col-md-4"><div><strong>支付时间：</strong>${new Date(order.payment_time).toLocaleString('zh-CN')}</div></div>` : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                ` : ''}
              </div>
            </div>
            <div class="modal-footer">
              ${order.status === 'successful' || order.status === 'ready_for_pickup' ? `<button class="btn btn-primary" data-confirm="${order.id}" onclick="this.closest('.modal').querySelector('[data-bs-dismiss]').click(); document.querySelector('[data-confirm=\\'${order.id}\\']').click();">确认收货</button>` : ''}
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">关闭</button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      const bsModal = new bootstrap.Modal(modal);
      bsModal.show();
      modal.addEventListener('hidden.bs.modal', () => modal.remove());
    } catch (error) {
      console.error('显示订单详情时出错:', error);
      alert('加载订单详情失败: ' + error.message);
    }
  }

  // 商品拼单通知功能
  async function notifyForProduct(productId, buttonEl) {
    const tokens = window.api.getTokens();
    if (!tokens.access) {
      if (confirm('设置通知需要登录，是否前往登录？')) {
        window.location.href = '/login.html';
      }
      return;
    }
    
    try {
      const res = await window.api.fetchAPI(`/api/products/${productId}/notify/`, { method: 'POST' });
      if (res.ok) {
        buttonEl.innerHTML = '✅';
        buttonEl.disabled = true;
        buttonEl.title = '已设置通知';
        setTimeout(() => {
          buttonEl.innerHTML = '🔔';
          buttonEl.disabled = false;
          buttonEl.title = '有新拼单时通知我';
        }, 2000);
      } else {
        alert('设置通知失败');
      }
    } catch (error) {
      alert('网络错误');
    }
  }
  
  // 工具函数
  window.copyToClipboard = function(elementId) {
    const element = document.getElementById(elementId);
    element.select();
    document.execCommand('copy');
    
    // 显示复制成功提示
    const originalText = element.value;
    element.value = '已复制到剪贴板！';
    setTimeout(() => {
      element.value = originalText;
    }, 1000);
  };
  
  window.shareToWeChat = function() {
    alert('请在微信中打开分享，或复制链接手动分享');
  };
})();


