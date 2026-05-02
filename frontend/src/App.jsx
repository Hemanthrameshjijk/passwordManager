import { useEffect, useState, useCallback } from 'react';

const API_URL = 'http://localhost:8000';
const tokenKey = 'pm_token';
const orgKey = 'pm_active_org';

function getToken() { return localStorage.getItem(tokenKey); }
function setTokenStorage(token) { localStorage.setItem(tokenKey, token); }
function clearTokenStorage() { localStorage.removeItem(tokenKey); localStorage.removeItem(orgKey); }

function getStoredOrgId() { return localStorage.getItem(orgKey); }
function setStoredOrgId(id) { localStorage.setItem(orgKey, String(id)); }

function apiFetch(path, options = {}, orgId = null) {
  const headers = options.headers || {};
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (orgId) headers['X-Org-Id'] = String(orgId);
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

// ===== Main App =====
function App() {
  const [token, setToken] = useState(getToken());
  const [user, setUser] = useState(null);
  const [activeOrgId, setActiveOrgId] = useState(() => {
    const stored = getStoredOrgId();
    return stored ? Number(stored) : null;
  });
  const [toast, setToast] = useState({ message: '', type: '' });

  const isLoggedIn = Boolean(token);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);
  const hideToast = useCallback(() => setToast({ message: '', type: '' }), []);

  // Fetch user profile
  useEffect(() => {
    if (isLoggedIn) {
      apiFetch('/auth/me').then(res => {
        if (res.ok) return res.json();
        throw new Error('Session expired');
      }).then(userData => {
        setUser(userData);
        // Auto-select org if user has exactly one, or restore stored
        if (userData.orgs && userData.orgs.length > 0) {
          const stored = getStoredOrgId();
          const validStored = stored && userData.orgs.some(o => o.org_id === Number(stored));
          if (validStored) {
            setActiveOrgId(Number(stored));
          } else {
            setActiveOrgId(userData.orgs[0].org_id);
            setStoredOrgId(userData.orgs[0].org_id);
          }
        } else {
          setActiveOrgId(null);
        }
      }).catch(() => {
        clearTokenStorage();
        setToken(null);
      });
    } else {
      setUser(null);
      setActiveOrgId(null);
    }
  }, [isLoggedIn]);

  const handleLogin = (accessToken) => {
    setTokenStorage(accessToken);
    setToken(accessToken);
  };

  const handleLogout = () => {
    clearTokenStorage();
    setToken(null);
    setUser(null);
    setActiveOrgId(null);
    showToast('Logged out');
  };

  const handleSwitchOrg = (orgId) => {
    setActiveOrgId(orgId);
    setStoredOrgId(orgId);
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

  // User has no organizations
  if (!user.orgs || user.orgs.length === 0) {
    return (
      <>
        <NoOrgScreen user={user} onLogout={handleLogout} />
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      </>
    );
  }

  return (
    <>
      <Dashboard
        user={user}
        activeOrgId={activeOrgId}
        onSwitchOrg={handleSwitchOrg}
        onLogout={handleLogout}
        showToast={showToast}
        refreshUser={() => {
          apiFetch('/auth/me').then(res => res.ok ? res.json() : null).then((data) => {
            if (data) {
              setUser(data);
              setActiveOrgId((current) => current || data.orgs?.[0]?.org_id || null);
              const stored = getStoredOrgId();
              if (!stored || !data.orgs.some(o => o.org_id === Number(stored))) {
                setStoredOrgId(data.orgs[0].org_id);
              }
            }
          });
        }}
      />
      <Toast message={toast.message} type={toast.type} onClose={hideToast} />
    </>
  );
}


// ===== AUTH SCREEN =====
function AuthScreen({ onLogin, showToast }) {
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', name: '', org_name: '' });
  const [loading, setLoading] = useState(false);

  const updateField = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    let endpoint, body;
    if (tab === 'login') {
      endpoint = '/auth/login';
      body = { email: form.email, password: form.password };
    } else if (tab === 'register') {
      endpoint = '/auth/register';
      body = { email: form.email, password: form.password, name: form.name };
    } else {
      endpoint = '/auth/admin/register';
      body = { email: form.email, password: form.password, name: form.name, org_name: form.org_name };
    }

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.detail || 'Request failed', 'error');
        return;
      }
      onLogin(data.access_token);
      showToast(tab === 'login' ? 'Welcome back!' : 'Account created!');
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
          <p>Secure credential management for teams</p>
        </div>

        <div className="auth-card">
          <div className="auth-tabs">
            <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>Login</button>
            <button className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>Register</button>
            <button className={`auth-tab ${tab === 'admin' ? 'active' : ''}`} onClick={() => setTab('admin')}>Admin Setup</button>
          </div>

          <form onSubmit={handleSubmit}>
            {(tab === 'register' || tab === 'admin') && (
              <div className="form-group">
                <label>Full Name</label>
                <input className="form-input" placeholder="John Doe" value={form.name} onChange={updateField('name')} />
              </div>
            )}
            <div className="form-group">
              <label>Email</label>
              <input className="form-input" type="email" placeholder="you@company.com" value={form.email} onChange={updateField('email')} required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input className="form-input" type="password" placeholder="••••••••" value={form.password} onChange={updateField('password')} required />
            </div>
            {tab === 'admin' && (
              <div className="form-group">
                <label>Organization Name</label>
                <input className="form-input" placeholder="Acme Corp" value={form.org_name} onChange={updateField('org_name')} required />
              </div>
            )}
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Please wait...' : tab === 'login' ? 'Sign In' : tab === 'register' ? 'Create Account' : 'Create Organization'}
            </button>
          </form>

          {tab === 'login' && (
            <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
              Don't have an account? <button style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, padding: 0, fontFamily: 'inherit', fontSize: 'inherit' }} onClick={() => setTab('register')}>Register</button>
            </p>
          )}
          {tab === 'register' && (
            <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
              Want to create an organization? <button style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, padding: 0, fontFamily: 'inherit', fontSize: 'inherit' }} onClick={() => setTab('admin')}>Admin Setup</button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}


