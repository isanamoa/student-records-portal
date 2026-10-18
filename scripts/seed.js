/**
 * Seed synthetic test accounts and records for ICS570 assignment.
 * Run: npm run seed
 */
const db = require('../src/db');

console.log('Seeding synthetic data...');

// Clear existing data (safe for local lab only)
db.exec(`
  DELETE FROM grades;
  DELETE FROM enrollments;
  DELETE FROM lecturer_courses;
  DELETE FROM credentials;
  DELETE FROM courses;
  DELETE FROM users;
`);

// Users
const insertUser = db.prepare(`
  INSERT INTO users (id, username, display_name, role)
  VALUES (?, ?, ?, ?)
`);

insertUser.run('S001', 's001', 'Student A (S001)', 'student');
insertUser.run('S002', 's002', 'Student B (S002)', 'student');
insertUser.run('L001', 'l001', 'Lecturer L001', 'lecturer');

// Course
db.prepare(`INSERT INTO courses (id, name) VALUES (?, ?)`)
  .run('C101', 'Introduction to Cybersecurity');

// Lecturer assignment
db.prepare(`INSERT INTO lecturer_courses (lecturer_id, course_id) VALUES (?, ?)`)
  .run('L001', 'C101');

// Enrollments
const enroll = db.prepare(`INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)`);
enroll.run('S001', 'C101');
enroll.run('S002', 'C101');

// Grades (fictional)
const insertGrade = db.prepare(`
  INSERT INTO grades (student_id, course_id, value, updated_by)
  VALUES (?, ?, ?, ?)
`);
insertGrade.run('S001', 'C101', 78.5, 'L001');
insertGrade.run('S002', 'C101', 82.0, 'L001');

console.log('Seed complete.');
console.log('Test accounts:');
console.log('  S001 / s001  (student)');
console.log('  S002 / s002  (student)');
console.log('  L001 / l001  (lecturer – assigned to C101)');
console.log('Course: C101 – Introduction to Cybersecurity');
