import { CLIENT_HTML_SANITIZE_HELPERS } from '../../common/utils/html-sanitize';

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
      <button class="tab-btn" onclick="switchTab('device-types')"><i class="fa-solid fa-gamepad"></i> Device Types</button>
      <button class="tab-btn" onclick="switchTab('games-catalog')"><i class="fa-solid fa-dice"></i> Games Catalog</button>
      <button class="tab-btn" onclick="switchTab('audit')"><i class="fa-solid fa-list-check"></i> Audit Logs</button>
      <button class="tab-btn" onclick="switchTab('security')"><i class="fa-solid fa-shield-halved"></i> Security &amp; 2FA</button>
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
        <div class="section-title"><i class="fa-solid fa-id-card"></i> احراز هویت صاحبان گیم‌نت (KYC Verifications)</div>
        <button class="btn btn-secondary btn-sm" onclick="loadVerifications()"><i class="fa-solid fa-arrows-rotate"></i> Refresh</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Gaming Center ID</th>
            <th>Gaming Center Name</th>
            <th>Applicant Name</th>
            <th>Phone</th>
            <th>Submitted</th>
            <th>Status / Reason</th>
            <th>Documents</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="verifications-table-body">
          <tr><td colspan="9">Loading verification submissions...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Tab 3: Advertisements -->
    <div id="tab-ads" class="card" style="display:none;">
      <div class="section-header">
        <div class="section-title"><i class="fa-solid fa-rectangle-ad"></i> مدیریت تبلیغات اسلایدر (Slider Advertisements)</div>
        <div style="display:flex; gap:10px; align-items:center;">
          <button class="btn btn-primary btn-sm" onclick="openCreateAdModal()"><i class="fa-solid fa-plus"></i> ایجاد تبلیغ جدید</button>
          <input type="text" id="ad-search-input" placeholder="Search center or title..." class="input" style="width:200px; padding:6px 12px; font-size:13px;" onkeyup="loadAds()" />
          <select id="ad-status-filter" class="select" style="padding:6px 12px; font-size:13px;" onchange="loadAds()">
            <option value="">All Statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="EXPIRED">EXPIRED</option>
            <option value="DELETED">DELETED</option>
          </select>
          <button class="btn btn-secondary btn-sm" onclick="loadAds()"><i class="fa-solid fa-arrows-rotate"></i> Refresh</button>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Banner & Title</th>
            <th>Type</th>
            <th>Gaming Center</th>
            <th>Priority</th>
            <th>Period (Start ~ End)</th>
            <th>Duration</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="ads-table-body">
          <tr><td colspan="8">Loading advertisement requests...</td></tr>
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
    <!-- Tab: Dynamic Device Types -->
    <div id="tab-device-types" class="card" style="display:none;">
      <div class="section-header">
        <div class="section-title"><i class="fa-solid fa-gamepad"></i> Device Types Management</div>
        <button class="btn btn-secondary btn-sm" onclick="loadDeviceTypes()"><i class="fa-solid fa-arrows-rotate"></i> Refresh</button>
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:16px; align-items:flex-end;">
        <div>
          <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">Name</label>
          <input id="dt-name" type="text" placeholder="e.g. PLAYSTATION 5 Pro" style="padding:8px 10px; border-radius:6px; border:1px solid var(--border); background:var(--bg); color:white;">
        </div>
        <div>
          <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">Slug (optional)</label>
          <input id="dt-slug" type="text" placeholder="e.g. ps5-pro" style="padding:8px 10px; border-radius:6px; border:1px solid var(--border); background:var(--bg); color:white;">
        </div>
        <div>
          <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">Category</label>
          <select id="dt-category" style="padding:8px 10px; border-radius:6px; border:1px solid var(--border); background:var(--bg); color:white;">
            <option value="PC">PC</option>
            <option value="PLAYSTATION 4">PLAYSTATION 4</option>
            <option value="PLAYSTATION 5">PLAYSTATION 5</option>
            <option value="XBOX">XBOX</option>
            <option value="SWITCH">SWITCH</option>
            <option value="VR">VR</option>
          </select>
        </div>
        <label style="display:inline-flex; align-items:center; gap:6px; font-size:13px; padding-bottom:8px; cursor:pointer;">
          <input id="dt-extra-controller" type="checkbox"> Extra Controller Enabled
        </label>
        <button class="btn btn-primary btn-sm" onclick="createDeviceType()"><i class="fa-solid fa-plus"></i> Add Device Type</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Slug</th>
            <th>Category</th>
            <th>Extra Controller</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="device-types-table-body">
          <tr><td colspan="6" style="text-align:center;color:var(--text-muted);">Loading...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Tab: Smart Games Catalog -->
    <div id="tab-games-catalog" class="card" style="display:none;">
      <div class="section-header">
        <div class="section-title"><i class="fa-solid fa-dice"></i> Smart Games Catalog Management</div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-secondary btn-sm" onclick="checkDuplicateGames()"><i class="fa-solid fa-clone"></i> Detect Duplicates</button>
          <button class="btn btn-secondary btn-sm" onclick="loadCatalogGames()"><i class="fa-solid fa-arrows-rotate"></i> Refresh</button>
        </div>
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px; align-items:flex-end;">
        <div style="flex:1; min-width:180px;">
          <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">Search Games (FA / EN / Alias)</label>
          <input id="gc-search-input" type="text" placeholder="e.g. FC 26, فیفا ۲۶, Call of Duty..." oninput="loadCatalogGames()" style="width:100%; padding:8px 10px; border-radius:6px; border:1px solid var(--border); background:var(--bg); color:white;">
        </div>
      </div>
      <div style="border:1px solid var(--border); border-radius:8px; padding:12px; margin-bottom:16px;">
        <div style="font-size:13px; font-weight:600; margin-bottom:10px;" id="gc-form-title">Add New Catalog Game</div>
        <input type="hidden" id="gc-edit-id" value="">
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:10px; margin-bottom:10px;">
          <div>
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">Display Title</label>
            <input id="gc-title" type="text" placeholder="EA Sports FC 26" style="width:100%; padding:8px; border-radius:6px; border:1px solid var(--border); background:var(--bg); color:white;">
          </div>
          <div>
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">Persian Title</label>
            <input id="gc-title-fa" type="text" placeholder="اف سی ۲۶" style="width:100%; padding:8px; border-radius:6px; border:1px solid var(--border); background:var(--bg); color:white;">
          </div>
          <div>
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">English Title</label>
            <input id="gc-title-en" type="text" placeholder="EA Sports FC 26" style="width:100%; padding:8px; border-radius:6px; border:1px solid var(--border); background:var(--bg); color:white;">
          </div>
          <div>
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">Category</label>
            <select id="gc-category" style="width:100%; padding:8px; border-radius:6px; border:1px solid var(--border); background:var(--bg); color:white;">
              <option value="SPORTS">SPORTS</option>
              <option value="FPS">FPS</option>
              <option value="BATTLE_ROYALE">BATTLE_ROYALE</option>
              <option value="OPEN_WORLD">OPEN_WORLD</option>
              <option value="MOBA">MOBA</option>
              <option value="RACING">RACING</option>
              <option value="FIGHTING">FIGHTING</option>
              <option value="SANDBOX">SANDBOX</option>
              <option value="RPG">RPG</option>
              <option value="ACTION">ACTION</option>
              <option value="OTHER">OTHER</option>
            </select>
          </div>
          <div>
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">Cover Image URL</label>
            <input id="gc-cover-url" type="text" placeholder="https://..." style="width:100%; padding:8px; border-radius:6px; border:1px solid var(--border); background:var(--bg); color:white;">
          </div>
          <div>
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">Aliases (comma-separated)</label>
            <input id="gc-aliases" type="text" placeholder="FC26, FIFA 26, فیفا ۲۶" style="width:100%; padding:8px; border-radius:6px; border:1px solid var(--border); background:var(--bg); color:white;">
          </div>
        </div>
        <div style="display:flex; gap:14px; flex-wrap:wrap; align-items:center; justify-content:space-between;">
          <div style="display:flex; gap:12px; flex-wrap:wrap; font-size:12px;">
            <label><input type="checkbox" class="gc-platform-cb" value="PC" checked> PC</label>
            <label><input type="checkbox" class="gc-platform-cb" value="PLAYSTATION 5" checked> PS5</label>
            <label><input type="checkbox" class="gc-platform-cb" value="PLAYSTATION 4"> PS4</label>
            <label><input type="checkbox" class="gc-platform-cb" value="XBOX"> XBOX</label>
            <label><input type="checkbox" class="gc-platform-cb" value="SWITCH"> SWITCH</label>
            <label><input type="checkbox" class="gc-platform-cb" value="VR"> VR</label>
            <label style="margin-left:12px;"><input type="checkbox" id="gc-supports-online"> Supports Online</label>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary btn-sm" onclick="resetGameForm()">Clear</button>
            <button class="btn btn-primary btn-sm" onclick="saveCatalogGame()"><i class="fa-solid fa-floppy-disk"></i> Save Game</button>
          </div>
        </div>
      </div>
      <div id="gc-duplicates-box" style="display:none; border:1px solid var(--warning); border-radius:8px; padding:12px; margin-bottom:14px;"></div>
      <table>
        <thead>
          <tr>
            <th>Title (FA / EN)</th>
            <th>Category</th>
            <th>Platforms</th>
            <th>Aliases</th>
            <th>Centers</th>
            <th>Online</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="games-catalog-table-body">
          <tr><td colspan="7" style="text-align:center;color:var(--text-muted);">Loading games catalog...</td></tr>
        </tbody>
      </table>
    </div>

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

    <!-- Tab: Security > Two-Factor Authentication -->
    <div id="tab-security" class="card" style="display:none;">
      <div class="section-header">
        <div class="section-title"><i class="fa-solid fa-shield-halved"></i> Security &gt; Two-Factor Authentication (TOTP)</div>
        <button class="btn btn-secondary btn-sm" onclick="loadSecuritySettings()"><i class="fa-solid fa-arrows-rotate"></i> Refresh</button>
      </div>

      <div class="kpi-grid" style="margin-bottom:20px;">
        <div class="kpi-card">
          <div class="title"><span>2FA Status</span><i class="fa-solid fa-shield-check" style="color:var(--success);"></i></div>
          <div class="val" id="sec-totp-status" style="font-size:18px;">-</div>
        </div>
        <div class="kpi-card">
          <div class="title"><span>Activated At</span><i class="fa-solid fa-clock" style="color:var(--info);"></i></div>
          <div class="val" id="sec-totp-enabled-at" style="font-size:14px; direction:ltr;">-</div>
        </div>
        <div class="kpi-card">
          <div class="title"><span>Recovery Codes Remaining</span><i class="fa-solid fa-key" style="color:var(--warning);"></i></div>
          <div class="val" id="sec-recovery-remaining">-</div>
        </div>
        <div class="kpi-card">
          <div class="title"><span>Active Admin Sessions</span><i class="fa-solid fa-laptop" style="color:var(--primary);"></i></div>
          <div class="val" id="sec-active-sessions">-</div>
        </div>
      </div>

      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:20px;">
        <button class="btn btn-primary btn-sm" onclick="openSecurityActionModal('ADD_DEVICE')"><i class="fa-solid fa-plus"></i> اتصال Authenticator جدید</button>
        <button class="btn btn-secondary btn-sm" onclick="openSecurityActionModal('REPLACE_DEVICE')"><i class="fa-solid fa-rotate"></i> جایگزینی دستگاه قبلی</button>
        <button class="btn btn-secondary btn-sm" onclick="openSecurityActionModal('REGEN_RECOVERY')"><i class="fa-solid fa-vault"></i> تولید مجدد Recovery Codes</button>
        <button class="btn btn-danger btn-sm" onclick="openSecurityActionModal('DISABLE_2FA')"><i class="fa-solid fa-shield-xmark"></i> غیرفعالسازی 2FA</button>
        <button class="btn btn-danger btn-sm" onclick="revokeAllAdminSessions()"><i class="fa-solid fa-power-off"></i> خاتمه همه نشست‌ها</button>
      </div>

      <h3 style="font-size:15px; margin-bottom:10px;">دستگاه‌های Authenticator متصل (Google / Microsoft Authenticator)</h3>
      <table style="margin-bottom:24px;">
        <thead>
          <tr>
            <th>Label</th>
            <th>Issuer</th>
            <th>Role</th>
            <th>Verified At</th>
            <th>Last Used</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="sec-devices-body">
          <tr><td colspan="6">Loading authenticators...</td></tr>
        </tbody>
      </table>

      <h3 style="font-size:15px; margin-bottom:10px;">نشست‌های فعال مدیر پلتفرم</h3>
      <table>
        <thead>
          <tr>
            <th>Session ID</th>
            <th>IP Address</th>
            <th>User Agent</th>
            <th>MFA Verified</th>
            <th>Last Used</th>
            <th>Expires</th>
          </tr>
        </thead>
        <tbody id="sec-sessions-body">
          <tr><td colspan="6">Loading sessions...</td></tr>
        </tbody>
      </table>
    </div>
  </main>

  <!-- Security Management Modal (Add/Replace Authenticator, Regenerate Recovery Codes, Disable 2FA) -->
  <div id="securityModal" class="auth-overlay" style="display:none;">
    <div class="auth-card" style="max-width:480px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <h2 id="secModalTitle" style="margin-bottom:0;"><i class="fa-solid fa-shield-halved" style="color:var(--primary);"></i> Security Action</h2>
        <button type="button" class="btn btn-secondary btn-sm" onclick="closeSecurityModal()">بستن</button>
      </div>
      <div id="secModalError" class="auth-error"></div>

      <!-- Step A: Re-authenticate -->
      <form id="secReauthForm" onsubmit="submitSecurityReauth(event)">
        <p id="secModalDesc">لطفاً رمز عبور فعلی و کد ۶ رقمی Authenticator را برای تایید هویت مجدد وارد کنید.</p>
        <div class="form-group" id="secLabelGroup" style="display:none;">
          <label for="secDeviceLabel">نام دستگاه Authenticator (اختیاری)</label>
          <input type="text" id="secDeviceLabel" class="form-control rtl" placeholder="مثلاً: Google Authenticator گوشی دوم" />
        </div>
        <div class="form-group">
          <label for="secCurrentPassword">رمز عبور فعلی (Current Password)</label>
          <input type="password" id="secCurrentPassword" class="form-control" required autocomplete="current-password" />
        </div>
        <div class="form-group">
          <label for="secCurrentTotp">کد ۶ رقمی Authenticator</label>
          <input type="text" id="secCurrentTotp" class="form-control" inputmode="numeric" maxlength="6" pattern="\\d{6}" placeholder="000000" required />
        </div>
        <button type="submit" id="secReauthBtn" class="btn btn-primary btn-block">تایید و ادامه</button>
      </form>

      <!-- Step B: Pending QR Enrollment for Add/Replace -->
      <div id="secQrConfirmBox" style="display:none;">
        <p>کد QR زیر را در Google Authenticator یا Microsoft Authenticator اسکن کنید و کد ۶ رقمی جدید را وارد نمایید:</p>
        <div style="text-align:center; background:#fff; padding:12px; border-radius:10px; display:inline-block; margin-bottom:12px;">
          <img id="secNewQrImg" alt="Authenticator QR" style="width:190px; height:190px; display:block;" />
        </div>
        <div class="form-group">
          <label>کلید دستی (Manual Entry Key)</label>
          <input type="text" id="secNewManualKey" class="form-control" readonly />
        </div>
        <form onsubmit="submitConfirmNewDevice(event)">
          <div class="form-group">
            <label for="secNewDeviceCode">کد ۶ رقمی دستگاه جدید</label>
            <input type="text" id="secNewDeviceCode" class="form-control" inputmode="numeric" maxlength="6" pattern="\\d{6}" placeholder="000000" required />
          </div>
          <button type="submit" class="btn btn-success btn-block">تایید و فعال‌سازی دستگاه</button>
        </form>
      </div>

      <!-- Step C: Regenerated Recovery Codes Output -->
      <div id="secRecoveryResultBox" style="display:none;">
        <p style="color:#fde68a;">کدهای بازیابی جدید صادر شدند و کدهای قبلی باطل شدند. هر کد فقط یک بار قابل استفاده است:</p>
        <pre id="secRecoveryCodesPre" style="background:var(--bg); border:1px solid var(--border-accent); border-radius:8px; padding:12px; direction:ltr; text-align:left; font-size:12px; margin-bottom:14px; overflow-x:auto;"></pre>
        <button type="button" class="btn btn-primary btn-block" onclick="closeSecurityModal()">متوجه شدم و ذخیره کردم</button>
      </div>
    </div>
  </div>

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

  <!-- Approve Advertisement Modal -->
  <div id="approveAdModal" class="auth-overlay" style="display: none;">
    <div class="auth-card" style="max-width: 450px;">
      <h2><i class="fa-solid fa-check" style="color: var(--success);"></i> Approve Advertisement</h2>
      <p>Configure the approved duration and display priority.</p>
      <form id="approveAdForm" onsubmit="submitApproveAd(event)">
        <input type="hidden" id="approveAdId" />
        <div class="form-group">
          <label for="approveAdDuration">Approved Duration (Days)</label>
          <input type="number" id="approveAdDuration" class="form-control" min="1" max="365" required />
        </div>
        <div class="form-group">
          <label for="approveAdPriority">Display Priority (0 - 1000)</label>
          <input type="number" id="approveAdPriority" class="form-control" min="0" max="1000" value="0" />
        </div>
        <div style="display:flex; gap:10px; justify-content:flex-end;">
          <button type="button" class="btn btn-secondary" onclick="closeApproveAdModal()">Cancel</button>
          <button type="submit" class="btn btn-success">Confirm Approval</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Reject Advertisement Modal -->
  <div id="rejectAdModal" class="auth-overlay" style="display: none;">
    <div class="auth-card" style="max-width: 450px;">
      <h2><i class="fa-solid fa-xmark" style="color: var(--danger);"></i> Reject Advertisement</h2>
      <p>Please enter the reason for rejecting this advertisement request.</p>
      <form id="rejectAdForm" onsubmit="submitRejectAd(event)">
        <input type="hidden" id="rejectAdId" />
        <div class="form-group">
          <label for="rejectAdReason">Rejection Reason</label>
          <textarea id="rejectAdReason" class="form-control" rows="3" required placeholder="Banner quality does not meet guidelines..."></textarea>
        </div>
        <div style="display:flex; gap:10px; justify-content:flex-end;">
          <button type="button" class="btn btn-secondary" onclick="closeRejectAdModal()">Cancel</button>
          <button type="submit" class="btn btn-danger">Confirm Rejection</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Create Advertisement Modal (Platform Admin) -->
  <div id="createAdModal" class="auth-overlay" style="display: none;">
    <div class="auth-card" style="max-width: 560px;">
      <h2><i class="fa-solid fa-rectangle-ad" style="color: var(--primary);"></i> ایجاد تبلیغ جدید در اسلایدر</h2>
      <p>ایجاد تبلیغ مستقل (بدون وابستگی به گیم‌نت) یا متصل به یک گیم‌نت خاص.</p>
      <form id="createAdForm" onsubmit="handleCreateAd(event)">
        <div class="form-group">
          <label>نوع تبلیغ (Advertisement Type)</label>
          <select id="adNewType" class="form-control" onchange="toggleAdTypeFields()">
            <option value="GLOBAL_PROMOTION" selected>تبلیغ عمومی سراسری (مستقل - بدون گیم‌نت)</option>
            <option value="CUSTOM_LINK">لینک اختصاصی / وب‌سایت (مستقل - بدون گیم‌نت)</option>
            <option value="CATEGORY">دسته‌بندی خاص (مستقل - بدون گیم‌نت)</option>
            <option value="GAMING_CENTER">مربوط به یک گیم‌نت خاص</option>
          </select>
        </div>
        <div class="form-group">
          <label>عنوان تبلیغ (Title)</label>
          <input type="text" id="adNewTitle" class="form-control" placeholder="مثلاً: جشنواره تخفیف پلتفرم PlayNest" required />
        </div>
        <div class="form-group">
          <label>توضیحات (Description - اختیاری)</label>
          <textarea id="adNewDescription" class="form-control" rows="2" placeholder="توضیحات تکمیلی تبلیغ..."></textarea>
        </div>
        <div class="form-group">
          <label>تصویر بنر (Banner Image URL یا آپلود)</label>
          <div style="display:flex; gap:8px;">
            <input type="text" id="adNewBannerUrl" class="form-control" placeholder="https://... یا آدرس تصویر" required />
            <label class="btn btn-secondary" style="margin-bottom:0; cursor:pointer; white-space:nowrap;">
              <i class="fa-solid fa-upload"></i> آپلود
              <input type="file" id="adNewBannerFile" accept="image/*" style="display:none;" onchange="uploadAdBannerFile(this)" />
            </label>
          </div>
          <small id="adBannerUploadMsg" style="color:var(--text-muted); font-size:11px;"></small>
        </div>
        <div class="form-group" id="adDestinationUrlGroup">
          <label>لینک مقصد (Destination URL)</label>
          <input type="url" id="adNewDestinationUrl" class="form-control" placeholder="https://example.com/promo" />
        </div>
        <div class="form-group" id="adCategoryGroup" style="display:none;">
          <label>نام دسته‌بندی (Category)</label>
          <input type="text" id="adNewCategory" class="form-control" placeholder="مثلاً: PC, VR, PLAYSTATION 4, PLAYSTATION 5" />
        </div>
        <div class="form-group" id="adGamingCenterGroup" style="display:none;">
          <label>گیم‌نت مربوطه (در صورت خالی بودن، تبلیغ مستقل خواهد بود)</label>
          <select id="adNewGamingCenterId" class="form-control">
            <option value="">-- مستقل (بدون ارتباط با هیچ گیم‌نتی) --</option>
          </select>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div class="form-group">
            <label>اولویت نمایش (Priority)</label>
            <input type="number" id="adNewPriority" class="form-control" value="10" min="0" max="1000" />
          </div>
          <div class="form-group">
            <label>مدت زمان نمایش به روز (Duration Days)</label>
            <input type="number" id="adNewDuration" class="form-control" value="30" min="1" max="365" />
          </div>
        </div>
        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button type="submit" class="btn btn-primary" style="flex:1;"><i class="fa-solid fa-plus"></i> ایجاد و انتشار تبلیغ</button>
          <button type="button" class="btn btn-secondary" onclick="closeCreateAdModal()">انصراف</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Platform Admin Authentication Modal (Mandatory 2FA SSR Flow) -->
  <div id="authOverlay" class="auth-overlay" style="display: none;">
    <div class="auth-card" style="max-width:480px;">
      <div id="authError" class="auth-error"></div>

      <!-- Step 1: Username & Password -->
      <div id="dashAuthLoginStep">
        <h2><i class="fa-solid fa-shield-halved" style="color: var(--primary);"></i> Platform Admin Login</h2>
        <p>نام کاربری (Username) و رمز عبور مدیر کل پلتفرم را وارد کنید. تایید دو مرحله‌ای TOTP الزامی است.</p>
        <form id="loginForm" onsubmit="handleLogin(event)">
          <div class="form-group">
            <label for="adminUsername">Username (or Phone / Email)</label>
            <input type="text" id="adminUsername" class="form-control" placeholder="superadmin" required autocomplete="username" />
          </div>
          <div class="form-group">
            <label for="adminPassword">Password</label>
            <input type="password" id="adminPassword" class="form-control" placeholder="••••••••" required autocomplete="current-password" />
          </div>
          <button type="submit" id="loginSubmitBtn" class="btn btn-primary btn-block">
            <i class="fa-solid fa-lock"></i> Continue to Two-Factor Verification
          </button>
        </form>
      </div>

      <!-- Step 2: Two-Factor Verification -->
      <div id="dashAuthVerifyStep" style="display:none;">
        <h2><i class="fa-solid fa-key" style="color: var(--primary);"></i> Two-Factor Verification</h2>
        <p>کد ۶ رقمی Google Authenticator یا Microsoft Authenticator را وارد کنید.</p>
        <form id="verify2faForm" onsubmit="handleVerify2fa(event)">
          <div class="form-group" id="dashTotpGroup">
            <label for="dashTotpCode">6-Digit Authenticator Code</label>
            <input type="text" id="dashTotpCode" class="form-control" inputmode="numeric" maxlength="6" placeholder="000000" autocomplete="one-time-code" />
          </div>
          <div class="form-group" id="dashRecoveryGroup" style="display:none;">
            <label for="dashRecoveryCode">Single-Use Recovery Code</label>
            <input type="text" id="dashRecoveryCode" class="form-control" placeholder="XXXX-XXXX-XXXX-XXXX" />
          </div>
          <button type="submit" id="verify2faBtn" class="btn btn-primary btn-block">
            <i class="fa-solid fa-shield-check"></i> Verify &amp; Sign In
          </button>
        </form>
        <div style="display:flex; justify-content:space-between; margin-top:12px;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="toggleDashRecoveryMode()" id="dashToggleRecoveryBtn">Use Recovery Code</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="showDashStep('login')">Back</button>
        </div>
      </div>

      <!-- Step 3: Mandatory Initial Authenticator Setup & QR Enrollment (No Skip) -->
      <div id="dashAuthSetupStep" style="display:none;">
        <h2><i class="fa-solid fa-qrcode" style="color: var(--warning);"></i> Mandatory Initial 2FA Setup</h2>
        <p>در اولین ورود، اتصال Google Authenticator یا Microsoft Authenticator اجباری است و امکان رد کردن آن وجود ندارد.</p>
        <div style="text-align:center; background:#fff; padding:10px; border-radius:10px; display:inline-block; margin-bottom:12px;">
          <img id="dashSetupQrImg" alt="2FA QR Code" style="width:185px; height:185px; display:block;" />
        </div>
        <div class="form-group">
          <label>Manual Entry Key</label>
          <input type="text" id="dashSetupManualKey" class="form-control" readonly />
        </div>
        <form id="setupConfirmForm" onsubmit="handleConfirmInitial2fa(event)">
          <div class="form-group">
            <label for="dashSetupCode">Enter 6-Digit Code from Authenticator</label>
            <input type="text" id="dashSetupCode" class="form-control" inputmode="numeric" maxlength="6" placeholder="000000" required />
          </div>
          <button type="submit" id="confirmSetupBtn" class="btn btn-success btn-block">
            <i class="fa-solid fa-check-double"></i> Confirm &amp; Activate 2FA
          </button>
        </form>
      </div>

      <!-- Step 4: Recovery Codes Display -->
      <div id="dashAuthRecoveryStep" style="display:none;">
        <h2><i class="fa-solid fa-vault" style="color: var(--success);"></i> Save Your Recovery Codes</h2>
        <p>این ۱۰ کد بازیابی فقط یک بار نمایش داده می‌شوند. هر کد فقط یک بار قابل استفاده است.</p>
        <pre id="dashRecoveryCodesPre" style="background:var(--bg); border:1px solid var(--border-accent); border-radius:8px; padding:12px; direction:ltr; text-align:left; font-size:12px; margin-bottom:12px; overflow-x:auto;"></pre>
        <label style="display:flex; align-items:center; gap:8px; font-size:12px; margin-bottom:12px; cursor:pointer;">
          <input type="checkbox" id="dashSavedRecoveryCb" onchange="document.getElementById('dashFinishSetupBtn').disabled = !this.checked;" />
          کدهای بازیابی را ذخیره کردم
        </label>
        <button type="button" id="dashFinishSetupBtn" class="btn btn-primary btn-block" disabled onclick="finishInitialSetup()">
          ورود به داشبورد مدیریت
        </button>
      </div>
    </div>
  </div>

  <div id="toast"></div>

  <script>
