const db = require('../src/db');
const { runAesGcmDemo } = require('../src/services/aes-gcm-demo');

const student = db.prepare(`
  SELECT id, username, display_name
  FROM users
  WHERE id = 'S001' AND role = 'student'
`).get();

if (!student) {
  console.error('Student S001 was not found. Run `npm run seed` first.');
  process.exitCode = 1;
} else {
  const grades = db.prepare(`
    SELECT g.course_id, c.name AS course_name, g.value, g.updated_at
    FROM grades g
    JOIN courses c ON c.id = g.course_id
    WHERE g.student_id = ?
    ORDER BY c.name
  `).all(student.id);

  const result = runAesGcmDemo({
    studentId: student.id,
    username: student.username,
    studentName: student.display_name,
    grades,
  });

  console.log(`${result.algorithm} database record demonstration passed.`);
  console.log(`Original record: ${JSON.stringify(result.originalRecord)}`);
  console.log(`Encrypted envelope: ${JSON.stringify(result.encryptedRecord)}`);
  console.log(`Decrypted record: ${JSON.stringify(result.decryptedRecord)}`);
  console.log(`Decryption restored the original content exactly: ${result.checks.exactRoundTrip}`);
  console.log(`Second encryption used a different 96-bit nonce: ${result.checks.fresh96BitNoncePerEncryption}`);
  console.log(`Tampered ciphertext rejected during authentication: ${result.checks.tamperedCiphertextRejected}`);
  console.log('The AES key was generated for this run only and was not stored or printed.');
}
