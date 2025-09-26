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

  async function loadProductsForSelect() {
    // 简化：假设公开的产品列表端点存在
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
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    ensureAuth();
    bindEvents();
    loadGroupBuys();
  });
})();


