const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireOwnStudentOrLecturer } = require('../middleware/authorization');

/**
 * GET /students/:studentId
 * Student: own record only
 * Lecturer: only students in assigned courses
 */
router.get(
  '/:studentId',
  requireAuth,
  requireOwnStudentOrLecturer,
  (req, res) => {
    const { studentId } = req.params;

    const student = db.prepare(`
      SELECT id, username, display_name, role
      FROM users WHERE id = ? AND role = 'student'
    `).get(studentId);

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const grades = db.prepare(`
      SELECT g.course_id, c.name AS course_name, g.value, g.updated_at, g.updated_by
      FROM grades g
      JOIN courses c ON g.course_id = c.id
      WHERE g.student_id = ?
    `).all(studentId);

    res.json({
      student: {
        id: student.id,
        username: student.username,
        displayName: student.display_name,
      },
      grades,
    });
  }
);

module.exports = router;
