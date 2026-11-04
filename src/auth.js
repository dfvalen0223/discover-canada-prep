// Private Access Gate — Clean Username & Password Authentication
// Authorized Users:
// 1. User: daniel1130  | Password: felipe1130
// 2. User: mildrentoro | Password: viviana6703

window.AuthGate = (function () {
  const AUTH_STORAGE_KEY = "discover_canada_auth_session_v5";
  const CONFIG_STORAGE_KEY = "discover_canada_auth_config_v5";

  const GITHUB_PAGES_BASE_URL = "https://dfvalen0223.github.io/discover-canada-prep/";

  function getDefaultConfig() {
    return {
      secretInviteKey: "canada-2026-vip-7x9k2m",
      requireSecretLinkOnWeb: false, // Protected directly by the private user accounts (daniel1130 & mildrentoro)
      users: [
        {
          username: "daniel1130",
          email: "daniel1130",
          passwordHash: "felipe1130",
          displayName: "daniel1130",
          role: "admin"
        },
        {
          username: "mildrentoro",
          email: "mildrentoro",
          passwordHash: "viviana6703",
          displayName: "mildrentoro",
          role: "admin"
        }
      ]
    };
  }

  let authConfig = loadConfig();
  let currentSession = loadSession();

  function loadConfig() {
    const def = getDefaultConfig();
    try {
      const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (!raw) return def;
      const parsed = JSON.parse(raw);
      // Always ensure dfvalen0223 and mildrentoro are present with their exact passwords
      parsed.users = def.users;
      return Object.assign(def, parsed);
    } catch (e) {
      return def;
    }
  }

  function saveConfig() {
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(authConfig));
    } catch (e) {
      console.error("Failed to save auth config:", e);
    }
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function saveSession(sessionObj) {
    currentSession = sessionObj;
    try {
      if (sessionObj) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionObj));
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch (e) {
      console.error("Failed to save auth session:", e);
    }
  }

  function checkPrivateLinkAccess() {
    return true;
  }

  function unlockWithSecretKey() {
    return true;
  }

  function getShareablePrivateLink() {
    return (window.location.protocol === "http:" || window.location.protocol === "https:")
      ? `${window.location.origin}${window.location.pathname}`
      : GITHUB_PAGES_BASE_URL;
  }

  /**
   * Logs in with Username & Password (dfvalen0223 / mildrentoro, with or without @gmail.com)
   */
  function signInWithPassword(userInput, passwordInput) {
    const rawUser = String(userInput || "").trim().toLowerCase();
    const cleanUser = rawUser.replace(/@gmail\.com$/i, "").replace(/@googlemail\.com$/i, "");
    const cleanPass = String(passwordInput || "").trim().toLowerCase().replace(/@gmail\.com$/i, "");

    if (!cleanUser || !cleanPass) {
      throw new Error("Por favor ingresa tu usuario y contraseña.");
    }

    const matched = (authConfig.users || []).find(
      u => u.username.toLowerCase() === cleanUser
    );

    if (matched && matched.passwordHash.toLowerCase() === cleanPass) {
      const session = {
        uid: `user_${matched.username}`,
        email: matched.username,
        username: matched.username,
        displayName: matched.displayName,
        provider: "password",
        role: matched.role || "admin",
        loggedInAt: new Date().toISOString()
      };
      saveSession(session);
      if (window.AdaptiveEngine && window.AdaptiveEngine.setActiveUserScope) {
        window.AdaptiveEngine.setActiveUserScope(matched.username);
        const st = window.AdaptiveEngine.getState();
        if (st && st.profile) {
          st.profile.name = matched.displayName;
          window.AdaptiveEngine.saveState();
        }
      }
      return session;
    }

    throw new Error("Usuario o contraseña incorrectos.");
  }

  function signOut() {
    saveSession(null);
    renderAuthOverlayIfNeeded();
  }

  function getSession() {
    return currentSession;
  }

  function getConfig() {
    return authConfig;
  }

  function updateConfig(partial) {
    authConfig = Object.assign(authConfig, partial);
    saveConfig();
    return authConfig;
  }

  /**
   * Renders the full-screen Login Gate if not authenticated
   */
  function renderAuthOverlayIfNeeded() {
    const overlay = document.getElementById("auth-gate-overlay");
    const appShell = document.querySelector(".app-shell");
    if (!overlay) return;

    // If user has an active session, unlock the app and ensure proper flex layout!
    if (currentSession) {
      overlay.style.display = "none";
      if (appShell) {
        appShell.style.removeProperty("display");
      }
      if (window.AdaptiveEngine && window.AdaptiveEngine.setActiveUserScope) {
        window.AdaptiveEngine.setActiveUserScope(currentSession.username);
      }
      return;
    }

    // Otherwise, hide the main app shell and show the clean Username & Password Login Portal
    if (appShell) appShell.style.display = "none";
    overlay.style.display = "flex";

    overlay.innerHTML = `
      <div class="auth-card">
        <div class="auth-header-row">
          <div class="auth-logo-circle">🍁</div>
          <div>
            <div class="auth-badge-verified">🔒 ACCESO PRIVADO</div>
            <h2>Discover Canada Prep</h2>
            <p class="auth-subtitle">Simulador Oficial de Ciudadanía Canadiense (20 Preguntas • 15/20 para Pasar)</p>
          </div>
        </div>

        <form id="form-password-login" class="auth-form" style="margin-top: 12px;">
          <div>
            <label class="auth-label" for="input-login-user">Usuario</label>
            <input type="text" id="input-login-user" class="auth-input" placeholder="Ingresa tu usuario" autocomplete="username" required />
          </div>
          <div>
            <label class="auth-label" for="input-login-pass">Contraseña</label>
            <input type="password" id="input-login-pass" class="auth-input" placeholder="Ingresa tu contraseña" autocomplete="current-password" required />
          </div>
          <div id="login-error-msg" class="auth-error" style="display:none;"></div>
          <button type="submit" class="btn btn-primary btn-full btn-lg" style="margin-top: 8px;">
            🔑 Iniciar Sesión
          </button>
        </form>
      </div>
    `;

    document.getElementById("form-password-login").addEventListener("submit", (e) => {
      e.preventDefault();
      try {
        const u = document.getElementById("input-login-user").value;
        const p = document.getElementById("input-login-pass").value;
        const session = signInWithPassword(u, p);
        renderAuthOverlayIfNeeded();
        if (typeof window.onAuthSessionChanged === "function") window.onAuthSessionChanged(session);
      } catch (err) {
        const errEl = document.getElementById("login-error-msg");
        if (errEl) {
          errEl.style.display = "block";
          errEl.textContent = err.message;
        }
      }
    });
  }

  return {
    checkPrivateLinkAccess,
    unlockWithSecretKey,
    getShareablePrivateLink,
    signInWithPassword,
    signOut,
    getSession,
    getConfig,
    updateConfig,
    renderAuthOverlayIfNeeded
  };
})();
