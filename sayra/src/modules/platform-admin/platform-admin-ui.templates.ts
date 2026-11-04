export const platformAdminDashboardTemplate = () => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PlayNest - Central Platform Administration</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: #151c2e;
      --card-sub-bg: #1e293b;
      --border: #232f48;
      --text: #e2e8f0;
      --text-muted: #94a3b8;
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --accent: #ef4444;
      --success: #10b981;
      --warning: #f59e0b;
      --info: #3b82f6;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background-color: var(--bg); color: var(--text); min-height: 100vh; display: flex; flex-direction: column; overflow-x: hidden; }

    .super-badge {
      background: linear-gradient(90deg, #b91c1c, #dc2626);
      color: white;
      text-align: center;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      box-shadow: 0 2px 10px rgba(220, 38, 38, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }

    header {
      background: var(--card-bg);
      border-bottom: 1px solid var(--border);
      padding: 14px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 40;
    }
    .brand { font-size: 18px; font-weight: 800; display: flex; align-items: center; gap: 12px; }
    .brand i { color: var(--primary); }
    .header-actions { display: flex; gap: 12px; align-items: center; }

    .admin-layout {
      display: flex;
      flex: 1;
      min-height: calc(100vh - 100px);
    }

    /* Sidebar Navigation */
    .sidebar {
      width: 260px;
      background: var(--card-bg);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }
    .nav-menu {
      padding: 16px 12px;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-radius: 6px;
      color: var(--text-muted);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .nav-item:hover {
      background: var(--card-sub-bg);
      color: white;
    }
    .nav-item.active {
      background: var(--primary);
      color: white;
    }
    .nav-item i {
      width: 18px;
      text-align: center;
    }

    /* Main Container */
    .content-area {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
      max-width: 1600px;
    }
    .breadcrumb {
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
    }
    .page-title {
      font-size: 22px;
      font-weight: 700;
      color: white;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .kpi-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 20px;
      position: relative;
    }
    .kpi-card .title {
      font-size: 12px;
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .kpi-card .val {
      font-size: 26px;
      font-weight: 700;
      color: white;
    }
    .kpi-card .sub {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 6px;
    }

    /* Cards and Tables */
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .table-responsive {
      overflow-x: auto;
      margin-top: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
      text-align: left;
    }
    th {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      color: var(--text-muted);
      font-weight: 600;
      background: rgba(255, 255, 255, 0.02);
    }
    td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      color: var(--text);
    }
    tr:last-child td { border-bottom: none; }
    tbody tr:hover {
      background: rgba(255, 255, 255, 0.015);
    }

    /* Badges */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge-success { background: rgba(16, 185, 129, 0.15); color: var(--success); }
    .badge-danger { background: rgba(239, 68, 68, 0.15); color: var(--accent); }
    .badge-primary { background: rgba(99, 102, 241, 0.15); color: var(--primary); }
    .badge-warning { background: rgba(245, 158, 11, 0.15); color: var(--warning); }
    .badge-info { background: rgba(59, 130, 246, 0.15); color: var(--info); }

    /* Buttons */
    .btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
    }
    .btn-primary { background: var(--primary); color: white; }
    .btn-primary:hover { background: var(--primary-hover); }
    .btn-secondary { background: var(--card-sub-bg); color: var(--text); border-color: var(--border); }
    .btn-secondary:hover { background: #334155; }
    .btn-danger { background: var(--accent); color: white; }
    .btn-danger:hover { background: #dc2626; }
    .btn-success { background: var(--success); color: white; }
    .btn-success:hover { background: #059669; }
    .btn-sm { padding: 4px 10px; font-size: 12px; }

    /* Filter Toolbar */
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;
      padding: 12px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border);
      border-radius: 6px;
    }
    .form-control {
      background: var(--bg);
      border: 1px solid var(--border);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 13px;
      outline: none;
    }
    .form-control:focus {
      border-color: var(--primary);
    }

    /* Modal */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 16px;
    }
    .modal-content {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      width: 100%;
      max-width: 600px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    }
    .modal-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .modal-title { font-size: 16px; font-weight: 700; color: white; }
    .modal-close { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 18px; }
    .modal-body { padding: 20px; }
    .modal-footer {
      padding: 16px 20px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    /* Form Fields */
    .form-group {
      margin-bottom: 16px;
    }
    .form-group label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 6px;
      color: var(--text-muted);
    }
    .form-group input, .form-group select, .form-group textarea {
      width: 100%;
      background: var(--bg);
      border: 1px solid var(--border);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 14px;
      outline: none;
    }
    .form-group textarea { resize: vertical; min-height: 80px; }

    /* Alert Boxes */
    .alert {
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 13px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .alert-info { background: rgba(59, 130, 246, 0.15); border: 1px solid var(--info); color: #93c5fd; }
    .alert-warning { background: rgba(245, 158, 11, 0.15); border: 1px solid var(--warning); color: #fde68a; }
    .alert-danger { background: rgba(239, 68, 68, 0.15); border: 1px solid var(--accent); color: #fca5a5; }

    /* Pagination */
    .pagination {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 16px;
      font-size: 13px;
      color: var(--text-muted);
    }
    .pagination-actions { display: flex; gap: 8px; }

    /* Empty and Loading States */
    .loading-state, .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: var(--text-muted);
    }
    .loading-state i, .empty-state i {
      font-size: 32px;
      margin-bottom: 12px;
      display: block;
    }

    /* Toast Notification */
    #toast-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 200;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .toast {
      background: var(--card-sub-bg);
      border: 1px solid var(--border);
      color: white;
      padding: 12px 18px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      min-width: 250px;
      animation: slideIn 0.3s ease;
    }
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    @media (max-width: 900px) {
      .admin-layout { flex-direction: column; }
      .sidebar { width: 100%; border-right: none; border-bottom: 1px solid var(--border); }
      .nav-menu { flex-direction: row; overflow-x: auto; padding: 8px; }
      .nav-item { white-space: nowrap; font-size: 12px; }
    }
  </style>
</head>
<body>
  <div class="super-badge">
    <i class="fa-solid fa-shield-halved"></i> PLAYNEST PLATFORM SUPERUSER — GLOBAL PLATFORM ADMINISTRATION
  </div>

  <header>
    <div class="brand">
      <i class="fa-solid fa-gamepad"></i> PlayNest Central Console
    </div>
    <div class="header-actions">
      <span id="current-admin-name" style="font-size: 13px; color: var(--text-muted);">Admin</span>
      <button class="btn btn-secondary btn-sm" onclick="showAuthModal()"><i class="fa-solid fa-key"></i> Session</button>
      <button class="btn btn-danger btn-sm" onclick="logout()"><i class="fa-solid fa-right-from-bracket"></i> Logout</button>
    </div>
  </header>

  <div class="admin-layout">
    <!-- Sidebar Navigation: All 10 Modules -->
    <aside class="sidebar">
      <ul class="nav-menu">
        <li><a class="nav-item active" onclick="navigate('dashboard')"><i class="fa-solid fa-gauge"></i> 1. Dashboard</a></li>
        <li><a class="nav-item" onclick="navigate('users')"><i class="fa-solid fa-users"></i> 2. Users</a></li>
        <li><a class="nav-item" onclick="navigate('centers')"><i class="fa-solid fa-building"></i> 3. Gaming Centers</a></li>
        <li><a class="nav-item" onclick="navigate('reservations')"><i class="fa-solid fa-calendar-check"></i> 4. Reservations</a></li>
        <li><a class="nav-item" onclick="navigate('verifications')"><i class="fa-solid fa-id-card"></i> 5. Verification</a></li>
        <li><a class="nav-item" onclick="navigate('ads')"><i class="fa-solid fa-rectangle-ad"></i> 6. Advertisements</a></li>
        <li><a class="nav-item" onclick="navigate('campaigns')"><i class="fa-solid fa-bullhorn"></i> 7. Campaigns</a></li>
        <li><a class="nav-item" onclick="navigate('settings')"><i class="fa-solid fa-sliders"></i> 8. Settings</a></li>
        <li><a class="nav-item" onclick="navigate('blog')"><i class="fa-solid fa-newspaper"></i> 9. Blog</a></li>
        <li><a class="nav-item" onclick="navigate('analytics')"><i class="fa-solid fa-chart-line"></i> 10. Analytics</a></li>
        <li><a class="nav-item" onclick="navigate('audit')"><i class="fa-solid fa-list-check"></i> Audit Logs</a></li>
      </ul>
    </aside>

    <!-- Main Content Area -->
    <main class="content-area">
      <div id="breadcrumb" class="breadcrumb">
        <span>Platform Admin</span> <i class="fa-solid fa-chevron-right" style="font-size: 10px;"></i> <span id="breadcrumb-active">Dashboard</span>
      </div>

      <!-- 1. DASHBOARD MODULE -->
      <section id="module-dashboard">
        <div class="page-header">
          <div class="page-title"><i class="fa-solid fa-gauge"></i> Global Operational Overview</div>
          <button class="btn btn-secondary btn-sm" onclick="loadDashboard()"><i class="fa-solid fa-rotate"></i> Refresh</button>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="title">Total Gaming Centers</div>
            <div class="val" id="dash-total-centers">-</div>
            <div class="sub" id="dash-active-centers">Active: -</div>
          </div>
          <div class="kpi-card">
            <div class="title">Total Stations</div>
            <div class="val" id="dash-total-stations">-</div>
            <div class="sub">Across all registered centers</div>
          </div>
          <div class="kpi-card">
            <div class="title">Total Reservations</div>
            <div class="val" id="dash-total-reservations">-</div>
            <div class="sub" id="dash-today-reservations">Aggregated lifetime</div>
          </div>
          <div class="kpi-card">
            <div class="title">Gross Payments (IRR)</div>
            <div class="val" id="dash-total-gmv">-</div>
            <div class="sub" id="dash-platform-cut">Platform Commission: -</div>
          </div>
        </div>

        <div class="card">
          <div style="font-weight: 700; margin-bottom: 12px; display: flex; justify-content: space-between;">
            <span><i class="fa-solid fa-bolt"></i> Recent Platform Activity</span>
            <span class="badge badge-info">Real-time Feed</span>
          </div>
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody id="dash-activity-tbody">
                <tr><td colspan="5" class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading recent activity...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- 2. USERS MANAGEMENT MODULE -->
      <section id="module-users" style="display: none;">
        <div class="page-header">
          <div class="page-title"><i class="fa-solid fa-users"></i> Users Management</div>
          <button class="btn btn-primary btn-sm" onclick="openCreateUserModal()"><i class="fa-solid fa-user-plus"></i> Create User</button>
        </div>

        <div class="toolbar">
          <input type="text" id="users-search" class="form-control" placeholder="Search by name, phone, email..." style="width: 250px;">
          <select id="users-role" class="form-control" style="width: 140px;">
            <option value="">All Roles</option>
            <option value="ADMIN">ADMIN</option>
            <option value="MANAGER">MANAGER</option>
            <option value="STAFF">STAFF</option>
            <option value="RECEPTIONIST">RECEPTIONIST</option>
          </select>
          <select id="users-status" class="form-control" style="width: 130px;">
            <option value="">All Statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <button class="btn btn-secondary btn-sm" onclick="loadUsers()"><i class="fa-solid fa-filter"></i> Filter</button>
        </div>

        <div class="card">
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Phone / Email</th>
                  <th>Role</th>
                  <th>Center</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="users-tbody">
                <tr><td colspan="6" class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading users...</td></tr>
              </tbody>
            </table>
          </div>
          <div class="pagination">
            <span id="users-page-info">Page 1 of 1</span>
            <div class="pagination-actions">
              <button class="btn btn-secondary btn-sm" id="users-prev-btn" onclick="prevUsersPage()"><i class="fa-solid fa-angle-left"></i> Prev</button>
              <button class="btn btn-secondary btn-sm" id="users-next-btn" onclick="nextUsersPage()">Next <i class="fa-solid fa-angle-right"></i></button>
            </div>
          </div>
        </div>
      </section>

      <!-- 3. GAMING CENTERS MANAGEMENT MODULE -->
      <section id="module-centers" style="display: none;">
        <div class="page-header">
          <div class="page-title"><i class="fa-solid fa-building"></i> Gaming Centers Management</div>
        </div>

        <div class="toolbar">
          <input type="text" id="centers-search" class="form-control" placeholder="Search by name, slug, city..." style="width: 250px;">
          <button class="btn btn-secondary btn-sm" onclick="loadGamingCenters()"><i class="fa-solid fa-magnifying-glass"></i> Search</button>
        </div>

        <div class="card">
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Center Name</th>
                  <th>Slug</th>
                  <th>City</th>
                  <th>Stations</th>
                  <th>Users</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="centers-tbody">
                <tr><td colspan="7" class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading centers...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- 4. RESERVATIONS MANAGEMENT MODULE -->
      <section id="module-reservations" style="display: none;">
        <div class="page-header">
          <div class="page-title"><i class="fa-solid fa-calendar-check"></i> Platform Reservations Management</div>
        </div>

        <div class="alert alert-info">
          <i class="fa-solid fa-circle-info"></i>
          <div>
            <strong>Backend Integration Notice:</strong> The global aggregated endpoint <code>GET /platform-admin/reservations</code> is scheduled for backend deployment. The complete query interface, status filters, and table schema below are pre-wired and ready for real-time aggregation.
          </div>
        </div>

        <div class="toolbar">
          <input type="text" id="res-search" class="form-control" placeholder="Search customer phone, code..." style="width: 220px;">
          <select id="res-status" class="form-control" style="width: 140px;">
            <option value="">All Statuses</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELED">CANCELED</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
          </select>
          <input type="date" id="res-start" class="form-control" style="width: 140px;">
          <input type="date" id="res-end" class="form-control" style="width: 140px;">
          <button class="btn btn-secondary btn-sm" onclick="loadReservations()"><i class="fa-solid fa-filter"></i> Apply</button>
        </div>

        <div class="card">
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Booking Code</th>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Gaming Center</th>
                  <th>Time Slot</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody id="reservations-tbody">
                <tr><td colspan="8" class="empty-state"><i class="fa-solid fa-folder-open"></i> Awaiting Backend Aggregated Reservation API (GET /platform-admin/reservations). No mock data displayed.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- 5. OWNER VERIFICATION MODULE -->
      <section id="module-verifications" style="display: none;">
        <div class="page-header">
          <div class="page-title"><i class="fa-solid fa-id-card"></i> Owner KYC & Center Verification</div>
          <button class="btn btn-secondary btn-sm" onclick="loadVerifications()"><i class="fa-solid fa-rotate"></i> Refresh</button>
        </div>

        <div class="card">
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Gaming Center</th>
                  <th>City</th>
                  <th>Requested At</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="verifications-tbody">
                <tr><td colspan="6" class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading verification requests...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- 6. ADVERTISEMENTS MANAGEMENT MODULE -->
      <section id="module-ads" style="display: none;">
        <div class="page-header">
          <div class="page-title"><i class="fa-solid fa-rectangle-ad"></i> Advertisements Management</div>
          <button class="btn btn-secondary btn-sm" onclick="loadAdRequests()"><i class="fa-solid fa-rotate"></i> Refresh</button>
        </div>

        <div class="toolbar">
          <select id="ad-status-filter" class="form-control" onchange="loadAdRequests()" style="width: 150px;">
            <option value="">All Statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="EXPIRED">EXPIRED</option>
          </select>
        </div>

        <div class="card">
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Gaming Center</th>
                  <th>Duration</th>
                  <th>Dates</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="ads-tbody">
                <tr><td colspan="6" class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading ad requests...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- 7. CAMPAIGNS MANAGEMENT MODULE -->
      <section id="module-campaigns" style="display: none;">
        <div class="page-header">
          <div class="page-title"><i class="fa-solid fa-bullhorn"></i> Global Campaigns & Discounts</div>
          <button class="btn btn-primary btn-sm" onclick="openCreateCampaignModal()"><i class="fa-solid fa-plus"></i> New Campaign</button>
        </div>

        <div class="card">
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Scope</th>
                  <th>Validity</th>
                  <th>Used / Limit</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="campaigns-tbody">
                <tr><td colspan="8" class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading campaigns...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- 8. PLATFORM SETTINGS MODULE -->
      <section id="module-settings" style="display: none;">
        <div class="page-header">
          <div class="page-title"><i class="fa-solid fa-sliders"></i> Global Platform Settings</div>
          <button class="btn btn-success btn-sm" onclick="saveSettings()"><i class="fa-solid fa-floppy-disk"></i> Save Changes</button>
        </div>

        <div class="card">
          <h3 style="font-size: 15px; margin-bottom: 16px; color: white;"><i class="fa-solid fa-gear"></i> General & Support Configuration</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;">
            <div class="form-group">
              <label>Site Title</label>
              <input type="text" id="setting-siteTitle" class="form-control">
            </div>
            <div class="form-group">
              <label>Support Phone</label>
              <input type="text" id="setting-supportPhone" class="form-control">
            </div>
            <div class="form-group">
              <label>Support Email</label>
              <input type="email" id="setting-supportEmail" class="form-control">
            </div>
            <div class="form-group">
              <label>Central Headquarters Address</label>
              <input type="text" id="setting-centralAddress" class="form-control">
            </div>
          </div>
        </div>

        <div class="card">
          <h3 style="font-size: 15px; margin-bottom: 16px; color: white;"><i class="fa-solid fa-coins"></i> Financial & Reservation Rules</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;">
            <div class="form-group">
              <label>Platform Commission (%)</label>
              <input type="number" id="setting-platformCommissionPercent" class="form-control" min="0" max="100">
            </div>
            <div class="form-group">
              <label>Max Advance Booking Days</label>
              <input type="number" id="setting-maxAdvanceBookingDays" class="form-control" min="1">
            </div>
            <div class="form-group">
              <label>Payment Timeout (Minutes)</label>
              <input type="number" id="setting-onlinePaymentTimeoutMinutes" class="form-control" min="1">
            </div>
            <div class="form-group">
              <label>Cancellation Penalty (%)</label>
              <input type="number" id="setting-cancellationPenaltyPercent" class="form-control" min="0" max="100">
            </div>
            <div class="form-group">
              <label>Free Cancellation Window (Hours)</label>
              <input type="number" id="setting-freeCancellationHours" class="form-control" min="0">
            </div>
          </div>
        </div>

        <div class="card">
          <h3 style="font-size: 15px; margin-bottom: 16px; color: white;"><i class="fa-solid fa-wrench"></i> Maintenance Mode</h3>
          <div class="form-group">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" id="setting-maintenanceMode" style="width: auto;">
              <span>Activate Platform Maintenance Mode</span>
            </label>
          </div>
          <div class="form-group">
            <label>Maintenance Message to Users</label>
            <textarea id="setting-maintenanceMessage" class="form-control" placeholder="Platform is currently under scheduled maintenance..."></textarea>
          </div>
        </div>
      </section>

      <!-- 9. BLOG MANAGEMENT MODULE -->
      <section id="module-blog" style="display: none;">
        <div class="page-header">
          <div class="page-title"><i class="fa-solid fa-newspaper"></i> Platform Blog & Articles</div>
        </div>

        <div class="alert alert-info">
          <i class="fa-solid fa-circle-info"></i>
          <div>
            <strong>Backend Architecture Note:</strong> Multi-tenant blog management is tenant-isolated. Platform-wide superuser global article API <code>GET /platform-admin/blog/posts</code> is pending dedicated backend endpoint integration.
          </div>
        </div>

        <div class="card">
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Author</th>
                  <th>Published Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="blog-tbody">
                <tr><td colspan="6" class="empty-state"><i class="fa-solid fa-file-pen"></i> Awaiting Backend Aggregated Blog API (GET /platform-admin/blog/posts). No mock data displayed.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- 10. ANALYTICS & REPORTS MODULE -->
      <section id="module-analytics" style="display: none;">
        <div class="page-header">
          <div class="page-title"><i class="fa-solid fa-chart-line"></i> Analytics & Business Intelligence</div>
          <button class="btn btn-secondary btn-sm" onclick="loadAnalytics()"><i class="fa-solid fa-rotate"></i> Refresh</button>
        </div>

        <div class="toolbar">
          <input type="date" id="analytics-start" class="form-control" style="width: 140px;">
          <input type="date" id="analytics-end" class="form-control" style="width: 140px;">
          <input type="text" id="analytics-city" class="form-control" placeholder="Filter by city..." style="width: 150px;">
          <button class="btn btn-secondary btn-sm" onclick="loadAnalytics()"><i class="fa-solid fa-filter"></i> Apply</button>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="title">Total Revenue (Recognized)</div>
            <div class="val" id="an-total-revenue">-</div>
            <div class="sub" id="an-net-revenue">Net Revenue: -</div>
          </div>
          <div class="kpi-card">
            <div class="title">Platform Commission Cut</div>
            <div class="val" id="an-platform-commission">-</div>
            <div class="sub" id="an-centers-payout">Gaming Centers Payout: -</div>
          </div>
          <div class="kpi-card">
            <div class="title">Completed Reservations</div>
            <div class="val" id="an-completed-res">-</div>
            <div class="sub" id="an-cancellation-rate">Cancellation Rate: -</div>
          </div>
          <div class="kpi-card">
            <div class="title">New Customer Registrations</div>
            <div class="val" id="an-new-users">-</div>
            <div class="sub" id="an-active-users">Active Users: -</div>
          </div>
        </div>
      </section>

      <!-- AUDIT LOGS MODULE -->
      <section id="module-audit" style="display: none;">
        <div class="page-header">
          <div class="page-title"><i class="fa-solid fa-list-check"></i> System Audit Logs</div>
          <button class="btn btn-secondary btn-sm" onclick="loadAudit()"><i class="fa-solid fa-rotate"></i> Refresh</button>
        </div>

        <div class="card">
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Entity ID</th>
                  <th>Center</th>
                </tr>
              </thead>
              <tbody id="audit-tbody">
                <tr><td colspan="6" class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading audit logs...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  </div>

  <!-- AUTHENTICATION / TOKEN MODAL -->
  <div id="modal-auth" class="modal-backdrop">
    <div class="modal-content" style="max-width: 440px;">
      <div class="modal-header">
        <h3 class="modal-title"><i class="fa-solid fa-shield-halved"></i> Administrator Authentication</h3>
        <button class="modal-close" onclick="closeAuthModal()">&times;</button>
      </div>
      <div class="modal-body">
        <div id="auth-alert" style="display: none;" class="alert alert-danger"></div>
        <div class="form-group">
          <label>Platform Admin Phone</label>
          <input type="text" id="auth-phone" class="form-control" placeholder="0912...">
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" id="auth-password" class="form-control" placeholder="••••••••">
        </div>
        <div style="text-align: center; margin: 12px 0; font-size: 12px; color: var(--text-muted);">— OR PASTE BEARER TOKEN —</div>
        <div class="form-group">
          <label>Access Token</label>
          <input type="text" id="auth-token-direct" class="form-control" placeholder="eyJhbGciOiJIUzI1NiIs...">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeAuthModal()">Cancel</button>
        <button class="btn btn-primary" onclick="performLogin()">Authenticate</button>
      </div>
    </div>
  </div>

  <!-- CREATE USER MODAL -->
  <div id="modal-create-user" class="modal-backdrop">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title"><i class="fa-solid fa-user-plus"></i> Create Platform User</h3>
        <button class="modal-close" onclick="closeModal('modal-create-user')">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Gaming Center ID</label>
          <input type="text" id="user-new-center" class="form-control" required placeholder="gc_...">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label>First Name</label>
            <input type="text" id="user-new-first" class="form-control" required>
          </div>
          <div class="form-group">
            <label>Last Name</label>
            <input type="text" id="user-new-last" class="form-control" required>
          </div>
        </div>
        <div class="form-group">
          <label>Phone Number</label>
          <input type="text" id="user-new-phone" class="form-control" required placeholder="0912...">
        </div>
        <div class="form-group">
          <label>Email (Optional)</label>
          <input type="email" id="user-new-email" class="form-control">
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" id="user-new-pass" class="form-control" required placeholder="Minimum 6 characters">
        </div>
        <div class="form-group">
          <label>Role</label>
          <select id="user-new-role" class="form-control">
            <option value="MANAGER">MANAGER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modal-create-user')">Cancel</button>
        <button class="btn btn-primary" onclick="submitCreateUser()">Create User</button>
      </div>
    </div>
  </div>

  <!-- CREATE CAMPAIGN MODAL -->
  <div id="modal-create-campaign" class="modal-backdrop">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title"><i class="fa-solid fa-plus"></i> Create Platform Campaign</h3>
        <button class="modal-close" onclick="closeModal('modal-create-campaign')">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Campaign Title</label>
          <input type="text" id="camp-title" class="form-control" placeholder="Summer Gaming Fest">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label>Discount Code</label>
            <input type="text" id="camp-code" class="form-control" placeholder="SUMMER50">
          </div>
          <div class="form-group">
            <label>Discount Type</label>
            <select id="camp-type" class="form-control">
              <option value="PERCENTAGE">PERCENTAGE (%)</option>
              <option value="FIXED_AMOUNT">FIXED AMOUNT (IRR)</option>
            </select>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label>Discount Value</label>
            <input type="number" id="camp-val" class="form-control" min="1">
          </div>
          <div class="form-group">
            <label>Min Order Amount (IRR)</label>
            <input type="number" id="camp-min-order" class="form-control" value="0">
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label>Start Date</label>
            <input type="datetime-local" id="camp-start" class="form-control">
          </div>
          <div class="form-group">
            <label>End Date</label>
            <input type="datetime-local" id="camp-end" class="form-control">
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modal-create-campaign')">Cancel</button>
        <button class="btn btn-primary" onclick="submitCreateCampaign()">Save Campaign</button>
      </div>
    </div>
  </div>

  <div id="toast-container"></div>

  <script>
    // State & Standard API Client
    const state = {
      token: localStorage.getItem('playnest_platform_token') || '',
      currentModule: 'dashboard',
      usersPage: 1,
    };

    function notify(message, type = 'info') {
      const container = document.getElementById('toast-container');
      const toast = document.createElement('div');
      toast.className = 'toast';
      const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-info';
      toast.innerHTML = '<i class="fa-solid ' + icon + '"></i><span>' + message + '</span>';
      container.appendChild(toast);
      setTimeout(() => { toast.remove(); }, 4000);
    }

    async function apiRequest(endpoint, options = {}) {
      const headers = {
        'Content-Type': 'application/json',
        ...(state.token ? { 'Authorization': 'Bearer ' + state.token } : {}),
        ...(options.headers || {})
      };

      try {
        const response = await fetch(endpoint, { ...options, headers });

        if (response.status === 401 || response.status === 403) {
          showAuthModal();
          throw new Error('Authentication required (Status ' + response.status + ')');
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          if (!response.ok) {
            throw new Error('Server returned HTTP ' + response.status);
          }
          return { data: null };
        }

        const data = await response.json();
        if (!response.ok) {
          const errMsg = data?.error?.message || data?.message || 'Request failed with status ' + response.status;
          throw new Error(errMsg);
        }
        return data;
      } catch (err) {
        if (!err.message.includes('Authentication required')) {
          notify(err.message, 'error');
        }
        throw err;
      }
    }

    // Navigation
    function navigate(moduleName) {
      state.currentModule = moduleName;
      document.querySelectorAll('section[id^="module-"]').forEach(sec => sec.style.display = 'none');
      const targetSec = document.getElementById('module-' + moduleName);
      if (targetSec) targetSec.style.display = 'block';

      document.querySelectorAll('.nav-item').forEach(item => {
        const onclickAttr = item.getAttribute('onclick') || '';
        item.classList.toggle('active', onclickAttr.includes("'" + moduleName + "'"));
      });

      document.getElementById('breadcrumb-active').textContent = moduleName.toUpperCase();

      // Trigger module load
      if (moduleName === 'dashboard') loadDashboard();
      if (moduleName === 'users') loadUsers();
      if (moduleName === 'centers') loadGamingCenters();
      if (moduleName === 'reservations') loadReservations();
      if (moduleName === 'verifications') loadVerifications();
      if (moduleName === 'ads') loadAdRequests();
      if (moduleName === 'campaigns') loadCampaigns();
      if (moduleName === 'settings') loadSettings();
      if (moduleName === 'blog') loadBlog();
      if (moduleName === 'analytics') loadAnalytics();
      if (moduleName === 'audit') loadAudit();
    }

    // Authentication Handlers
    function showAuthModal() {
      document.getElementById('modal-auth').style.display = 'flex';
      document.getElementById('auth-token-direct').value = state.token;
    }
    function closeAuthModal() {
      document.getElementById('modal-auth').style.display = 'none';
    }
    function closeModal(id) {
      document.getElementById(id).style.display = 'none';
    }

    async function performLogin() {
      const directToken = document.getElementById('auth-token-direct').value.trim();
      const phone = document.getElementById('auth-phone').value.trim();
      const password = document.getElementById('auth-password').value;
      const alertBox = document.getElementById('auth-alert');

      if (directToken) {
        state.token = directToken.replace('Bearer ', '');
        localStorage.setItem('playnest_platform_token', state.token);
        closeAuthModal();
        notify('Session token configured', 'success');
        navigate(state.currentModule);
        return;
      }

      if (!phone || !password) {
        alertBox.textContent = 'Please enter phone and password or direct token';
        alertBox.style.display = 'block';
        return;
      }

      try {
        const res = await fetch('/api/v1/auth/platform-admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, password })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error?.message || 'Login failed');
        }
        state.token = data.data.tokens.accessToken;
        localStorage.setItem('playnest_platform_token', state.token);
        document.getElementById('current-admin-name').textContent = data.data.admin.fullName;
        closeAuthModal();
        notify('Welcome ' + data.data.admin.fullName, 'success');
        navigate(state.currentModule);
      } catch (err) {
        alertBox.textContent = err.message;
        alertBox.style.display = 'block';
      }
    }

    function logout() {
      state.token = '';
      localStorage.removeItem('playnest_platform_token');
      notify('Logged out', 'info');
      showAuthModal();
    }

    // 1. Dashboard Module
    async function loadDashboard() {
      try {
        const [ops, fin, centers, audit] = await Promise.all([
          apiRequest('/api/v1/platform-admin/operations/overview'),
          apiRequest('/api/v1/platform-admin/financials/overview'),
          apiRequest('/api/v1/platform-admin/gaming-centers?limit=100'),
          apiRequest('/api/v1/platform-admin/audit-logs?limit=10')
        ]);

        document.getElementById('dash-total-centers').textContent = ops.data?.totalCenters ?? 0;
        document.getElementById('dash-total-stations').textContent = ops.data?.totalStations ?? 0;
        document.getElementById('dash-total-reservations').textContent = ops.data?.totalReservations ?? 0;
        document.getElementById('dash-total-gmv').textContent = Number(fin.data?.totalCompletedAmount || 0).toLocaleString();
        document.getElementById('dash-platform-cut').textContent = 'Platform Commission: ' + Number(fin.data?.totalPlatformCommission || 0).toLocaleString() + ' IRR';

        const activeCount = (centers.data || []).filter(c => c.isActive !== false).length;
        document.getElementById('dash-active-centers').textContent = 'Active: ' + activeCount + ' / Inactive: ' + (centers.data.length - activeCount);

        const tbody = document.getElementById('dash-activity-tbody');
        tbody.innerHTML = (audit.data || []).map(l => \`
          <tr>
            <td>\${new Date(l.createdAt).toLocaleTimeString()}</td>
            <td><strong>\${l.platformAdmin?.fullName || l.user?.fullName || 'System'}</strong></td>
            <td><span class="badge badge-primary">\${l.action}</span></td>
            <td><code>\${l.entity}</code></td>
            <td>\${l.entityId}</td>
          </tr>
        \`).join('') || '<tr><td colspan="5" class="empty-state">No recent activity found</td></tr>';
      } catch (e) {
        console.error(e);
      }
    }

    // 2. Users Management Module
    async function loadUsers() {
      try {
        const search = document.getElementById('users-search').value.trim();
        const role = document.getElementById('users-role').value;
        const status = document.getElementById('users-status').value;
        const query = '?page=' + state.usersPage + '&limit=15' +
          (search ? '&search=' + encodeURIComponent(search) : '') +
          (role ? '&role=' + role : '') +
          (status ? '&isActive=' + status : '');

        const res = await apiRequest('/api/v1/platform-admin/users' + query);
        const users = res.data || [];
        const pagination = res.meta?.pagination || { page: 1, totalPages: 1 };

        document.getElementById('users-page-info').textContent = 'Page ' + pagination.page + ' of ' + (pagination.totalPages || 1);
        document.getElementById('users-prev-btn').disabled = pagination.page <= 1;
        document.getElementById('users-next-btn').disabled = pagination.page >= pagination.totalPages;

        const tbody = document.getElementById('users-tbody');
        tbody.innerHTML = users.map(u => \`
          <tr>
            <td><strong>\${u.fullName}</strong></td>
            <td>\${u.phone}<br><span style="font-size:12px;color:var(--text-muted)">\${u.email || '-'}</span></td>
            <td><span class="badge badge-primary">\${u.role}</span></td>
            <td>\${u.gamingCenter?.name || '-'}</td>
            <td><span class="badge \${u.isActive ? 'badge-success' : 'badge-danger'}">\${u.isActive ? 'ACTIVE' : 'DEACTIVATED'}</span></td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="toggleUserStatus('\${u.id}', \${!u.isActive})">\${u.isActive ? 'Deactivate' : 'Activate'}</button>
              <button class="btn btn-secondary btn-sm" onclick="resetUserPasswordPrompt('\${u.id}')">Reset Password</button>
              <button class="btn btn-danger btn-sm" onclick="revokeUserSessionsAction('\${u.id}')"><i class="fa-solid fa-ban"></i> Revoke</button>
            </td>
          </tr>
        \`).join('') || '<tr><td colspan="6" class="empty-state">No users matching criteria</td></tr>';
      } catch (e) {
        console.error(e);
      }
    }

    function prevUsersPage() { if (state.usersPage > 1) { state.usersPage--; loadUsers(); } }
    function nextUsersPage() { state.usersPage++; loadUsers(); }

    function openCreateUserModal() {
      document.getElementById('modal-create-user').style.display = 'flex';
    }
    async function submitCreateUser() {
      const payload = {
        gamingCenterId: document.getElementById('user-new-center').value.trim(),
        firstName: document.getElementById('user-new-first').value.trim(),
        lastName: document.getElementById('user-new-last').value.trim(),
        phone: document.getElementById('user-new-phone').value.trim(),
        email: document.getElementById('user-new-email').value.trim() || undefined,
        password: document.getElementById('user-new-pass').value,
        role: document.getElementById('user-new-role').value
      };
      await apiRequest('/api/v1/platform-admin/users', { method: 'POST', body: JSON.stringify(payload) });
      notify('User created successfully', 'success');
      closeModal('modal-create-user');
      loadUsers();
    }

    async function toggleUserStatus(userId, newStatus) {
      if (!confirm('Are you sure you want to change this user status?')) return;
      await apiRequest('/api/v1/platform-admin/users/' + userId + '/status', {
        method: 'PATCH',
        body: JSON.stringify({ isActive: newStatus })
      });
      notify('User status updated', 'success');
      loadUsers();
    }

    async function resetUserPasswordPrompt(userId) {
      const newPassword = prompt('Enter new password (min 6 characters):');
      if (!newPassword) return;
      await apiRequest('/api/v1/platform-admin/users/' + userId + '/reset-password', {
        method: 'POST',
        body: JSON.stringify({ newPassword })
      });
      notify('User password has been reset successfully', 'success');
    }

    async function revokeUserSessionsAction(userId) {
      if (!confirm('Revoke all active sessions for this user?')) return;
      await apiRequest('/api/v1/platform-admin/users/' + userId + '/revoke-sessions', { method: 'POST' });
      notify('Sessions revoked', 'success');
    }

    // 3. Gaming Centers Management
    async function loadGamingCenters() {
      const search = document.getElementById('centers-search').value.trim();
      const res = await apiRequest('/api/v1/platform-admin/gaming-centers' + (search ? '?search=' + encodeURIComponent(search) : ''));
      const tbody = document.getElementById('centers-tbody');
      tbody.innerHTML = (res.data || []).map(c => \`
        <tr>
          <td><strong>\${c.name}</strong></td>
          <td><code>\${c.slug}</code></td>
          <td>\${c.city || '-'}</td>
          <td>\${c._count?.stations || 0}</td>
          <td>\${c._count?.users || 0}</td>
          <td><span class="badge \${c.isActive !== false ? 'badge-success' : 'badge-danger'}">\${c.isActive !== false ? 'ACTIVE' : 'INACTIVE'}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="toggleCenterStatus('\${c.id}', \${c.isActive === false})">\${c.isActive === false ? 'Activate' : 'Deactivate'}</button>
          </td>
        </tr>
      \`).join('') || '<tr><td colspan="7" class="empty-state">No gaming centers found</td></tr>';
    }

    async function toggleCenterStatus(centerId, newActive) {
      await apiRequest('/api/v1/platform-admin/gaming-centers/' + centerId + '/status', {
        method: 'PATCH',
        body: JSON.stringify({ isActive: newActive })
      });
      notify('Gaming center status updated', 'success');
      loadGamingCenters();
    }

    // 4. Reservations Management
    async function loadReservations() {
      // Backend aggregate API check
      const tbody = document.getElementById('reservations-tbody');
      try {
        const res = await fetch('/api/v1/platform-admin/reservations', {
          headers: { 'Authorization': 'Bearer ' + state.token }
        });
        if (res.status === 404) {
          tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><i class="fa-solid fa-cloud-arrow-up"></i> Notice: Global aggregated reservations endpoint (GET /platform-admin/reservations) is pending backend route registration. No hardcoded mocks are shown.</td></tr>';
          return;
        }
        const data = await res.json();
        if (data.data && data.data.length > 0) {
          tbody.innerHTML = data.data.map(r => \`
            <tr>
              <td><code>\${r.id}</code></td>
              <td>\${r.customerName || '-'}</td>
              <td>\${r.customerPhone || '-'}</td>
              <td>\${r.gamingCenterName || '-'}</td>
              <td>\${new Date(r.startTime).toLocaleString()}</td>
              <td>\${Number(r.totalPrice || 0).toLocaleString()} IRR</td>
              <td><span class="badge badge-info">\${r.paymentState}</span></td>
              <td><span class="badge badge-primary">\${r.status}</span></td>
            </tr>
          \`).join('');
        }
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Backend API for platform reservations is not yet reachable.</td></tr>';
      }
    }

    // 5. Verification Management
    async function loadVerifications() {
      const res = await apiRequest('/api/v1/platform-admin/verifications');
      const tbody = document.getElementById('verifications-tbody');
      tbody.innerHTML = (res.data || []).map(v => \`
        <tr>
          <td><code>\${v.id}</code></td>
          <td><strong>\${v.gamingCenter?.name || '-'}</strong></td>
          <td>\${v.gamingCenter?.city || '-'}</td>
          <td>\${new Date(v.createdAt).toLocaleDateString()}</td>
          <td><span class="badge \${v.status === 'APPROVED' ? 'badge-success' : v.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}">\${v.status}</span></td>
          <td>
            \${v.status === 'PENDING' ? \`
              <button class="btn btn-success btn-sm" onclick="approveVerification('\${v.id}')"><i class="fa-solid fa-check"></i> Approve</button>
              <button class="btn btn-danger btn-sm" onclick="rejectVerification('\${v.id}')"><i class="fa-solid fa-xmark"></i> Reject</button>
            \` : '<span style="font-size:12px;color:var(--text-muted)">Reviewed</span>'}
          </td>
        </tr>
      \`).join('') || '<tr><td colspan="6" class="empty-state">No pending KYC verifications</td></tr>';
    }

    async function approveVerification(id) {
      if (!confirm('Approve KYC verification for this center?')) return;
      await apiRequest('/api/v1/platform-admin/verifications/' + id + '/approve', { method: 'POST' });
      notify('Verification approved', 'success');
      loadVerifications();
    }

    async function rejectVerification(id) {
      const reason = prompt('Please enter rejection reason:');
      if (!reason) return;
      await apiRequest('/api/v1/platform-admin/verifications/' + id + '/reject', {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      notify('Verification rejected', 'info');
      loadVerifications();
    }

    // 6. Advertisements Management
    async function loadAdRequests() {
      const status = document.getElementById('ad-status-filter').value;
      const res = await apiRequest('/api/v1/platform-admin/ad-requests' + (status ? '?status=' + status : ''));
      const tbody = document.getElementById('ads-tbody');
      tbody.innerHTML = (res.data || []).map(ad => \`
        <tr>
          <td><strong>\${ad.title}</strong></td>
          <td>\${ad.gamingCenter?.name || '-'}</td>
          <td>\${ad.durationDays} days</td>
          <td>\${new Date(ad.startDate).toLocaleDateString()} - \${new Date(ad.endDate).toLocaleDateString()}</td>
          <td><span class="badge \${ad.status === 'APPROVED' ? 'badge-success' : ad.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}">\${ad.status}</span></td>
          <td>
            \${ad.status === 'PENDING' ? \`
              <button class="btn btn-success btn-sm" onclick="decideAd('\${ad.id}', 'APPROVED')">Approve</button>
              <button class="btn btn-danger btn-sm" onclick="decideAd('\${ad.id}', 'REJECTED')">Reject</button>
            \` : '<span style="font-size:12px;color:var(--text-muted)">Completed</span>'}
          </td>
        </tr>
      \`).join('') || '<tr><td colspan="6" class="empty-state">No advertisement requests found</td></tr>';
    }

    async function decideAd(id, status) {
      let decisionReason = undefined;
      if (status === 'REJECTED') {
        decisionReason = prompt('Enter rejection reason:');
        if (!decisionReason) return;
      }
      await apiRequest('/api/v1/platform-admin/ad-requests/' + id + '/status', {
        method: 'PATCH',
        body: JSON.stringify({ status, decisionReason })
      });
      notify('Advertisement status updated to ' + status, 'success');
      loadAdRequests();
    }

    // 7. Campaigns Management
    async function loadCampaigns() {
      const res = await apiRequest('/api/v1/platform-admin/campaigns');
      const tbody = document.getElementById('campaigns-tbody');
      tbody.innerHTML = (res.data || []).map(c => \`
        <tr>
          <td><strong>\${c.title}</strong></td>
          <td><code>\${c.code}</code></td>
          <td>\${c.discountType === 'PERCENTAGE' ? c.discountValue + '%' : Number(c.discountValue).toLocaleString() + ' IRR'}</td>
          <td><span class="badge badge-info">\${c.scopeType}</span></td>
          <td>\${new Date(c.startDate).toLocaleDateString()} - \${new Date(c.endDate).toLocaleDateString()}</td>
          <td>\${c.usedCount} / \${c.totalUsageLimit || '∞'}</td>
          <td><span class="badge \${c.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}">\${c.status}</span></td>
          <td>
            <button class="btn btn-danger btn-sm" onclick="deleteCampaignAction('\${c.id}')"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      \`).join('') || '<tr><td colspan="8" class="empty-state">No platform discount campaigns configured</td></tr>';
    }

    function openCreateCampaignModal() {
      document.getElementById('modal-create-campaign').style.display = 'flex';
    }

    async function submitCreateCampaign() {
      const startDate = document.getElementById('camp-start').value;
      const endDate = document.getElementById('camp-end').value;
      if (!startDate || !endDate) {
        notify('Please select valid start and end dates', 'error');
        return;
      }

      const payload = {
        title: document.getElementById('camp-title').value.trim(),
        code: document.getElementById('camp-code').value.trim(),
        discountType: document.getElementById('camp-type').value,
        discountValue: Number(document.getElementById('camp-val').value),
        minOrderAmount: Number(document.getElementById('camp-min-order').value) || 0,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      };

      await apiRequest('/api/v1/platform-admin/campaigns', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      notify('Campaign created successfully', 'success');
      closeModal('modal-create-campaign');
      loadCampaigns();
    }

    async function deleteCampaignAction(id) {
      if (!confirm('Are you sure you want to delete this campaign?')) return;
      await apiRequest('/api/v1/platform-admin/campaigns/' + id, { method: 'DELETE' });
      notify('Campaign deleted', 'success');
      loadCampaigns();
    }

    // 8. Platform Settings Module
    async function loadSettings() {
      const res = await apiRequest('/api/v1/platform-admin/settings');
      const s = res.data || {};
      document.getElementById('setting-siteTitle').value = s.siteTitle || '';
      document.getElementById('setting-supportPhone').value = s.supportPhone || '';
      document.getElementById('setting-supportEmail').value = s.supportEmail || '';
      document.getElementById('setting-centralAddress').value = s.centralAddress || '';
      document.getElementById('setting-platformCommissionPercent').value = s.platformCommissionPercent ?? 10;
      document.getElementById('setting-maxAdvanceBookingDays').value = s.maxAdvanceBookingDays ?? 14;
      document.getElementById('setting-onlinePaymentTimeoutMinutes').value = s.onlinePaymentTimeoutMinutes ?? 15;
      document.getElementById('setting-cancellationPenaltyPercent').value = s.cancellationPenaltyPercent ?? 20;
      document.getElementById('setting-freeCancellationHours').value = s.freeCancellationHours ?? 2;
      document.getElementById('setting-maintenanceMode').checked = !!s.maintenanceMode;
      document.getElementById('setting-maintenanceMessage').value = s.maintenanceMessage || '';
    }

    async function saveSettings() {
      const payload = {
        siteTitle: document.getElementById('setting-siteTitle').value.trim(),
        supportPhone: document.getElementById('setting-supportPhone').value.trim(),
        supportEmail: document.getElementById('setting-supportEmail').value.trim(),
        centralAddress: document.getElementById('setting-centralAddress').value.trim(),
        platformCommissionPercent: Number(document.getElementById('setting-platformCommissionPercent').value),
        maxAdvanceBookingDays: Number(document.getElementById('setting-maxAdvanceBookingDays').value),
        onlinePaymentTimeoutMinutes: Number(document.getElementById('setting-onlinePaymentTimeoutMinutes').value),
        cancellationPenaltyPercent: Number(document.getElementById('setting-cancellationPenaltyPercent').value),
        freeCancellationHours: Number(document.getElementById('setting-freeCancellationHours').value),
        maintenanceMode: document.getElementById('setting-maintenanceMode').checked,
        maintenanceMessage: document.getElementById('setting-maintenanceMessage').value.trim(),
      };

      await apiRequest('/api/v1/platform-admin/settings', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      notify('Platform settings saved successfully', 'success');
    }

    // 9. Blog Management
    async function loadBlog() {
      const tbody = document.getElementById('blog-tbody');
      try {
        const res = await fetch('/api/v1/platform-admin/blog/posts', {
          headers: { 'Authorization': 'Bearer ' + state.token }
        });
        if (res.status === 404) {
          tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fa-solid fa-newspaper"></i> Global platform blog articles endpoint (GET /platform-admin/blog/posts) is awaiting backend architecture unification. No fake mock items shown.</td></tr>';
          return;
        }
      } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Global platform blog service currently isolated per tenant.</td></tr>';
      }
    }

    // 10. Analytics & Reports
    async function loadAnalytics() {
      const start = document.getElementById('analytics-start').value;
      const end = document.getElementById('analytics-end').value;
      const city = document.getElementById('analytics-city').value.trim();

      const query = '?period=MONTHLY' +
        (start ? '&startDate=' + new Date(start).toISOString() : '') +
        (end ? '&endDate=' + new Date(end).toISOString() : '') +
        (city ? '&city=' + encodeURIComponent(city) : '');

      const res = await apiRequest('/api/v1/platform-admin/analytics/reports' + query);
      const d = res.data || {};
      const fin = d.financial || {};
      const resv = d.reservations || {};
      const users = d.users || {};

      document.getElementById('an-total-revenue').textContent = Number(fin.totalRevenue || 0).toLocaleString() + ' IRR';
      document.getElementById('an-net-revenue').textContent = 'Net Revenue: ' + Number(fin.netRevenue || 0).toLocaleString() + ' IRR';
      document.getElementById('an-platform-commission').textContent = Number(fin.platformCommission || 0).toLocaleString() + ' IRR';
      document.getElementById('an-centers-payout').textContent = 'Gaming Centers: ' + Number(fin.gamingCentersPayout || 0).toLocaleString() + ' IRR';

      document.getElementById('an-completed-res').textContent = (resv.completedReservations || 0) + ' / ' + (resv.totalReservations || 0);
      document.getElementById('an-cancellation-rate').textContent = 'Cancellation Rate: ' + (resv.cancellationRate || 0) + '%';

      document.getElementById('an-new-users').textContent = users.newUsers || 0;
      document.getElementById('an-active-users').textContent = 'Active Users: ' + (users.activeUsers || 0);
    }

    // System Audit Logs
    async function loadAudit() {
      const res = await apiRequest('/api/v1/platform-admin/audit-logs?limit=30');
      const tbody = document.getElementById('audit-tbody');
      tbody.innerHTML = (res.data || []).map(l => \`
        <tr>
          <td>\${new Date(l.createdAt).toLocaleString()}</td>
          <td><strong>\${l.platformAdmin?.fullName || l.user?.fullName || 'System'}</strong></td>
          <td><span class="badge badge-primary">\${l.action}</span></td>
          <td>\${l.entity}</td>
          <td><code>\${l.entityId}</code></td>
          <td>\${l.gamingCenter?.name || '-'}</td>
        </tr>
      \`).join('') || '<tr><td colspan="6" class="empty-state">No audit logs found</td></tr>';
    }

    // Initialization
    if (!state.token) {
      showAuthModal();
    } else {
      loadDashboard();
    }
  </script>
</body>
</html>`;
