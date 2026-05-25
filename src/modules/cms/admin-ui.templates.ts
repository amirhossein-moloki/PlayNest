import { serializeSectionRegistryForEditor } from './page-section-registry';

export const pagesListTemplate = (gamingCenterId: string, statusOptions: string, typeOptions: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CMS Pages</title>
    <style>
      body {
        font-family: "Inter", "Segoe UI", sans-serif;
        margin: 0;
        background: #f6f7fb;
        color: #1f2933;
      }
      header {
        background: #ffffff;
        border-bottom: 1px solid #e5e7eb;
        padding: 24px 32px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 22px;
      }
      .subtitle {
        color: #6b7280;
        font-size: 14px;
      }
      main {
        padding: 24px 32px 40px;
      }
      .filters {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 16px;
        margin-bottom: 16px;
      }
      .filters label {
        display: block;
        font-size: 12px;
        color: #6b7280;
        margin-bottom: 6px;
      }
      .filters select,
      .filters input {
        width: 100%;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid #d1d5db;
        background: #ffffff;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
        margin: 16px 0 24px;
      }
      button {
        padding: 8px 14px;
        border-radius: 8px;
        border: 1px solid #cbd2d9;
        background: #ffffff;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .card {
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
        padding: 16px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        padding: 12px 8px;
        text-align: left;
        border-bottom: 1px solid #eef0f3;
        font-size: 14px;
      }
      th {
        color: #6b7280;
        font-weight: 600;
      }
      .link-button {
        display: inline-flex;
        align-items: center;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid #d1d5db;
        color: #1f2933;
        text-decoration: none;
        font-size: 12px;
        background: #ffffff;
      }
      .link-button:hover {
        border-color: #9ca3af;
      }
      .badge {
        display: inline-block;
        padding: 2px 10px;
        border-radius: 999px;
        font-size: 12px;
        background: #eef2ff;
        color: #4338ca;
      }
      .state {
        padding: 32px 12px;
        text-align: center;
        color: #6b7280;
      }
      .state strong {
        display: block;
        font-size: 16px;
        color: #111827;
        margin-bottom: 6px;
      }
      .error {
        color: #b42318;
      }
      .pagination {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 16px;
        color: #6b7280;
        font-size: 13px;
      }
    </style>
  </head>
  <body>
    <header>
      <h1>CMS Pages</h1>
      <div class="subtitle">GamingCenter ID: ${gamingCenterId}</div>
    </header>
    <main>
      <div class="filters">
        <div>
          <label for="statusFilter">Status</label>
          <select id="statusFilter">
            <option value="">All statuses</option>
            ${statusOptions}
          </select>
        </div>
        <div>
          <label for="typeFilter">Type</label>
          <select id="typeFilter">
            <option value="">All types</option>
            ${typeOptions}
          </select>
        </div>
        <div>
          <label for="authToken">Auth token</label>
          <input id="authToken" placeholder="Paste bearer token" />
        </div>
      </div>
      <div class="actions">
        <button id="refreshButton">Refresh</button>
        <span id="statusText"></span>
      </div>
      <div class="card">
        <table aria-live="polite">
          <thead>
            <tr>
              <th>Title</th>
              <th>Slug</th>
              <th>Type</th>
              <th>Status</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="pagesBody"></tbody>
        </table>
        <div class="state" id="stateMessage" hidden></div>
      </div>
      <div class="pagination">
        <button id="prevButton">Previous</button>
        <span id="paginationSummary">Page 1</span>
        <button id="nextButton">Next</button>
      </div>
    </main>
    <script>
      const pagesBody = document.getElementById('pagesBody');
      const statusFilter = document.getElementById('statusFilter');
      const typeFilter = document.getElementById('typeFilter');
      const authTokenInput = document.getElementById('authToken');
      const statusText = document.getElementById('statusText');
      const stateMessage = document.getElementById('stateMessage');
      const prevButton = document.getElementById('prevButton');
      const nextButton = document.getElementById('nextButton');
      const paginationSummary = document.getElementById('paginationSummary');
      const refreshButton = document.getElementById('refreshButton');

      let limit = 10;
      let offset = 0;
      let total = 0;

      const loadStoredToken = () => {
        const stored = localStorage.getItem('cmsAdminToken');
        if (stored) {
          authTokenInput.value = stored;
        }
      };

      const saveToken = () => {
        const token = authTokenInput.value.trim();
        if (token) {
          localStorage.setItem('cmsAdminToken', token);
        }
      };

      const setState = ({ message, isError = false }) => {
        if (!message) {
          stateMessage.hidden = true;
          stateMessage.textContent = '';
          stateMessage.classList.remove('error');
          return;
        }
        stateMessage.hidden = false;
        stateMessage.innerHTML = isError
          ? \`<strong>Unable to load pages</strong>\${message}\`
          : \`<strong>No pages found</strong>\${message}\`;
        stateMessage.classList.toggle('error', isError);
      };

      const updatePagination = () => {
        const currentPage = Math.floor(offset / limit) + 1;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        paginationSummary.textContent = \`Page \${currentPage} of \${totalPages} • \${total} total\`;
        prevButton.disabled = offset === 0;
        nextButton.disabled = offset + limit >= total;
      };

      const renderRows = (pages) => {
        pagesBody.innerHTML = '';
        pages.forEach((page) => {
          const row = document.createElement('tr');
          row.innerHTML = \`
            <td>\${page.title ?? '-'}</td>
            <td>\${page.slug ?? '-'}</td>
            <td>\${page.type ?? '-'}</td>
            <td><span class="badge">\${page.status ?? '-'}</span></td>
            <td>\${page.updatedAt ? new Date(page.updatedAt).toLocaleString() : '-'}</td>
            <td><a class="link-button" href="/api/v1/admin/gamingCenters/${gamingCenterId}/pages/\${page.id}">Edit</a></td>
          \`;
          pagesBody.appendChild(row);
        });
      };

      const fetchPages = async () => {
        statusText.textContent = 'Loading...';
        setState({ message: '' });
        pagesBody.innerHTML = '';
        const params = new URLSearchParams();
        if (statusFilter.value) params.set('status', statusFilter.value);
        if (typeFilter.value) params.set('type', typeFilter.value);
        params.set('limit', limit);
        params.set('offset', offset);

        const token = authTokenInput.value.trim();
        if (token) saveToken();

        try {
          const response = await fetch(\`/api/v1/gamingCenters/${gamingCenterId}/pages?\${params}\`,
            {
              headers: token ? { Authorization: \`Bearer \${token}\` } : {},
            }
          );
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || response.statusText);
          }
          const payload = await response.json();
          const pages = payload.data ?? [];
          total = payload.meta?.total ?? pages.length;
          limit = payload.meta?.limit ?? limit;
          offset = payload.meta?.offset ?? offset;
          if (pages.length === 0) {
            setState({ message: 'Adjust filters or create a new page to get started.' });
          }
          renderRows(pages);
          updatePagination();
          statusText.textContent = 'Loaded';
        } catch (error) {
          setState({
            message: \`\${error instanceof Error ? error.message : 'Unexpected error.'}\`,
            isError: true,
          });
          statusText.textContent = 'Failed to load.';
        }
      };

      statusFilter.addEventListener('change', () => {
        offset = 0;
        fetchPages();
      });
      typeFilter.addEventListener('change', () => {
        offset = 0;
        fetchPages();
      });
      refreshButton.addEventListener('click', fetchPages);
      prevButton.addEventListener('click', () => {
        offset = Math.max(0, offset - limit);
        fetchPages();
      });
      nextButton.addEventListener('click', () => {
        offset = offset + limit;
        fetchPages();
      });

      loadStoredToken();
      fetchPages();
    </script>
  </body>
</html>`;

export const pageEditorTemplate = (
  gamingCenterId: string,
  pageId: string,
  statusOptions: string,
  typeOptions: string,
  robotsIndexOptions: string,
  robotsFollowOptions: string
) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Page Editor</title>
    <style>
      body {
        font-family: "Inter", "Segoe UI", sans-serif;
        margin: 0;
        background: #f6f7fb;
        color: #1f2933;
      }
      header {
        background: #ffffff;
        border-bottom: 1px solid #e5e7eb;
        padding: 24px 32px;
      }
      h1 {
        margin: 0 0 6px;
        font-size: 22px;
      }
      .subtitle {
        color: #6b7280;
        font-size: 13px;
      }
      main {
        padding: 24px 32px 40px;
      }
      .header-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
        margin-top: 16px;
      }
      .back-link {
        text-decoration: none;
        color: #1f2933;
        font-size: 13px;
        border: 1px solid #d1d5db;
        padding: 6px 12px;
        border-radius: 999px;
        background: #fff;
      }
      .layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 20px;
      }
      .view-toggle {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
      }
      .toggle-button {
        border: 1px solid #d1d5db;
        background: #ffffff;
        padding: 8px 14px;
        border-radius: 999px;
        font-size: 13px;
        cursor: pointer;
        color: #6b7280;
      }
      .toggle-button.active {
        background: #111827;
        color: #ffffff;
        border-color: #111827;
      }
      .card {
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
        padding: 20px;
      }
      .tabs {
        display: flex;
        gap: 8px;
        border-bottom: 1px solid #e5e7eb;
        margin-bottom: 16px;
      }
      .tab {
        border: none;
        background: transparent;
        padding: 10px 14px;
        font-size: 13px;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        color: #6b7280;
      }
      .tab.active {
        color: #111827;
        border-bottom-color: #6366f1;
        font-weight: 600;
      }
      .tab-panel {
        display: none;
      }
      .tab-panel.active {
        display: block;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
      }
      label {
        display: block;
        font-size: 12px;
        color: #6b7280;
        margin-bottom: 6px;
      }
      input,
      select,
      textarea {
        width: 100%;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid #d1d5db;
        background: #ffffff;
        font-size: 14px;
      }
      textarea {
        resize: vertical;
        min-height: 100px;
      }
      .actions {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 20px;
      }
      button {
        padding: 8px 14px;
        border-radius: 8px;
        border: 1px solid #cbd2d9;
        background: #ffffff;
        cursor: pointer;
      }
      button.primary {
        background: #111827;
        color: #ffffff;
        border-color: #111827;
      }
      .status-text {
        color: #6b7280;
        font-size: 13px;
      }
      .sections-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .sections-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        gap: 12px;
      }
      .sections-header h3 {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
      }
      .section-item {
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: #fafafa;
      }
      .section-item-header {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
      }
      .section-item.dragging {
        opacity: 0.6;
      }
      .section-item.dragover {
        border-color: #6366f1;
        background: #eef2ff;
      }
      .drag-handle {
        font-size: 18px;
        cursor: grab;
        color: #9ca3af;
      }
      .section-content {
        flex: 1;
      }
      .section-title {
        font-size: 14px;
        font-weight: 600;
      }
      .section-meta {
        font-size: 12px;
        color: #6b7280;
        margin-top: 4px;
      }
      .toggle {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #374151;
      }
      .section-editor {
        width: 100%;
        border-top: 1px solid #e5e7eb;
        padding-top: 12px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .section-editor .editor-grid {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }
      .editor-block {
        border: 1px solid #e5e7eb;
        background: #ffffff;
        padding: 10px;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .editor-block-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 12px;
        color: #6b7280;
      }
      .editor-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .section-errors {
        margin: 0;
        padding-left: 16px;
        color: #b91c1c;
        font-size: 12px;
      }
      .section-errors.hidden {
        display: none;
      }
      .field-inline {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .empty-state {
        padding: 20px;
        text-align: center;
        color: #6b7280;
        border: 1px dashed #d1d5db;
        border-radius: 10px;
      }
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.45);
        display: none;
        align-items: center;
        justify-content: center;
        padding: 24px;
        z-index: 100;
      }
      .modal-backdrop.open {
        display: flex;
      }
      .modal {
        background: #ffffff;
        border-radius: 12px;
        padding: 20px;
        width: min(480px, 100%);
        box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
      }
      .modal h3 {
        margin: 0 0 8px;
        font-size: 16px;
      }
      .modal p {
        margin: 0 0 16px;
        color: #6b7280;
        font-size: 13px;
      }
      .modal .actions {
        margin-top: 16px;
        justify-content: flex-end;
      }
      .preview-panel {
        padding: 16px;
      }
      .preview-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        gap: 12px;
      }
      .preview-header h3 {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
      }
      .preview-status {
        font-size: 12px;
        color: #6b7280;
        margin-bottom: 8px;
      }
      .preview-frame {
        width: 100%;
        min-height: 600px;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        background: #ffffff;
      }
    </style>
  </head>
  <body>
    <header>
      <h1>Page Editor</h1>
      <div class="subtitle">GamingCenter ID: ${gamingCenterId} • Page ID: ${pageId}</div>
      <div class="header-actions">
        <a class="back-link" href="/api/v1/admin/gamingCenters/${gamingCenterId}/pages">← Back to pages</a>
        <div>
          <label for="authToken">Auth token</label>
          <input id="authToken" placeholder="Paste bearer token" />
        </div>
      </div>
    </header>
    <main>
      <div class="view-toggle" role="tablist" aria-label="Editor preview toggle">
        <button class="toggle-button active" data-view="editor" type="button">Editor</button>
        <button class="toggle-button" data-view="preview" type="button">Preview</button>
      </div>
      <div class="layout">
        <section class="card" id="editorPanel">
          <div class="tabs">
            <button class="tab active" data-tab="meta">Meta</button>
            <button class="tab" data-tab="seo">SEO</button>
            <button class="tab" data-tab="sections">Sections</button>
          </div>
          <div class="tab-panel active" id="tab-meta">
            <div class="form-grid">
              <div>
                <label for="title">Title</label>
                <input id="title" placeholder="Page title" />
              </div>
              <div>
                <label for="slug">Slug</label>
                <input id="slug" placeholder="slug-url" />
              </div>
              <div>
                <label for="type">Page type</label>
                <select id="type">
                  <option value="">Select type</option>
                  ${typeOptions}
                </select>
              </div>
              <div>
                <label for="status">Status</label>
                <select id="status">
                  <option value="">Select status</option>
                  ${statusOptions}
                </select>
              </div>
              <div>
                <label for="publishedAt">Published at</label>
                <input id="publishedAt" type="datetime-local" />
              </div>
            </div>
          </div>
          <div class="tab-panel" id="tab-seo">
            <div class="form-grid">
              <div>
                <label for="seoTitle">SEO title</label>
                <input id="seoTitle" placeholder="SEO headline" />
              </div>
              <div>
                <label for="seoDescription">SEO description</label>
                <textarea id="seoDescription" placeholder="Short description for search engines"></textarea>
              </div>
              <div>
                <label for="canonicalPath">Canonical path</label>
                <input id="canonicalPath" placeholder="/stations/..." />
              </div>
              <div>
                <label for="ogTitle">Open Graph title</label>
                <input id="ogTitle" placeholder="Social share title" />
              </div>
              <div>
                <label for="ogDescription">Open Graph description</label>
                <textarea id="ogDescription" placeholder="Social share description"></textarea>
              </div>
              <div>
                <label for="ogImageUrl">Open Graph image URL</label>
                <input id="ogImageUrl" placeholder="https://..." />
              </div>
              <div>
                <label for="robotsIndex">Robots index</label>
                <select id="robotsIndex">
                  <option value="">Default</option>
                  ${robotsIndexOptions}
                </select>
              </div>
              <div>
                <label for="robotsFollow">Robots follow</label>
                <select id="robotsFollow">
                  <option value="">Default</option>
                  ${robotsFollowOptions}
                </select>
              </div>
              <div>
                <label for="structuredDataJson">Structured data JSON</label>
                <textarea id="structuredDataJson" placeholder='{"@context": "https://schema.org"}'></textarea>
              </div>
            </div>
          </div>
          <div class="tab-panel" id="tab-sections">
            <div class="sections-header">
              <h3>Sections</h3>
              <button type="button" id="addSectionButton">Add Section</button>
            </div>
            <ul class="sections-list" id="sectionsList"></ul>
          </div>
          <div class="actions">
            <button class="primary" id="saveButton">Save changes</button>
            <span class="status-text" id="statusText"></span>
          </div>
        </section>
        <section class="card preview-panel" id="previewPanel" hidden>
          <div class="preview-header">
            <h3>Live preview</h3>
            <button type="button" id="refreshPreviewButton">Refresh preview</button>
          </div>
          <div class="preview-status" id="previewStatus"></div>
          <iframe
            id="previewFrame"
            title="Page preview"
            class="preview-frame"
            sandbox="allow-same-origin"
          ></iframe>
        </section>
      </div>
    </main>
    <script>
      const authTokenInput = document.getElementById('authToken');
      const statusText = document.getElementById('statusText');
      const saveButton = document.getElementById('saveButton');
      const sectionsList = document.getElementById('sectionsList');
      const addSectionButton = document.getElementById('addSectionButton');
      const viewButtons = document.querySelectorAll('.toggle-button');
      const editorPanel = document.getElementById('editorPanel');
      const previewPanel = document.getElementById('previewPanel');
      const previewFrame = document.getElementById('previewFrame');
      const previewStatus = document.getElementById('previewStatus');
      const refreshPreviewButton = document.getElementById('refreshPreviewButton');

      const fields = {
        title: document.getElementById('title'),
        slug: document.getElementById('slug'),
        type: document.getElementById('type'),
        status: document.getElementById('status'),
        publishedAt: document.getElementById('publishedAt'),
        seoTitle: document.getElementById('seoTitle'),
        seoDescription: document.getElementById('seoDescription'),
        canonicalPath: document.getElementById('canonicalPath'),
        ogTitle: document.getElementById('ogTitle'),
        ogDescription: document.getElementById('ogDescription'),
        ogImageUrl: document.getElementById('ogImageUrl'),
        robotsIndex: document.getElementById('robotsIndex'),
        robotsFollow: document.getElementById('robotsFollow'),
        structuredDataJson: document.getElementById('structuredDataJson'),
      };

      const tabButtons = document.querySelectorAll('.tab');
      const panels = document.querySelectorAll('.tab-panel');
      let sections = [];
      const htmlTagRegex = /<[^>]+>/;
      const cloneData = (value) => JSON.parse(JSON.stringify(value ?? {}));
      const sectionConfigs = ${serializeSectionRegistryForEditor()};
      const sectionDefaults = Object.fromEntries(
        Object.entries(sectionConfigs).map(([type, config]) => [type, cloneData(config.defaults)]),
      );
      const sectionTypes = Object.keys(sectionConfigs);

      const toDatetimeLocal = (value) => {
        if (!value) return '';
        const date = new Date(value);
        const offset = date.getTimezoneOffset();
        const local = new Date(date.getTime() - offset * 60000);
        return local.toISOString().slice(0, 16);
      };

      const loadStoredToken = () => {
        const stored = localStorage.getItem('cmsAdminToken');
        if (stored) {
          authTokenInput.value = stored;
        }
      };

      const saveToken = () => {
        const token = authTokenInput.value.trim();
        if (token) {
          localStorage.setItem('cmsAdminToken', token);
        }
      };

      const setStatus = (message) => {
        statusText.textContent = message ?? '';
      };

      const setPreviewStatus = (message) => {
        if (!previewStatus) return;
        previewStatus.textContent = message ?? '';
      };

      const setActiveView = (viewName) => {
        viewButtons.forEach((button) => {
          button.classList.toggle('active', button.dataset.view === viewName);
        });
        if (editorPanel) {
          editorPanel.hidden = viewName !== 'editor';
        }
        if (previewPanel) {
          previewPanel.hidden = viewName !== 'preview';
        }
        if (viewName === 'preview') {
          loadPreview();
        }
      };

      const setActiveTab = (tabName) => {
        tabButtons.forEach((button) => {
          button.classList.toggle('active', button.dataset.tab === tabName);
        });
        panels.forEach((panel) => {
          panel.classList.toggle('active', panel.id === \`tab-\${tabName}\`);
        });
      };

      const parseSectionData = (section) => {
        const fallback = cloneData(sectionDefaults[section.type] ?? {});
        if (!section.dataJson) return fallback;
        try {
          const parsed = JSON.parse(section.dataJson);
          return parsed && typeof parsed === 'object' ? parsed : fallback;
        } catch (error) {
          return fallback;
        }
      };

      const ensureSectionData = (section) => {
        if (!section.data) {
          section.data = parseSectionData(section);
        }
        return section.data;
      };

      const pushError = (errors, path, message) => {
        errors.push(\`\${path}: \${message}\`);
      };

      const validateRequiredString = (value, path, errors) => {
        if (typeof value !== 'string' || value.trim().length === 0) {
          pushError(errors, path, 'Required.');
        }
      };

      const validatePositiveInt = (value, path, errors) => {
        if (!Number.isInteger(value) || value <= 0) {
          pushError(errors, path, 'Must be a positive integer.');
        }
      };

      const validateBoolean = (value, path, errors) => {
        if (typeof value !== 'boolean') {
          pushError(errors, path, 'Must be true/false.');
        }
      };

      const validateRichTextBlock = (block, index, errors) => {
        if (!block || typeof block !== 'object') {
          pushError(errors, \`blocks[\${index}]\`, 'Block is required.');
          return;
        }
        validateRequiredString(block.type, \`blocks[\${index}].type\`, errors);
        validateRequiredString(block.text, \`blocks[\${index}].text\`, errors);
        if (!block.allowHtml && htmlTagRegex.test(block.text ?? '')) {
          pushError(errors, \`blocks[\${index}].text\`, 'HTML is not allowed.');
        }
      };

      const validationHelpers = {
        pushError,
        validateRequiredString,
        validatePositiveInt,
        validateBoolean,
        validateRichTextBlock,
      };

      const validateSection = (type, data) => {
        const config = sectionConfigs[type];
        if (!config) return [\`\${type}: Unsupported section type.\`];
        const errors = [];

        const validateField = (field, value, path) => {
          if (field.required && (value === undefined || value === null || (typeof value === 'string' && value.trim() === ''))) {
            errors.push(\`\${path}: Required.\`);
          }
          if (field.type === 'group' && field.fields) {
            field.fields.forEach(f => validateField(f, (value || {})[f.name], \`\${path}.\${f.name}\`));
          }
          if (field.type === 'list' && field.fields) {
            if (Array.isArray(value)) {
              value.forEach((item, i) => {
                field.fields.forEach(f => validateField(f, (item || {})[f.name], \`\${path}[\${i}].\${f.name}\`));
              });
            }
          }
        };

        config.fields.forEach(f => validateField(f, data[f.name], f.name));
        return errors;
      };

      const createLabeledField = (labelText) => {
        const wrapper = document.createElement('div');
        const label = document.createElement('label');
        label.textContent = labelText;
        wrapper.appendChild(label);
        return { wrapper, label };
      };

      const createTextInput = (labelText, value, onInput) => {
        const { wrapper } = createLabeledField(labelText);
        const input = document.createElement('input');
        input.type = 'text';
        input.value = value ?? '';
        input.addEventListener('input', () => onInput(input.value));
        wrapper.appendChild(input);
        return wrapper;
      };

      const createTextarea = (labelText, value, onInput) => {
        const { wrapper } = createLabeledField(labelText);
        const textarea = document.createElement('textarea');
        textarea.value = value ?? '';
        textarea.addEventListener('input', () => onInput(textarea.value));
        wrapper.appendChild(textarea);
        return wrapper;
      };

      const createNumberInput = (labelText, value, onInput) => {
        const { wrapper } = createLabeledField(labelText);
        const input = document.createElement('input');
        input.type = 'number';
        input.value = Number.isFinite(value) ? String(value) : '';
        input.addEventListener('input', () => {
          const parsed = Number(input.value);
          onInput(Number.isFinite(parsed) ? parsed : input.value === '' ? undefined : parsed);
        });
        wrapper.appendChild(input);
        return wrapper;
      };

      const createCheckbox = (labelText, checked, onChange) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'field-inline';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = Boolean(checked);
        const label = document.createElement('label');
        label.textContent = labelText;
        input.addEventListener('change', () => onChange(input.checked));
        wrapper.appendChild(input);
        wrapper.appendChild(label);
        return wrapper;
      };

      const syncSectionData = (section, metaEl, errorsEl) => {
        section.dataJson = JSON.stringify(section.data ?? {}, null, 2);
        metaEl.textContent = \`Position \${section.sortOrder + 1} • \${section.dataJson.length} chars\`;
        const errors = validateSection(section.type, section.data);
        errorsEl.innerHTML = '';
        if (errors.length === 0) {
          errorsEl.classList.add('hidden');
        } else {
          errorsEl.classList.remove('hidden');
          errors.forEach((message) => {
            const item = document.createElement('li');
            item.textContent = message;
            errorsEl.appendChild(item);
          });
        }
      };

      const createListEditor = ({ items, renderItem, onAdd, onRemove }) => {
        const container = document.createElement('div');
        container.className = 'editor-block';
        const list = document.createElement('div');
        list.className = 'editor-grid';
        const refresh = () => {
          list.innerHTML = '';
          items.forEach((item, index) => {
            const block = document.createElement('div');
            block.className = 'editor-block';
            const header = document.createElement('div');
            header.className = 'editor-block-header';
            header.textContent = \`Item \${index + 1}\`;
            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.textContent = 'Remove';
            removeButton.addEventListener('click', () => {
              onRemove(index);
              refresh();
            });
            header.appendChild(removeButton);
            block.appendChild(header);
            renderItem(block, item, index);
            list.appendChild(block);
          });
        };
        const actions = document.createElement('div');
        actions.className = 'editor-actions';
        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.textContent = 'Add item';
        addButton.addEventListener('click', () => {
          onAdd();
          refresh();
        });
        actions.appendChild(addButton);
        container.appendChild(list);
        container.appendChild(actions);
        refresh();
        return container;
      };

      const editorHelpers = {
        createTextInput,
        createTextarea,
        createNumberInput,
        createCheckbox,
        createListEditor,
        createLabeledField,
      };

      const buildSectionEditor = (section, metaEl, errorsEl) => {
        const editor = document.createElement('div');
        editor.className = 'section-editor';
        const data = ensureSectionData(section);
        const grid = document.createElement('div');
        grid.className = 'editor-grid';

        const update = () => syncSectionData(section, metaEl, errorsEl);
        const config = sectionConfigs[section.type];

        const renderField = (field, container, currentData, currentUpdate) => {
          if (field.type === 'text') {
            container.appendChild(createTextInput(field.label, currentData[field.name], (val) => {
              currentData[field.name] = val;
              currentUpdate();
            }));
          } else if (field.type === 'textarea') {
            container.appendChild(createTextarea(field.label, currentData[field.name], (val) => {
              currentData[field.name] = val;
              currentUpdate();
            }));
          } else if (field.type === 'number') {
            container.appendChild(createNumberInput(field.label, currentData[field.name], (val) => {
              currentData[field.name] = val;
              currentUpdate();
            }));
          } else if (field.type === 'checkbox') {
            container.appendChild(createCheckbox(field.label, currentData[field.name], (val) => {
              currentData[field.name] = val;
              currentUpdate();
            }));
          } else if (field.type === 'group' && field.fields) {
            const groupData = currentData[field.name] || (currentData[field.name] = {});
            field.fields.forEach(f => renderField(f, container, groupData, currentUpdate));
          } else if (field.type === 'list' && field.fields) {
            const listData = currentData[field.name] || (currentData[field.name] = []);
            const listEditor = createListEditor({
              items: listData,
              renderItem: (block, item, index) => {
                const itemGrid = document.createElement('div');
                itemGrid.className = 'editor-grid';
                field.fields.forEach(f => renderField(f, itemGrid, item, () => {
                   currentUpdate();
                }));
                block.appendChild(itemGrid);
              },
              onAdd: () => {
                const newItem = {};
                field.fields.forEach(f => { if(f.defaultValue !== undefined) newItem[f.name] = f.defaultValue; });
                listData.push(newItem);
                currentUpdate();
              },
              onRemove: (index) => {
                listData.splice(index, 1);
                currentUpdate();
              }
            });
            editor.appendChild(listEditor);
          }
        };

        if (config && config.fields) {
          config.fields.forEach(f => renderField(f, grid, data, update));
        }

        if (grid.children.length > 0) {
          editor.appendChild(grid);
        }
        editor.appendChild(errorsEl);
        syncSectionData(section, metaEl, errorsEl);
        return editor;
      };

      tabButtons.forEach((button) => {
        button.addEventListener('click', () => setActiveTab(button.dataset.tab));
      });

      const updateSectionSortOrders = () => {
        sections = sections.map((section, index) => ({
          ...section,
          sortOrder: index,
        }));
      };

      const renderSections = () => {
        updateSectionSortOrders();
        sectionsList.innerHTML = '';
        if (sections.length === 0) {
          const empty = document.createElement('li');
          empty.className = 'empty-state';
          empty.textContent = 'No sections configured for this page yet.';
          sectionsList.appendChild(empty);
          return;
        }
        sections.forEach((section, index) => {
          ensureSectionData(section);
          const item = document.createElement('li');
          item.className = 'section-item';
          item.setAttribute('draggable', 'true');
          item.dataset.index = index;
          const header = document.createElement('div');
          header.className = 'section-item-header';
          const dragHandle = document.createElement('span');
          dragHandle.className = 'drag-handle';
          dragHandle.setAttribute('aria-hidden', 'true');
          dragHandle.textContent = '⠿';
          const content = document.createElement('div');
          content.className = 'section-content';
          const title = document.createElement('div');
          title.className = 'section-title';
          title.textContent = section.type;
          const meta = document.createElement('div');
          meta.className = 'section-meta';
          meta.textContent = \`Position \${section.sortOrder + 1} • \${section.dataJson?.length ?? 0} chars\`;
          content.appendChild(title);
          content.appendChild(meta);
          const toggleLabel = document.createElement('label');
          toggleLabel.className = 'toggle';
          const toggle = document.createElement('input');
          toggle.type = 'checkbox';
          toggle.dataset.index = String(index);
          toggle.checked = Boolean(section.isEnabled);
          toggleLabel.appendChild(toggle);
          toggleLabel.append('Enabled');
          header.appendChild(dragHandle);
          header.appendChild(content);
          header.appendChild(toggleLabel);
          item.appendChild(header);
          const errorsEl = document.createElement('ul');
          errorsEl.className = 'section-errors hidden';
          const editor = buildSectionEditor(section, meta, errorsEl);
          item.appendChild(editor);
          sectionsList.appendChild(item);
        });
      };

      sectionsList.addEventListener('change', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        if (!target.matches('input[type="checkbox"][data-index]')) return;
        const index = Number(target.dataset.index);
        if (Number.isNaN(index) || !sections[index]) return;
        sections[index].isEnabled = target.checked;
      });

      sectionsList.addEventListener('dragstart', (event) => {
        const item = event.target.closest('.section-item');
        if (!item) return;
        item.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', item.dataset.index);
      });

      sectionsList.addEventListener('dragend', (event) => {
        const item = event.target.closest('.section-item');
        if (!item) return;
        item.classList.remove('dragging');
      });

      sectionsList.addEventListener('dragover', (event) => {
        const item = event.target.closest('.section-item');
        if (!item) return;
        event.preventDefault();
        item.classList.add('dragover');
      });

      sectionsList.addEventListener('dragleave', (event) => {
        const item = event.target.closest('.section-item');
        if (!item) return;
        item.classList.remove('dragover');
      });

      sectionsList.addEventListener('drop', (event) => {
        const item = event.target.closest('.section-item');
        if (!item) return;
        event.preventDefault();
        const fromIndex = Number(event.dataTransfer.getData('text/plain'));
        const toIndex = Number(item.dataset.index);
        if (Number.isNaN(fromIndex) || Number.isNaN(toIndex) || fromIndex === toIndex) {
          return;
        }
        const [moved] = sections.splice(fromIndex, 1);
        sections.splice(toIndex, 0, moved);
        renderSections();
      });

      const buildModal = () => {
        const modalBackdrop = document.createElement('div');
        modalBackdrop.className = 'modal-backdrop';
        modalBackdrop.innerHTML = \`
          <div class="modal" role="dialog" aria-modal="true" aria-labelledby="addSectionTitle">
            <h3 id="addSectionTitle">Add a section</h3>
            <p>Select a section type to add with a starter template.</p>
            <div>
              <label for="sectionTypeSelect">Section type</label>
              <select id="sectionTypeSelect">
                \${sectionTypes.map((type) => \`<option value="\${type}">\${type}</option>\`).join('')}
              </select>
            </div>
            <div class="actions">
              <button type="button" id="cancelAddSection">Cancel</button>
              <button type="button" class="primary" id="confirmAddSection">Add section</button>
            </div>
          </div>
        \`;
        document.body.appendChild(modalBackdrop);

        const closeModal = () => {
          modalBackdrop.classList.remove('open');
        };

        modalBackdrop.addEventListener('click', (event) => {
          if (event.target === modalBackdrop) {
            closeModal();
          }
        });

        const cancelButton = modalBackdrop.querySelector('#cancelAddSection');
        const confirmButton = modalBackdrop.querySelector('#confirmAddSection');
        const typeSelect = modalBackdrop.querySelector('#sectionTypeSelect');

        cancelButton.addEventListener('click', closeModal);
        confirmButton.addEventListener('click', () => {
          const selectedType = typeSelect.value;
          const template = sectionDefaults[selectedType];
          if (!template) return;
          sections.push({
            type: selectedType,
            dataJson: JSON.stringify(template, null, 2),
            isEnabled: true,
          });
          renderSections();
          closeModal();
          setActiveTab('sections');
        });

        return {
          open: () => {
            modalBackdrop.classList.add('open');
          },
        };
      };

      const addSectionModal = buildModal();

      const populateForm = (page) => {
        fields.title.value = page.title ?? '';
        fields.slug.value = page.slug ?? '';
        fields.type.value = page.type ?? '';
        fields.status.value = page.status ?? '';
        fields.publishedAt.value = toDatetimeLocal(page.publishedAt);
        fields.seoTitle.value = page.seoTitle ?? '';
        fields.seoDescription.value = page.seoDescription ?? '';
        fields.canonicalPath.value = page.canonicalPath ?? '';
        fields.ogTitle.value = page.ogTitle ?? '';
        fields.ogDescription.value = page.ogDescription ?? '';
        fields.ogImageUrl.value = page.ogImageUrl ?? '';
        fields.robotsIndex.value = page.robotsIndex ?? '';
        fields.robotsFollow.value = page.robotsFollow ?? '';
        fields.structuredDataJson.value = page.structuredDataJson ?? '';
        sections = (page.sections ?? []).map((section) => ({
          ...section,
          isEnabled: section.isEnabled ?? true,
        }));
        renderSections();
      };

      const fetchPage = async () => {
        setStatus('Loading page...');
        const token = authTokenInput.value.trim();
        if (token) saveToken();

        try {
          const response = await fetch('/api/v1/gamingCenters/${gamingCenterId}/pages/${pageId}', {
            headers: token ? { Authorization: \`Bearer \${token}\` } : {},
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || response.statusText);
          }
          const payload = await response.json();
          populateForm(payload.data);
          setStatus('Loaded');
        } catch (error) {
          setStatus(\`Failed to load page: \${error instanceof Error ? error.message : 'Unexpected error.'}\`);
        }
      };

      const readValue = (field) => {
        const value = field.value.trim();
        return value.length > 0 ? value : undefined;
      };

      const buildPreviewPayload = () => ({
        title: readValue(fields.title),
        pageId: '${pageId}',
        sections: sections.map((section, index) => ({
          id: section.id,
          type: section.type,
          dataJson: section.dataJson,
          sortOrder: section.sortOrder ?? index,
          isEnabled: section.isEnabled ?? true,
        })),
      });

      const validateMainFields = () => {
        const errors = [];
        if (!fields.title.value.trim()) errors.push('Title is required.');
        if (!fields.slug.value.trim()) errors.push('Slug is required.');
        if (!/^[a-z0-9-]+$/.test(fields.slug.value.trim())) {
          errors.push('Slug must be lowercase, numbers, and dashes only.');
        }
        return errors;
      };

      const buildPayload = () => {
        const mainErrors = validateMainFields();
        if (mainErrors.length > 0) {
          throw new Error(mainErrors.join(' '));
        }

        const payload = {};
        const title = readValue(fields.title);
        const slug = readValue(fields.slug);
        const type = readValue(fields.type);
        const status = readValue(fields.status);
        const publishedAt = readValue(fields.publishedAt);
        const seoTitle = readValue(fields.seoTitle);
        const seoDescription = readValue(fields.seoDescription);
        const canonicalPath = readValue(fields.canonicalPath);
        const ogTitle = readValue(fields.ogTitle);
        const ogDescription = readValue(fields.ogDescription);
        const ogImageUrl = readValue(fields.ogImageUrl);
        const robotsIndex = readValue(fields.robotsIndex);
        const robotsFollow = readValue(fields.robotsFollow);
        const structuredDataJson = readValue(fields.structuredDataJson);

        if (title !== undefined) payload.title = title;
        if (slug !== undefined) payload.slug = slug;
        if (type !== undefined) payload.type = type;
        if (status !== undefined) payload.status = status;
        if (publishedAt !== undefined) {
          payload.publishedAt = new Date(publishedAt).toISOString();
        }
        if (seoTitle !== undefined) payload.seoTitle = seoTitle;
        if (seoDescription !== undefined) payload.seoDescription = seoDescription;
        if (canonicalPath !== undefined) payload.canonicalPath = canonicalPath;
        if (ogTitle !== undefined) payload.ogTitle = ogTitle;
        if (ogDescription !== undefined) payload.ogDescription = ogDescription;
        if (ogImageUrl !== undefined) payload.ogImageUrl = ogImageUrl;
        if (robotsIndex !== undefined) payload.robotsIndex = robotsIndex;
        if (robotsFollow !== undefined) payload.robotsFollow = robotsFollow;
        if (structuredDataJson !== undefined) payload.structuredDataJson = structuredDataJson;

        payload.sections = sections.map((section, index) => ({
          id: section.id,
          type: section.type,
          dataJson: section.dataJson,
          sortOrder: section.sortOrder ?? index,
          isEnabled: section.isEnabled ?? true,
        }));

        return payload;
      };

      const loadPreview = async () => {
        if (!previewFrame) return;
        setPreviewStatus('Loading preview...');
        try {
          const response = await fetch('/api/v1/admin/gamingCenters/${gamingCenterId}/pages/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildPreviewPayload()),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || response.statusText);
          }
          const html = await response.text();
          previewFrame.srcdoc = html;
          setPreviewStatus('Preview updated.');
        } catch (error) {
          setPreviewStatus(
            \`Preview failed: \${error instanceof Error ? error.message : 'Unexpected error.'}\`,
          );
        }
      };

      const savePage = async () => {
        setStatus('Validating...');
        const token = authTokenInput.value.trim();
        if (token) saveToken();
        try {
          const payload = buildPayload();
          setStatus('Saving...');
          const response = await fetch('/api/v1/gamingCenters/${gamingCenterId}/pages/${pageId}', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: \`Bearer \${token}\` } : {}),
            },
            body: JSON.stringify(payload),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || response.statusText);
          }
          const payload = await response.json();
          populateForm(payload.data);
          setStatus('Saved');
        } catch (error) {
          setStatus(\`Save failed: \${error instanceof Error ? error.message : 'Unexpected error.'}\`);
        }
      };

      saveButton.addEventListener('click', savePage);
      addSectionButton.addEventListener('click', () => addSectionModal.open());
      if (refreshPreviewButton) {
        refreshPreviewButton.addEventListener('click', loadPreview);
      }
      viewButtons.forEach((button) => {
        button.addEventListener('click', () => {
          if (button.dataset.view) {
            setActiveView(button.dataset.view);
          }
        });
      });

      loadStoredToken();
      fetchPage();
    </script>
  </body>
</html>`;
