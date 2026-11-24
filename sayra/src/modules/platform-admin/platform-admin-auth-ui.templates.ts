export interface PlatformAdminAuthPageOptions {
  redirectTo?: string;
  mode?: 'dashboard' | 'adminjs';
}

export const platformAdminAuthPageTemplate = (
  options: PlatformAdminAuthPageOptions = {}
) => {
  const redirectTo = options.redirectTo || '/api/v1/platform-admin/dashboard';
  const mode = options.mode || 'dashboard';

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PlayNest - ورود امن مدیر پلتفرم (2FA)</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #111827;
      --card-hover: #1f2937;
      --border: #1f293d;
      --border-accent: #374151;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --primary-glow: rgba(99, 102, 241, 0.25);
      --accent: #ef4444;
      --success: #10b981;
      --warning: #f59e0b;
      --info: #06b6d4;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, Vazirmatn, sans-serif; }
    body {
      background: radial-gradient(circle at top, #111827 0%, #090d16 65%);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      direction: rtl;
    }
    .super-badge {
      background: linear-gradient(90deg, #991b1b, #dc2626, #b91c1c);
      color: white;
      text-align: center;
      padding: 9px 18px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.6px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    .auth-shell {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }
    .auth-card {
      background: var(--card-bg);
      border: 1px solid var(--border-accent);
      border-radius: 14px;
      padding: 32px;
      width: 100%;
      max-width: 500px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      text-align: right;
    }
    .auth-card h1 {
      font-size: 19px;
      font-weight: 700;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 10px;
      color: #fff;
    }
    .auth-card .subtitle {
      color: var(--text-muted);
      font-size: 13px;
      margin-bottom: 20px;
      line-height: 1.7;
    }
    .step-indicator {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
    }
    .step-pill {
      flex: 1;
      text-align: center;
      font-size: 11px;
      padding: 6px 8px;
      border-radius: 6px;
      background: #0f172a;
      border: 1px solid var(--border);
      color: var(--text-muted);
      font-weight: 600;
    }
    .step-pill.active {
      background: rgba(99, 102, 241, 0.18);
      border-color: var(--primary);
      color: #c7d2fe;
    }
    .step-pill.done {
      background: rgba(16, 185, 129, 0.14);
      border-color: rgba(16, 185, 129, 0.45);
      color: #6ee7b7;
    }
    .form-group { margin-bottom: 16px; text-align: right; }
    .form-group label { display: block; font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; }
    .form-control {
      width: 100%;
      padding: 11px 14px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: white;
      font-size: 14px;
      outline: none;
      direction: ltr;
      text-align: left;
      transition: border-color 0.2s;
    }
    .form-control:focus { border-color: var(--primary); }
    .otp-input {
      font-size: 22px;
      letter-spacing: 8px;
      text-align: center;
      font-weight: 700;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .btn {
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s;
    }
    .btn-primary { background: var(--primary); color: white; }
    .btn-primary:hover:not(:disabled) { background: var(--primary-hover); }
    .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
    .btn-secondary { background: var(--border-accent); color: white; }
    .btn-secondary:hover { background: #4b5563; }
    .btn-success { background: var(--success); color: white; }
    .btn-success:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-link { background: transparent; color: #a5b4fc; padding: 6px 0; font-size: 12px; }
    .btn-block { width: 100%; padding: 12px; }
    .alert-error {
      background: rgba(239, 68, 68, 0.14);
      border: 1px solid var(--accent);
      color: #fca5a5;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 12px;
      margin-bottom: 16px;
      display: none;
      line-height: 1.6;
    }
    .alert-warning {
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.45);
      color: #fde68a;
      padding: 12px 14px;
      border-radius: 8px;
      font-size: 12px;
      margin-bottom: 16px;
      line-height: 1.6;
    }
    .qr-box {
      background: #fff;
      padding: 14px;
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin: 8px auto 14px;
    }
    .qr-box img { width: 200px; height: 200px; display: block; }
    .manual-key-box {
      background: var(--bg);
      border: 1px dashed var(--border-accent);
      border-radius: 8px;
      padding: 10px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 16px;
    }
    .manual-key-box code {
      direction: ltr;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
      color: #a5b4fc;
      word-break: break-all;
    }
    .recovery-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin: 12px 0 16px;
      direction: ltr;
    }
    .recovery-code-item {
      background: var(--bg);
      border: 1px solid var(--border-accent);
      border-radius: 6px;
      padding: 8px 10px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      text-align: center;
      color: #e5e7eb;
      letter-spacing: 0.6px;
    }
    .apps-badges {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }
    .app-chip {
      background: rgba(99, 102, 241, 0.14);
      border: 1px solid rgba(99, 102, 241, 0.35);
      color: #c7d2fe;
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="super-badge">
    <i class="fa-solid fa-shield-halved"></i>
    <span>PLATFORM SUPERUSER — MANDATORY TOTP TWO-FACTOR AUTHENTICATION</span>
  </div>

  <div class="auth-shell">
    <div class="auth-card">
      <div class="step-indicator">
        <div id="pill-1" class="step-pill active">۱. نام کاربری و رمز</div>
        <div id="pill-2" class="step-pill">۲. احراز دو مرحله‌ای</div>
        <div id="pill-3" class="step-pill">۳. تکمیل ورود</div>
      </div>

      <div id="authError" class="alert-error"></div>

      <!-- View 1: Admin Login -->
      <div id="view-login">
        <h1><i class="fa-solid fa-user-shield" style="color: var(--primary);"></i> ورود مدیر کل پلتفرم</h1>
        <p class="subtitle">برای دسترسی به پنل مدیریت پلتفرم، نام کاربری (Username) و رمز عبور خود را وارد کنید. تایید دو مرحله‌ای (TOTP) در مرحله بعد الزامی است.</p>
        <form id="loginForm" onsubmit="handleStep1Login(event)">
          <div class="form-group">
            <label for="adminUsername">نام کاربری (Username)</label>
            <input type="text" id="adminUsername" class="form-control" placeholder="superadmin" required autocomplete="username" />
          </div>
          <div class="form-group">
            <label for="adminPassword">رمز عبور (Password)</label>
            <input type="password" id="adminPassword" class="form-control" placeholder="••••••••••••" required autocomplete="current-password" />
          </div>
          <button type="submit" id="loginBtn" class="btn btn-primary btn-block">
            <i class="fa-solid fa-arrow-left"></i> ادامه و بررسی اعتبار
          </button>
        </form>
      </div>

      <!-- View 2: Two-Factor Verification -->
      <div id="view-verify-2fa" style="display:none;">
        <h1><i class="fa-solid fa-key" style="color: var(--primary);"></i> تایید هویت دو مرحله‌ای</h1>
        <p class="subtitle" id="verifySubtitle">کد ۶ رقمی نمایش‌داده‌شده در برنامه Google Authenticator یا Microsoft Authenticator را وارد کنید.</p>
        <form id="verify2faForm" onsubmit="handleVerify2fa(event)">
          <div class="form-group" id="totpCodeGroup">
            <label for="totpCodeInput">کد ۶ رقمی Authenticator</label>
            <input type="text" id="totpCodeInput" class="form-control otp-input" inputmode="numeric" maxlength="6" pattern="\\d{6}" placeholder="000000" autocomplete="one-time-code" />
          </div>
          <div class="form-group" id="recoveryCodeGroup" style="display:none;">
            <label for="recoveryCodeInput">کد بازیابی یک‌بارمصرف (Recovery Code)</label>
            <input type="text" id="recoveryCodeInput" class="form-control" placeholder="XXXX-XXXX-XXXX-XXXX" />
          </div>
          <button type="submit" id="verifyBtn" class="btn btn-primary btn-block">
            <i class="fa-solid fa-shield-check"></i> تایید و ورود به پنل
          </button>
        </form>
        <div style="display:flex; justify-content:space-between; margin-top:12px;">
          <button type="button" class="btn btn-link" id="toggleRecoveryBtn" onclick="toggleRecoveryMode()">استفاده از کد بازیابی یک‌بارمصرف</button>
          <button type="button" class="btn btn-link" onclick="resetToLogin()">بازگشت به ورود</button>
        </div>
      </div>

      <!-- View 3 & 4: Mandatory Initial Authenticator Setup & QR Code Enrollment (No Skip) -->
      <div id="view-setup-2fa" style="display:none;">
        <h1><i class="fa-solid fa-qrcode" style="color: var(--primary);"></i> راه‌اندازی اجباری احراز هویت دو مرحله‌ای</h1>
        <div class="alert-warning">
          <i class="fa-solid fa-triangle-exclamation"></i>
          برای امنیت حساب مدیر کل (SUPERUSER)، فعال‌سازی Authenticator در اولین ورود <strong>اجباری</strong> است و امکان رد کردن این مرحله وجود ندارد.
        </div>
        <div class="apps-badges">
          <span class="app-chip"><i class="fa-brands fa-google"></i> Google Authenticator</span>
          <span class="app-chip"><i class="fa-brands fa-microsoft"></i> Microsoft Authenticator</span>
        </div>
        <div id="setupLoading" style="text-align:center; padding:24px; color:var(--text-muted); font-size:13px;">
          <i class="fa-solid fa-spinner fa-spin"></i> در حال تولید کلید امن و QR Code...
        </div>
        <div id="setupEnrollmentBox" style="display:none;">
          <div style="text-align:center;">
            <div class="qr-box">
              <img id="setupQrImg" alt="Authenticator QR Code" />
            </div>
          </div>
          <div class="form-group">
            <label>کلید دستی جایگزین (Manual Entry Key)</label>
            <div class="manual-key-box">
              <code id="setupManualKey">-</code>
              <button type="button" class="btn btn-secondary" style="padding:5px 10px; font-size:11px;" onclick="copyText('setupManualKey')">کپی</button>
            </div>
          </div>
          <form id="confirmSetupForm" onsubmit="handleConfirmInitialSetup(event)">
            <div class="form-group">
              <label for="setupConfirmCode">کد ۶ رقمی تولیدشده در Authenticator را وارد کنید</label>
              <input type="text" id="setupConfirmCode" class="form-control otp-input" inputmode="numeric" maxlength="6" pattern="\\d{6}" placeholder="000000" required />
            </div>
            <button type="submit" id="confirmSetupBtn" class="btn btn-primary btn-block">
              <i class="fa-solid fa-check-double"></i> تایید و فعال‌سازی 2FA
            </button>
          </form>
        </div>
      </div>

      <!-- View 5: Recovery Codes Display -->
      <div id="view-recovery-codes" style="display:none;">
        <h1><i class="fa-solid fa-vault" style="color: var(--success);"></i> کدهای بازیابی اضطراری (Recovery Codes)</h1>
        <div class="alert-warning">
          این ۱۰ کد بازیابی <strong>فقط یک بار</strong> نمایش داده می‌شوند و هر کد فقط یک بار قابل استفاده است. لطفاً آن‌ها را در مکانی امن ذخیره کنید.
        </div>
        <div id="recoveryCodesGrid" class="recovery-grid"></div>
        <div style="display:flex; gap:8px; margin-bottom:16px;">
          <button type="button" class="btn btn-secondary" style="flex:1;" onclick="copyAllRecoveryCodes()"><i class="fa-solid fa-copy"></i> کپی همه کدها</button>
          <button type="button" class="btn btn-secondary" style="flex:1;" onclick="downloadRecoveryCodes()"><i class="fa-solid fa-download"></i> دانلود فایل txt</button>
        </div>
        <label style="display:flex; align-items:center; gap:8px; font-size:12px; margin-bottom:16px; cursor:pointer; color:var(--text);">
          <input type="checkbox" id="savedRecoveryCheckbox" onchange="document.getElementById('proceedAfterSetupBtn').disabled = !this.checked;" />
          کدهای بازیابی را ذخیره کردم و می‌دانم پس از خروج دوباره نمایش داده نمی‌شوند.
        </label>
        <button type="button" id="proceedAfterSetupBtn" class="btn btn-success btn-block" disabled onclick="finalizeAuthNavigation()">
          <i class="fa-solid fa-arrow-left"></i> ورود به پنل مدیریت
        </button>
      </div>
    </div>
  </div>

  <script>
    var AUTH_MODE = ${JSON.stringify(mode)};
    var REDIRECT_TO = ${JSON.stringify(redirectTo)};
    var state = {
      challengeToken: null,
      setupToken: null,
      deviceId: null,
      usingRecovery: false,
      recoveryCodes: [],
      accessToken: null,
      refreshToken: null
    };

    function showError(msg) {
      var el = document.getElementById('authError');
      if (msg) {
        el.textContent = msg;
        el.style.display = 'block';
      } else {
        el.style.display = 'none';
      }
    }

    function setActiveView(viewId, stepNum) {
      ['view-login', 'view-verify-2fa', 'view-setup-2fa', 'view-recovery-codes'].forEach(function(id) {
        document.getElementById(id).style.display = id === viewId ? 'block' : 'none';
      });
      for (var i = 1; i <= 3; i++) {
        var pill = document.getElementById('pill-' + i);
        pill.classList.remove('active', 'done');
        if (i < stepNum) pill.classList.add('done');
        if (i === stepNum) pill.classList.add('active');
      }
    }

    function resetToLogin() {
      state.challengeToken = null;
      state.setupToken = null;
      state.deviceId = null;
      state.usingRecovery = false;
      showError('');
      setActiveView('view-login', 1);
    }

    function toggleRecoveryMode() {
      state.usingRecovery = !state.usingRecovery;
      document.getElementById('totpCodeGroup').style.display = state.usingRecovery ? 'none' : 'block';
      document.getElementById('recoveryCodeGroup').style.display = state.usingRecovery ? 'block' : 'none';
      document.getElementById('toggleRecoveryBtn').textContent = state.usingRecovery
        ? 'استفاده از کد ۶ رقمی Authenticator'
        : 'استفاده از کد بازیابی یک‌بارمصرف';
      showError('');
    }

    async function handleStep1Login(e) {
      e.preventDefault();
      showError('');
      var username = document.getElementById('adminUsername').value.trim();
      var password = document.getElementById('adminPassword').value;
      var btn = document.getElementById('loginBtn');
      btn.disabled = true;

      try {
        var res = await fetch('/api/v1/auth/platform-admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username, password: password })
        });
        var payload = await res.json();
        if (!res.ok) {
          throw new Error((payload.error && payload.error.message) || payload.message || 'نام کاربری یا رمز عبور نادرست است');
        }
        var data = payload.data || {};
        if (data.requiresTwoFactorSetup && data.setupToken) {
          state.setupToken = data.setupToken;
          setActiveView('view-setup-2fa', 2);
          await startMandatorySetup();
        } else if (data.challengeToken) {
          state.challengeToken = data.challengeToken;
          setActiveView('view-verify-2fa', 2);
          document.getElementById('totpCodeInput').focus();
        } else {
          throw new Error('پاسخ احراز هویت نامعتبر است');
        }
      } catch (err) {
        showError(err.message || 'خطا در ورود');
      } finally {
        btn.disabled = false;
      }
    }

    async function startMandatorySetup() {
      document.getElementById('setupLoading').style.display = 'block';
      document.getElementById('setupEnrollmentBox').style.display = 'none';
      try {
        var res = await fetch('/api/v1/auth/platform-admin/2fa/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ setupToken: state.setupToken, mode: 'INITIAL' })
        });
        var payload = await res.json();
        if (!res.ok) {
          throw new Error((payload.error && payload.error.message) || payload.message || 'خطا در شروع راه‌اندازی 2FA');
        }
        var data = payload.data || {};
        state.deviceId = data.deviceId;
        document.getElementById('setupQrImg').src = data.qrCodeDataUrl;
        document.getElementById('setupManualKey').textContent = data.manualEntryKey;
        document.getElementById('setupLoading').style.display = 'none';
        document.getElementById('setupEnrollmentBox').style.display = 'block';
        document.getElementById('setupConfirmCode').focus();
      } catch (err) {
        document.getElementById('setupLoading').style.display = 'none';
        showError(err.message);
      }
    }

    async function handleConfirmInitialSetup(e) {
      e.preventDefault();
      showError('');
      var code = document.getElementById('setupConfirmCode').value.trim();
      var btn = document.getElementById('confirmSetupBtn');
      btn.disabled = true;

      try {
        var res = await fetch('/api/v1/auth/platform-admin/2fa/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            setupToken: state.setupToken,
            deviceId: state.deviceId,
            code: code,
            mode: 'INITIAL'
          })
        });
        var payload = await res.json();
        if (!res.ok) {
          throw new Error((payload.error && payload.error.message) || payload.message || 'کد تایید نامعتبر است');
        }
        var data = payload.data || {};
        state.accessToken = data.accessToken || (data.tokens && data.tokens.accessToken);
        state.refreshToken = data.refreshToken || (data.tokens && data.tokens.refreshToken);
        state.recoveryCodes = data.recoveryCodes || [];

        localStorage.setItem('platform_token', state.accessToken);
        if (state.refreshToken) localStorage.setItem('platform_refresh_token', state.refreshToken);

        var grid = document.getElementById('recoveryCodesGrid');
        grid.innerHTML = state.recoveryCodes.map(function(c) {
          return '<div class="recovery-code-item">' + c + '</div>';
        }).join('');

        setActiveView('view-recovery-codes', 3);
      } catch (err) {
        showError(err.message);
      } finally {
        btn.disabled = false;
      }
    }

    async function handleVerify2fa(e) {
      e.preventDefault();
      showError('');
      var btn = document.getElementById('verifyBtn');
      btn.disabled = true;
      var body = { challengeToken: state.challengeToken };
      if (state.usingRecovery) {
        body.recoveryCode = document.getElementById('recoveryCodeInput').value.trim();
      } else {
        body.code = document.getElementById('totpCodeInput').value.trim();
      }

      try {
        var res = await fetch('/api/v1/auth/platform-admin/verify-2fa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        var payload = await res.json();
        if (!res.ok) {
          throw new Error((payload.error && payload.error.message) || payload.message || 'کد احراز هویت نامعتبر است');
        }
        var data = payload.data || {};
        state.accessToken = data.accessToken || (data.tokens && data.tokens.accessToken);
        state.refreshToken = data.refreshToken || (data.tokens && data.tokens.refreshToken);
        localStorage.setItem('platform_token', state.accessToken);
        if (state.refreshToken) localStorage.setItem('platform_refresh_token', state.refreshToken);

        await finalizeAuthNavigation();
      } catch (err) {
        showError(err.message);
      } finally {
        btn.disabled = false;
      }
    }

    async function finalizeAuthNavigation() {
      if (AUTH_MODE === 'adminjs') {
        var sessRes = await fetch('/platform-admin-panel/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + state.accessToken
          }
        });
        if (!sessRes.ok) {
          showError('خطا در ایجاد نشست پنل دیتابیس');
          return;
        }
      }
      window.location.href = REDIRECT_TO;
    }

    function copyText(elId) {
      var text = document.getElementById(elId).textContent;
      if (navigator.clipboard) navigator.clipboard.writeText(text);
    }

    function copyAllRecoveryCodes() {
      if (navigator.clipboard && state.recoveryCodes.length) {
        navigator.clipboard.writeText(state.recoveryCodes.join('\\n'));
      }
    }

    function downloadRecoveryCodes() {
      if (!state.recoveryCodes.length) return;
      var blob = new Blob([
        'PlayNest Platform Admin Emergency Recovery Codes\\n' +
        'Each code can be used ONCE if your Authenticator is unavailable.\\n\\n' +
        state.recoveryCodes.join('\\n') + '\\n'
      ], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'playnest-admin-recovery-codes.txt';
      a.click();
      URL.revokeObjectURL(url);
    }
  </script>
</body>
</html>`;
};
