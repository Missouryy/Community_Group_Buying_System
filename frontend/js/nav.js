/**
 * 统一导航系统
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
        { label: '我的订单', href: '/orders.html', icon: '📋', active: ['/orders.html'] },
        { label: '个人中心', href: '/profile.html', icon: '👤', active: ['/profile.html'] }
      ],
      leader: [
        { label: '团长门户', href: '/leader.html', icon: '👑', active: ['/leader.html'] },
        { label: '我的订单', href: '/orders.html', icon: '📋', active: ['/orders.html'] },
        { label: '个人中心', href: '/profile.html', icon: '👤', active: ['/profile.html'] }
      ],
      admin: [
        { label: '管理后台', href: '/admin.html', icon: '⚙️', active: ['/admin.html'] },
        { label: '我的订单', href: '/orders.html', icon: '📋', active: ['/orders.html'] },
        { label: '个人中心', href: '/profile.html', icon: '👤', active: ['/profile.html'] }
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

    // 用户操作按钮
    const userActionsHTML = generateUserActionsHTML(role);

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
            </div>
            
            <div class="nav-apple__actions">
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
      admin: '',  // 管理员导航栏已有管理后台链接，不需要重复按钮
      leader: '',  // 团长导航栏已有团长门户链接，不需要重复按钮
      user: ''
    };

    return `
      ${roleSpecificButtons[role] || ''}
      <button class="btn btn-outline-secondary" id="theme-toggle" title="切换深浅模式">
        <span class="me-1" id="theme-toggle-icon">🖥️</span><span id="theme-toggle-text">跟随系统</span>
      </button>
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
   * 页面内导航切换现在由各页面自己处理
   */

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

    // 主题切换
    document.addEventListener('click', (e) => {
      if (e.target.closest('#theme-toggle')) {
        e.preventDefault();
        toggleTheme();
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
    // 应用主题
    applyTheme(getSavedTheme());
  }

  /**
   * 更新导航状态
   */
  function updateNavigation() {
    const currentNav = document.querySelector('.nav-apple');
    if (currentNav) {
      currentNav.outerHTML = generateNavHTML();
      bindEvents();
      applyTheme(getSavedTheme());
    }
  }

  // ====== 主题切换逻辑（仅深色/浅色） ======
  function getSavedTheme() {
    const t = localStorage.getItem('theme');
    if (t === 'dark' || t === 'light') return t;
    // 首次无记录时可参考系统偏好
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function saveTheme(theme) {
    localStorage.setItem('theme', theme);
  }

  function updateThemeToggleUI(theme) {
    const iconEl = document.getElementById('theme-toggle-icon');
    const textEl = document.getElementById('theme-toggle-text');
    if (!iconEl || !textEl) return;
    if (theme === 'dark') {
      iconEl.textContent = '🌙';
      textEl.textContent = '深色';
    } else if (theme === 'light') {
      iconEl.textContent = '🌞';
      textEl.textContent = '浅色';
    } else {
      iconEl.textContent = '🌞';
      textEl.textContent = '浅色';
    }
  }

  function applyTheme(theme) {
    const html = document.documentElement;
    // 使用 Bootstrap 5.3 的 data-bs-theme 支持
    if (theme === 'dark') {
      html.setAttribute('data-bs-theme', 'dark');
      html.style.colorScheme = 'dark';
    } else {
      html.setAttribute('data-bs-theme', 'light');
      html.style.colorScheme = 'light';
    }
    updateThemeToggleUI(theme);
  }

  function toggleTheme() {
    const current = getSavedTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    saveTheme(next);
    applyTheme(next);
  }


  // 公共接口
  return {
    init,
    updateNavigation,
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