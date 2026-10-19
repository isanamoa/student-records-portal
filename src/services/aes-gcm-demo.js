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

  return {
    nonce,
    ciphertext: Buffer.concat([cipher.update(plaintext), cipher.final()]),
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

function beginAesGcmDemo(record) {
  if (!record || typeof record.studentId !== 'string') {
    throw new TypeError('A database student record is required');
  }

  const key = randomBytes(32);
  const createNonce = createNonceGenerator();
  const additionalData = getAdditionalData(record);
  const originalPlaintext = Buffer.from(JSON.stringify(record), 'utf8');
  const encryptedRecord = encrypt(originalPlaintext, key, createNonce, additionalData);
  const secondEncryption = encrypt(originalPlaintext, key, createNonce, additionalData);

  assert.equal(encryptedRecord.nonce.length, nonceLength);
  assert.equal(secondEncryption.nonce.length, nonceLength);
  assert.notDeepEqual(secondEncryption.nonce, encryptedRecord.nonce);

  const tamperedCiphertext = Buffer.from(encryptedRecord.ciphertext);
  tamperedCiphertext[0] ^= 1;
  assert.throws(() => decrypt({
    ...encryptedRecord,
    ciphertext: tamperedCiphertext,
  }, key, additionalData));

  return {
    state: {
      studentId: record.studentId,
      key,
      additionalData,
      originalPlaintext,
      encryptedRecord,
    },
    result: {
      algorithm: 'AES-256-GCM',
      encryptedRecord: serializeEnvelope(encryptedRecord),
      checks: {
        fresh96BitNoncePerEncryption: true,
        tamperedCiphertextRejected: true,
      },
    },
  };
}

function decryptAesGcmDemo(state) {
  const decryptedPlaintext = decrypt(
    state.encryptedRecord,
    state.key,
    state.additionalData
  );

  assert.deepEqual(decryptedPlaintext, state.originalPlaintext);
  const decryptedRecord = JSON.parse(decryptedPlaintext.toString('utf8'));

  return {
    decryptedRecord,
    exactRoundTrip: decryptedPlaintext.equals(state.originalPlaintext),
  };
}

function testAesGcmTamperDetection(state) {
  const originalCiphertext = Buffer.from(state.encryptedRecord.ciphertext);
  const tamperedCiphertext = Buffer.from(state.encryptedRecord.ciphertext);
  tamperedCiphertext[0] ^= 1;

  let authenticationRejected = false;
  try {
    decrypt({
      ...state.encryptedRecord,
      ciphertext: tamperedCiphertext,
    }, state.key, state.additionalData);
  } catch {
    authenticationRejected = true;
  }

  assert.equal(
    authenticationRejected,
    true,
    'AES-GCM accepted a ciphertext modified without a matching authentication tag'
  );

  return {
    tamperedComponent: 'ciphertext byte 0',
    authenticationRejected,
    tamperedCiphertextChanged: !tamperedCiphertext.equals(originalCiphertext),
    originalEnvelopePreserved: state.encryptedRecord.ciphertext.equals(originalCiphertext),
  };
}

function runAesGcmDemo(record) {
  const encryption = beginAesGcmDemo(record);
  const tamperTest = testAesGcmTamperDetection(encryption.state);
  const decryption = decryptAesGcmDemo(encryption.state);
  const originalRecord = JSON.parse(encryption.state.originalPlaintext.toString('utf8'));

  assert.deepEqual(decryption.decryptedRecord, originalRecord);

  return {
    algorithm: encryption.result.algorithm,
    originalRecord,
    encryptedRecord: encryption.result.encryptedRecord,
    decryptedRecord: decryption.decryptedRecord,
    checks: {
      exactRoundTrip: decryption.exactRoundTrip,
      fresh96BitNoncePerEncryption: encryption.result.checks.fresh96BitNoncePerEncryption,
      tamperedCiphertextRejected: tamperTest.authenticationRejected,
    },
  };
}

module.exports = {
  beginAesGcmDemo,
  decryptAesGcmDemo,
  runAesGcmDemo,
  testAesGcmTamperDetection,
};
