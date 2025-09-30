/**
 * 统一导航系统 - Apple 风格社区团购导航
 */
window.navSystem = (function() {
  
  // 导航配置
  const NAV_CONFIG = {
    // 角色菜单配置
    menus: {
      anonymous: [
        { label: '首页', href: '/index.html', icon: '🏠', active: ['/', '/index.html'] }
      ],
      user: [
        { label: '首页', href: '/index.html', icon: '🏠', active: ['/', '/index.html'] },
        { label: '我的订单', href: '/orders.html', icon: '📋', active: ['/orders.html'] },
        { label: '个人中心', href: '/profile.html', icon: '👤', active: ['/profile.html'] }
      ],
      leader: [
        { label: '首页', href: '/index.html', icon: '🏠', active: ['/', '/index.html'] },
        { label: '团长门户', href: '/leader.html', icon: '👑', active: ['/leader.html'] },
        { label: '我的订单', href: '/orders.html', icon: '📋', active: ['/orders.html'] },
        { label: '个人中心', href: '/profile.html', icon: '👤', active: ['/profile.html'] }
      ],
      admin: [
        { label: '管理仪表盘', href: '/admin.html', icon: '⚙️', active: ['/admin.html'] },
        { label: '订单管理', href: '/orders.html', icon: '📋', active: ['/orders.html'] },
        { label: '个人中心', href: '/profile.html', icon: '👤', active: ['/profile.html'] }
      ]
    },
    
    // 页面内导航配置（用于单页应用导航）
    pageNavs: {
      '/leader.html': [
        { label: '仪表盘', page: 'dashboard', icon: '📊' },
        { label: '拼单管理', page: 'groupbuys', icon: '🛒' },
        { label: '提货管理', page: 'pickups', icon: '📦' },
        { label: '提成明细', page: 'commissions', icon: '💰' }
      ],
      '/admin.html': [
        { label: '管理仪表盘', page: 'dashboard', icon: '📊' },
        { label: '商品管理', page: 'products', icon: '🛍️' },
        { label: '团长管理', page: 'leaders', icon: '👑' },
        { label: '库存预警', page: 'inventory', icon: '⚠️' }
      ]
    }
  };

  /**
   * 获取用户角色
   */
  function getUserRole() {
    try {
      const tokens = window.api?.getTokens();
      if (!tokens?.access) return 'anonymous';
      
      const payload = JSON.parse(atob(tokens.access.split('.')[1]));
      return payload.role || 'user';
    } catch (e) {
      return 'anonymous';
    }
  }

  /**
   * 获取当前页面路径
   */
  function getCurrentPath() {
    return window.location.pathname;
  }

  /**
   * 检查链接是否为当前激活页面
   */
  function isActiveLink(menuItem) {
    const currentPath = getCurrentPath();
    return menuItem.active?.includes(currentPath) || false;
  }

  /**
   * 生成导航HTML
   */
  function generateNavHTML() {
    const role = getUserRole();
    const menuItems = NAV_CONFIG.menus[role] || NAV_CONFIG.menus.anonymous;
    const currentPath = getCurrentPath();
    const pageNavItems = NAV_CONFIG.pageNavs[currentPath] || [];
    
    // 主导航链接
    const mainNavHTML = menuItems.map(item => {
      const isActive = isActiveLink(item);
      return `
        <a class="nav-link ${isActive ? 'active' : ''}" href="${item.href}">
          <span class="nav-apple__link-icon">${item.icon}</span>
          ${item.label}
        </a>
      `;
    }).join('');

    // 页面内导航（如果存在）
    const pageNavHTML = pageNavItems.length > 0 ? `
      <div class="nav-apple__divider"></div>
      ${pageNavItems.map(item => `
        <a class="nav-link" href="#" data-page="${item.page}">
          <span class="nav-apple__link-icon">${item.icon}</span>
          ${item.label}
        </a>
      `).join('')}
    ` : '';

    // 用户操作按钮
    const userActionsHTML = generateUserActionsHTML(role);

    // WebSocket 状态（仅首页显示）
    const websocketStatusHTML = currentPath === '/' || currentPath === '/index.html' ? 
      '<div id="websocket-status" class="nav-apple__status"></div>' : '';

    return `
      <nav class="navbar navbar-expand-lg nav-apple sticky-top">
        <div class="container-fluid">
          <!-- 品牌区域 -->
          <a class="navbar-brand nav-apple__brand" href="/index.html">
            <div class="nav-apple__brand-icon">🏘️</div>
            社区团购
          </a>

          <!-- 移动端折叠按钮 -->
          <button class="navbar-toggler nav-apple__toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
            <span class="navbar-toggler-icon">
              <span></span>
            </span>
          </button>

          <!-- 导航内容 -->
          <div class="collapse navbar-collapse" id="navbarNav">
            <div class="navbar-nav me-auto nav-apple__links">
              ${mainNavHTML}
              ${pageNavHTML}
            </div>
            
            <div class="nav-apple__actions">
              ${websocketStatusHTML}
              ${userActionsHTML}
            </div>
          </div>
        </div>
      </nav>
    `;
  }

  /**
   * 生成用户操作按钮HTML
   */
  function generateUserActionsHTML(role) {
    if (role === 'anonymous') {
      return `
        <a class="btn btn-primary" href="/login.html">
          <span class="me-1">🔑</span>登录/注册
        </a>
      `;
    }

    const roleSpecificButtons = {
      admin: '<a class="btn btn-outline-light me-2" href="/admin.html"><span class="me-1">⚙️</span>管理后台</a>',
      leader: '<a class="btn btn-outline-light me-2" href="/leader.html"><span class="me-1">👑</span>团长门户</a>',
      user: ''
    };

    return `
      ${roleSpecificButtons[role] || ''}
      <button class="btn btn-outline-light" id="nav-logout">
        <span class="me-1">🚪</span>退出登录
      </button>
    `;
  }

  /**
   * 处理登出
   */
  function handleLogout() {
    if (confirm('确定要退出登录吗？')) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login.html';
    }
  }

  /**
   * 处理页面内导航点击
   */
  function handlePageNavClick(e) {
    const target = e.target.closest('[data-page]');
    if (!target) return;
    
    e.preventDefault();
    const page = target.getAttribute('data-page');
    const pageId = 'page-' + page;
    
    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    
    // 显示目标页面
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
      targetPage.style.display = '';
    }
    
    // 更新导航激活状态
    document.querySelectorAll('[data-page]').forEach(nav => nav.classList.remove('active'));
    target.classList.add('active');
    
    // 触发页面加载事件
    window.dispatchEvent(new CustomEvent('pageNavigation', { 
      detail: { page, pageId } 
    }));
  }

  /**
   * 绑定事件监听器
   */
  function bindEvents() {
    // 登出按钮
    document.addEventListener('click', (e) => {
      if (e.target.closest('#nav-logout')) {
        e.preventDefault();
        handleLogout();
      }
    });

    // 页面内导航
    document.addEventListener('click', handlePageNavClick);

    // 移动端导航折叠处理
    document.addEventListener('click', (e) => {
      const navLink = e.target.closest('.nav-apple__links .nav-link');
      if (navLink && window.innerWidth < 992) {
        // 在小屏幕上点击导航链接后自动折叠菜单
        const navbar = document.querySelector('.navbar-collapse');
        if (navbar && navbar.classList.contains('show')) {
          const bsCollapse = bootstrap.Collapse.getInstance(navbar);
          if (bsCollapse) bsCollapse.hide();
        }
      }
    });
  }

  /**
   * 初始化导航系统
   */
  function init() {
    // 查找导航容器
    let navContainer = document.querySelector('nav.navbar');
    
    // 如果没有找到导航容器，创建一个
    if (!navContainer) {
      navContainer = document.createElement('div');
      navContainer.id = 'nav-container';
      document.body.insertBefore(navContainer, document.body.firstChild);
    }
    
    // 生成并插入导航HTML
    navContainer.outerHTML = generateNavHTML();
    
    // 绑定事件
    bindEvents();
    
    // 设置默认激活页面（针对页面内导航）
    const currentPath = getCurrentPath();
    if (NAV_CONFIG.pageNavs[currentPath]) {
      const firstPageNav = document.querySelector('[data-page]');
      if (firstPageNav) {
        firstPageNav.classList.add('active');
      }
    }
  }

  /**
   * 更新导航状态
   */
  function updateNavigation() {
    const currentNav = document.querySelector('.nav-apple');
    if (currentNav) {
      currentNav.outerHTML = generateNavHTML();
      bindEvents();
    }
  }

  /**
   * 设置WebSocket状态
   */
  function setWebSocketStatus(status, message) {
    const statusElement = document.getElementById('websocket-status');
    if (statusElement) {
      if (status === 'connected') {
        statusElement.innerHTML = `
          <span class="text-success">
            <span class="nav-apple__status-indicator"></span>
            ${message || '实时连接'}
          </span>
        `;
      } else {
        statusElement.innerHTML = `
          <span class="text-muted">
            <span class="nav-apple__status-indicator offline"></span>
            ${message || '连接断开'}
          </span>
        `;
      }
    }
  }

  // 监听页面导航事件，用于各页面的特定处理
  window.addEventListener('pageNavigation', (e) => {
    const { page, pageId } = e.detail;
    
    // 根据页面类型调用相应的加载函数
    if (window.location.pathname === '/leader.html') {
      switch (page) {
        case 'dashboard':
          if (window.loadLeaderDashboard) window.loadLeaderDashboard();
          break;
        case 'groupbuys':
          if (window.loadGroupBuys) window.loadGroupBuys();
          break;
        case 'pickups':
          if (window.loadPickupManagement) window.loadPickupManagement();
          break;
        case 'commissions':
          if (window.loadCommissions) window.loadCommissions();
          break;
      }
    } else if (window.location.pathname === '/admin.html') {
      switch (page) {
        case 'dashboard':
          if (window.loadDashboard) window.loadDashboard();
          break;
        case 'products':
          if (window.loadProducts) window.loadProducts();
          break;
        case 'leaders':
          if (window.loadLeaderApplications) window.loadLeaderApplications();
          break;
        case 'inventory':
          if (window.loadAlerts) window.loadAlerts();
          break;
      }
    }
  });

  // 公共接口
  return {
    init,
    updateNavigation,
    setWebSocketStatus,
    getUserRole,
    getCurrentPath
  };
})();

// 自动初始化（当DOM加载完成时）
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.navSystem.init);
} else {
  window.navSystem.init();
}