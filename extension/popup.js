const API_URL = 'http://localhost:8000';

document.addEventListener('DOMContentLoaded', async () => {
  const loginView = document.getElementById('login-view');
  const vaultView = document.getElementById('vault-view');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  const itemsContainer = document.getElementById('items-container');
  const userDisplay = document.getElementById('user-display');
  const loginError = document.getElementById('login-error');

  // Check if token exists
  const checkAuth = async () => {
    const { token, email } = await chrome.storage.local.get(['token', 'email']);
    if (token) {
      showVault(email);
      fetchVault(token);
    } else {
      showLogin();
    }
  };

  const showLogin = () => {
    loginView.classList.remove('hidden');
    vaultView.classList.add('hidden');
  };

  const showVault = (email) => {
    loginView.classList.add('hidden');
    vaultView.classList.remove('hidden');
    userDisplay.textContent = email;
  };

  const fetchVault = async (token) => {
    try {
      const response = await fetch(`${API_URL}/vault`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const items = await response.json();
        renderItems(items);
      } else {
        throw new Error('Failed to fetch vault');
      }
    } catch (err) {
      console.error(err);
      itemsContainer.innerHTML = '<div class="error">Error loading vault. Is backend running?</div>';
    }
  };

  const renderItems = (items) => {
    itemsContainer.innerHTML = '';
    if (items.length === 0) {
      itemsContainer.innerHTML = '<div style="text-align: center; color: #64748b;">No items found</div>';
      return;
    }
    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'vault-item';
      
      // For MVP, we assume encrypted_data is "username:password"
      // In real zero-knowledge, decryption happens here using a user key
      const [username, password] = item.encrypted_data.split(':');

      div.innerHTML = `
        <span>${item.title}</span>
        <button class="autofill-btn" data-username="${username}" data-password="${password}">Autofill</button>
      `;
      itemsContainer.appendChild(div);
    });

    // Add listeners to autofill buttons
    document.querySelectorAll('.autofill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const { username, password } = btn.dataset;
        triggerAutofill(username, password);
      });
    });
  };

  const triggerAutofill = async (username, password) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    chrome.tabs.sendMessage(tab.id, {
      action: 'AUTOFILL',
      data: { username, password }
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        alert('Could not autofill. Please refresh the page and try again.');
      }
    });
  };

  loginBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    loginError.classList.add('hidden');

    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        await chrome.storage.local.set({ token: data.access_token, email });
        showVault(email);
        fetchVault(data.access_token);
      } else {
        const err = await response.json();
        loginError.textContent = err.detail || 'Login failed';
        loginError.classList.remove('hidden');
      }
    } catch (err) {
      loginError.textContent = 'Connection error. Is backend running?';
      loginError.classList.remove('hidden');
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await chrome.storage.local.clear();
    showLogin();
  });

  refreshBtn.addEventListener('click', async () => {
    const { token } = await chrome.storage.local.get('token');
    if (token) fetchVault(token);
  });

  checkAuth();
});
