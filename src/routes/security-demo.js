const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireOwnStudentOrLecturer } = require('../middleware/authorization');
const { runAesGcmDemo } = require('../services/aes-gcm-demo');

const router = express.Router();

router.post('/aes-gcm/:studentId', requireAuth, requireOwnStudentOrLecturer, (req, res) => {
  try {
    const { studentId } = req.params;
    const student = db.prepare(`
      SELECT id, username, display_name
      FROM users
      WHERE id = ? AND role = 'student'
    `).get(studentId);

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

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

    const record = {
      studentId: student.id,
      username: student.username,
      studentName: student.display_name,
      grades,
    };

    res.json(runAesGcmDemo(record));
  } catch (err) {
    console.error('AES-GCM demonstration error:', err.message);
    res.status(500).json({ error: 'AES-GCM demonstration failed' });
  }
});

module.exports = router;