${CLIENT_HTML_SANITIZE_HELPERS}
    var token = localStorage.getItem('platform_token');
    var refreshToken = null;
    localStorage.removeItem('platform_refresh_token');
    var authFlow = { challengeToken: null, setupToken: null, deviceId: null, usingRecovery: false };
    var securityActionState = { action: null, deviceId: null, pendingDeviceId: null, mode: null };

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

    function showDashStep(step) {
      document.getElementById('dashAuthLoginStep').style.display = step === 'login' ? 'block' : 'none';
      document.getElementById('dashAuthVerifyStep').style.display = step === 'verify' ? 'block' : 'none';
      document.getElementById('dashAuthSetupStep').style.display = step === 'setup' ? 'block' : 'none';
      document.getElementById('dashAuthRecoveryStep').style.display = step === 'recovery' ? 'block' : 'none';
    }

    function showLoginModal(errorMessage) {
      var overlay = document.getElementById('authOverlay');
      var errorDiv = document.getElementById('authError');
      showDashStep('login');
      if (errorMessage) {
        errorDiv.textContent = errorMessage;
        errorDiv.style.display = 'block';
      } else {
        errorDiv.style.display = 'none';
      }
      overlay.style.display = 'flex';
      document.getElementById('adminUsername').focus();
    }

    function hideLoginModal() {
      document.getElementById('authOverlay').style.display = 'none';
    }

    function toggleDashRecoveryMode() {
      authFlow.usingRecovery = !authFlow.usingRecovery;
      document.getElementById('dashTotpGroup').style.display = authFlow.usingRecovery ? 'none' : 'block';
      document.getElementById('dashRecoveryGroup').style.display = authFlow.usingRecovery ? 'block' : 'none';
      document.getElementById('dashToggleRecoveryBtn').textContent = authFlow.usingRecovery ? 'Use 6-Digit Code' : 'Use Recovery Code';
    }

    async function handleLogin(e) {
      e.preventDefault();
      var username = document.getElementById('adminUsername').value.trim();
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
          body: JSON.stringify({ username: username, password: password })
        });

        var resData = await response.json();
        if (!response.ok) {
          throw new Error((resData.error && resData.error.message) || resData.message || 'Invalid credentials or access denied');
        }

        var data = resData.data || {};
        if (data.requiresTwoFactorSetup && data.setupToken) {
          authFlow.setupToken = data.setupToken;
          var setupRes = await fetch('/api/v1/auth/platform-admin/2fa/setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ setupToken: authFlow.setupToken, mode: 'INITIAL' })
          });
          var setupJson = await setupRes.json();
          if (!setupRes.ok) {
            throw new Error((setupJson.error && setupJson.error.message) || setupJson.message || 'Failed to initialize 2FA setup');
          }
          authFlow.deviceId = setupJson.data.deviceId;
          document.getElementById('dashSetupQrImg').src = setupJson.data.qrCodeDataUrl;
          document.getElementById('dashSetupManualKey').value = setupJson.data.manualEntryKey;
          showDashStep('setup');
          document.getElementById('dashSetupCode').focus();
        } else if (data.challengeToken) {
          authFlow.challengeToken = data.challengeToken;
          authFlow.usingRecovery = false;
          showDashStep('verify');
          document.getElementById('dashTotpCode').focus();
        } else {
          throw new Error('Unexpected authentication response');
        }
      } catch (err) {
        errorDiv.textContent = err.message || 'Authentication failed';
        errorDiv.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-lock"></i> Continue to Two-Factor Verification';
      }
    }

    async function handleVerify2fa(e) {
      e.preventDefault();
      var errorDiv = document.getElementById('authError');
      var btn = document.getElementById('verify2faBtn');
      errorDiv.style.display = 'none';
      btn.disabled = true;

      try {
        var body = { challengeToken: authFlow.challengeToken };
        if (authFlow.usingRecovery) {
          body.recoveryCode = document.getElementById('dashRecoveryCode').value.trim();
        } else {
          body.code = document.getElementById('dashTotpCode').value.trim();
        }
        var response = await fetch('/api/v1/auth/platform-admin/verify-2fa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        var resData = await response.json();
        if (!response.ok) {
          throw new Error((resData.error && resData.error.message) || resData.message || '2FA verification failed');
        }
        var data = resData.data || {};
        token = data.accessToken || (data.tokens && data.tokens.accessToken);
        localStorage.setItem('platform_token', token);
        localStorage.removeItem('platform_refresh_token');
        hideLoginModal();
        loadData();
      } catch (err) {
        errorDiv.textContent = err.message || '2FA verification failed';
        errorDiv.style.display = 'block';
      } finally {
        btn.disabled = false;
      }
    }

    async function handleConfirmInitial2fa(e) {
      e.preventDefault();
      var errorDiv = document.getElementById('authError');
      var btn = document.getElementById('confirmSetupBtn');
      errorDiv.style.display = 'none';
      btn.disabled = true;
      try {
        var code = document.getElementById('dashSetupCode').value.trim();
        var response = await fetch('/api/v1/auth/platform-admin/2fa/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ setupToken: authFlow.setupToken, deviceId: authFlow.deviceId, code: code, mode: 'INITIAL' })
        });
        var resData = await response.json();
        if (!response.ok) {
          throw new Error((resData.error && resData.error.message) || resData.message || 'Invalid verification code');
        }
        var data = resData.data || {};
        token = data.accessToken || (data.tokens && data.tokens.accessToken);
        localStorage.setItem('platform_token', token);
        localStorage.removeItem('platform_refresh_token');

        document.getElementById('dashRecoveryCodesPre').textContent = (data.recoveryCodes || []).join('\\n');
        document.getElementById('dashSavedRecoveryCb').checked = false;
        document.getElementById('dashFinishSetupBtn').disabled = true;
        showDashStep('recovery');
      } catch (err) {
        errorDiv.textContent = err.message || '2FA confirmation failed';
        errorDiv.style.display = 'block';
      } finally {
        btn.disabled = false;
      }
    }

    function finishInitialSetup() {
      hideLoginModal();
      loadData();
    }

    var tabList = ['centers', 'verifications', 'ads', 'campaigns', 'reservations', 'users', 'customers', 'settings', 'device-types', 'games-catalog', 'audit', 'security'];

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
      if (targetTab === 'device-types') loadDeviceTypes();
      if (targetTab === 'games-catalog') loadCatalogGames();
      if (targetTab === 'audit') loadAudit();
      if (targetTab === 'security') loadSecuritySettings();
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
        var safeId = encodeURIComponent(c.id || '');
        var safeSlug = encodeURIComponent(c.slug || '');
        return '<tr>' +
          '<td><strong>' + escapeHtml(c.name) + '</strong></td>' +
          '<td><code>' + escapeHtml(c.slug) + '</code></td>' +
          '<td>' + escapeHtml(c.city || '-') + '</td>' +
          '<td>' + escapeHtml(c._count && c._count.stations ? c._count.stations : 0) + '</td>' +
          '<td>' + escapeHtml(c._count && c._count.users ? c._count.users : 0) + '</td>' +
          '<td><button class="btn btn-sm ' + btnCls + '" onclick="toggleCenterStatus(\\'' + escapeJsArg(c.id) + '\\', ' + isAct + ')">' + btnTxt + '</button></td>' +
          '<td><div style="display:flex; gap:6px;">' +
            '<a href="/api/v1/admin/gamingCenters/' + safeId + '/dashboard" target="_blank" class="btn btn-secondary btn-sm"><i class="fa-solid fa-arrow-up-right-from-square"></i> Center View</a>' +
            '<a href="/public/gamingCenters/' + safeSlug + '" target="_blank" class="btn btn-secondary btn-sm"><i class="fa-solid fa-globe"></i> Website</a>' +
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
          tbody.innerHTML = '<tr><td colspan="9">هیچ درخواست احراز هویتی یافت نشد.</td></tr>';
          return;
        }
        tbody.innerHTML = items.map(function(v) {
          var badgeCls = v.status === 'APPROVED' ? 'badge-success' : (v.status === 'REJECTED' ? 'badge-danger' : 'badge-warning');
          var centerId = v.gamingCenterId || (v.gamingCenter && v.gamingCenter.id) || '-';
          var centerName = (v.gamingCenter && v.gamingCenter.name) || v.gamingCenterName || '-';
          var applicantName = v.ownerFullName || (v.gamingCenter && v.gamingCenter.users && v.gamingCenter.users[0] && v.gamingCenter.users[0].fullName) || '-';
          var applicantPhone = v.phoneNumber || (v.gamingCenter && v.gamingCenter.users && v.gamingCenter.users[0] && v.gamingCenter.users[0].phone) || '-';

          var statusHtml = '<span class="badge ' + badgeCls + '">' + escapeHtml(v.status) + '</span>';
          if (v.status === 'REJECTED' && v.rejectionReason) {
            statusHtml += '<div style="font-size:11px; color:#ef4444; margin-top:4px;"><strong>دلیل رد:</strong> ' + escapeHtml(v.rejectionReason) + '</div>';
          }

          var docsHtml = '';
          var safeLicenseUrl = v.businessLicenseUrl ? sanitizeUrl(v.businessLicenseUrl, '') : '';
          var safeCardUrl = v.nationalCardUrl ? sanitizeUrl(v.nationalCardUrl, '') : '';
          if (safeLicenseUrl) docsHtml += '<a href="' + safeLicenseUrl + '" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-secondary"><i class="fa-solid fa-file-contract"></i> پروانه کسب</a> ';
          if (safeCardUrl) docsHtml += '<a href="' + safeCardUrl + '" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-secondary"><i class="fa-solid fa-file"></i> کارت ملی</a>';

          var safePhoneTel = String(applicantPhone).replace(/[^0-9+()-]/g, '');
          var actionsHtml = v.status === 'PENDING'
            ? '<div style="display:flex; gap:6px;">' +
                '<button class="btn btn-sm btn-success" onclick="approveVerification(\\'' + escapeJsArg(v.id) + '\\')"><i class="fa-solid fa-check"></i> تایید</button>' +
                '<button class="btn btn-sm btn-danger" onclick="rejectVerification(\\'' + escapeJsArg(v.id) + '\\')"><i class="fa-solid fa-xmark"></i> رد</button>' +
              '</div>'
            : '<span style="color:var(--text-muted); font-size:12px;">' + escapeHtml(v.reviewedAt ? new Date(v.reviewedAt).toLocaleDateString() : 'بررسی شده') + '</span>';

          return '<tr>' +
            '<td><code>' + escapeHtml(v.id) + '</code></td>' +
            '<td><code>' + escapeHtml(centerId) + '</code></td>' +
            '<td><strong>' + escapeHtml(centerName) + '</strong></td>' +
            '<td>' + escapeHtml(applicantName) + '</td>' +
            '<td>' + (applicantPhone !== '-' ? '<a href="tel:' + escapeHtml(safePhoneTel) + '">' + escapeHtml(applicantPhone) + '</a>' : '-') + '</td>' +
            '<td>' + escapeHtml(new Date(v.createdAt).toLocaleDateString()) + '</td>' +
            '<td>' + statusHtml + '</td>' +
            '<td>' + docsHtml + '</td>' +
            '<td>' + actionsHtml + '</td>' +
          '</tr>';
        }).join('');
      } catch (e) { console.error(e); }
    }

    async function approveVerification(id) {
      if (!confirm('آیا از تایید احراز هویت این گیم‌نت اطمینان دارید؟')) return;
      var res = await fetch('/api/v1/platform-admin/verifications/' + id + '/approve', { method: 'POST', headers: headers() });
      if (res.ok) { showToast('احراز هویت با موفقیت تایید شد.'); loadVerifications(); }
      else { showToast('خطا در تایید احراز هویت.'); }
    }

    async function rejectVerification(id) {
      var reason = prompt('لطفاً دلیل رد درخواست احراز هویت را وارد نمایید:');
      if (reason === null) return;
      reason = reason.trim();
      if (!reason || reason.length < 3) {
        showToast('دلیل رد باید حداقل ۳ کاراکتر باشد.');
        return;
      }
      var res = await fetch('/api/v1/platform-admin/verifications/' + id + '/reject', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ rejectionReason: reason })
      });
      if (res.ok) { showToast('درخواست احراز هویت رد شد.'); loadVerifications(); }
      else { showToast('خطا در رد درخواست.'); }
    }

    async function loadAds() {
      try {
        var statusFilter = (document.getElementById('ad-status-filter') || {}).value || '';
        var searchVal = (document.getElementById('ad-search-input') || {}).value || '';
        var url = '/api/v1/platform-admin/ad-requests?limit=50';
        if (statusFilter) url += '&status=' + encodeURIComponent(statusFilter);
        if (searchVal) url += '&search=' + encodeURIComponent(searchVal);

        var res = await fetch(url, { headers: headers() });
        var data = (await res.json()).data;
        var items = Array.isArray(data) ? data : ((data && data.items) || []);
        var tbody = document.getElementById('ads-table-body');
        if (items.length === 0) {
          tbody.innerHTML = '<tr><td colspan="8">No advertisement requests found.</td></tr>';
          return;
        }
        tbody.innerHTML = items.map(function(a) {
          var badgeCls = 'badge-secondary';
          if (a.status === 'ACTIVE') badgeCls = 'badge-success';
          else if (a.status === 'APPROVED') badgeCls = 'badge-info';
          else if (a.status === 'REJECTED') badgeCls = 'badge-danger';
          else if (a.status === 'PENDING') badgeCls = 'badge-warning';
          else if (a.status === 'EXPIRED') badgeCls = 'badge-secondary';
          else if (a.status === 'DELETED') badgeCls = 'badge-danger';

          var adTypeBadge = '<span class="badge badge-info">' + escapeHtml(a.adType || 'GAMING_CENTER') + '</span>';
          var centerDisplay = (a.gamingCenter && a.gamingCenter.name)
            ? '<strong>' + escapeHtml(a.gamingCenter.name) + '</strong>'
            : '<span class="badge badge-secondary" style="font-size:11px;"><i class="fa-solid fa-globe"></i> مستقل (بدون گیم‌نت)</span>';

          var actionsHtml = '<div style="display:flex; gap:6px;">';
          if (a.status === 'PENDING') {
            actionsHtml += '<button class="btn btn-sm btn-success" onclick="openApproveAdModal(\\'' + escapeJsArg(a.id) + '\\', ' + (Number(a.durationDays) || 30) + ')">Approve</button>' +
              '<button class="btn btn-sm btn-danger" onclick="openRejectAdModal(\\'' + escapeJsArg(a.id) + '\\')">Reject</button>';
          }
          if (a.status !== 'DELETED') {
            actionsHtml += '<button class="btn btn-sm btn-outline-danger" onclick="deleteAdRequestPrompt(\\'' + escapeJsArg(a.id) + '\\')"><i class="fa-solid fa-trash"></i></button>';
          }
          actionsHtml += '</div>';

          var start = a.startDate ? String(a.startDate).slice(0, 10) : '-';
          var end = a.endDate ? String(a.endDate).slice(0, 10) : '-';

          var safeBannerUrl = a.bannerUrl ? sanitizeUrl(a.bannerUrl, '') : '';
          var bannerImg = safeBannerUrl ? '<img src="' + safeBannerUrl + '" style="width:60px; height:34px; object-fit:cover; border-radius:4px; margin-right:8px; vertical-align:middle;" />' : '';

          return '<tr>' +
            '<td>' + bannerImg + '<strong>' + escapeHtml(a.title) + '</strong></td>' +
            '<td>' + adTypeBadge + '</td>' +
            '<td>' + centerDisplay + '</td>' +
            '<td><span class="badge badge-info">' + escapeHtml(Number(a.priority) || 0) + '</span></td>' +
            '<td style="direction:ltr; font-size:12px;">' + escapeHtml(start) + ' ~ ' + escapeHtml(end) + '</td>' +
            '<td>' + escapeHtml(Number(a.durationDays) || 30) + ' days</td>' +
            '<td><span class="badge ' + badgeCls + '">' + escapeHtml(a.status) + '</span></td>' +
            '<td>' + actionsHtml + '</td>' +
          '</tr>';
        }).join('');
      } catch (e) { console.error(e); }
    }

    function openCreateAdModal() {
      var gcSelect = document.getElementById('adNewGamingCenterId');
      if (gcSelect && gcSelect.options.length <= 1) {
        fetch('/api/v1/platform-admin/gaming-centers?limit=100', { headers: headers() })
          .then(function(r) { return r.json(); })
          .then(function(res) {
            var items = (res && res.data && res.data.items) || (Array.isArray(res && res.data) ? res.data : []);
            items.forEach(function(gc) {
              var opt = document.createElement('option');
              opt.value = gc.id;
              opt.textContent = gc.name + ' (' + gc.id + ')';
              gcSelect.appendChild(opt);
            });
          })
          .catch(function(e) { console.error('Failed to load centers for ad dropdown', e); });
      }
      document.getElementById('adNewType').value = 'GLOBAL_PROMOTION';
      toggleAdTypeFields();
      document.getElementById('createAdModal').style.display = 'flex';
    }

    function closeCreateAdModal() {
      document.getElementById('createAdModal').style.display = 'none';
      document.getElementById('createAdForm').reset();
      document.getElementById('adBannerUploadMsg').textContent = '';
    }

    function toggleAdTypeFields() {
      var type = document.getElementById('adNewType').value;
      var destGroup = document.getElementById('adDestinationUrlGroup');
      var catGroup = document.getElementById('adCategoryGroup');
      var gcGroup = document.getElementById('adGamingCenterGroup');

      if (destGroup) destGroup.style.display = (type === 'CUSTOM_LINK' || type === 'GLOBAL_PROMOTION') ? 'block' : 'none';
      if (catGroup) catGroup.style.display = (type === 'CATEGORY') ? 'block' : 'none';
      if (gcGroup) gcGroup.style.display = (type === 'GAMING_CENTER') ? 'block' : 'none';
    }

    async function uploadAdBannerFile(input) {
      if (!input.files || input.files.length === 0) return;
      var file = input.files[0];
      var msg = document.getElementById('adBannerUploadMsg');
      msg.textContent = 'در حال آپلود بنر...';

      var formData = new FormData();
      formData.append('file', file);

      try {
        var h = headers();
        delete h['Content-Type'];
        var res = await fetch('/api/v1/platform-admin/media/upload', {
          method: 'POST',
          headers: h,
          body: formData
        });
        var json = await res.json();
        if (res.ok && json.data && json.data.url) {
          document.getElementById('adNewBannerUrl').value = json.data.url;
          msg.textContent = 'بنر با موفقیت آپلود شد.';
          msg.style.color = 'var(--success)';
        } else {
          msg.textContent = 'خطا در آپلود بنر: ' + ((json.error && json.error.message) || 'آپلود ناموفق');
          msg.style.color = '#ef4444';
        }
      } catch (err) {
        msg.textContent = 'خطای ارتباط در آپلود بنر.';
        msg.style.color = '#ef4444';
      }
    }

    async function handleCreateAd(e) {
      e.preventDefault();
      var title = document.getElementById('adNewTitle').value.trim();
      var description = document.getElementById('adNewDescription').value.trim() || undefined;
      var bannerUrl = document.getElementById('adNewBannerUrl').value.trim();
      var adType = document.getElementById('adNewType').value;
      var destinationUrl = document.getElementById('adNewDestinationUrl').value.trim() || undefined;
      var category = document.getElementById('adNewCategory').value.trim() || undefined;
      var gamingCenterId = document.getElementById('adNewGamingCenterId').value.trim() || null;
      var priority = parseInt(document.getElementById('adNewPriority').value, 10) || 0;
      var durationDays = parseInt(document.getElementById('adNewDuration').value, 10) || 30;

      var payload = {
        title: title,
        description: description,
        bannerUrl: bannerUrl,
        adType: adType,
        destinationUrl: destinationUrl,
        category: category,
        gamingCenterId: gamingCenterId,
        priority: priority,
        durationDays: durationDays,
        status: 'APPROVED'
      };

      try {
        var res = await fetch('/api/v1/platform-admin/ad-requests', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify(payload)
        });
        var json = await res.json();
        if (res.ok) {
          showToast('تبلیغ با موفقیت ساخته شد.');
          closeCreateAdModal();
          loadAds();
        } else {
          showToast('خطا: ' + ((json.error && json.error.message) || 'عدم امکان ساخت تبلیغ'));
        }
      } catch (err) {
        showToast('خطا در ارتباط با سرور.');
      }
    }

    function openApproveAdModal(id, currentDuration) {
      document.getElementById('approveAdId').value = id;
      document.getElementById('approveAdDuration').value = currentDuration || 30;
      document.getElementById('approveAdPriority').value = 0;
      document.getElementById('approveAdModal').style.display = 'flex';
    }

    function closeApproveAdModal() {
      document.getElementById('approveAdModal').style.display = 'none';
    }

    async function submitApproveAd(e) {
      e.preventDefault();
      var id = document.getElementById('approveAdId').value;
      var days = document.getElementById('approveAdDuration').value;
      var priority = document.getElementById('approveAdPriority').value;
      var body = {
        status: 'APPROVED',
        durationDays: parseInt(days, 10),
        priority: parseInt(priority, 10) || 0
      };
      var res = await fetch('/api/v1/platform-admin/ad-requests/' + id + '/status', {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify(body)
      });
      if (res.ok) {
        showToast('Advertisement approved successfully.');
        closeApproveAdModal();
        loadAds();
      } else {
        alert('Failed to approve advertisement');
      }
    }

    function openRejectAdModal(id) {
      document.getElementById('rejectAdId').value = id;
      document.getElementById('rejectAdReason').value = '';
      document.getElementById('rejectAdModal').style.display = 'flex';
    }

    function closeRejectAdModal() {
      document.getElementById('rejectAdModal').style.display = 'none';
    }

    async function submitRejectAd(e) {
      e.preventDefault();
      var id = document.getElementById('rejectAdId').value;
      var reason = document.getElementById('rejectAdReason').value.trim();
      var res = await fetch('/api/v1/platform-admin/ad-requests/' + id + '/status', {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ status: 'REJECTED', decisionReason: reason })
      });
      if (res.ok) {
        showToast('Advertisement rejected.');
        closeRejectAdModal();
        loadAds();
      } else {
        alert('Failed to reject advertisement');
      }
    }

    async function deleteAdRequestPrompt(id) {
      if (!confirm('Are you sure you want to delete this advertisement? It will no longer appear on public sliders.')) return;
      var res = await fetch('/api/v1/platform-admin/ad-requests/' + id, {
        method: 'DELETE',
        headers: headers()
      });
      if (res.ok) { showToast('Advertisement deleted.'); loadAds(); }
      else { alert('Failed to delete advertisement'); }
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
          var valText = c.discountType === 'PERCENTAGE' ? (Number(c.percentage || 0) + '%') : (Number(c.amount || 0).toLocaleString() + ' IRR');
          var badgeCls = c.isActive ? 'badge-success' : 'badge-danger';
          var statusTxt = c.isActive ? 'ACTIVE' : 'INACTIVE';

          return '<tr>' +
            '<td><strong>' + escapeHtml(c.title) + '</strong></td>' +
            '<td><code>' + escapeHtml(c.code) + '</code></td>' +
            '<td><span class="badge badge-primary">' + escapeHtml(c.discountType) + '</span></td>' +
            '<td>' + escapeHtml(valText) + '</td>' +
            '<td>' + escapeHtml((Number(c.platformShareBps || 0) / 100) + '% Platform') + '</td>' +
            '<td><span class="badge ' + badgeCls + '">' + statusTxt + '</span></td>' +
            '<td><button class="btn btn-sm btn-danger" onclick="deleteCampaign(\\'' + escapeJsArg(c.id) + '\\')"><i class="fa-solid fa-trash"></i> Delete</button></td>' +
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
            '<td><code>' + escapeHtml(String(r.id || '').slice(0, 10)) + '...</code></td>' +
            '<td>' + escapeHtml(centerName) + '</td>' +
            '<td>' + escapeHtml(stationName) + '</td>' +
            '<td>' + escapeHtml(custName) + '</td>' +
            '<td style="direction:ltr; font-size:12px;">' + escapeHtml(new Date(r.startTime).toLocaleString()) + '</td>' +
            '<td>' + escapeHtml(Number(r.totalPrice || 0).toLocaleString()) + ' IRR</td>' +
            '<td><span class="badge ' + badgeCls + '">' + escapeHtml(r.status) + '</span></td>' +
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
            '<td><strong>' + escapeHtml(u.fullName) + '</strong></td>' +
            '<td style="direction:ltr;">' + escapeHtml(u.phone) + '</td>' +
            '<td>' + escapeHtml(centerName) + '</td>' +
            '<td><span class="badge badge-primary">' + escapeHtml(u.role) + '</span></td>' +
            '<td><span class="badge ' + badgeCls + '">' + statusTxt + '</span></td>' +
            '<td><button class="btn btn-sm btn-danger" onclick="revokeSessions(\\'' + escapeJsArg(u.id) + '\\')"><i class="fa-solid fa-ban"></i> Revoke Sessions</button></td>' +
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
            '<td><strong>' + escapeHtml(custName) + '</strong></td>' +
            '<td style="direction:ltr;">' + escapeHtml(c.phone || '-') + '</td>' +
            '<td>' + escapeHtml(c.email || '-') + '</td>' +
            '<td>' + escapeHtml(resCount) + '</td>' +
            '<td>' + escapeHtml(walletBal) + ' IRR</td>' +
            '<td>' + escapeHtml(new Date(c.createdAt).toLocaleDateString()) + '</td>' +
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

    async function loadDeviceTypes() {
      var tbody = document.getElementById('device-types-table-body');
      try {
        var res = await fetch('/api/v1/platform-admin/device-types?limit=100', { headers: headers() });
        var json = await res.json();
        var items = (json.data && (json.data.items || json.data.data || json.data)) || [];
        if (!Array.isArray(items) || items.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">No device types found.</td></tr>';
          return;
        }
        tbody.innerHTML = items.map(function(dt) {
          return '<tr>' +
            '<td><strong>' + escapeHtml(dt.name) + '</strong></td>' +
            '<td><code>' + escapeHtml(dt.slug) + '</code></td>' +
            '<td>' + escapeHtml(dt.category) + '</td>' +
            '<td><button class="btn btn-sm ' + (dt.extraControllerEnabled ? 'btn-primary' : 'btn-secondary') + '" onclick="toggleDeviceTypeField(\\'' + escapeJsArg(dt.id) + '\\', \\'extraControllerEnabled\\', ' + (!dt.extraControllerEnabled) + ')">' + (dt.extraControllerEnabled ? 'Enabled' : 'Disabled') + '</button></td>' +
            '<td><button class="btn btn-sm ' + (dt.isActive ? 'btn-primary' : 'btn-secondary') + '" onclick="toggleDeviceTypeField(\\'' + escapeJsArg(dt.id) + '\\', \\'isActive\\', ' + (!dt.isActive) + ')">' + (dt.isActive ? 'Active' : 'Inactive') + '</button></td>' +
            '<td><button class="btn btn-danger btn-sm" onclick="deleteDeviceType(\\'' + escapeJsArg(dt.id) + '\\')"><i class="fa-solid fa-trash"></i></button></td>' +
          '</tr>';
        }).join('');
      } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--danger);">Failed to load device types</td></tr>';
      }
    }

    async function createDeviceType() {
      var name = document.getElementById('dt-name').value.trim();
      var slug = document.getElementById('dt-slug').value.trim();
      var category = document.getElementById('dt-category').value;
      var extraControllerEnabled = document.getElementById('dt-extra-controller').checked;
      if (!name) { alert('Device type name is required.'); return; }
      var payload = { name: name, category: category, extraControllerEnabled: extraControllerEnabled };
      if (slug) payload.slug = slug;
      var res = await fetch('/api/v1/platform-admin/device-types', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, headers()),
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        var err = await res.json().catch(function() { return {}; });
        alert(err.message || 'Failed to create device type');
        return;
      }
      document.getElementById('dt-name').value = '';
      document.getElementById('dt-slug').value = '';
      document.getElementById('dt-extra-controller').checked = false;
      loadDeviceTypes();
    }

    async function toggleDeviceTypeField(id, field, value) {
      var payload = {};
      payload[field] = value;
      var res = await fetch('/api/v1/platform-admin/device-types/' + id, {
        method: 'PATCH',
        headers: Object.assign({ 'Content-Type': 'application/json' }, headers()),
        body: JSON.stringify(payload)
      });
      if (res.ok) loadDeviceTypes();
    }

    async function deleteDeviceType(id) {
      if (!confirm('Delete this device type?')) return;
      var res = await fetch('/api/v1/platform-admin/device-types/' + id, {
        method: 'DELETE',
        headers: headers()
      });
      if (res.ok) loadDeviceTypes();
    }

    var cachedCatalogGames = [];

    async function loadCatalogGames() {
      var tbody = document.getElementById('games-catalog-table-body');
      var search = (document.getElementById('gc-search-input') && document.getElementById('gc-search-input').value.trim()) || '';
      try {
        var qs = '?limit=100' + (search ? '&search=' + encodeURIComponent(search) : '');
        var res = await fetch('/api/v1/platform-admin/catalog/games' + qs, { headers: headers() });
        var json = await res.json();
        var items = (json.data && (json.data.data || json.data.items || json.data)) || [];
        cachedCatalogGames = Array.isArray(items) ? items : [];
        if (cachedCatalogGames.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">No games found.</td></tr>';
          return;
        }
        tbody.innerHTML = cachedCatalogGames.map(function(g) {
          var aliasList = Array.isArray(g.aliases) ? g.aliases.map(function(a) { return a.alias || a; }).join(', ') : '-';
          var centerCount = (g._count && g._count.centerGames) || 0;
          return '<tr>' +
            '<td><strong>' + escapeHtml(g.title) + '</strong><br><small style="color:var(--text-muted);">' + escapeHtml(g.titleFa || '-') + ' | ' + escapeHtml(g.slug || '-') + '</small></td>' +
            '<td>' + escapeHtml(g.category || g.genre || '-') + '</td>' +
            '<td>' + escapeHtml((g.supportedPlatforms || []).join(', ')) + '</td>' +
            '<td style="max-width:220px; font-size:12px;">' + escapeHtml(aliasList) + '</td>' +
            '<td>' + centerCount + '</td>' +
            '<td>' + (g.supportsOnline ? '<span class="badge badge-success">ONLINE</span>' : '<span class="badge badge-secondary">OFFLINE</span>') + '</td>' +
            '<td><button class="btn btn-secondary btn-sm" onclick="editCatalogGame(\\'' + escapeJsArg(g.id) + '\\')"><i class="fa-solid fa-pen"></i></button> ' +
            '<button class="btn btn-danger btn-sm" onclick="deleteCatalogGame(\\'' + escapeJsArg(g.id) + '\\')"><i class="fa-solid fa-trash"></i></button></td>' +
          '</tr>';
        }).join('');
      } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--danger);">Failed to load games catalog</td></tr>';
      }
    }

    function editCatalogGame(id) {
      var g = cachedCatalogGames.find(function(item) { return item.id === id; });
      if (!g) return;
      document.getElementById('gc-edit-id').value = g.id;
      document.getElementById('gc-form-title').textContent = 'Edit Game: ' + g.title;
      document.getElementById('gc-title').value = g.title || '';
      document.getElementById('gc-title-fa').value = g.titleFa || '';
      document.getElementById('gc-title-en').value = g.titleEn || '';
      document.getElementById('gc-category').value = g.category || 'OTHER';
      document.getElementById('gc-cover-url').value = g.coverImageUrl || '';
      document.getElementById('gc-aliases').value = Array.isArray(g.aliases) ? g.aliases.map(function(a) { return a.alias || a; }).join(', ') : '';
      document.getElementById('gc-supports-online').checked = Boolean(g.supportsOnline);
      document.querySelectorAll('.gc-platform-cb').forEach(function(cb) {
        cb.checked = Array.isArray(g.supportedPlatforms) && g.supportedPlatforms.indexOf(cb.value) !== -1;
      });
    }

    function resetGameForm() {
      document.getElementById('gc-edit-id').value = '';
      document.getElementById('gc-form-title').textContent = 'Add New Catalog Game';
      document.getElementById('gc-title').value = '';
      document.getElementById('gc-title-fa').value = '';
      document.getElementById('gc-title-en').value = '';
      document.getElementById('gc-category').value = 'SPORTS';
      document.getElementById('gc-cover-url').value = '';
      document.getElementById('gc-aliases').value = '';
      document.getElementById('gc-supports-online').checked = false;
    }

    async function saveCatalogGame() {
      var id = document.getElementById('gc-edit-id').value.trim();
      var title = document.getElementById('gc-title').value.trim();
      if (!title) { alert('Title is required'); return; }
      var platforms = [];
      document.querySelectorAll('.gc-platform-cb:checked').forEach(function(cb) { platforms.push(cb.value); });
      var payload = {
        title: title,
        titleFa: document.getElementById('gc-title-fa').value.trim() || null,
        titleEn: document.getElementById('gc-title-en').value.trim() || null,
        category: document.getElementById('gc-category').value,
        coverImageUrl: document.getElementById('gc-cover-url').value.trim() || undefined,
        aliases: document.getElementById('gc-aliases').value.trim(),
        supportedPlatforms: platforms.length ? platforms : ['PC'],
        supportsOnline: document.getElementById('gc-supports-online').checked
      };
      var url = id ? '/api/v1/platform-admin/catalog/games/' + id : '/api/v1/platform-admin/catalog/games';
      var res = await fetch(url, {
        method: id ? 'PATCH' : 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, headers()),
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        var err = await res.json().catch(function() { return {}; });
        alert(err.message || 'Failed to save game');
        return;
      }
      resetGameForm();
      loadCatalogGames();
      showToast('Game saved to catalog.');
    }

    async function checkDuplicateGames() {
      var box = document.getElementById('gc-duplicates-box');
      var res = await fetch('/api/v1/platform-admin/catalog/games/duplicates', { headers: headers() });
      var json = await res.json();
      var groups = json.data || [];
      box.style.display = 'block';
      if (!Array.isArray(groups) || groups.length === 0) {
        box.innerHTML = '<span style="color:var(--success);">No duplicate games detected.</span>';
        return;
      }
      box.innerHTML = '<strong>Potential Duplicates (' + groups.length + '):</strong>' + groups.map(function(grp) {
        var target = grp.games[0];
        var sourceIds = grp.games.slice(1).map(function(x) { return x.id; });
        return '<div style="margin-top:8px; display:flex; justify-content:space-between; align-items:center;">' +
          '<span>' + grp.games.map(function(x) { return escapeHtml(x.title) + ' (' + escapeHtml(x.id) + ')'; }).join(' | ') + '</span>' +
          '<button class="btn btn-warning btn-sm" onclick="mergeDuplicateGroup(\\'' + escapeJsArg(target.id) + '\\', \\'' + escapeJsArg(sourceIds.join(',')) + '\\')">Merge into ' + escapeHtml(target.title) + '</button>' +
        '</div>';
      }).join('');
    }

    async function mergeDuplicateGroup(targetId, sourceCsv) {
      if (!confirm('Merge duplicate game entries into target game?')) return;
      var res = await fetch('/api/v1/platform-admin/catalog/games/merge', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, headers()),
        body: JSON.stringify({ targetGameId: targetId, sourceGameIds: sourceCsv.split(','), deactivateSources: true })
      });
      if (res.ok) {
        showToast('Duplicate games merged.');
        checkDuplicateGames();
        loadCatalogGames();
      }
    }

    async function deleteCatalogGame(id) {
      if (!confirm('Delete this game from catalog?')) return;
      var res = await fetch('/api/v1/platform-admin/catalog/games/' + id, {
        method: 'DELETE',
        headers: headers()
      });
      if (res.ok) loadCatalogGames();
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
            '<td style="direction:ltr; font-size:12px;">' + escapeHtml(new Date(l.createdAt).toLocaleString()) + '</td>' +
            '<td><strong>' + escapeHtml(actor) + '</strong></td>' +
            '<td><code style="direction:ltr;">' + escapeHtml(l.action) + '</code></td>' +
            '<td>' + escapeHtml(l.entity) + '</td>' +
            '<td><code style="direction:ltr;">' + escapeHtml(l.entityId) + '</code></td>' +
            '<td>' + escapeHtml(centerName) + '</td>' +
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

    async function loadSecuritySettings() {
      try {
        var [statusRes, sessRes] = await Promise.all([
          fetch('/api/v1/auth/platform-admin/2fa/status', { headers: headers() }),
          fetch('/api/v1/auth/platform-admin/sessions', { headers: headers() })
        ]);
        var statusData = (await statusRes.json()).data || {};
        var sessData = (await sessRes.json()).data || {};

        document.getElementById('sec-totp-status').innerHTML = statusData.totpEnabled
          ? '<span class="badge badge-success">ACTIVE (TOTP Mandatory)</span>'
          : '<span class="badge badge-danger">DISABLED</span>';
        document.getElementById('sec-totp-enabled-at').textContent = statusData.totpEnabledAt
          ? new Date(statusData.totpEnabledAt).toLocaleString()
          : '-';
        document.getElementById('sec-recovery-remaining').textContent = statusData.recoveryCodesRemaining != null
          ? statusData.recoveryCodesRemaining + ' / 10'
          : '-';
        document.getElementById('sec-active-sessions').textContent = statusData.activeSessionsCount != null
          ? statusData.activeSessionsCount
          : '-';

        var devices = statusData.devices || [];
        var devBody = document.getElementById('sec-devices-body');
        if (!devices.length) {
          devBody.innerHTML = '<tr><td colspan="6">No active authenticator devices enrolled.</td></tr>';
        } else {
          devBody.innerHTML = devices.map(function(d) {
            return '<tr>' +
              '<td><strong>' + escapeHtml(d.label) + '</strong></td>' +
              '<td>' + escapeHtml(d.issuer) + '</td>' +
              '<td>' + (d.isPrimary ? '<span class="badge badge-primary">Primary</span>' : '<span class="badge badge-info">Secondary</span>') + '</td>' +
              '<td style="direction:ltr; font-size:12px;">' + escapeHtml(d.verifiedAt ? new Date(d.verifiedAt).toLocaleString() : '-') + '</td>' +
              '<td style="direction:ltr; font-size:12px;">' + escapeHtml(d.lastUsedAt ? new Date(d.lastUsedAt).toLocaleString() : '-') + '</td>' +
              '<td>' + (devices.length > 1 ? '<button class="btn btn-danger btn-sm" onclick="openSecurityActionModal(\\'REMOVE_DEVICE\\', \\'' + escapeJsArg(d.id) + '\\')">حذف</button>' : '<span style="color:var(--text-muted); font-size:12px;">Primary Locked</span>') + '</td>' +
            '</tr>';
          }).join('');
        }

        var sessions = sessData.sessions || [];
        var sessBody = document.getElementById('sec-sessions-body');
        if (!sessions.length) {
          sessBody.innerHTML = '<tr><td colspan="6">No active sessions.</td></tr>';
        } else {
          sessBody.innerHTML = sessions.map(function(s) {
            return '<tr>' +
              '<td><code>' + escapeHtml(s.id) + '</code>' + (s.isCurrent ? ' <span class="badge badge-success">Current</span>' : '') + '</td>' +
              '<td style="direction:ltr;">' + escapeHtml(s.ipAddress || '-') + '</td>' +
              '<td style="max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + escapeHtml(s.userAgent || '-') + '</td>' +
              '<td><span class="badge badge-success">' + (s.mfaVerifiedAt ? 'TOTP Verified' : 'No') + '</span></td>' +
              '<td style="direction:ltr; font-size:12px;">' + escapeHtml(s.lastUsedAt ? new Date(s.lastUsedAt).toLocaleString() : '-') + '</td>' +
              '<td style="direction:ltr; font-size:12px;">' + escapeHtml(new Date(s.expiresAt).toLocaleString()) + '</td>' +
            '</tr>';
          }).join('');
        }
      } catch (e) { console.error(e); }
    }

    function openSecurityActionModal(action, deviceId) {
      securityActionState = { action: action, deviceId: deviceId || null, pendingDeviceId: null, mode: null };
      document.getElementById('secModalError').style.display = 'none';
      document.getElementById('secReauthForm').style.display = 'block';
      document.getElementById('secQrConfirmBox').style.display = 'none';
      document.getElementById('secRecoveryResultBox').style.display = 'none';
      document.getElementById('secCurrentPassword').value = '';
      document.getElementById('secCurrentTotp').value = '';
      document.getElementById('secDeviceLabel').value = '';
      document.getElementById('secLabelGroup').style.display = (action === 'ADD_DEVICE' || action === 'REPLACE_DEVICE') ? 'block' : 'none';

      var titles = {
        ADD_DEVICE: 'اتصال Authenticator جدید',
        REPLACE_DEVICE: 'جایگزینی دستگاه Authenticator',
        REGEN_RECOVERY: 'تولید مجدد کدهای بازیابی',
        DISABLE_2FA: 'غیرفعالسازی احراز هویت دو مرحله‌ای',
        REMOVE_DEVICE: 'حذف دستگاه Authenticator'
      };
      document.getElementById('secModalTitle').textContent = titles[action] || 'Security Action';
      document.getElementById('securityModal').style.display = 'flex';
    }

    function closeSecurityModal() {
      document.getElementById('securityModal').style.display = 'none';
    }

    async function submitSecurityReauth(e) {
      e.preventDefault();
      var errEl = document.getElementById('secModalError');
      errEl.style.display = 'none';
      var currentPassword = document.getElementById('secCurrentPassword').value;
      var code = document.getElementById('secCurrentTotp').value.trim();
      var label = document.getElementById('secDeviceLabel').value.trim();

      try {
        if (securityActionState.action === 'ADD_DEVICE' || securityActionState.action === 'REPLACE_DEVICE') {
          var mode = securityActionState.action === 'REPLACE_DEVICE' ? 'REPLACE' : 'ADD';
          var res = await fetch('/api/v1/auth/platform-admin/2fa/setup', {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({ currentPassword: currentPassword, currentTotpCode: code, mode: mode, label: label || undefined })
          });
          var json = await res.json();
          if (!res.ok) throw new Error((json.error && json.error.message) || json.message || 'Verification failed');
          securityActionState.pendingDeviceId = json.data.deviceId;
          securityActionState.mode = mode;
          document.getElementById('secNewQrImg').src = json.data.qrCodeDataUrl;
          document.getElementById('secNewManualKey').value = json.data.manualEntryKey;
          document.getElementById('secNewDeviceCode').value = '';
          document.getElementById('secReauthForm').style.display = 'none';
          document.getElementById('secQrConfirmBox').style.display = 'block';
        } else if (securityActionState.action === 'REGEN_RECOVERY') {
          var regenRes = await fetch('/api/v1/auth/platform-admin/2fa/recovery-codes/regenerate', {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({ currentPassword: currentPassword, code: code })
          });
          var regenJson = await regenRes.json();
          if (!regenRes.ok) throw new Error((regenJson.error && regenJson.error.message) || regenJson.message || 'Failed');
          document.getElementById('secRecoveryCodesPre').textContent = (regenJson.data.recoveryCodes || []).join('\\n');
          document.getElementById('secReauthForm').style.display = 'none';
          document.getElementById('secRecoveryResultBox').style.display = 'block';
          loadSecuritySettings();
        } else if (securityActionState.action === 'DISABLE_2FA') {
          var disRes = await fetch('/api/v1/auth/platform-admin/2fa/disable', {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({ currentPassword: currentPassword, code: code })
          });
          var disJson = await disRes.json();
          if (!disRes.ok) throw new Error((disJson.error && disJson.error.message) || disJson.message || 'Failed');
          closeSecurityModal();
          localStorage.removeItem('platform_token');
          localStorage.removeItem('platform_refresh_token');
          token = null;
          refreshToken = null;
          showLoginModal('2FA غیرفعال شد و تمام نشست‌ها بسته شدند. در ورود بعدی راه‌اندازی مجدد الزامی است.');
        } else if (securityActionState.action === 'REMOVE_DEVICE') {
          var remRes = await fetch('/api/v1/auth/platform-admin/2fa/devices/' + securityActionState.deviceId, {
            method: 'DELETE',
            headers: headers(),
            body: JSON.stringify({ currentPassword: currentPassword, code: code })
          });
          var remJson = await remRes.json();
          if (!remRes.ok) throw new Error((remJson.error && remJson.error.message) || remJson.message || 'Failed');
          closeSecurityModal();
          showToast('Authenticator removed.');
          loadSecuritySettings();
        }
      } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
      }
    }

    async function submitConfirmNewDevice(e) {
      e.preventDefault();
      var errEl = document.getElementById('secModalError');
      errEl.style.display = 'none';
      try {
        var code = document.getElementById('secNewDeviceCode').value.trim();
        var res = await fetch('/api/v1/auth/platform-admin/2fa/confirm', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ deviceId: securityActionState.pendingDeviceId, code: code, mode: securityActionState.mode })
        });
        var json = await res.json();
        if (!res.ok) throw new Error((json.error && json.error.message) || json.message || 'Invalid code');
        closeSecurityModal();
        showToast('Authenticator updated successfully.');
        loadSecuritySettings();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
      }
    }

    async function revokeAllAdminSessions() {
      if (!confirm('همه نشست‌های فعال بسته شوند؟')) return;
      await fetch('/api/v1/auth/platform-admin/sessions/revoke-all', {
        method: 'POST',
        headers: headers()
      });
      localStorage.removeItem('platform_token');
      localStorage.removeItem('platform_refresh_token');
      token = null;
      refreshToken = null;
      showLoginModal('تمام نشست‌ها لغو شدند.');
    }

    async function logout() {
      try {
        if (token) {
          await fetch('/api/v1/auth/platform-admin/logout', { method: 'POST', headers: headers() });
        }
      } catch (e) { /* ignore */ }
      localStorage.removeItem('platform_token');
      localStorage.removeItem('platform_refresh_token');
      token = null;
      refreshToken = null;
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
