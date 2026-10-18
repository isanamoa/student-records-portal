const db = require('../db');

/**
 * Student may read only their own record.
 * Lecturer may read records of students enrolled in courses they teach.
 */
function requireOwnStudentOrLecturer(req, res, next) {
  const requestedId = req.params.studentId;
  const { userId, role } = req.session;

  if (role === 'student') {
    if (userId !== requestedId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Students may only view their own academic record.',
      });
    }
    return next();
  }

  if (role === 'lecturer') {
    // Check whether the requested student is in any course taught by this lecturer
    const row = db.prepare(`
      SELECT 1
      FROM enrollments e
      JOIN lecturer_courses lc ON e.course_id = lc.course_id
      WHERE e.student_id = ? AND lc.lecturer_id = ?
      LIMIT 1
    `).get(requestedId, userId);

    if (!row) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Lecturer is not assigned to any course containing this student.',
      });
    }
    return next();
  }

  return res.status(403).json({ error: 'Forbidden' });
}

/**
 * Only a lecturer assigned to the specific course may update grades.
 */
function requireLecturerForCourse(req, res, next) {
  const { courseId } = req.params;
  const { userId, role } = req.session;

  if (role !== 'lecturer') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Only lecturers may update grades.',
    });
  }

  const assignment = db.prepare(`
    SELECT 1 FROM lecturer_courses
    WHERE lecturer_id = ? AND course_id = ?
  `).get(userId, courseId);

  if (!assignment) {
    return res.status(403).json({
      error: 'Forbidden',
      message: `Lecturer is not assigned to course ${courseId}.`,
    });
  }

  next();
}

module.exports = {
  requireOwnStudentOrLecturer,
  requireLecturerForCourse,
};