// ===== NO ORG SCREEN =====
function NoOrgScreen({ user, onLogout }) {
  return (
    <div className="no-org-wrapper">
      <div className="no-org-card">
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⏳</div>
        <h2>Waiting for Organization</h2>
        <p>
          You've registered successfully as <strong>{user.email}</strong>.<br />
          An admin needs to add you to their organization before you can access the dashboard.
        </p>
        <div className="waiting-badge">⚡ Pending organization assignment</div>
        <div><button className="btn btn-secondary" onClick={onLogout}>Logout</button></div>
      </div>
    </div>
  );
}


// ===== DASHBOARD =====
function Dashboard({ user, activeOrgId, onSwitchOrg, onLogout, showToast, refreshUser }) {
  const [view, setView] = useState('credentials');
  const [credentials, setCredentials] = useState([]);
  const [files, setFiles] = useState([]);
  const [users, setUsers] = useState([]);

  const activeOrg = user.orgs.find(o => o.org_id === activeOrgId);
  const isAdmin = activeOrg?.role === 'admin';

  const loadCredentials = useCallback(async () => {
    const res = await apiFetch('/credentials', {}, activeOrgId);
    if (res.ok) setCredentials(await res.json());
  }, [activeOrgId]);

  const loadFiles = useCallback(async () => {
    const res = await apiFetch('/files', {}, activeOrgId);
    if (res.ok) setFiles(await res.json());
  }, [activeOrgId]);

  const loadUsers = useCallback(async () => {
    const res = await apiFetch('/users', {}, activeOrgId);
    if (res.ok) setUsers(await res.json());
  }, [activeOrgId]);

  useEffect(() => {
    if (activeOrgId) {
      loadCredentials();
      loadFiles();
      loadUsers();
    }
  }, [activeOrgId, loadCredentials, loadFiles, loadUsers]);

  const tabs = [
    { key: 'credentials', label: '🔑 Credentials' },
    { key: 'files', label: '📁 Files' },
  ];
  const canCreateOrg = user.orgs.some(o => o.role === 'admin');
  if (canCreateOrg) tabs.push({ key: 'organizations', label: '🏢 Organizations' });
  if (isAdmin) tabs.push({ key: 'users', label: '👥 Users' });

  return (
    <div className="dashboard-wrapper">
      {/* TOPBAR */}
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-logo">🔐</div>
          <div className="topbar-title">Password Manager</div>
        </div>
        <div className="topbar-right">
          {/* Org Switcher */}
          {user.orgs.length > 1 && (
            <div className="org-switcher">
              <select
                className="org-select"
                value={activeOrgId || ''}
                onChange={(e) => onSwitchOrg(Number(e.target.value))}
              >
                {user.orgs.map(o => (
                  <option key={o.org_id} value={o.org_id}>
                    {o.org_name} ({o.role})
                  </option>
                ))}
              </select>
            </div>
          )}
          {user.orgs.length === 1 && (
            <div className="org-badge">
              <span className="org-badge-name">{activeOrg?.org_name}</span>
              <span className={`role-tag ${activeOrg?.role}`}>{activeOrg?.role}</span>
            </div>
          )}

          <div className="user-badge">
            <div className="avatar">{(user.name || user.email)[0].toUpperCase()}</div>
            <div className="user-info">
              <div className="user-name">{user.name || user.email}</div>
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
          <CredentialsView credentials={credentials} onReload={loadCredentials} showToast={showToast} orgId={activeOrgId} users={users} />
        )}
        {view === 'files' && (
          <FilesView files={files} onReload={loadFiles} showToast={showToast} orgId={activeOrgId} users={users} />
        )}
        {view === 'organizations' && canCreateOrg && (
          <OrganizationsView user={user} showToast={showToast} refreshUser={refreshUser} />
        )}
        {view === 'users' && isAdmin && (
          <UsersView users={users} currentUserId={user.id} onReload={loadUsers} showToast={showToast} orgId={activeOrgId} />
        )}
      </div>
    </div>
  );
}


