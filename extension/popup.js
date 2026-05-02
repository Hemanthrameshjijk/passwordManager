const API_URL = 'http://localhost:8000';

const views = {
  login: document.getElementById('view-login'),
  vault: document.getElementById('view-vault')
};

const elements = {
  emailInput: document.getElementById('login-email'),
  passInput: document.getElementById('login-pass'),
  btnLogin: document.getElementById('btn-login'),
  btnLogout: document.getElementById('btn-logout'),
  statusUser: document.getElementById('status-user'),
  projectSelect: document.getElementById('project-select'),
  listCredentials: document.getElementById('list-credentials')
};

function switchView(viewName) {
  Object.values(views).forEach(v => v.classList.remove('active'));
  views[viewName].classList.add('active');
}

async function apiFetch(path, options = {}, projectId = null) {
  const { token } = await chrome.storage.local.get('token');
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (projectId && projectId !== 'null') headers['X-Project-Id'] = projectId;
  if (!options.body || typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  return fetch(`${API_URL}${path}`, { ...options, headers });
}

async function loadVault() {
  const { activeProjectId } = await chrome.storage.local.get('activeProjectId');
  const res = await apiFetch('/credentials', {}, activeProjectId);
  if (!res.ok) return;

  const credentials = await res.json();
  elements.listCredentials.innerHTML = '';
  
  if (credentials.length === 0) {
    elements.listCredentials.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">No credentials found</div>';
    return;
  }

  credentials.forEach(cred => {
    const div = document.createElement('div');
    div.className = 'credential-item';
    div.innerHTML = `
      <div class="item-domain">${cred.domain}</div>
      <div class="item-user">${cred.username}</div>
    `;
    div.onclick = () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'AUTOFILL', credential: cred });
      });
    };
    elements.listCredentials.appendChild(div);
  });
}

async function loadProjects(user) {
  elements.projectSelect.innerHTML = '<option value="null">🔓 My Private Vault</option>';
  user.projects.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.project_id;
    opt.textContent = `🏢 ${p.project_name}`;
    elements.projectSelect.appendChild(opt);
  });

  const { activeProjectId } = await chrome.storage.local.get('activeProjectId');
  if (activeProjectId) elements.projectSelect.value = activeProjectId;
}

async function checkAuth() {
  const { token } = await chrome.storage.local.get('token');
  if (!token) {
    switchView('login');
    elements.statusUser.textContent = 'Not logged in';
    elements.btnLogout.style.display = 'none';
    return;
  }

  const res = await apiFetch('/auth/me');
  if (res.ok) {
    const user = await res.json();
    elements.statusUser.textContent = user.name || user.email;
    elements.btnLogout.style.display = 'inline';
    await loadProjects(user);
    await loadVault();
    switchView('vault');
  } else {
    chrome.storage.local.remove(['token', 'activeProjectId']);
    switchView('login');
  }
}

elements.btnLogin.onclick = async () => {
  const email = elements.emailInput.value;
  const password = elements.passInput.value;

  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (res.ok) {
    const { access_token } = await res.json();
    await chrome.storage.local.set({ token: access_token });
    checkAuth();
  } else {
    alert('Login failed');
  }
};

elements.btnLogout.onclick = async () => {
  await chrome.storage.local.remove(['token', 'activeProjectId']);
  checkAuth();
};

elements.projectSelect.onchange = async () => {
  const id = elements.projectSelect.value;
  await chrome.storage.local.set({ activeProjectId: id });
  loadVault();
};

document.addEventListener('DOMContentLoaded', checkAuth);
