const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const config = require('../config');
const db = require('../db');

const rpID = config.rpID;
const rpName = config.rpName;
const origin = config.origin;

/**
 * Generate registration options for a known user.
 */
async function getRegistrationOptions(user) {
  const existing = db.prepare(
    'SELECT id FROM credentials WHERE user_id = ?'
  ).all(user.id);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: Buffer.from(user.id, 'utf8'),
    userName: user.username,
    userDisplayName: user.display_name,
    attestationType: 'none',
    excludeCredentials: existing.map(c => ({
      id: c.id,
      type: 'public-key',
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
      authenticatorAttachment: 'platform',
    },
  });

  // Store challenge in session (caller must set req.session.currentChallenge)
  return options;
}

/**
 * Verify registration response and store credential.
 */
async function verifyAndStoreRegistration(user, response, expectedChallenge) {
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Registration verification failed');
  }

  const { credential, credentialDeviceType, credentialBackedUp } =
    verification.registrationInfo;

  const credentialID = credential.id; // already base64url
  const publicKey = Buffer.from(credential.publicKey);

  db.prepare(`
    INSERT INTO credentials (id, user_id, public_key, counter, device_type, backed_up, transports)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    credentialID,
    user.id,
    publicKey,
    credential.counter,
    credentialDeviceType,
    credentialBackedUp ? 1 : 0,
    JSON.stringify(credential.transports || [])
  );

  return { credentialID, verified: true };
}

/**
 * Generate authentication options.
 */
async function getAuthenticationOptions(user) {
  const creds = db.prepare(
    'SELECT id, transports FROM credentials WHERE user_id = ?'
  ).all(user.id);

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: creds.map(c => ({
      id: c.id,
      type: 'public-key',
      transports: c.transports ? JSON.parse(c.transports) : undefined,
    })),
    userVerification: 'preferred',
  });

  return options;
}

/**
 * Verify authentication response.
 */
async function verifyAuthentication(user, response, expectedChallenge) {
  const cred = db.prepare(
    'SELECT * FROM credentials WHERE id = ? AND user_id = ?'
  ).get(response.id, user.id);

  if (!cred) {
    throw new Error('Credential not found for this user');
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: cred.id,
      publicKey: cred.public_key,
      counter: cred.counter,
      transports: cred.transports ? JSON.parse(cred.transports) : undefined,
    },
  });

  if (!verification.verified) {
    throw new Error('Authentication verification failed');
  }

  // Update counter
  db.prepare('UPDATE credentials SET counter = ? WHERE id = ?')
    .run(verification.authenticationInfo.newCounter, cred.id);

  return { verified: true, userId: user.id };
}

module.exports = {
  getRegistrationOptions,
  verifyAndStoreRegistration,
  getAuthenticationOptions,
  verifyAuthentication,
};
