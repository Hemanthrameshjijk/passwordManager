const API_URL = "http://localhost:8000";
const tokenKey = "zkac_token";

const authSection = document.getElementById("auth-section");
const dashboardSection = document.getElementById("dashboard-section");
const logoutBtn = document.getElementById("logoutBtn");
const notification = document.getElementById("notification");
const tabs = document.querySelectorAll(".tabs button");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const createCredentialForm = document.getElementById("createCredentialForm");
const uploadForm = document.getElementById("uploadForm");
const addUserForm = document.getElementById("addUserForm");

const credentialsList = document.getElementById("credentialsList");
const filesList = document.getElementById("filesList");
const usersList = document.getElementById("usersList");

function authToken() {
  return localStorage.getItem(tokenKey);
}

function setAuth(token) {
  localStorage.setItem(tokenKey, token);
}

function clearAuth() {
  localStorage.removeItem(tokenKey);
}

function showNotification(message, error = false) {
  notification.textContent = message;
  notification.classList.remove("hidden");
  notification.style.background = error ? "rgba(251, 113, 133, 0.16)" : "rgba(56, 189, 248, 0.14)";
  notification.style.borderColor = error ? "rgba(251, 113, 133, 0.4)" : "rgba(56, 189, 248, 0.32)";
}

function hideNotification() {
  notification.classList.add("hidden");
}

function fetchWithAuth(url, options = {}) {
  const token = authToken();
  options.headers = options.headers || {};
  options.headers["Content-Type"] = options.headers["Content-Type"] || "application/json";
  if (token) {
    options.headers.Authorization = `Bearer ${token}`;
  }
  return fetch(url, options);
}

function showDashboard() {
  authSection.classList.add("hidden");
  dashboardSection.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");
  loadAll();
}

function showLogin() {
  authSection.classList.remove("hidden");
  dashboardSection.classList.add("hidden");
  logoutBtn.classList.add("hidden");
}

function handleTab(event) {
  tabs.forEach((button) => button.classList.remove("active"));
  event.target.classList.add("active");
  const view = event.target.dataset.view;
  document.querySelectorAll(".view").forEach((panel) => panel.classList.add("hidden"));
  document.getElementById(`${view}View`).classList.remove("hidden");
}

async function loadCredentials() {
  const res = await fetchWithAuth(`${API_URL}/credentials`);
  if (!res.ok) {
    showNotification("Failed to load credentials", true);
    return;
  }
  const items = await res.json();
  credentialsList.innerHTML = items.length
    ? items.map(renderCredentialItem).join("")
    : "<div class=\"item\">No credentials found.</div>";
}

function renderCredentialItem(item) {
  return `
    <div class="item">
      <strong>${item.domain}</strong>
      <p>Username: ${item.username}</p>
      <p>Password: ${item.password}</p>
      <p>Shared with: ${item.shared_with.length ? item.shared_with.join(", ") : "No one"}</p>
      <form class="share-form" data-credential-id="${item.id}">
        <input type="text" name="shareIds" placeholder="Share user ids comma-separated" />
        <button type="submit">Share</button>
      </form>
    </div>
  ";
}

async function loadFiles() {
  const res = await fetchWithAuth(`${API_URL}/files`);
  if (!res.ok) {
    showNotification("Failed to load files", true);
    return;
  }
  const items = await res.json();
  filesList.innerHTML = items.length
    ? items.map(renderFileItem).join("")
    : "<div class=\"item\">No files found.</div>";
}

function renderFileItem(item) {
  return `
    <div class="item">
      <strong>${item.file_name}</strong>
      <p>Download: <a href="${API_URL}${item.storage_url}" target="_blank" rel="noreferrer">Open</a></p>
      <p>Shared with: ${item.shared_with.length ? item.shared_with.join(", ") : "No one"}</p>
      <form class="share-file-form" data-file-id="${item.id}">
        <input type="text" name="shareIds" placeholder="Share user ids comma-separated" />
        <button type="submit">Share</button>
      </form>
    </div>
  ";
}

