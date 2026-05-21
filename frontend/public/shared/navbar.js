/**
 * Shared navbar for toolsbymatt.com sub-apps.
 * Include via: <script src="/shared/navbar.js"></script>
 * Injects a fixed navbar at the top of the page and pushes body content down.
 */
(() => {
  const BAR_HEIGHT = 44;
  const currentPath = window.location.pathname;

  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    .tbm-navbar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      height: ${BAR_HEIGHT}px;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 16px;
      background: #111827;
      border-bottom: 1px solid rgba(148,163,184,0.12);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .tbm-navbar-left {
      display: flex; align-items: center; gap: 10px;
    }
    .tbm-navbar-logo {
      width: 26px; height: 26px; border-radius: 6px;
      background: linear-gradient(135deg, #818cf8, #6366f1);
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 12px; color: #fff;
      text-decoration: none;
    }
    .tbm-navbar-home {
      color: #e2e8f0; text-decoration: none; font-size: 14px; font-weight: 600;
      letter-spacing: -0.02em;
    }
    .tbm-navbar-home:hover { color: #a5b4fc; }
    .tbm-navbar-sep {
      width: 1px; height: 18px; background: rgba(148,163,184,0.2); margin: 0 4px;
    }
    .tbm-navbar-apps {
      display: flex; align-items: center; gap: 2px;
    }
    .tbm-navbar-app {
      padding: 5px 10px; border-radius: 6px;
      color: #94a3b8; text-decoration: none; font-size: 13px; font-weight: 500;
      transition: background 0.15s, color 0.15s;
    }
    .tbm-navbar-app:hover { background: rgba(148,163,184,0.08); color: #e2e8f0; }
    .tbm-navbar-app.active {
      background: rgba(129,140,248,0.12); color: #a5b4fc;
    }
    body { padding-top: ${BAR_HEIGHT}px !important; }
    @media (max-width: 640px) {
      .tbm-navbar-home-text { display: none; }
      .tbm-navbar-app { font-size: 12px; padding: 5px 8px; }
    }
  `;
  document.head.appendChild(style);

  // Build navbar
  const nav = document.createElement('nav');
  nav.className = 'tbm-navbar';
  nav.innerHTML = `
    <div class="tbm-navbar-left">
      <a href="/" class="tbm-navbar-logo">M</a>
      <a href="/" class="tbm-navbar-home"><span class="tbm-navbar-home-text">toolsbymatt.com</span></a>
      <div class="tbm-navbar-sep"></div>
      <div class="tbm-navbar-apps" id="tbm-nav-apps"></div>
    </div>
  `;
  document.body.prepend(nav);

  // Fetch apps and populate
  fetch('/api/apps')
    .then(r => r.json())
    .then(data => {
      const container = document.getElementById('tbm-nav-apps');
      data.apps.forEach(app => {
        const a = document.createElement('a');
        a.href = app.url;
        a.className = 'tbm-navbar-app';
        a.textContent = app.name;
        if (currentPath.startsWith(app.url) || currentPath.startsWith(app.url.replace(/\/$/, ''))) {
          a.classList.add('active');
        }
        container.appendChild(a);
      });
    })
    .catch(() => {});
})();
