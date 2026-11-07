export const platformAdminDashboardTemplate = () => `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PlayNest - Platform Superuser Administration</title>
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
    body { background-color: var(--bg); color: var(--text); min-height: 100vh; display: flex; flex-direction: column; direction: rtl; }

    .super-badge {
      background: linear-gradient(90deg, #991b1b, #dc2626, #b91c1c);
      color: white;
      text-align: center;
      padding: 9px 18px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 1px;
      box-shadow: 0 2px 12px rgba(220, 38, 38, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }

    header {
      background: var(--card-bg);
      border-bottom: 1px solid var(--border);
      padding: 16px 28px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .brand { font-size: 20px; font-weight: 800; display: flex; align-items: center; gap: 12px; color: white; }
    .brand i { color: var(--primary); font-size: 24px; }
    .brand span.tag { font-size: 11px; padding: 2px 8px; border-radius: 9999px; background: rgba(99,102,241,0.2); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.4); font-weight: normal; }

    .nav-links { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
    .nav-links a { color: var(--text-muted); text-decoration: none; font-size: 13px; font-weight: 600; transition: color 0.2s, background-color 0.2s; padding: 6px 12px; border-radius: 6px; display: inline-flex; align-items: center; gap: 6px; }
    .nav-links a:hover, .nav-links a.active { color: white; background-color: var(--card-hover); }

    .btn { padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s; }
    .btn-primary { background: var(--primary); color: white; }
    .btn-primary:hover { background: var(--primary-hover); }
    .btn-secondary { background: var(--border-accent); color: white; }
    .btn-secondary:hover { background: #4b5563; }
    .btn-danger { background: var(--accent); color: white; }
    .btn-danger:hover { background: #dc2626; }
    .btn-success { background: var(--success); color: white; }
    .btn-success:hover { background: #059669; }
    .btn-sm { padding: 4px 10px; font-size: 12px; }

    .container { max-width: 1440px; margin: 0 auto; padding: 24px 20px; width: 100%; flex: 1; }

    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .kpi-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; padding: 18px; transition: transform 0.2s, border-color 0.2s; }
    .kpi-card:hover { transform: translateY(-2px); border-color: var(--border-accent); }
    .kpi-card .title { font-size: 12px; color: var(--text-muted); text-transform: uppercase; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; }
    .kpi-card .val { font-size: 26px; font-weight: 700; color: white; letter-spacing: -0.5px; }

    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
    .section-title { font-size: 17px; font-weight: 700; display: flex; align-items: center; gap: 8px; color: #fff; }
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; padding: 22px; margin-bottom: 24px; overflow-x: auto; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3); }

    table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: right; }
    th { padding: 12px 14px; border-bottom: 1px solid var(--border); color: var(--text-muted); font-weight: 600; white-space: nowrap; }
    td { padding: 12px 14px; border-bottom: 1px solid var(--border); color: var(--text); vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background-color: rgba(255, 255, 255, 0.02); }

    .badge { padding: 4px 9px; border-radius: 5px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; }
    .badge-success { background: rgba(16, 185, 129, 0.15); color: var(--success); border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge-danger { background: rgba(239, 68, 68, 0.15); color: var(--accent); border: 1px solid rgba(239, 68, 68, 0.3); }
    .badge-warning { background: rgba(245, 158, 11, 0.15); color: var(--warning); border: 1px solid rgba(245, 158, 11, 0.3); }
    .badge-primary { background: rgba(99, 102, 241, 0.15); color: var(--primary); border: 1px solid rgba(99, 102, 241, 0.3); }
    .badge-info { background: rgba(6, 182, 212, 0.15); color: var(--info); border: 1px solid rgba(6, 182, 212, 0.3); }

    .tabs { display: flex; gap: 6px; margin-bottom: 20px; border-bottom: 1px solid var(--border); padding-bottom: 10px; overflow-x: auto; scrollbar-width: thin; }
    .tab-btn { background: none; border: none; color: var(--text-muted); font-weight: 600; font-size: 13px; padding: 9px 16px; cursor: pointer; border-radius: 8px; display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; transition: all 0.2s; }
    .tab-btn:hover { color: white; background-color: var(--card-hover); }
    .tab-btn.active { background: var(--primary); color: white; box-shadow: 0 2px 8px var(--primary-glow); }

    /* Auth & Action Modals */
    .auth-overlay {
      position: fixed;
      inset: 0;
      background: rgba(9, 13, 22, 0.88);
      backdrop-filter: blur(8px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      padding: 20px;
    }
    .auth-card {
      background: var(--card-bg);
      border: 1px solid var(--border-accent);
      border-radius: 14px;
      padding: 32px;
      width: 100%;
      max-width: 440px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.6);
      text-align: right;
    }
    .auth-card h2 { font-size: 19px; font-weight: 700; margin-bottom: 8px; display: flex; align-items: center; gap: 10px; color: white; }
    .auth-card p { color: var(--text-muted); font-size: 13px; margin-bottom: 24px; line-height: 1.5; }

    .form-group { margin-bottom: 16px; text-align: right; }
    .form-group label { display: block; font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; }
    .form-control {
      width: 100%;
      padding: 10px 14px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: white;
      font-size: 13px;
      outline: none;
      transition: border-color 0.2s;
      direction: ltr;
      text-align: left;
    }
    .form-control.rtl { direction: rtl; text-align: right; }
    .form-control:focus { border-color: var(--primary); }

    .auth-error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid var(--accent);
      color: #fca5a5;
      padding: 10px 14px;
      border-radius: 6px;
      font-size: 12px;
      margin-bottom: 16px;
      display: none;
    }
    .btn-block { width: 100%; justify-content: center; padding: 11px; }

    /* Toast Notification */
    #toast {
      position: fixed;
      bottom: 24px;
      left: 24px;
      background: #1f2937;
      color: white;
      border: 1px solid var(--border-accent);
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 13px;
      display: none;
      z-index: 2000;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5);
    }
  </style>
</head>
<body>
  <div class="super-badge">
    <i class="fa-solid fa-shield-halved"></i>
    <span>PLATFORM SUPERUSER — GLOBAL PLATFORM ADMINISTRATION</span>
  </div>

  <header>
    <div class="brand">
      <i class="fa-solid fa-gamepad"></i>
      <div>PlayNest Platform Administration</div>
      <span class="tag">Super Admin</span>
    </div>
    <div class="nav-links">
      <a href="/api/v1/platform-admin/dashboard" class="active"><i class="fa-solid fa-gauge"></i> Global Overview</a>
      <a href="/api/v1/platform-admin/analytics/dashboard"><i class="fa-solid fa-chart-line"></i> Platform Analytics</a>
      <a href="/platform-admin-panel" target="_blank"><i class="fa-solid fa-layer-group"></i> Database Console (AdminJS)</a>
      <a href="/docs" target="_blank"><i class="fa-solid fa-book-open"></i> Swagger</a>
      <a href="/redoc" target="_blank"><i class="fa-solid fa-file-code"></i> ReDoc</a>
      <button class="btn btn-danger btn-sm" onclick="logout()"><i class="fa-solid fa-right-from-bracket"></i> Logout</button>
    </div>
  </header>

  <main class="container">
    <!-- Top Level Platform KPIs -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="title"><span>Gaming Centers</span><i class="fa-solid fa-building" style="color: var(--primary);"></i></div>
        <div class="val" id="kpi-centers">-</div>
      </div>
      <div class="kpi-card">
        <div class="title"><span>Active Centers</span><i class="fa-solid fa-circle-check" style="color: var(--success);"></i></div>
        <div class="val" id="kpi-active-centers">-</div>
      </div>
      <div class="kpi-card">
        <div class="title"><span>Stations</span><i class="fa-solid fa-desktop" style="color: var(--info);"></i></div>
        <div class="val" id="kpi-stations">-</div>
      </div>
      <div class="kpi-card">
        <div class="title"><span>Reservations</span><i class="fa-solid fa-calendar-check" style="color: var(--warning);"></i></div>
        <div class="val" id="kpi-reservations">-</div>
      </div>
      <div class="kpi-card">
        <div class="title"><span>Gross Payments (IRR)</span><i class="fa-solid fa-wallet" style="color: var(--success);"></i></div>
        <div class="val" id="kpi-gmv">-</div>
      </div>
      <div class="kpi-card">
        <div class="title"><span>Staff & Managers</span><i class="fa-solid fa-user-shield" style="color: var(--primary);"></i></div>
        <div class="val" id="kpi-users-count">-</div>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab('centers')"><i class="fa-solid fa-building"></i> Gaming Centers</button>
      <button class="tab-btn" onclick="switchTab('verifications')"><i class="fa-solid fa-id-card"></i> Verifications (KYC)</button>
      <button class="tab-btn" onclick="switchTab('ads')"><i class="fa-solid fa-rectangle-ad"></i> Ad Requests</button>
      <button class="tab-btn" onclick="switchTab('campaigns')"><i class="fa-solid fa-tags"></i> Platform Campaigns</button>
      <button class="tab-btn" onclick="switchTab('reservations')"><i class="fa-solid fa-calendar-days"></i> Reservations</button>
      <button class="tab-btn" onclick="switchTab('users')"><i class="fa-solid fa-users"></i> Staff & Users</button>
      <button class="tab-btn" onclick="switchTab('customers')"><i class="fa-solid fa-user-tag"></i> Customers</button>
      <button class="tab-btn" onclick="switchTab('settings')"><i class="fa-solid fa-sliders"></i> Platform Settings</button>
      <button class="tab-btn" onclick="switchTab('audit')"><i class="fa-solid fa-list-check"></i> Audit Logs</button>
    </div>

    <!-- Tab 1: Gaming Centers -->
    <div id="tab-centers" class="card">
      <div class="section-header">
        <div class="section-title"><i class="fa-solid fa-building"></i> Gaming Centers Across Platform</div>
        <button class="btn btn-secondary btn-sm" onclick="loadCenters()"><i class="fa-solid fa-arrows-rotate"></i> Refresh</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Slug</th>
            <th>City</th>
            <th>Stations</th>
            <th>Staff</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="centers-table-body">
          <tr><td colspan="7">Loading gaming centers...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Tab 2: KYC Verifications -->
    <div id="tab-verifications" class="card" style="display:none;">
      <div class="section-header">
        <div class="section-title"><i class="fa-solid fa-id-card"></i> Center KYC Documents & Verifications</div>
        <button class="btn btn-secondary btn-sm" onclick="loadVerifications()"><i class="fa-solid fa-arrows-rotate"></i> Refresh</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Gaming Center</th>
            <th>Submitted</th>
            <th>Status</th>
            <th>Documents</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="verifications-table-body">
          <tr><td colspan="6">Loading verification submissions...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Tab 3: Advertisements -->
    <div id="tab-ads" class="card" style="display:none;">
      <div class="section-header">
        <div class="section-title"><i class="fa-solid fa-rectangle-ad"></i> Advertisement Requests</div>
        <button class="btn btn-secondary btn-sm" onclick="loadAds()"><i class="fa-solid fa-arrows-rotate"></i> Refresh</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Gaming Center</th>
            <th>Position</th>
            <th>Period</th>
            <th>Price (IRR)</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="ads-table-body">
          <tr><td colspan="7">Loading advertisement requests...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Tab 4: Platform Campaigns -->
    <div id="tab-campaigns" class="card" style="display:none;">
      <div class="section-header">
        <div class="section-title"><i class="fa-solid fa-tags"></i> Platform Campaigns & Global Discounts</div>
        <button class="btn btn-primary btn-sm" onclick="openCreateCampaignModal()"><i class="fa-solid fa-plus"></i> Create Campaign</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Code</th>
            <th>Type</th>
            <th>Amount / Percent</th>
            <th>Platform Share</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="campaigns-table-body">
          <tr><td colspan="7">Loading campaigns...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Tab 5: Reservations -->
    <div id="tab-reservations" class="card" style="display:none;">
      <div class="section-header">
        <div class="section-title"><i class="fa-solid fa-calendar-days"></i> Recent Reservations Across Platform</div>
        <button class="btn btn-secondary btn-sm" onclick="loadReservations()"><i class="fa-solid fa-arrows-rotate"></i> Refresh</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Reservation ID</th>
            <th>Gaming Center</th>
            <th>Station</th>
            <th>Customer</th>
            <th>Start Time</th>
            <th>Total Price</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="reservations-table-body">
          <tr><td colspan="7">Loading reservations...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Tab 6: Global Users & Staff -->
    <div id="tab-users" class="card" style="display:none;">
      <div class="section-header">
        <div class="section-title"><i class="fa-solid fa-users"></i> All Users Across Platform</div>
        <button class="btn btn-secondary btn-sm" onclick="loadUsers()"><i class="fa-solid fa-arrows-rotate"></i> Refresh</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Full Name</th>
            <th>Phone</th>
            <th>Gaming Center</th>
            <th>Role</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="users-table-body">
          <tr><td colspan="6">Loading users...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Tab 7: Customers -->
    <div id="tab-customers" class="card" style="display:none;">
      <div class="section-header">
        <div class="section-title"><i class="fa-solid fa-user-tag"></i> Registered Customers & Gamers</div>
        <button class="btn btn-secondary btn-sm" onclick="loadCustomers()"><i class="fa-solid fa-arrows-rotate"></i> Refresh</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Customer Name</th>
            <th>Phone</th>
            <th>Email</th>
            <th>Reservations</th>
            <th>Wallet Balance</th>
            <th>Registered</th>
          </tr>
        </thead>
        <tbody id="customers-table-body">
          <tr><td colspan="6">Loading customer accounts...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Tab 8: Platform Settings -->
    <div id="tab-settings" class="card" style="display:none;">
      <div class="section-header">
        <div class="section-title"><i class="fa-solid fa-sliders"></i> Platform Global Settings</div>
      </div>
      <form id="platformSettingsForm" onsubmit="saveSettings(event)" style="max-width: 600px;">
        <div class="form-group">
          <label>Platform Site Title</label>
          <input type="text" id="settingSiteTitle" class="form-control" required />
        </div>
        <div class="form-group">
          <label>Default Commission % (e.g. 5 for 5%)</label>
          <input type="number" id="settingDefaultCommission" class="form-control" min="0" max="100" step="0.5" required />
        </div>
        <div class="form-group">
          <label>Allow Public Center Registration</label>
          <select id="settingAllowReg" class="form-control">
            <option value="true">Enabled (Open Registration)</option>
            <option value="false">Disabled (Invite / Admin Only)</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary" id="saveSettingsBtn">
          <i class="fa-solid fa-floppy-disk"></i> Save Platform Settings
        </button>
      </form>
    </div>

    <!-- Tab 9: System Audit Trail -->
    <div id="tab-audit" class="card" style="display:none;">
      <div class="section-header">
        <div class="section-title"><i class="fa-solid fa-list-check"></i> System Audit Trail</div>
        <button class="btn btn-secondary btn-sm" onclick="loadAudit()"><i class="fa-solid fa-arrows-rotate"></i> Refresh</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Entity</th>
            <th>Entity ID</th>
            <th>Gaming Center</th>
          </tr>
        </thead>
        <tbody id="audit-table-body">
          <tr><td colspan="6">Loading audit trail...</td></tr>
        </tbody>
      </table>
    </div>
  </main>

  <!-- Create Campaign Modal -->
  <div id="campaignModal" class="auth-overlay" style="display: none;">
    <div class="auth-card" style="max-width: 520px;">
      <h2><i class="fa-solid fa-tag" style="color: var(--primary);"></i> Create New Platform Campaign</h2>
      <p>Configure a promotional discount coupon across all gaming centers.</p>
      <form id="createCampaignForm" onsubmit="handleCreateCampaign(event)">
        <div class="form-group">
          <label>Campaign Title</label>
          <input type="text" id="campTitle" class="form-control" placeholder="Summer Gaming Fest" required />
        </div>
        <div class="form-group">
          <label>Discount Voucher Code</label>
          <input type="text" id="campCode" class="form-control" placeholder="PLAYSUMMER" required />
        </div>
        <div class="form-group">
          <label>Discount Type</label>
          <select id="campType" class="form-control" onchange="toggleCampTypeFields()">
            <option value="PERCENTAGE">Percentage (%)</option>
            <option value="FIXED_AMOUNT">Fixed Minor Units (IRR)</option>
          </select>
        </div>
        <div class="form-group">
          <label id="campValLabel">Discount Percentage (1 - 100)</label>
          <input type="number" id="campVal" class="form-control" min="1" max="100" placeholder="20" required />
        </div>
        <div class="form-group">
          <label>Platform Funding Share % (e.g. 100)</label>
          <input type="number" id="campPlatformShare" class="form-control" min="0" max="100" value="100" required />
        </div>
        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button type="submit" class="btn btn-primary" style="flex:1;"><i class="fa-solid fa-check"></i> Create Campaign</button>
          <button type="button" class="btn btn-secondary" onclick="closeCampaignModal()">Cancel</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Platform Admin Authentication Modal (SSR Authentication Flow) -->
  <div id="authOverlay" class="auth-overlay" style="display: none;">
    <div class="auth-card">
      <h2><i class="fa-solid fa-shield-halved" style="color: var(--primary);"></i> Platform Admin Login</h2>
      <p>Enter your platform superuser credentials to access global administration.</p>
      <div id="authError" class="auth-error"></div>
      <form id="loginForm" onsubmit="handleLogin(event)">
        <div class="form-group">
          <label for="adminPhone">Phone Number</label>
          <input type="text" id="adminPhone" class="form-control" placeholder="09123456789" required autocomplete="username" />
        </div>
        <div class="form-group">
          <label for="adminPassword">Password</label>
          <input type="password" id="adminPassword" class="form-control" placeholder="••••••••" required autocomplete="current-password" />
        </div>
        <button type="submit" id="loginSubmitBtn" class="btn btn-primary btn-block">
          <i class="fa-solid fa-lock"></i> Sign In to Platform Console
        </button>
      </form>
    </div>
  </div>

  <div id="toast"></div>

  <script>
    var token = localStorage.getItem('platform_token');

    function headers() {
      return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (token || '')
      };
    }

    function showToast(msg, duration) {
      var toast = document.getElementById('toast');
      toast.textContent = msg;
      toast.style.display = 'block';
      setTimeout(function() { toast.style.display = 'none'; }, duration || 3000);
    }

    function showLoginModal(errorMessage) {
      var overlay = document.getElementById('authOverlay');
      var errorDiv = document.getElementById('authError');
      if (errorMessage) {
        errorDiv.textContent = errorMessage;
        errorDiv.style.display = 'block';
      } else {
        errorDiv.style.display = 'none';
      }
      overlay.style.display = 'flex';
      document.getElementById('adminPhone').focus();
    }

    function hideLoginModal() {
      document.getElementById('authOverlay').style.display = 'none';
    }

    async function handleLogin(e) {
      e.preventDefault();
      var phone = document.getElementById('adminPhone').value.trim();
      var password = document.getElementById('adminPassword').value;
      var btn = document.getElementById('loginSubmitBtn');
      var errorDiv = document.getElementById('authError');

      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...';
      errorDiv.style.display = 'none';

      try {
        var response = await fetch('/api/v1/auth/platform-admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: phone, password: password })
        });

        var resData = await response.json();
        if (!response.ok) {
          throw new Error(resData.message || 'Invalid credentials or access denied');
        }

        var issuedToken = resData.data && resData.data.tokens ? resData.data.tokens.accessToken : (resData.data ? resData.data.token : resData.token);
        if (!issuedToken) {
          throw new Error('Authentication failed: Missing token in response');
        }

        token = issuedToken;
        localStorage.setItem('platform_token', token);
        hideLoginModal();
        loadData();
      } catch (err) {
        errorDiv.textContent = err.message || 'Authentication failed';
        errorDiv.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-lock"></i> Sign In to Platform Console';
      }
    }

    var tabList = ['centers', 'verifications', 'ads', 'campaigns', 'reservations', 'users', 'customers', 'settings', 'audit'];

    function switchTab(targetTab) {
      tabList.forEach(function(tab) {
        var el = document.getElementById('tab-' + tab);
        if (el) el.style.display = tab === targetTab ? 'block' : 'none';
      });

      document.querySelectorAll('.tab-btn').forEach(function(btn, idx) {
        btn.classList.toggle('active', tabList[idx] === targetTab);
      });

      if (targetTab === 'centers') loadCenters();
      if (targetTab === 'verifications') loadVerifications();
      if (targetTab === 'ads') loadAds();
      if (targetTab === 'campaigns') loadCampaigns();
      if (targetTab === 'reservations') loadReservations();
      if (targetTab === 'users') loadUsers();
      if (targetTab === 'customers') loadCustomers();
      if (targetTab === 'settings') loadSettings();
      if (targetTab === 'audit') loadAudit();
    }

    async function loadData() {
      try {
        var results = await Promise.all([
          fetch('/api/v1/platform-admin/operations/overview', { headers: headers() }),
          fetch('/api/v1/platform-admin/financials/overview', { headers: headers() }),
          fetch('/api/v1/platform-admin/gaming-centers', { headers: headers() })
        ]);
        var opsRes = results[0];
        var finRes = results[1];
        var centersRes = results[2];

        if (opsRes.status === 401 || opsRes.status === 403) {
          localStorage.removeItem('platform_token');
          token = null;
          showLoginModal(opsRes.status === 403 ? 'Access Denied: Platform superuser privileges required.' : 'Session expired or not authenticated. Please log in.');
          return;
        }

        var ops = (await opsRes.json()).data || {};
        var fin = (await finRes.json()).data || {};
        var centersData = await centersRes.json();
        var centers = Array.isArray(centersData.data) ? centersData.data : ((centersData.data && centersData.data.items) || []);

        document.getElementById('kpi-centers').innerText = ops.totalCenters != null ? ops.totalCenters : '-';
        document.getElementById('kpi-stations').innerText = ops.totalStations != null ? ops.totalStations : '-';
        document.getElementById('kpi-reservations').innerText = ops.totalReservations != null ? ops.totalReservations : '-';
        document.getElementById('kpi-gmv').innerText = Number(fin.totalCompletedAmount || 0).toLocaleString();

        var activeCount = centers.filter(function(c) { return c.isActive !== false; }).length;
        document.getElementById('kpi-active-centers').innerText = activeCount;

        renderCentersTable(centers);
      } catch (e) {
        console.error(e);
      }
    }

    function renderCentersTable(centers) {
      var tbody = document.getElementById('centers-table-body');
      if (!centers || centers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No gaming centers found.</td></tr>';
        return;
      }
      tbody.innerHTML = centers.map(function(c) {
        var isAct = c.isActive !== false;
        var btnCls = isAct ? 'btn-success' : 'btn-danger';
        var btnTxt = isAct ? 'ACTIVE' : 'INACTIVE';
        return '<tr>' +
          '<td><strong>' + c.name + '</strong></td>' +
          '<td><code>' + c.slug + '</code></td>' +
          '<td>' + (c.city || '-') + '</td>' +
          '<td>' + (c._count && c._count.stations ? c._count.stations : 0) + '</td>' +
          '<td>' + (c._count && c._count.users ? c._count.users : 0) + '</td>' +
          '<td><button class="btn btn-sm ' + btnCls + '" onclick="toggleCenterStatus(\'' + c.id + '\', ' + isAct + ')">' + btnTxt + '</button></td>' +
          '<td><div style="display:flex; gap:6px;">' +
            '<a href="/api/v1/admin/gamingCenters/' + c.id + '/dashboard" target="_blank" class="btn btn-secondary btn-sm"><i class="fa-solid fa-arrow-up-right-from-square"></i> Center View</a>' +
            '<a href="/public/gamingCenters/' + c.slug + '" target="_blank" class="btn btn-secondary btn-sm"><i class="fa-solid fa-globe"></i> Website</a>' +
          '</div></td>' +
        '</tr>';
      }).join('');
    }

    async function loadCenters() {
      try {
        var res = await fetch('/api/v1/platform-admin/gaming-centers', { headers: headers() });
        var resJson = await res.json();
        var centers = Array.isArray(resJson.data) ? resJson.data : ((resJson.data && resJson.data.items) || []);
        renderCentersTable(centers);
      } catch (e) { console.error(e); }
    }

    async function toggleCenterStatus(centerId, currentStatus) {
      var newStatus = !currentStatus;
      if (!confirm('Update center active status?')) return;
      try {
        var res = await fetch('/api/v1/platform-admin/gaming-centers/' + centerId + '/status', {
          method: 'PATCH',
          headers: headers(),
          body: JSON.stringify({ isActive: newStatus })
        });
        if (res.ok) {
          showToast('Center status updated successfully.');
          loadCenters();
        }
      } catch (err) { showToast('Failed to update status.'); }
    }

    async function loadVerifications() {
      try {
        var res = await fetch('/api/v1/platform-admin/verifications', { headers: headers() });
        var data = (await res.json()).data;
        var items = Array.isArray(data) ? data : ((data && data.items) || []);
        var tbody = document.getElementById('verifications-table-body');
        if (items.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6">No KYC verification submissions found.</td></tr>';
          return;
        }
        tbody.innerHTML = items.map(function(v) {
          var badgeCls = v.status === 'APPROVED' ? 'badge-success' : (v.status === 'REJECTED' ? 'badge-danger' : 'badge-warning');
          var centerName = v.gamingCenter && v.gamingCenter.name ? v.gamingCenter.name : v.gamingCenterId;
          var docsHtml = '';
          if (v.nationalCardUrl) docsHtml += '<a href="' + v.nationalCardUrl + '" target="_blank" class="btn btn-sm btn-secondary"><i class="fa-solid fa-file"></i> National Card</a> ';
          if (v.businessLicenseUrl) docsHtml += '<a href="' + v.businessLicenseUrl + '" target="_blank" class="btn btn-sm btn-secondary"><i class="fa-solid fa-file-contract"></i> License</a>';

          var actionsHtml = v.status === 'PENDING'
            ? '<div style="display:flex; gap:6px;">' +
                '<button class="btn btn-sm btn-success" onclick="approveVerification(\'' + v.id + '\')"><i class="fa-solid fa-check"></i> Approve</button>' +
                '<button class="btn btn-sm btn-danger" onclick="rejectVerification(\'' + v.id + '\')"><i class="fa-solid fa-xmark"></i> Reject</button>' +
              '</div>'
            : '<span style="color:var(--text-muted); font-size:12px;">Reviewed</span>';

          return '<tr>' +
            '<td><code>' + v.id + '</code></td>' +
            '<td><strong>' + centerName + '</strong></td>' +
            '<td>' + new Date(v.createdAt).toLocaleDateString() + '</td>' +
            '<td><span class="badge ' + badgeCls + '">' + v.status + '</span></td>' +
            '<td>' + docsHtml + '</td>' +
            '<td>' + actionsHtml + '</td>' +
          '</tr>';
        }).join('');
      } catch (e) { console.error(e); }
    }

    async function approveVerification(id) {
      if (!confirm('Approve this gaming center KYC verification?')) return;
      var res = await fetch('/api/v1/platform-admin/verifications/' + id + '/approve', { method: 'POST', headers: headers() });
      if (res.ok) { showToast('Verification approved successfully.'); loadVerifications(); }
    }

    async function rejectVerification(id) {
      var reason = 'Documents do not meet regulatory compliance requirements';
      if (!confirm('Reject verification submission with standard reason?')) return;
      var res = await fetch('/api/v1/platform-admin/verifications/' + id + '/reject', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ rejectionReason: reason })
      });
      if (res.ok) { showToast('Verification rejected.'); loadVerifications(); }
    }

    async function loadAds() {
      try {
        var res = await fetch('/api/v1/platform-admin/ad-requests', { headers: headers() });
        var data = (await res.json()).data;
        var items = Array.isArray(data) ? data : ((data && data.items) || []);
        var tbody = document.getElementById('ads-table-body');
        if (items.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7">No advertisement requests found.</td></tr>';
          return;
        }
        tbody.innerHTML = items.map(function(a) {
          var badgeCls = a.status === 'APPROVED' ? 'badge-success' : (a.status === 'REJECTED' ? 'badge-danger' : 'badge-warning');
          var centerName = a.gamingCenter && a.gamingCenter.name ? a.gamingCenter.name : '-';
          var actionsHtml = a.status === 'PENDING'
            ? '<div style="display:flex; gap:6px;">' +
                '<button class="btn btn-sm btn-success" onclick="updateAdStatus(\'' + a.id + '\', \'APPROVED\')">Approve</button>' +
                '<button class="btn btn-sm btn-danger" onclick="updateAdStatus(\'' + a.id + '\', \'REJECTED\')">Reject</button>' +
              '</div>'
            : '<span style="color:var(--text-muted); font-size:12px;">Processed</span>';

          var start = a.startDate ? a.startDate.slice(0, 10) : '';
          var end = a.endDate ? a.endDate.slice(0, 10) : '';

          return '<tr>' +
            '<td><strong>' + a.title + '</strong></td>' +
            '<td>' + centerName + '</td>' +
            '<td><span class="badge badge-info">' + (a.position || 'BANNER') + '</span></td>' +
            '<td style="direction:ltr; font-size:12px;">' + start + ' ~ ' + end + '</td>' +
            '<td>' + Number(a.price || 0).toLocaleString() + '</td>' +
            '<td><span class="badge ' + badgeCls + '">' + a.status + '</span></td>' +
            '<td>' + actionsHtml + '</td>' +
          '</tr>';
        }).join('');
      } catch (e) { console.error(e); }
    }

    async function updateAdStatus(id, status) {
      var res = await fetch('/api/v1/platform-admin/ad-requests/' + id + '/status', {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ status: status })
      });
      if (res.ok) { showToast('Advertisement status updated.'); loadAds(); }
    }

    async function loadCampaigns() {
      try {
        var res = await fetch('/api/v1/platform-admin/campaigns', { headers: headers() });
        var data = (await res.json()).data;
        var items = Array.isArray(data) ? data : ((data && data.items) || []);
        var tbody = document.getElementById('campaigns-table-body');
        if (items.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7">No active platform campaigns found.</td></tr>';
          return;
        }
        tbody.innerHTML = items.map(function(c) {
          var valText = c.discountType === 'PERCENTAGE' ? (c.percentage + '%') : (Number(c.amount || 0).toLocaleString() + ' IRR');
          var badgeCls = c.isActive ? 'badge-success' : 'badge-danger';
          var statusTxt = c.isActive ? 'ACTIVE' : 'INACTIVE';

          return '<tr>' +
            '<td><strong>' + c.title + '</strong></td>' +
            '<td><code>' + c.code + '</code></td>' +
            '<td><span class="badge badge-primary">' + c.discountType + '</span></td>' +
            '<td>' + valText + '</td>' +
            '<td>' + (c.platformShareBps / 100) + '% Platform</td>' +
            '<td><span class="badge ' + badgeCls + '">' + statusTxt + '</span></td>' +
            '<td><button class="btn btn-sm btn-danger" onclick="deleteCampaign(\'' + c.id + '\')"><i class="fa-solid fa-trash"></i> Delete</button></td>' +
          '</tr>';
        }).join('');
      } catch (e) { console.error(e); }
    }

    function openCreateCampaignModal() {
      document.getElementById('campaignModal').style.display = 'flex';
    }

    function closeCampaignModal() {
      document.getElementById('campaignModal').style.display = 'none';
    }

    function toggleCampTypeFields() {
      var type = document.getElementById('campType').value;
      var label = document.getElementById('campValLabel');
      var input = document.getElementById('campVal');
      if (type === 'PERCENTAGE') {
        label.innerText = 'Discount Percentage (1 - 100)';
        input.max = 100;
        input.placeholder = '20';
      } else {
        label.innerText = 'Discount Amount (IRR)';
        input.removeAttribute('max');
        input.placeholder = '500000';
      }
    }

    async function handleCreateCampaign(e) {
      e.preventDefault();
      var title = document.getElementById('campTitle').value.trim();
      var code = document.getElementById('campCode').value.trim();
      var discountType = document.getElementById('campType').value;
      var val = Number(document.getElementById('campVal').value);
      var platformShareBps = Number(document.getElementById('campPlatformShare').value) * 100;

      var payload = {
        title: title,
        code: code,
        discountType: discountType,
        percentage: discountType === 'PERCENTAGE' ? val : undefined,
        amount: discountType === 'FIXED_AMOUNT' ? val : undefined,
        platformShareBps: platformShareBps,
        isActive: true
      };

      try {
        var res = await fetch('/api/v1/platform-admin/campaigns', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          showToast('Campaign created successfully.');
          closeCampaignModal();
          loadCampaigns();
        } else {
          var err = await res.json();
          alert(err.message || 'Failed to create campaign');
        }
      } catch (err) { alert('Network error'); }
    }

    async function deleteCampaign(id) {
      if (!confirm('Are you sure you want to delete this campaign?')) return;
      var res = await fetch('/api/v1/platform-admin/campaigns/' + id, { method: 'DELETE', headers: headers() });
      if (res.ok) { showToast('Campaign deleted successfully.'); loadCampaigns(); }
    }

    async function loadReservations() {
      try {
        var res = await fetch('/api/v1/platform-admin/reservations?limit=25', { headers: headers() });
        var data = (await res.json()).data;
        var items = Array.isArray(data) ? data : ((data && data.items) || []);
        var tbody = document.getElementById('reservations-table-body');
        if (items.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7">No reservations found.</td></tr>';
          return;
        }
        tbody.innerHTML = items.map(function(r) {
          var centerName = r.gamingCenter && r.gamingCenter.name ? r.gamingCenter.name : '-';
          var stationName = r.station && r.station.name ? r.station.name : '-';
          var custName = r.customer ? (r.customer.name || r.customer.phone || '-') : '-';
          var badgeCls = r.status === 'COMPLETED' ? 'badge-success' : (r.status === 'CONFIRMED' ? 'badge-info' : 'badge-danger');

          return '<tr>' +
            '<td><code>' + r.id.slice(0, 10) + '...</code></td>' +
            '<td>' + centerName + '</td>' +
            '<td>' + stationName + '</td>' +
            '<td>' + custName + '</td>' +
            '<td style="direction:ltr; font-size:12px;">' + new Date(r.startTime).toLocaleString() + '</td>' +
            '<td>' + Number(r.totalPrice || 0).toLocaleString() + ' IRR</td>' +
            '<td><span class="badge ' + badgeCls + '">' + r.status + '</span></td>' +
          '</tr>';
        }).join('');
      } catch (e) { console.error(e); }
    }

    async function loadUsers() {
      try {
        var res = await fetch('/api/v1/platform-admin/users?limit=50', { headers: headers() });
        var resJson = await res.json();
        var data = Array.isArray(resJson.data) ? resJson.data : ((resJson.data && resJson.data.items) || []);
        document.getElementById('kpi-users-count').innerText = data.length;
        var tbody = document.getElementById('users-table-body');
        if (data.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6">No users found.</td></tr>';
          return;
        }
        tbody.innerHTML = data.map(function(u) {
          var centerName = u.gamingCenter && u.gamingCenter.name ? u.gamingCenter.name : '-';
          var badgeCls = u.isActive ? 'badge-success' : 'badge-danger';
          var statusTxt = u.isActive ? 'ACTIVE' : 'DEACTIVATED';

          return '<tr>' +
            '<td><strong>' + u.fullName + '</strong></td>' +
            '<td style="direction:ltr;">' + u.phone + '</td>' +
            '<td>' + centerName + '</td>' +
            '<td><span class="badge badge-primary">' + u.role + '</span></td>' +
            '<td><span class="badge ' + badgeCls + '">' + statusTxt + '</span></td>' +
            '<td><button class="btn btn-sm btn-danger" onclick="revokeSessions(\'' + u.id + '\')"><i class="fa-solid fa-ban"></i> Revoke Sessions</button></td>' +
          '</tr>';
        }).join('');
      } catch (e) { console.error(e); }
    }

    async function loadCustomers() {
      try {
        var res = await fetch('/api/v1/platform-admin/customers?limit=50', { headers: headers() });
        var resJson = await res.json();
        var data = Array.isArray(resJson.data) ? resJson.data : ((resJson.data && resJson.data.items) || []);
        var tbody = document.getElementById('customers-table-body');
        if (data.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6">No customers found.</td></tr>';
          return;
        }
        tbody.innerHTML = data.map(function(c) {
          var custName = c.fullName || c.name || '-';
          var walletBal = c.wallet && c.wallet.balance != null ? Number(c.wallet.balance).toLocaleString() : '0';
          var resCount = c._count && c._count.reservations != null ? c._count.reservations : 0;

          return '<tr>' +
            '<td><strong>' + custName + '</strong></td>' +
            '<td style="direction:ltr;">' + (c.phone || '-') + '</td>' +
            '<td>' + (c.email || '-') + '</td>' +
            '<td>' + resCount + '</td>' +
            '<td>' + walletBal + ' IRR</td>' +
            '<td>' + new Date(c.createdAt).toLocaleDateString() + '</td>' +
          '</tr>';
        }).join('');
      } catch (e) { console.error(e); }
    }

    async function loadSettings() {
      try {
        var res = await fetch('/api/v1/platform-admin/settings', { headers: headers() });
        var data = (await res.json()).data;
        if (data) {
          document.getElementById('settingSiteTitle').value = data.siteTitle || 'PlayNest';
          document.getElementById('settingDefaultCommission').value = (data.defaultCommissionBps || 500) / 100;
          document.getElementById('settingAllowReg').value = data.allowPublicRegistration !== false ? 'true' : 'false';
        }
      } catch (e) { console.error(e); }
    }

    async function saveSettings(e) {
      e.preventDefault();
      var siteTitle = document.getElementById('settingSiteTitle').value.trim();
      var commission = Number(document.getElementById('settingDefaultCommission').value);
      var allowPublicRegistration = document.getElementById('settingAllowReg').value === 'true';

      var payload = {
        siteTitle: siteTitle,
        defaultCommissionBps: commission * 100,
        allowPublicRegistration: allowPublicRegistration
      };

      try {
        var res = await fetch('/api/v1/platform-admin/settings', {
          method: 'PUT',
          headers: headers(),
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          showToast('Platform settings saved successfully.');
        } else {
          var err = await res.json();
          alert(err.message || 'Failed to update settings');
        }
      } catch (err) { alert('Network error'); }
    }

    async function loadAudit() {
      try {
        var res = await fetch('/api/v1/platform-admin/audit-logs?limit=50', { headers: headers() });
        var resJson = await res.json();
        var data = Array.isArray(resJson.data) ? resJson.data : ((resJson.data && resJson.data.items) || []);
        var tbody = document.getElementById('audit-table-body');
        if (data.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6">No audit records found.</td></tr>';
          return;
        }
        tbody.innerHTML = data.map(function(l) {
          var actor = (l.platformAdmin && l.platformAdmin.fullName) || (l.user && l.user.fullName) || 'System';
          var centerName = l.gamingCenter && l.gamingCenter.name ? l.gamingCenter.name : '-';

          return '<tr>' +
            '<td style="direction:ltr; font-size:12px;">' + new Date(l.createdAt).toLocaleString() + '</td>' +
            '<td><strong>' + actor + '</strong></td>' +
            '<td><code style="direction:ltr;">' + l.action + '</code></td>' +
            '<td>' + l.entity + '</td>' +
            '<td><code style="direction:ltr;">' + l.entityId + '</code></td>' +
            '<td>' + centerName + '</td>' +
          '</tr>';
        }).join('');
      } catch (e) { console.error(e); }
    }

    async function revokeSessions(userId) {
      if (!confirm('Revoke all active sessions for this user?')) return;
      await fetch('/api/v1/platform-admin/users/' + userId + '/revoke-sessions', {
        method: 'POST',
        headers: headers()
      });
      showToast('Sessions revoked successfully.');
      loadUsers();
    }

    function logout() {
      localStorage.removeItem('platform_token');
      token = null;
      showLoginModal('You have been logged out.');
    }

    if (!token) {
      showLoginModal();
    } else {
      loadData();
    }
  </script>
</body>
</html>`;
