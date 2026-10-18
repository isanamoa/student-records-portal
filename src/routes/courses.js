const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireLecturerForCourse } = require('../middleware/authorization');

/**
 * POST /courses/:courseId/grades/:studentId
 * Body: { value: number }
 * Only lecturer assigned to the course may update.
 */
router.post(
  '/:courseId/grades/:studentId',
  requireAuth,
  requireLecturerForCourse,
  (req, res) => {
    const { courseId, studentId } = req.params;
    const { value } = req.body;

    if (typeof value !== 'number' || value < 0 || value > 100) {
      return res.status(400).json({ error: 'value must be a number between 0 and 100' });
    }

    // Confirm student is enrolled
    const enrolled = db.prepare(`
      SELECT 1 FROM enrollments WHERE student_id = ? AND course_id = ?
    `).get(studentId, courseId);

    if (!enrolled) {
      return res.status(404).json({ error: 'Student not enrolled in this course' });
    }

    db.prepare(`
      INSERT INTO grades (student_id, course_id, value, updated_by, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(student_id, course_id) DO UPDATE SET
        value = excluded.value,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
    `).run(studentId, courseId, value, req.session.userId);

    res.json({
      message: 'Grade updated',
      studentId,
      courseId,
      value,
      updatedBy: req.session.userId,
    });
  }
);

/**
 * GET /courses/:courseId/roster  (optional helper for lecturer UI)
 */
router.get(
  '/:courseId/roster',
  requireAuth,
  requireLecturerForCourse,
  (req, res) => {
    const { courseId } = req.params;

    const roster = db.prepare(`
      SELECT u.id, u.display_name, u.username, g.value AS grade
      FROM enrollments e
      JOIN users u ON e.student_id = u.id
      LEFT JOIN grades g ON g.student_id = u.id AND g.course_id = e.course_id
      WHERE e.course_id = ?
      ORDER BY u.display_name
    `).all(courseId);

    res.json({ courseId, roster });
  }
);

module.exports = router;
