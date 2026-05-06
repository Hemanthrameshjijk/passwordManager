import { useEffect, useState, useCallback, useRef } from 'react';

const API_URL = 'http://localhost:8000';
const tokenKey = 'pm_token';
const projectKey = 'pm_active_project';

function getToken() { return localStorage.getItem(tokenKey); }
function setTokenStorage(token) { localStorage.setItem(tokenKey, token); }
function clearTokenStorage() { localStorage.removeItem(tokenKey); localStorage.removeItem(projectKey); }

function getStoredProjectId() { return localStorage.getItem(projectKey); }
function setStoredProjectId(id) {
  if (id === null) localStorage.removeItem(projectKey);
  else localStorage.setItem(projectKey, String(id));
}

function apiFetch(path, options = {}, projectId = null) {
  const headers = options.headers || {};
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (projectId) headers['X-Project-Id'] = String(projectId);
  return fetch(`${API_URL}${path}`, { ...options, headers });
}

// ===== Toast Component =====
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);
  if (!message) return null;
  return <div className={`toast ${type}`}>{message}</div>;
}

// ===== Searchable User Dropdown =====
function UserSearchDropdown({ onSelect, placeholder = "Search for a user..." }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await apiFetch(`/users/search?query=${query}`);
      if (res.ok) setResults(await res.json());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="search-dropdown-container" ref={containerRef}>
      <input
        className="form-input"
        placeholder={placeholder}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
      />
      {isOpen && results.length > 0 && (
        <div className="search-results-overlay">
          {results.map(user => (
            <div key={user.id} className="search-result-item" onClick={() => { onSelect(user); setQuery(''); setIsOpen(false); }}>
              <div className="result-name">{user.name || user.email}</div>
              <div className="result-email">{user.email}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== Main App =====
function App() {
  const [token, setToken] = useState(getToken());
  const [user, setUser] = useState(null);
  const [activeProjectId, setActiveProjectId] = useState(() => {
    const stored = getStoredProjectId();
    return (stored && stored !== 'null') ? Number(stored) : null;
  });
  const [toast, setToast] = useState({ message: '', type: '' });

  const isLoggedIn = Boolean(token);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);
  const hideToast = useCallback(() => setToast({ message: '', type: '' }), []);

  const refreshUser = useCallback(() => {
    if (!isLoggedIn) return;
    apiFetch('/auth/me').then(res => {
      if (res.ok) return res.json();
      throw new Error('Session expired');
    }).then(userData => {
      setUser(userData);
      const stored = getStoredProjectId();
      if (stored && stored !== 'null') {
        const id = Number(stored);
        if (!userData.projects.some(p => p.project_id === id)) {
          setActiveProjectId(null);
          setStoredProjectId(null);
        }
      }
    }).catch(() => {
      clearTokenStorage();
      setToken(null);
    });
  }, [isLoggedIn]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const handleLogin = (accessToken) => {
    setTokenStorage(accessToken);
    setToken(accessToken);
  };

  const handleLogout = () => {
    clearTokenStorage();
    setToken(null);
    setUser(null);
    setActiveProjectId(null);
    showToast('Logged out');
  };

  const handleSwitchProject = (id) => {
    setActiveProjectId(id);
    setStoredProjectId(id);
  };

  if (!isLoggedIn) {
    return (
      <>
        <AuthScreen onLogin={handleLogin} showToast={showToast} />
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      </>
    );
  }

  if (!user) {
    return (
      <div className="auth-wrapper">
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Dashboard
        user={user}
        activeProjectId={activeProjectId}
        onSwitchProject={handleSwitchProject}
        onLogout={handleLogout}
        showToast={showToast}
        refreshUser={refreshUser}
      />
      <Toast message={toast.message} type={toast.type} onClose={hideToast} />
    </>
  );
}


// ===== AUTH SCREEN =====
function AuthScreen({ onLogin, showToast }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const updateField = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.detail || 'Login failed', 'error');
        return;
      }
      onLogin(data.access_token);
      showToast('Welcome back!');
    } catch {
      showToast('Connection error. Is backend running?', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-container">
        <div className="auth-logo">
          <div className="logo-icon">🔐</div>
          <h1>Password Manager</h1>
          <p>Enterprise Credential Vault</p>
        </div>

        <div className="auth-card">
          <div className="auth-header">
            <h2>Log In</h2>
            <p>Access your secure workspace</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email</label>
              <input className="form-input" type="email" placeholder="you@company.com" value={form.email} onChange={updateField('email')} required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input className="form-input" type="password" placeholder="••••••••" value={form.password} onChange={updateField('password')} required />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Only authorized users can access this platform.<br />
            Contact your administrator for credentials.
          </p>
        </div>
      </div>
    </div>
  );
}


// ===== DASHBOARD =====
function Dashboard({ user, activeProjectId, onSwitchProject, onLogout, showToast, refreshUser }) {
  const [view, setView] = useState('credentials');
  const [credentials, setCredentials] = useState([]);
  const [files, setFiles] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);

  const activeProject = user.projects.find(p => p.project_id === activeProjectId);
  const isProjectAdmin = activeProject?.role === 'admin';

  const loadCredentials = useCallback(async () => {
    const res = await apiFetch('/credentials', {}, activeProjectId);
    if (res.ok) setCredentials(await res.json());
  }, [activeProjectId]);

  const loadFiles = useCallback(async (search = '') => {
    const path = `/files${search ? `?q=${encodeURIComponent(search)}` : ''}`;
    const res = await apiFetch(path, {}, activeProjectId);
    if (res.ok) setFiles(await res.json());
  }, [activeProjectId]);

  const loadProjects = useCallback(async () => {
    const res = await apiFetch('/projects');
    if (res.ok) setProjects(await res.json());
  }, []);

  const loadMembers = useCallback(async () => {
    if (!activeProjectId) {
      setProjectMembers([]);
      return;
    }
    const res = await apiFetch('/users', {}, activeProjectId);
    if (res.ok) setProjectMembers(await res.json());
  }, [activeProjectId]);

  useEffect(() => {
    loadCredentials();
    loadFiles();
    loadProjects();
    loadMembers();
  }, [activeProjectId, loadCredentials, loadFiles, loadProjects, loadMembers]);

  const tabs = [
    { key: 'credentials', label: '🔑 Credentials' },
    { key: 'files', label: '📁 Files' },
    { key: 'projects', label: '🏗️ Projects' },
  ];
  if (user.is_superadmin) tabs.push({ key: 'admin', label: '🛡️ Admin Portal' });

  return (
    <div className="dashboard-wrapper">
      {/* TOPBAR */}
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-logo">🔐</div>
          <div className="topbar-title">Vault</div>
        </div>
        <div className="topbar-right">
          <div className="org-switcher">
            <select
              className="org-select"
              value={activeProjectId || 'null'}
              onChange={(e) => onSwitchProject(e.target.value === 'null' ? null : Number(e.target.value))}
            >
              <option value="null">🔓 My Private Vault</option>
              {user.projects.map(p => (
                <option key={p.project_id} value={p.project_id}>
                  🏢 {p.project_name}
                </option>
              ))}
            </select>
          </div>

          <div className="user-badge">
            <div className="avatar">{(user.name || user.email)[0].toUpperCase()}</div>
            <div className="user-info">
              <div className="user-name">{user.name || user.email}</div>
              {user.is_superadmin && <div style={{ fontSize: '0.65rem', color: 'var(--accent)', fontWeight: 700 }}>SUPER ADMIN</div>}
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onLogout}>Logout</button>
        </div>
      </div>

      {/* MAIN */}
      <div className="main-content">
        <div className="nav-tabs">
          {tabs.map(t => (
            <button key={t.key} className={`nav-tab ${view === t.key ? 'active' : ''}`} onClick={() => setView(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {view === 'credentials' && (
          <CredentialsView
            credentials={credentials}
            onReload={loadCredentials}
            showToast={showToast}
            projectId={activeProjectId}
            isPrivate={!activeProjectId}
          />
        )}
        {view === 'files' && (
          <FilesView
            files={files}
            onReload={loadFiles}
            showToast={showToast}
            projectId={activeProjectId}
            isPrivate={!activeProjectId}
          />
        )}
        {view === 'projects' && (
          <ProjectsView
            projects={projects}
            onReload={() => { loadProjects(); refreshUser(); }}
            showToast={showToast}
            activeProjectId={activeProjectId}
            onSwitch={onSwitchProject}
            members={projectMembers}
          />
        )}
        {view === 'admin' && user.is_superadmin && (
          <AdminPortal showToast={showToast} />
        )}
      </div>
    </div>
  );
}


// ===== CREDENTIALS VIEW =====
function CredentialsView({ credentials, onReload, showToast, projectId, isPrivate }) {
  const [form, setForm] = useState({ domain: '', username: '', password: '' });

  const handleCreate = async (e) => {
    e.preventDefault();
    const body = { ...form, project_id: projectId };
    const res = await apiFetch('/credentials', { method: 'POST', body: JSON.stringify(body) });
    if (!res.ok) { showToast('Failed to create credential', 'error'); return; }
    setForm({ domain: '', username: '', password: '' });
    await onReload();
    showToast(`Saved to ${isPrivate ? 'Private Vault' : 'Project'}`);
  };

  return (
    <div className="panel-grid">
      <div className="panel">
        <h2>➕ {isPrivate ? 'Add Private Credential' : 'Add to Project'}</h2>
        <div className="divider" />
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label>Domain</label>
            <input className="form-input" placeholder="github.com" value={form.domain} onChange={e => setForm(p => ({ ...p, domain: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label>Username</label>
            <input className="form-input" placeholder="user@email.com" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input className="form-input" type="password" placeholder="••••••••" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
          </div>
          <button className="btn btn-primary" type="submit">Save Credential</button>
        </form>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>🔑 {isPrivate ? 'My Private Vault' : 'Project Credentials'}</h2>
          <button className="btn btn-secondary btn-sm" onClick={onReload}>Refresh</button>
        </div>
        <div className="item-list">
          {!credentials.length ? (
            <div className="empty-state">
              <div className="empty-icon">{isPrivate ? '🔒' : '🏢'}</div>
              <p>No credentials stored here</p>
            </div>
          ) : credentials.map(item => (
            <CredentialCard key={item.id} item={item} showToast={showToast} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CredentialCard({ item, showToast }) {
  const [showPassword, setShowPassword] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(item.password);
    showToast('Password copied to clipboard');
  };

  return (
    <div className="item-card">
      <div className="item-card-header">
        <div className="item-title">{item.domain}</div>
        <div className="item-card-actions">
          <button className="icon-btn" title={showPassword ? "Hide" : "View"} onClick={() => setShowPassword(!showPassword)}>
            {showPassword ? '👁️‍🗨️' : '👁️'}
          </button>
          <button className="icon-btn" title="Copy Password" onClick={handleCopy}>
            📋
          </button>
        </div>
      </div>
      <div className="item-meta">User: {item.username}</div>
      <div className="item-meta">
        Pass: <span className="password-display">{showPassword ? item.password : '••••••••'}</span>
      </div>
      <div className="item-footer">
        <span className="creator-badge">👤 Created by: {item.creator_name || item.creator_email}</span>
      </div>
    </div>
  );
}


// ===== FILES VIEW =====
function FilesView({ files, onReload, showToast, projectId, isPrivate }) {
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTag, setUploadTag] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [existingTags, setExistingTags] = useState([]);

  const loadTags = useCallback(async () => {
    const res = await apiFetch('/files/tags', {}, projectId);
    if (res.ok) setExistingTags(await res.json());
  }, [projectId]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    onReload(val); // This calls loadFiles(val) from Dashboard
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;
    const formData = new FormData();
    formData.append('file', uploadFile);
    if (uploadTag) formData.append('tag', uploadTag);
    if (projectId) formData.append('project_id', projectId);

    const res = await apiFetch('/files/upload', { method: 'POST', body: formData });
    if (!res.ok) { showToast('Upload failed', 'error'); return; }
    setUploadFile(null);
    setUploadTag('');
    await onReload(searchQuery);
    await loadTags();
    showToast('File uploaded');
  };

  return (
    <div className="panel-grid">
      <div className="panel">
        <h2>📤 {isPrivate ? 'Upload Private' : 'Upload to Project'}</h2>
        <div className="divider" />
        <form onSubmit={handleUpload}>
          <div className="form-group">
            <label>Select File</label>
            <input className="form-input" type="file" onChange={e => setUploadFile(e.target.files?.[0] ?? null)} required />
          </div>
          <div className="form-group">
            <label>Tag (Optional)</label>
            <input
              className="form-input"
              placeholder="e.g. v1, Draft, Final"
              value={uploadTag}
              onChange={e => setUploadTag(e.target.value)}
              list="existing-tags"
            />
            <datalist id="existing-tags">
              {existingTags.map(tag => (
                <option key={tag} value={tag} />
              ))}
            </datalist>
          </div>
          <button className="btn btn-primary" type="submit">Upload</button>
        </form>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>📁 {isPrivate ? 'My Private Files' : 'Project Files'}</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              className="form-input"
              style={{ width: '200px', fontSize: '0.8rem', padding: '6px 10px' }}
              placeholder="Search files or tags..."
              value={searchQuery}
              onChange={handleSearchChange}
            />
            <button className="btn btn-secondary btn-sm" onClick={() => onReload(searchQuery)}>Refresh</button>
          </div>
        </div>
        <div className="item-list">
          {!files.length ? (
            <div className="empty-state">
              <div className="empty-icon">📂</div>
              <p>No files yet</p>
            </div>
          ) : files.map(item => (
            <div className="item-card" key={item.id}>
              <div className="item-card-header" style={{ marginBottom: '8px' }}>
                <div className="item-title">{item.file_name}</div>
                <div className="item-card-actions">
                   <a href={`${API_URL}${item.storage_url}`} target="_blank" rel="noreferrer" className="icon-btn" title="Download">⬇️</a>
                </div>
              </div>

              <div className="file-tag-container">
                {item.tag ? (
                  <span className="file-tag">🏷️ {item.tag}</span>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No tag</span>
                )}
              </div>

              <div className="item-footer" style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="creator-badge">👤 {item.creator_name || item.creator_email}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// ===== PROJECTS VIEW =====
function ProjectsView({ projects, onReload, showToast, activeProjectId, onSwitch, members }) {
  const [newProjName, setNewProjName] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  const activeProject = projects.find(p => p.project_id === activeProjectId);

  const handleCreate = async (e) => {
    e.preventDefault();
    const res = await apiFetch('/projects', { method: 'POST', body: JSON.stringify({ name: newProjName }) });
    if (res.ok) {
      setNewProjName('');
      onReload();
      showToast('Project created');
    } else {
      showToast('Failed to create project', 'error');
    }
  };

  const handleInvite = async () => {
    if (!selectedUser) return;
    const res = await apiFetch('/users/add-to-project', { method: 'POST', body: JSON.stringify({ email: selectedUser.email, role: 'user' }) }, activeProjectId);
    if (res.ok) {
      setSelectedUser(null);
      showToast('User added to project');
      onReload();
    } else {
      const data = await res.json();
      showToast(data.detail || 'Invite failed', 'error');
    }
  };

  return (
    <div className="panel-grid">
      <div className="panel">
        <h2>🏗️ Project Management</h2>
        <div className="divider" />
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label>Create New Project</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input className="form-input" placeholder="e.g. Marketing Team" value={newProjName} onChange={e => setNewProjName(e.target.value)} required />
              <button className="btn btn-primary" type="submit">Create</button>
            </div>
          </div>
        </form>

        <h3 style={{ marginTop: '32px', fontSize: '0.9rem' }}>📁 Your Projects</h3>
        <div className="item-list" style={{ marginTop: '12px' }}>
          {projects.map(p => (
            <div className={`item-card ${activeProjectId === p.project_id ? 'active-border' : ''}`} key={p.project_id} style={{ cursor: 'pointer' }} onClick={() => onSwitch(p.project_id)}>
              <div className="item-title">{p.project_name}</div>
              <div className="item-meta">Role: {p.role}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        {activeProject ? (
          <>
            <div className="panel-header">
              <h2>👥 Members: {activeProject.project_name}</h2>
              {activeProject.role === 'admin' && <span className="role-tag admin">Owner</span>}
            </div>
            <div className="divider" />

            {activeProject.role === 'admin' && (
              <div className="invite-section" style={{ marginBottom: '24px' }}>
                <label className="form-label">Search & Invite Members</label>
                <div className="invite-controls">
                  <UserSearchDropdown onSelect={setSelectedUser} placeholder="Search by name or email..." />
                  <button className="btn btn-success" onClick={handleInvite} disabled={!selectedUser}>Invite</button>
                </div>
                {selectedUser && (
                  <div className="selected-user-preview">
                    Selected: <strong>{selectedUser.name || selectedUser.email}</strong>
                    <button className="btn-clear" onClick={() => setSelectedUser(null)}>×</button>
                  </div>
                )}
              </div>
            )}

            <div className="item-list">
              {members.map(m => (
                <div className="item-card" key={m.id}>
                  <div className="item-title">{m.name || m.email}</div>
                  <div className="item-meta">{m.email}</div>
                  <span className={`role-tag ${m.role}`}>{m.role}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📁</div>
            <p>Select a project to manage its members</p>
          </div>
        )}
      </div>
    </div>
  );
}


// ===== ADMIN PORTAL =====
function AdminPortal({ showToast }) {
  const [form, setForm] = useState({ email: '', password: '', name: '', is_superadmin: false });

  const handleCreate = async (e) => {
    e.preventDefault();
    const res = await apiFetch('/users/register', { method: 'POST', body: JSON.stringify(form) });
    if (res.ok) {
      setForm({ email: '', password: '', name: '', is_superadmin: false });
      showToast('User registered successfully');
    } else {
      const data = await res.json();
      showToast(data.detail || 'Registration failed', 'error');
    }
  };

  return (
    <div className="panel" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2>🛡️ Admin: User Registration</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px' }}>
        Create new platform accounts.
      </p>
      <div className="divider" />
      <form onSubmit={handleCreate}>
        <div className="form-group">
          <label>Full Name</label>
          <input className="form-input" placeholder="John Doe" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>Email Address</label>
          <input className="form-input" type="email" placeholder="user@company.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
        </div>
        <div className="form-group">
          <label>Initial Password</label>
          <input className="form-input" type="password" placeholder="••••••••" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
        </div>
        <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
          <input type="checkbox" checked={form.is_superadmin} onChange={e => setForm(p => ({ ...p, is_superadmin: e.target.checked }))} />
          <label style={{ margin: 0, fontWeight: 500 }}>Grant Super Admin Privileges</label>
        </div>
        <button className="btn btn-primary" type="submit" style={{ marginTop: '20px' }}>Register Account</button>
      </form>
    </div>
  );
}

export default App;