async function loadUsers() {
  const res = await fetchWithAuth(`${API_URL}/users`);
  if (!res.ok) {
    showNotification("Failed to load users", true);
    return;
  }
  const items = await res.json();
  usersList.innerHTML = items.length
    ? items.map((user) => `<div class="item"><strong>${user.email}</strong><p>Role: ${user.role}</p><p>ID: ${user.id}</p></div>`).join("")
    : "<div class=\"item\">No users yet.</div>";
}

async function loadAll() {
  hideNotification();
  await Promise.all([loadCredentials(), loadFiles(), loadUsers()]);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    showNotification("Login failed", true);
    return;
  }
  const data = await res.json();
  setAuth(data.access_token);
  showDashboard();
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("registerEmail").value;
  const password = document.getElementById("registerPassword").value;
  const org_name = document.getElementById("registerOrg").value;
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, org_name }),
  });
  if (!res.ok) {
    showNotification("Register failed", true);
    return;
  }
  const data = await res.json();
  setAuth(data.access_token);
  showDashboard();
});

createCredentialForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const domain = document.getElementById("credentialDomain").value;
  const username = document.getElementById("credentialUsername").value;
  const password = document.getElementById("credentialPassword").value;
  const res = await fetchWithAuth(`${API_URL}/credentials`, {
    method: "POST",
    body: JSON.stringify({ domain, username, password }),
  });
  if (!res.ok) {
    showNotification("Failed to create credential", true);
    return;
  }
  showNotification("Credential created");
  createCredentialForm.reset();
  loadCredentials();
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const fileInput = document.getElementById("uploadFile");
  const file = fileInput.files[0];
  if (!file) {
    return;
  }
  const formData = new FormData();
  formData.append("file", file);
  const token = authToken();
  const res = await fetch(`${API_URL}/files/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  if (!res.ok) {
    showNotification("File upload failed", true);
    return;
  }
  showNotification("File uploaded");
  uploadForm.reset();
  loadFiles();
});

addUserForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("newUserEmail").value;
  const password = document.getElementById("newUserPassword").value;
  const role = document.getElementById("newUserRole").value;
  const res = await fetchWithAuth(`${API_URL}/users`, {
    method: "POST",
    body: JSON.stringify({ email, password, role }),
  });
  if (!res.ok) {
    showNotification("Failed to add user", true);
    return;
  }
  showNotification("User added");
  addUserForm.reset();
  loadUsers();
});

credentialsList.addEventListener("submit", async (event) => {
  if (!event.target.matches(".share-form")) return;
  event.preventDefault();
  const credentialId = event.target.dataset.credentialId;
  const value = event.target.shareIds.value;
  const user_ids = value.split(",").map((id) => Number(id.trim())).filter(Boolean);
  const res = await fetchWithAuth(`${API_URL}/credentials/share`, {
    method: "POST",
    body: JSON.stringify({ credential_id: Number(credentialId), user_ids }),
  });
  if (!res.ok) {
    showNotification("Share credential failed", true);
    return;
  }
  showNotification("Credential shared");
  loadCredentials();
});

filesList.addEventListener("submit", async (event) => {
  if (!event.target.matches(".share-file-form")) return;
  event.preventDefault();
  const fileId = event.target.dataset.fileId;
  const value = event.target.shareIds.value;
  const user_ids = value.split(",").map((id) => Number(id.trim())).filter(Boolean);
  const res = await fetchWithAuth(`${API_URL}/files/share`, {
    method: "POST",
    body: JSON.stringify({ file_id: Number(fileId), user_ids }),
  });
  if (!res.ok) {
    showNotification("Share file failed", true);
    return;
  }
  showNotification("File shared");
  loadFiles();
});

logoutBtn.addEventListener("click", () => {
  clearAuth();
  showLogin();
});

tabs.forEach((button) => button.addEventListener("click", handleTab));

if (authToken()) {
  showDashboard();
} else {
  showLogin();
}
