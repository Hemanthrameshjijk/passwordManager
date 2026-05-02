chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'AUTOFILL') {
    const { username, password } = request.data;
    const success = performAutofill(username, password);
    sendResponse({ status: success ? 'success' : 'failed' });
  }
});

function performAutofill(username, password, retryCount = 0) {
  console.log(`[Zero-Knowledge] Attempting autofill (Attempt ${retryCount + 1})`);
  
  // Find password field first (usually the most unique)
  const passwordField = document.querySelector('input[type="password"]');
  
  // Find username/email field
  // Look for text or email types, often near the password field
  const potentialUsernameFields = Array.from(document.querySelectorAll('input[type="text"], input[type="email"], input:not([type])'));
  
  // Strategy: Find the input field immediately before the password field
  let usernameField = null;
  if (passwordField) {
    const allInputs = Array.from(document.querySelectorAll('input'));
    const passIndex = allInputs.indexOf(passwordField);
    if (passIndex > 0) {
      usernameField = allInputs[passIndex - 1];
    }
  }

  // Fallback: search by common attributes
  if (!usernameField) {
    usernameField = document.querySelector('input[name*="user"], input[name*="email"], input[id*="user"], input[id*="email"]');
  }

  if (passwordField && usernameField) {
    // Inject values
    usernameField.value = username;
    passwordField.value = password;

    // Trigger events so the site's JS (React/Vue/etc) picks up the change
    const events = ['input', 'change', 'blur'];
    events.forEach(evtName => {
      usernameField.dispatchEvent(new Event(evtName, { bubbles: true }));
      passwordField.dispatchEvent(new Event(evtName, { bubbles: true }));
    });

    console.log('[Zero-Knowledge] Autofill successful');
    return true;
  }

  // Retry logic
  if (retryCount < 3) {
    setTimeout(() => performAutofill(username, password, retryCount + 1), 1000);
    return false; // Will return success later if retry works, but for now we signal in progress
  }

  console.error('[Zero-Knowledge] Could not find login fields');
  return false;
}
