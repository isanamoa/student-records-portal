const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireOwnStudentOrLecturer } = require('../middleware/authorization');
const {
  beginAesGcmDemo,
  decryptAesGcmDemo,
  testAesGcmTamperDetection,
} = require('../services/aes-gcm-demo');

const router = express.Router();
const encryptionTtlMs = 5 * 60 * 1000;
const maxActiveEncryptions = 500;
const activeEncryptions = new Map();

function removeExpiredEncryptions(now = Date.now()) {
  for (const [sessionId, demo] of activeEncryptions) {
    if (demo.expiresAt <= now) removeEncryption(sessionId);
  }
}

function removeEncryption(sessionId) {
  const demo = activeEncryptions.get(sessionId);
  if (demo) clearTimeout(demo.expiryTimer);
  activeEncryptions.delete(sessionId);
}

function getStudentRecord(req, studentId) {
  const student = db.prepare(`
    SELECT id, username, display_name
    FROM users
    WHERE id = ? AND role = 'student'
  `).get(studentId);

  if (!student) return null;

  const grades = req.session.role === 'lecturer'
    ? db.prepare(`
      SELECT g.course_id, c.name AS course_name, g.value, g.updated_at
      FROM grades g
      JOIN courses c ON c.id = g.course_id
      JOIN lecturer_courses lc ON lc.course_id = g.course_id
      WHERE g.student_id = ? AND lc.lecturer_id = ?
      ORDER BY c.name
    `).all(studentId, req.session.userId)
    : db.prepare(`
      SELECT g.course_id, c.name AS course_name, g.value, g.updated_at
      FROM grades g
      JOIN courses c ON c.id = g.course_id
      WHERE g.student_id = ?
      ORDER BY c.name
    `).all(studentId);

  return {
    studentId: student.id,
    username: student.username,
    studentName: student.display_name,
    grades,
  };
}

router.post(
  '/aes-gcm/:studentId/encrypt',
  requireAuth,
  requireOwnStudentOrLecturer,
  (req, res) => {
    try {
      const record = getStudentRecord(req, req.params.studentId);
      if (!record) return res.status(404).json({ error: 'Student not found' });

      const sessionId = req.sessionID;
      removeExpiredEncryptions();
      if (
        !activeEncryptions.has(sessionId) &&
        activeEncryptions.size >= maxActiveEncryptions
      ) {
        const [oldestSessionId] = activeEncryptions.keys();
        removeEncryption(oldestSessionId);
      }

      const encryption = beginAesGcmDemo(record);
      const demo = {
        studentId: record.studentId,
        state: encryption.state,
        expiresAt: Date.now() + encryptionTtlMs,
      };
      demo.expiryTimer = setTimeout(
        () => {
          if (activeEncryptions.get(sessionId) === demo) {
            removeEncryption(sessionId);
          }
        },
        encryptionTtlMs
      );
      demo.expiryTimer.unref();
      activeEncryptions.set(sessionId, demo);

      res.json({
        ...encryption.result,
        expiresInSeconds: encryptionTtlMs / 1000,
      });
    } catch (err) {
      console.error('AES-GCM encryption demonstration error:', err.message);
      res.status(500).json({ error: 'AES-GCM encryption demonstration failed' });
    }
  }
);

router.post(
  '/aes-gcm/:studentId/tamper',
  requireAuth,
  requireOwnStudentOrLecturer,
  (req, res) => {
    removeExpiredEncryptions();
    const sessionId = req.sessionID;
    const demo = activeEncryptions.get(sessionId);
    if (!demo || demo.studentId !== req.params.studentId) {
      return res.status(409).json({
        error: 'No active encrypted record is available. Encrypt a record first.',
      });
    }

    try {
      const result = testAesGcmTamperDetection(demo.state);
      res.json({
        test: 'AES-256-GCM ciphertext tamper detection',
        outcome: 'PASS',
        ...result,
        detectedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('AES-GCM tamper detection demonstration error:', err.message);
      res.status(500).json({
        test: 'AES-256-GCM ciphertext tamper detection',
        outcome: 'FAIL',
        error: 'Modified ciphertext was not rejected',
        detectedAt: new Date().toISOString(),
      });
    }
  }
);

router.post(
  '/aes-gcm/:studentId/decrypt',
  requireAuth,
  requireOwnStudentOrLecturer,
  (req, res) => {
    removeExpiredEncryptions();
    const sessionId = req.sessionID;
    const demo = activeEncryptions.get(sessionId);
    if (!demo || demo.studentId !== req.params.studentId) {
      return res.status(409).json({
        error: 'No active encrypted record is available. Encrypt a record first.',
      });
    }

    try {
      const result = decryptAesGcmDemo(demo.state);
      removeEncryption(sessionId);
      res.json({
        decryptedRecord: result.decryptedRecord,
        checks: { exactRoundTrip: result.exactRoundTrip },
      });
    } catch (err) {
      removeEncryption(sessionId);
      console.error('AES-GCM decryption demonstration error:', err.message);
      res.status(400).json({ error: 'Encrypted record failed authentication' });
    }
  }
);

module.exports = router;
