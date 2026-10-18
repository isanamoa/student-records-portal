-- Users
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL CHECK(role IN ('student', 'lecturer')),
  created_at    TEXT DEFAULT (datetime('now'))
);

-- WebAuthn credentials
CREATE TABLE IF NOT EXISTS credentials (
  id              TEXT PRIMARY KEY,          -- credentialID (base64url)
  user_id         TEXT NOT NULL,
  public_key      BLOB NOT NULL,
  counter         INTEGER NOT NULL DEFAULT 0,
  device_type     TEXT,
  backed_up       INTEGER DEFAULT 0,
  transports      TEXT,                      -- JSON array
  created_at      TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Courses
CREATE TABLE IF NOT EXISTS courses (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL
);

-- Lecturer ↔ Course assignment
CREATE TABLE IF NOT EXISTS lecturer_courses (
  lecturer_id  TEXT NOT NULL,
  course_id    TEXT NOT NULL,
  PRIMARY KEY (lecturer_id, course_id),
  FOREIGN KEY (lecturer_id) REFERENCES users(id),
  FOREIGN KEY (course_id)   REFERENCES courses(id)
);

-- Student enrollment
CREATE TABLE IF NOT EXISTS enrollments (
  student_id  TEXT NOT NULL,
  course_id   TEXT NOT NULL,
  PRIMARY KEY (student_id, course_id),
  FOREIGN KEY (student_id) REFERENCES users(id),
  FOREIGN KEY (course_id)  REFERENCES courses(id)
);

-- Grades
CREATE TABLE IF NOT EXISTS grades (
  student_id  TEXT NOT NULL,
  course_id   TEXT NOT NULL,
  value       REAL,
  updated_by  TEXT,
  updated_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (student_id, course_id),
  FOREIGN KEY (student_id) REFERENCES users(id),
  FOREIGN KEY (course_id)  REFERENCES courses(id),
  FOREIGN KEY (updated_by) REFERENCES users(id)
);