// ===== CREDENTIALS VIEW =====
function CredentialsView({ credentials, onReload, showToast, orgId, users }) {
  const [form, setForm] = useState({ domain: '', username: '', password: '' });

  const handleCreate = async (e) => {
    e.preventDefault();
    const res = await apiFetch('/credentials', { method: 'POST', body: JSON.stringify(form) }, orgId);
    if (!res.ok) { showToast('Failed to create credential', 'error'); return; }
    setForm({ domain: '', username: '', password: '' });
    await onReload();
    showToast('Credential created');
  };

  return (
    <div className="panel-grid">
      <div className="panel">
        <h2>➕ Add Credential</h2>
        <div className="divider" />
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label>Domain / Website</label>
            <input className="form-input" placeholder="github.com" value={form.domain} onChange={e => setForm(p => ({ ...p, domain: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label>Username</label>
            <input className="form-input" placeholder="john@example.com" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} required />
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
          <h2>🔑 Stored Credentials</h2>
          <button className="btn btn-secondary btn-sm" onClick={onReload}>Refresh</button>
        </div>
        <div className="item-list">
          {!credentials.length ? (
            <div className="empty-state">
              <div className="empty-icon">🔒</div>
              <p>No credentials stored yet</p>
            </div>
          ) : credentials.map(item => (
            <div className="item-card" key={item.id}>
              <div className="item-title">{item.domain}</div>
              <div className="item-meta">User: {item.username}</div>
              <div className="item-meta">Pass: {'•'.repeat(8)}</div>
              <div className="item-meta">Shared: {item.shared_with.length ? item.shared_with.map(id => {
                const u = users.find(u => u.user_id === id);
                return u ? u.email : `#${id}`;
              }).join(', ') : 'No one'}</div>
              <ShareForm users={users} onShare={async (userIds) => {
                const res = await apiFetch('/credentials/share', { method: 'POST', body: JSON.stringify({ credential_id: item.id, user_ids: userIds }) }, orgId);
                if (res.ok) { showToast('Credential shared'); onReload(); }
                else showToast('Share failed', 'error');
              }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// ===== FILES VIEW =====
function FilesView({ files, onReload, showToast, orgId, users }) {
  const [uploadFile, setUploadFile] = useState(null);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;
    const formData = new FormData();
    formData.append('file', uploadFile);
    const res = await apiFetch('/files/upload', { method: 'POST', body: formData }, orgId);
    if (!res.ok) { showToast('Upload failed', 'error'); return; }
    setUploadFile(null);
    await onReload();
    showToast('File uploaded');
  };

  return (
    <div className="panel-grid">
      <div className="panel">
        <h2>📤 Upload File</h2>
        <div className="divider" />
        <form onSubmit={handleUpload}>
          <div className="form-group">
            <label>Select File</label>
            <input className="form-input" type="file" onChange={e => setUploadFile(e.target.files?.[0] ?? null)} required />
          </div>
          <button className="btn btn-primary" type="submit">Upload</button>
        </form>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>📁 Files</h2>
          <button className="btn btn-secondary btn-sm" onClick={onReload}>Refresh</button>
        </div>
        <div className="item-list">
          {!files.length ? (
            <div className="empty-state">
              <div className="empty-icon">📂</div>
              <p>No files uploaded yet</p>
            </div>
          ) : files.map(item => (
            <div className="item-card" key={item.id}>
              <div className="item-title">{item.file_name}</div>
              <div className="item-meta">
                <a href={`${API_URL}${item.storage_url}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>Download</a>
              </div>
              <div className="item-meta">Shared: {item.shared_with.length ? item.shared_with.map(id => {
                const u = users.find(u => u.user_id === id);
                return u ? u.email : `#${id}`;
              }).join(', ') : 'No one'}</div>
              <ShareForm users={users} onShare={async (userIds) => {
                const res = await apiFetch('/files/share', { method: 'POST', body: JSON.stringify({ file_id: item.id, user_ids: userIds }) }, orgId);
                if (res.ok) { showToast('File shared'); onReload(); }
                else showToast('Share failed', 'error');
              }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// ===== ORGANIZATIONS VIEW =====
function OrganizationsView({ user, showToast, refreshUser }) {
  const [orgName, setOrgName] = useState('');

  const canCreateOrg = user.orgs.some(o => o.role === 'admin');

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    if (!orgName.trim()) {
      showToast('Organization name is required', 'error');
      return;
    }
    const res = await apiFetch('/orgs', { method: 'POST', body: JSON.stringify({ name: orgName.trim() }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.detail || 'Failed to create organization', 'error');
      return;
    }
    setOrgName('');
    await refreshUser();
    showToast('Organization created');
  };

  return (
    <div className="panel-grid">
      <div className="panel">
        <h2>🏢 Your Organizations</h2>
        <div className="divider" />
        <div className="item-list">
          {user.orgs.map(org => (
            <div className="item-card" key={org.org_id}>
              <div className="item-title">{org.org_name}</div>
              <div className="item-meta">Role: {org.role}</div>
              <div className="item-meta">Org ID: {org.org_id}</div>
            </div>
          ))}
        </div>
      </div>

      {canCreateOrg && (
        <div className="panel">
          <h2>➕ Create New Organization</h2>
          <div className="divider" />
          <form onSubmit={handleCreateOrg}>
            <div className="form-group">
              <label>Organization Name</label>
              <input className="form-input" placeholder="New org name" value={orgName} onChange={e => setOrgName(e.target.value)} required />
            </div>
            <button className="btn btn-primary" type="submit">Create Organization</button>
          </form>
        </div>
      )}
    </div>
  );
}


// ===== USERS VIEW (Admin Only) =====
function UsersView({ users, currentUserId, onReload, showToast, orgId }) {
  const [addMode, setAddMode] = useState('existing');
  const [existingEmail, setExistingEmail] = useState('');
  const [existingRole, setExistingRole] = useState('user');
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'user' });

  const handleAddExisting = async (e) => {
    e.preventDefault();
    const res = await apiFetch('/users/add-to-org', { method: 'POST', body: JSON.stringify({ email: existingEmail, role: existingRole }) }, orgId);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { showToast(data.detail || 'Failed to add user', 'error'); return; }
    setExistingEmail('');
    setExistingRole('user');
    await onReload();
    showToast('User added to organization');
  };

  const handleCreateNew = async (e) => {
    e.preventDefault();
    const res = await apiFetch('/users', { method: 'POST', body: JSON.stringify(newUser) }, orgId);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { showToast(data.detail || 'Failed to create user', 'error'); return; }
    setNewUser({ email: '', password: '', role: 'user' });
    await onReload();
    showToast('User created and added');
  };

  const handleRemove = async (membershipId) => {
    if (!confirm('Remove this user from the organization?')) return;
    const res = await apiFetch(`/users/${membershipId}`, { method: 'DELETE' }, orgId);
    if (res.ok) { showToast('User removed'); onReload(); }
    else showToast('Failed to remove user', 'error');
  };

  return (
    <div className="panel-grid">
      <div className="panel">
        <h2>👥 Add User to Organization</h2>
        <div className="divider" />
        <div className="auth-tabs" style={{ marginBottom: '20px' }}>
          <button className={`auth-tab ${addMode === 'existing' ? 'active' : ''}`} onClick={() => setAddMode('existing')}>Add Existing</button>
          <button className={`auth-tab ${addMode === 'new' ? 'active' : ''}`} onClick={() => setAddMode('new')}>Create New</button>
        </div>

        {addMode === 'existing' ? (
          <form onSubmit={handleAddExisting}>
            <div className="form-group">
              <label>User Email</label>
              <input className="form-input" type="email" placeholder="user@example.com" value={existingEmail} onChange={e => setExistingEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select className="form-input" value={existingRole} onChange={e => setExistingRole(e.target.value)}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button className="btn btn-primary" type="submit">Add to Organization</button>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '12px' }}>
              💡 The user must have registered first. Enter their email to add them.
            </p>
          </form>
        ) : (
          <form onSubmit={handleCreateNew}>
            <div className="form-group">
              <label>Email</label>
              <input className="form-input" type="email" placeholder="newuser@example.com" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input className="form-input" type="password" placeholder="••••••••" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select className="form-input" value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button className="btn btn-primary" type="submit">Create & Add User</button>
          </form>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>🏢 Organization Members</h2>
          <button className="btn btn-secondary btn-sm" onClick={onReload}>Refresh</button>
        </div>
        <div className="item-list">
          {!users.length ? (
            <div className="empty-state">
              <div className="empty-icon">👤</div>
              <p>No members yet</p>
            </div>
          ) : users.map(u => (
            <div className="item-card" key={u.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="item-title">{u.name || u.email}</div>
                  <div className="item-meta">{u.email}</div>
                  <span className={`role-tag ${u.role}`}>{u.role}</span>
                </div>
                {u.user_id !== currentUserId && (
                  <button className="btn btn-danger btn-sm" onClick={() => handleRemove(u.id)}>Remove</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// ===== SHARE FORM =====
function ShareForm({ users, onShare }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);

  const candidates = (users || [])
    .filter(user => !selected.some(sel => sel.user_id === user.user_id))
    .filter(user => {
      const term = search.toLowerCase();
      return !term || (user.email && user.email.toLowerCase().includes(term)) || (user.name && user.name.toLowerCase().includes(term));
    });

  return (
    <form className="inline-form" onSubmit={(e) => {
      e.preventDefault();
      const userIds = selected.map(u => u.user_id);
      if (userIds.length) { onShare(userIds); setSelected([]); setSearch(''); }
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input className="form-input" placeholder="Search members to share with" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn btn-success btn-sm" type="submit" disabled={!selected.length}>Share</button>
        </div>
        {selected.length > 0 && (
          <div className="share-selected-list">
            {selected.map(user => (
              <span className="share-chip" key={user.user_id}>
                {user.name || user.email}
                <button type="button" onClick={() => setSelected(prev => prev.filter(u => u.user_id !== user.user_id))}>×</button>
              </span>
            ))}
          </div>
        )}
        {search && candidates.length > 0 && (
          <div className="share-suggestions">
            {candidates.slice(0, 6).map(user => (
              <button key={user.user_id} type="button" className="share-suggestion" onClick={() => { setSelected(prev => [...prev, user]); setSearch(''); }}>
                {user.name ? `${user.name} — ${user.email}` : user.email}
              </button>
            ))}
          </div>
        )}
      </div>
    </form>
  );
}


export default App;
