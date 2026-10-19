const assert = require('node:assert/strict');
const { createCipheriv, createDecipheriv, randomBytes } = require('node:crypto');

const algorithm = 'aes-256-gcm';
const nonceLength = 12;
const authenticationTagLength = 16;
function getAdditionalData(record) {
  return Buffer.from(`student-record-demo:v1:${record.studentId}`, 'utf8');
}

function createNonceGenerator() {
  const usedNonces = new Set();

  return () => {
    let nonce;
    let nonceKey;

    do {
      nonce = randomBytes(nonceLength);
      nonceKey = nonce.toString('hex');
    } while (usedNonces.has(nonceKey));

    usedNonces.add(nonceKey);
    return nonce;
  };
}

function encrypt(plaintext, key, createNonce, additionalData) {
  const nonce = createNonce();
  const cipher = createCipheriv(algorithm, key, nonce, {
    authTagLength: authenticationTagLength,
  });
  cipher.setAAD(additionalData);

  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    nonce,
    ciphertext,
    authTag: cipher.getAuthTag(),
  };
}

function decrypt(envelope, key, additionalData) {
  const decipher = createDecipheriv(algorithm, key, envelope.nonce, {
    authTagLength: authenticationTagLength,
  });
  decipher.setAAD(additionalData);
  decipher.setAuthTag(envelope.authTag);

  return Buffer.concat([
    decipher.update(envelope.ciphertext),
    decipher.final(),
  ]);
}

function serializeEnvelope(envelope) {
  return {
    nonce: envelope.nonce.toString('base64url'),
    ciphertext: envelope.ciphertext.toString('base64url'),
    authTag: envelope.authTag.toString('base64url'),
  };
}

function runAesGcmDemo(record) {
  if (!record || typeof record.studentId !== 'string') {
    throw new TypeError('A database student record is required');
  }

  const key = randomBytes(32);
  const createNonce = createNonceGenerator();
  const additionalData = getAdditionalData(record);
  const originalPlaintext = Buffer.from(JSON.stringify(record), 'utf8');
  const encryptedRecord = encrypt(originalPlaintext, key, createNonce, additionalData);
  const decryptedPlaintext = decrypt(encryptedRecord, key, additionalData);

  assert.deepEqual(decryptedPlaintext, originalPlaintext);
  assert.deepEqual(JSON.parse(decryptedPlaintext.toString('utf8')), record);

  const secondEncryption = encrypt(originalPlaintext, key, createNonce, additionalData);
  assert.equal(encryptedRecord.nonce.length, nonceLength);
  assert.equal(secondEncryption.nonce.length, nonceLength);
  assert.notDeepEqual(secondEncryption.nonce, encryptedRecord.nonce);
  assert.deepEqual(decrypt(secondEncryption, key, additionalData), originalPlaintext);

  const tamperedCiphertext = Buffer.from(encryptedRecord.ciphertext);
  tamperedCiphertext[0] ^= 1;
  assert.throws(() => decrypt({
    ...encryptedRecord,
    ciphertext: tamperedCiphertext,
  }, key, additionalData));

  return {
    algorithm: 'AES-256-GCM',
    originalRecord: JSON.parse(originalPlaintext.toString('utf8')),
    encryptedRecord: serializeEnvelope(encryptedRecord),
    decryptedRecord: JSON.parse(decryptedPlaintext.toString('utf8')),
    checks: {
      exactRoundTrip: decryptedPlaintext.equals(originalPlaintext),
      fresh96BitNoncePerEncryption:
        encryptedRecord.nonce.length === nonceLength &&
        secondEncryption.nonce.length === nonceLength &&
        !encryptedRecord.nonce.equals(secondEncryption.nonce),
      tamperedCiphertextRejected: true,
    },
  };
}

module.exports = { runAesGcmDemo };
