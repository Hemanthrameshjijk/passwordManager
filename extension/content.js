console.log('Zero-Knowledge Vault Content Script Loaded');

// Helper to find common login fields
function findLoginFields() {
  const inputs = Array.from(document.querySelectorAll('input'));
  
  const passwordField = inputs.find(i => 
    i.type === 'password' || 
    i.name?.toLowerCase().includes('password') || 
    i.id?.toLowerCase().includes('password')
  );

  const userField = inputs.find(i => 
    (i.type === 'email' || i.type === 'text') && 
    (i.name?.toLowerCase().includes('user') || 
     i.name?.toLowerCase().includes('email') || 
     i.name?.toLowerCase().includes('login') ||
     i.id?.toLowerCase().includes('user') ||
     i.id?.toLowerCase().includes('email'))
  );

  return { userField, passwordField };
}

// Guaranteed fill function
function fillCredentials(username, password) {
  const { userField, passwordField } = findLoginFields();

  if (userField) {
    userField.value = username;
    userField.dispatchEvent(new Event('input', { bubbles: true }));
    userField.dispatchEvent(new Event('change', { bubbles: true }));
    console.log('Filled username');
  }

  if (passwordField) {
    passwordField.value = password;
    passwordField.dispatchEvent(new Event('input', { bubbles: true }));
    passwordField.dispatchEvent(new Event('change', { bubbles: true }));
    console.log('Filled password');
  }

  if (!userField && !passwordField) {
    alert('Could not detect login fields on this page. Please click into the fields manually.');
  }
}

// Listen for messages from Popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'AUTOFILL') {
    const { username, password } = message.credential;
    fillCredentials(username, password);
    sendResponse({ success: true });
  }
});
