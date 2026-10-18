/**
 * Minimal WebAuthn client helpers (no external browser library required).
 * Uses the native Web Authentication API.
 */

function bufferToBase64URL(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64URLToBuffer(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const str = atob(base64 + pad);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Convert server options (with base64url strings) into browser-ready format.
 */
function preparePublicKeyOptions(options) {
  const prepared = { ...options };

  if (prepared.challenge) {
    prepared.challenge = base64URLToBuffer(prepared.challenge);
  }
  if (prepared.user && prepared.user.id) {
    prepared.user = {
      ...prepared.user,
      id: base64URLToBuffer(prepared.user.id),
    };
  }
  if (prepared.excludeCredentials) {
    prepared.excludeCredentials = prepared.excludeCredentials.map(c => ({
      ...c,
      id: base64URLToBuffer(c.id),
    }));
  }
  if (prepared.allowCredentials) {
    prepared.allowCredentials = prepared.allowCredentials.map(c => ({
      ...c,
      id: base64URLToBuffer(c.id),
    }));
  }
  return prepared;
}

/**
 * Convert credential response to JSON-serialisable form for the server.
 */
function credentialToJSON(cred) {
  if (!cred) return null;
  const json = {
    id: cred.id,
    rawId: bufferToBase64URL(cred.rawId),
    type: cred.type,
    response: {},
  };

  if (cred.response.clientDataJSON) {
    json.response.clientDataJSON = bufferToBase64URL(cred.response.clientDataJSON);
  }
  if (cred.response.attestationObject) {
    json.response.attestationObject = bufferToBase64URL(cred.response.attestationObject);
  }
  if (cred.response.authenticatorData) {
    json.response.authenticatorData = bufferToBase64URL(cred.response.authenticatorData);
  }
  if (cred.response.signature) {
    json.response.signature = bufferToBase64URL(cred.response.signature);
  }
  if (cred.response.userHandle) {
    json.response.userHandle = bufferToBase64URL(cred.response.userHandle);
  }
  if (cred.authenticatorAttachment) {
    json.authenticatorAttachment = cred.authenticatorAttachment;
  }
  if (cred.clientExtensionResults) {
    json.clientExtensionResults = cred.clientExtensionResults;
  }
  return json;
}

async function registerPasskey(username) {
  // 1. Get options from server
  const optRes = await fetch('/auth/register/options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username }),
  });
  if (!optRes.ok) {
    const err = await optRes.json();
    throw new Error(err.error || 'Failed to get registration options');
  }
  const options = await optRes.json();

  // 2. Create credential
  const publicKey = preparePublicKeyOptions(options);
  const credential = await navigator.credentials.create({ publicKey });

  // 3. Send to server for verification
  const verifyRes = await fetch('/auth/register/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(credentialToJSON(credential)),
  });
  if (!verifyRes.ok) {
    const err = await verifyRes.json();
    throw new Error(err.detail || err.error || 'Registration verification failed');
  }
  return verifyRes.json();
}

async function loginWithPasskey(username) {
  // 1. Get options
  const optRes = await fetch('/auth/login/options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username }),
  });
  if (!optRes.ok) {
    const err = await optRes.json();
    throw new Error(err.error || 'Failed to get authentication options');
  }
  const options = await optRes.json();

  // 2. Get assertion
  const publicKey = preparePublicKeyOptions(options);
  const credential = await navigator.credentials.get({ publicKey });

  // 3. Verify on server
  const verifyRes = await fetch('/auth/login/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(credentialToJSON(credential)),
  });
  if (!verifyRes.ok) {
    const err = await verifyRes.json();
    throw new Error(err.detail || err.error || 'Authentication failed');
  }
  return verifyRes.json();
}
