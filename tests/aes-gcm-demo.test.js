const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  beginAesGcmDemo,
  decryptAesGcmDemo,
  runAesGcmDemo,
  testAesGcmTamperDetection,
} = require('../src/services/aes-gcm-demo');

test('AES-GCM demo round-trips synthetic data and verifies ciphertext integrity', () => {
  const databaseRecord = {
    studentId: 'S001',
    username: 's001',
    studentName: 'Student A (S001)',
    grades: [
      {
        course_id: 'C101',
        course_name: 'Introduction to Cybersecurity',
        value: 78.5,
        updated_at: '2026-10-19 12:00:00',
      },
    ],
  };
  const result = runAesGcmDemo(databaseRecord);

  assert.equal(result.algorithm, 'AES-256-GCM');
  assert.deepEqual(result.originalRecord, databaseRecord);
  assert.deepEqual(result.decryptedRecord, databaseRecord);
  assert.equal(result.checks.exactRoundTrip, true);
  assert.equal(result.checks.fresh96BitNoncePerEncryption, true);
  assert.equal(result.checks.tamperedCiphertextRejected, true);
  assert.equal(Buffer.from(result.encryptedRecord.nonce, 'base64url').length, 12);
  assert.equal('key' in result, false);
});

test('AES-GCM demo requires a student record', () => {
  assert.throws(() => runAesGcmDemo(), {
    name: 'TypeError',
    message: 'A database student record is required',
  });
});

test('AES-GCM encrypt and decrypt steps can be run separately', () => {
  const record = {
    studentId: 'S001',
    username: 's001',
    studentName: 'Student A (S001)',
    grades: [],
  };
  const encryption = beginAesGcmDemo(record);
  const decryption = decryptAesGcmDemo(encryption.state);

  assert.deepEqual(decryption.decryptedRecord, record);
  assert.equal(decryption.exactRoundTrip, true);
  assert.equal(encryption.result.checks.tamperedCiphertextRejected, true);
  assert.equal('key' in encryption.result, false);
});

test('AES-GCM tamper test rejects a modified copy and preserves the original envelope', () => {
  const record = {
    studentId: 'S001',
    username: 's001',
    studentName: 'Student A (S001)',
    grades: [],
  };
  const encryption = beginAesGcmDemo(record);
  const testResult = testAesGcmTamperDetection(encryption.state);

  assert.deepEqual(testResult, {
    tamperedComponent: 'ciphertext byte 0',
    authenticationRejected: true,
    tamperedCiphertextChanged: true,
    originalEnvelopePreserved: true,
  });
  assert.deepEqual(decryptAesGcmDemo(encryption.state).decryptedRecord, record);
});
