// Private Invitation Link Gate + 1-Click Gmail Sign-In (Zero Extra Forms) + Username/Password Auth
// Designed for GitHub Pages (https://dfvalen0223.github.io/discover-canada-prep/) & macOS Portable App

window.AuthGate = (function () {
  const AUTH_STORAGE_KEY = "discover_canada_auth_session_v1";
  const CONFIG_STORAGE_KEY = "discover_canada_auth_config_v1";
  const INVITE_UNLOCKED_KEY = "discover_canada_invite_unlocked_v1";

  const DEFAULT_SECRET_KEY = "canada-2026-vip-7x9k2m";
  const GITHUB_PAGES_BASE_URL = "https://dfvalen0223.github.io/discover-canada-prep/";

  function getDefaultConfig() {
    return {
      secretInviteKey: DEFAULT_SECRET_KEY,
      requireSecretLinkOnWeb: true,
      allowAnyGmailWithLink: true,
      allowedGmailList: [
        "dfvalen0223@gmail.com",
        "danielvalencia@gmail.com",
        "invitado.canada@gmail.com"
      ],
      googleClientId: "", // Optional custom Google Cloud OAuth 2.0 Client ID for GIS One-Tap
      users: [
        {
          username: "daniel",
          email: "dfvalen0223@gmail.com",
          passwordHash: "Canada2026!",
          displayName: "Daniel Valencia",
          role: "admin"
        },
        {
          username: "admin",
          email: "admin@discovercanada.ca",
          passwordHash: "Canada2026!",
          displayName: "Administrador Canada Prep",
          role: "admin"
        },
        {
          username: "invitado",
          email: "invitado@gmail.com",
          passwordHash: "Canada2026!",
          displayName: "Estudiante Invitado",
          role: "student"
        }
      ],
      savedGmailAccounts: [
        {
          email: "dfvalen0223@gmail.com",
          displayName: "Daniel Valencia (Gmail)",
          lastUsed: new Date().toISOString()
        }
      ]
    };
  }

  let authConfig = loadConfig();
  let currentSession = loadSession();

  function loadConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (!raw) return getDefaultConfig();
      const parsed = JSON.parse(raw);
      return Object.assign(getDefaultConfig(), parsed);
    } catch (e) {
      return getDefaultConfig();
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

  /**
   * Checks if the visitor arrived via the Private Secret Link (?key=... or #key=...)
   */
  function checkPrivateLinkAccess() {
    // Local file:// macOS app bundle always has the invite token pre-authorized
    if (window.location.protocol === "file:") {
      localStorage.setItem(INVITE_UNLOCKED_KEY, authConfig.secretInviteKey);
      return true;
    }

    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#\/?\??/, ""));
    const urlKey = params.get("key") || params.get("invite") || hashParams.get("key") || hashParams.get("invite");

    if (urlKey && urlKey.trim() === authConfig.secretInviteKey) {
      localStorage.setItem(INVITE_UNLOCKED_KEY, authConfig.secretInviteKey);
      return true;
    }

    const storedUnlock = localStorage.getItem(INVITE_UNLOCKED_KEY);
    if (storedUnlock === authConfig.secretInviteKey) {
      return true;
    }

    return !authConfig.requireSecretLinkOnWeb;
  }

  function unlockWithSecretKey(inputKey) {
    if (inputKey && inputKey.trim() === authConfig.secretInviteKey) {
      localStorage.setItem(INVITE_UNLOCKED_KEY, authConfig.secretInviteKey);
      // Update URL query string cleanly so the user can bookmark their private link
      if (window.history && window.history.replaceState && window.location.protocol !== "file:") {
        const newUrl = `${window.location.pathname}?key=${encodeURIComponent(authConfig.secretInviteKey)}`;
        window.history.replaceState({}, "", newUrl);
      }
      return true;
    }
    return false;
  }

  function getShareablePrivateLink() {
    const base = (window.location.protocol === "http:" || window.location.protocol === "https:")
      ? `${window.location.origin}${window.location.pathname}`
      : GITHUB_PAGES_BASE_URL;
    return `${base}?key=${encodeURIComponent(authConfig.secretInviteKey)}`;
  }

  /**
   * Logs in with 1-Click Gmail Account (Zero extra registration forms!)
   */
  function signInWithGmail(emailInput, optionalName = "", optionalAvatar = "") {
    const email = String(emailInput || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      throw new Error("Por favor ingresa o selecciona un correo válido de Gmail (ejemplo: usuario@gmail.com).");
    }
    if (!email.endsWith("@gmail.com") && !email.endsWith("@googlemail.com")) {
      throw new Error("Usa una cuenta de correo de Gmail (@gmail.com) para el acceso directo con Google.");
    }

    if (!authConfig.allowAnyGmailWithLink) {
      const allowed = (authConfig.allowedGmailList || []).map(x => x.toLowerCase());
      if (!allowed.includes(email)) {
        throw new Error(`El correo ${email} no está en la lista blanca autorizada de esta app privada.`);
      }
    }

    // Automatically derive a friendly name from the Gmail handle without asking the user to fill any extra form!
    const localPart = email.split("@")[0];
    const derivedName = optionalName || localPart
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase());

    const session = {
      uid: `gmail_${email}`,
      email,
      username: localPart,
      displayName: derivedName,
      provider: "gmail",
      avatarUrl: optionalAvatar || "",
      loggedInAt: new Date().toISOString()
    };

    // Remember this Gmail account on this device for 1-click re-login next time
    const existingIdx = (authConfig.savedGmailAccounts || []).findIndex(a => a.email.toLowerCase() === email);
    if (existingIdx >= 0) {
      authConfig.savedGmailAccounts[existingIdx].lastUsed = new Date().toISOString();
      if (optionalName) authConfig.savedGmailAccounts[existingIdx].displayName = optionalName;
    } else {
      authConfig.savedGmailAccounts = authConfig.savedGmailAccounts || [];
      authConfig.savedGmailAccounts.unshift({
        email,
        displayName: `${derivedName} (Gmail)`,
        lastUsed: new Date().toISOString()
      });
    }
    saveConfig();
    saveSession(session);

    if (window.AdaptiveEngine && window.AdaptiveEngine.setActiveUserScope) {
      window.AdaptiveEngine.setActiveUserScope(email);
      const st = window.AdaptiveEngine.getState();
      if (st && st.profile) {
        st.profile.name = derivedName;
        window.AdaptiveEngine.saveState();
      }
    }

    return session;
  }

  /**
   * Logs in with Username/Email & Password
   */
  function signInWithPassword(userOrEmail, password) {
    const cleanUser = String(userOrEmail || "").trim().toLowerCase();
    const cleanPass = String(password || "").trim();

    if (!cleanUser || !cleanPass) {
      throw new Error("Ingresa tu usuario (o correo) y contraseña.");
    }

    // Check configured users
    const matched = (authConfig.users || []).find(
      u => u.username.toLowerCase() === cleanUser || (u.email && u.email.toLowerCase() === cleanUser)
    );

    if (matched && matched.passwordHash === cleanPass) {
      const session = {
        uid: `user_${matched.username}`,
        email: matched.email,
        username: matched.username,
        displayName: matched.displayName,
        provider: "password",
        role: matched.role || "student",
        loggedInAt: new Date().toISOString()
      };
      saveSession(session);
      if (window.AdaptiveEngine && window.AdaptiveEngine.setActiveUserScope) {
        window.AdaptiveEngine.setActiveUserScope(matched.email || matched.username);
        const st = window.AdaptiveEngine.getState();
        if (st && st.profile) {
          st.profile.name = matched.displayName;
          window.AdaptiveEngine.saveState();
        }
      }
      return session;
    }

    // Also allow any @gmail.com address to log in with the master password (`Canada2026!`) without pre-registration forms
    if (cleanUser.endsWith("@gmail.com") && cleanPass === "Canada2026!") {
      return signInWithGmail(cleanUser);
    }

    throw new Error("Usuario o contraseña incorrectos. (Usa tu cuenta @gmail.com o Usuario: daniel / Contraseña: Canada2026!)");
  }

  /**
   * Decodes a Google Identity Services (GIS) JWT credential payload if Google OAuth One-Tap is used
   */
  function handleGoogleCredentialResponse(response) {
    try {
      const jwt = response.credential;
      const base64Url = jwt.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(decodeURIComponent(atob(base64).split("").map(c =>
        "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)
      ).join("")));

      if (payload && payload.email) {
        const session = signInWithGmail(payload.email, payload.name || "", payload.picture || "");
        renderAuthOverlayIfNeeded();
        if (typeof window.onAuthSessionChanged === "function") {
          window.onAuthSessionChanged(session);
        }
      }
    } catch (e) {
      console.error("Error decoding Google JWT:", e);
    }
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
   * Renders the full-screen Private Invitation Gate or Login Gate if not authenticated
   */
  function renderAuthOverlayIfNeeded() {
    const overlay = document.getElementById("auth-gate-overlay");
    const appShell = document.querySelector(".app-shell");
    if (!overlay) return;

    const hasPrivateAccess = checkPrivateLinkAccess();

    // If both Private Link is verified AND user has an active session, unlock the app!
    if (hasPrivateAccess && currentSession) {
      overlay.style.display = "none";
      if (appShell) appShell.style.display = "flex";
      if (window.AdaptiveEngine && window.AdaptiveEngine.setActiveUserScope) {
        window.AdaptiveEngine.setActiveUserScope(currentSession.email || currentSession.username);
      }
      return;
    }

    // Otherwise, hide the main app shell and show the Private Gate / Login Portal
    if (appShell) appShell.style.display = "none";
    overlay.style.display = "flex";

    if (!hasPrivateAccess) {
      // VIEW 1: Private Link Required Screen (Blocks public visitors without the secret URL)
      overlay.innerHTML = `
        <div class="auth-card">
          <div class="auth-logo-circle">🔒</div>
          <div class="auth-badge-private">APLICACIÓN PRIVADA • ACCESO RESTRINGIDO</div>
          <h2>Discover Canada — Estudio Privado</h2>
          <p class="auth-subtitle">
            Esta aplicación es privada y <strong>solo puede ser vista y utilizada por personas que tengan el enlace secreto de invitación</strong>.
          </p>
          <div class="auth-private-notice">
            <span>🛡️ Si recibiste el enlace privado por WhatsApp, correo o mensaje, ábrelo directamente o introduce tu código de invitación abajo:</span>
          </div>
          <form id="form-unlock-invite" class="auth-form">
            <label class="auth-label">Código del Enlace de Invitación Privado</label>
            <input type="password" id="input-invite-key" class="auth-input" placeholder="Introduce el código secreto del enlace..." required />
            <div id="invite-error-msg" class="auth-error" style="display:none;"></div>
            <button type="submit" class="btn btn-primary btn-full btn-lg">
              🔓 Verificar Enlace Privado y Continuar
            </button>
          </form>
        </div>
      `;

      document.getElementById("form-unlock-invite").addEventListener("submit", (e) => {
        e.preventDefault();
        const val = document.getElementById("input-invite-key").value;
        if (unlockWithSecretKey(val)) {
          renderAuthOverlayIfNeeded();
        } else {
          const err = document.getElementById("invite-error-msg");
          err.style.display = "block";
          err.textContent = "Código de invitación inválido. Solicita el enlace privado completo al administrador.";
        }
      });
      return;
    }

    // VIEW 2: Private Link Verified -> Show 1-Click Gmail Login (Zero Extra Forms) + Username/Password
    const savedAccountsHtml = (authConfig.savedGmailAccounts || []).map(acc => {
      const initial = (acc.displayName || acc.email)[0].toUpperCase();
      return `
        <button type="button" class="gmail-quick-account-btn" data-gmail="${acc.email}">
          <span class="gmail-avatar-chip">${initial}</span>
          <span class="gmail-account-meta">
            <strong>${acc.displayName || acc.email}</strong>
            <small>${acc.email} • 1-Clic (Sin formularios)</small>
          </span>
          <span class="gmail-arrow">→</span>
        </button>
      `;
    }).join("");

    overlay.innerHTML = `
      <div class="auth-card">
        <div class="auth-header-row">
          <div class="auth-logo-circle">🍁</div>
          <div>
            <div class="auth-badge-verified">✅ ENLACE PRIVADO VERIFICADO</div>
            <h2>Discover Canada Prep</h2>
            <p class="auth-subtitle">Simulador Oficial de Ciudadanía Canadiense (20 Preguntas • 15/20 para Pasar)</p>
          </div>
        </div>

        <!-- SECTION 1: 1-CLICK GMAIL LOGIN (ZERO EXTRA FORMS) -->
        <div class="auth-section-box auth-gmail-box">
          <div class="auth-section-title">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            <span>Acceso Rápido con Cuenta de Gmail (Sin Formularios Adicionales)</span>
          </div>

          ${savedAccountsHtml ? `
            <div class="gmail-saved-list">
              ${savedAccountsHtml}
            </div>
          ` : ''}

          <form id="form-gmail-direct" class="gmail-direct-row">
            <input type="email" id="input-gmail-direct" class="auth-input" placeholder="tu.correo@gmail.com" autocomplete="email" required />
            <button type="submit" class="btn-google-signin">
              Entrar con Gmail →
            </button>
          </form>
          <div id="gmail-auth-btn-container" style="margin-top:6px;"></div>
          <div class="auth-hint-text">
            ✨ No necesitas rellenar formularios de registro: entra directo con tu correo <strong>@gmail.com</strong> y tu progreso se guardará automáticamente.
          </div>
        </div>

        <div class="auth-divider"><span>O INGRESA CON USUARIO Y CONTRASEÑA</span></div>

        <!-- SECTION 2: USERNAME & PASSWORD LOGIN -->
        <form id="form-password-login" class="auth-form">
          <div class="auth-grid-2">
            <div>
              <label class="auth-label" for="input-login-user">Usuario o Correo</label>
              <input type="text" id="input-login-user" class="auth-input" placeholder="daniel / admin" autocomplete="username" required />
            </div>
            <div>
              <label class="auth-label" for="input-login-pass">Contraseña</label>
              <input type="password" id="input-login-pass" class="auth-input" placeholder="••••••••" autocomplete="current-password" required />
            </div>
          </div>
          <div id="login-error-msg" class="auth-error" style="display:none;"></div>
          <button type="submit" class="btn btn-secondary btn-full">
            🔑 Iniciar Sesión con Usuario y Contraseña
          </button>
        </form>
      </div>
    `;

    // Bind 1-click saved Gmail buttons
    overlay.querySelectorAll(".gmail-quick-account-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        try {
          const session = signInWithGmail(btn.dataset.gmail);
          renderAuthOverlayIfNeeded();
          if (typeof window.onAuthSessionChanged === "function") window.onAuthSessionChanged(session);
        } catch (err) {
          showLoginError(err.message);
        }
      });
    });

    // Bind direct Gmail input (zero extra forms!)
    document.getElementById("form-gmail-direct").addEventListener("submit", (e) => {
      e.preventDefault();
      try {
        const emailVal = document.getElementById("input-gmail-direct").value.trim();
        const normalized = emailVal.includes("@") ? emailVal : `${emailVal}@gmail.com`;
        const session = signInWithGmail(normalized);
        renderAuthOverlayIfNeeded();
        if (typeof window.onAuthSessionChanged === "function") window.onAuthSessionChanged(session);
      } catch (err) {
        showLoginError(err.message);
      }
    });

    // Bind Username & Password form
    document.getElementById("form-password-login").addEventListener("submit", (e) => {
      e.preventDefault();
      try {
        const u = document.getElementById("input-login-user").value;
        const p = document.getElementById("input-login-pass").value;
        const session = signInWithPassword(u, p);
        renderAuthOverlayIfNeeded();
        if (typeof window.onAuthSessionChanged === "function") window.onAuthSessionChanged(session);
      } catch (err) {
        showLoginError(err.message);
      }
    });

    // If an official Google Cloud OAuth Client ID is configured, also render the Google Identity Services One-Tap button
    if (authConfig.googleClientId && window.google && window.google.accounts && window.google.accounts.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: authConfig.googleClientId,
          callback: handleGoogleCredentialResponse
        });
        window.google.accounts.id.renderButton(
          document.getElementById("gmail-auth-btn-container"),
          { theme: "outline", size: "large", width: "100%" }
        );
      } catch (e) {
        console.warn("GIS init warning:", e);
      }
    }

    function showLoginError(msg) {
      const errEl = document.getElementById("login-error-msg");
      if (errEl) {
        errEl.style.display = "block";
        errEl.textContent = msg;
      }
    }
  }

  return {
    checkPrivateLinkAccess,
    unlockWithSecretKey,
    getShareablePrivateLink,
    signInWithGmail,
    signInWithPassword,
    signOut,
    getSession,
    getConfig,
    updateConfig,
    renderAuthOverlayIfNeeded
  };
})();
