const $ = (sel) => document.querySelector(sel);

const authSection = $('#auth-section');
const dashboard = $('#dashboard');
const authStatus = $('#auth-status');
const accountMenu = $('.account-menu');
const accountToggle = $('#account-toggle');
const accountPopover = $('#account-popover');
const studentView = $('#student-view');
const lecturerView = $('#lecturer-view');
const myRecord = $('#my-record');
const rosterEl = $('#roster');
const gradeStatus = $('#grade-status');
const cryptoDemo = $('#crypto-demo');
const cryptoDemoStudent = $('#crypto-demo-student');
let currentUser = null;

function showStatus(el, msg, type = '') {
  el.textContent = msg;
  el.className = 'status ' + type;
}

function setAccountPopoverOpen(isOpen) {
  accountPopover.classList.toggle('hidden', !isOpen);
  accountToggle.setAttribute('aria-expanded', String(isOpen));
}

function setProfileDetails(user) {
  const name = user.displayName || user.username || 'Portal user';
  const rawRole = user.role || 'user';
  const role = rawRole.charAt(0).toUpperCase() + rawRole.slice(1);
  const initials = name
    .trim()
    .split(/\s+/)
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  ['user-name', 'popover-user-name'].forEach(id => {
    $(`#${id}`).textContent = name;
  });
  ['user-role', 'popover-user-role'].forEach(id => {
    $(`#${id}`).textContent = role;
  });
  ['user-avatar', 'popover-user-avatar'].forEach(id => {
    $(`#${id}`).textContent = initials;
  });
}

function getCurrentRoute() {
  const segments = window.location.pathname.split('/').filter(Boolean);

  if (segments.length === 2 && segments[0].toLowerCase() === 'students') {
    return { type: 'student-record', studentId: segments[1].toUpperCase() };
  }

  if (
    segments.length === 3 &&
    segments[0].toLowerCase() === 'course' &&
    segments[1].toLowerCase() === 'lecturer'
  ) {
    return { type: 'lecturer-course', username: segments[2].toLowerCase() };
  }

  return { type: 'home' };
}

function setLoggedIn(user) {
  currentUser = user;
  authSection.classList.add('hidden');
  dashboard.classList.remove('hidden');
  cryptoDemo.classList.remove('hidden');
  accountMenu.classList.remove('hidden');
  studentView.classList.add('hidden');
  lecturerView.classList.add('hidden');

  const route = getCurrentRoute();
  if (route.type === 'student-record') {
    studentView.classList.remove('hidden');
    loadStudentRecord(route.studentId);
  } else if (route.type === 'lecturer-course') {
    lecturerView.classList.remove('hidden');
    if (user.role === 'lecturer' && user.username.toLowerCase() === route.username) {
      loadRoster();
    } else {
      rosterEl.innerHTML = '<p class="status error">This lecturer page is not available for the signed-in account.</p>';
    }
  } else if (user.role === 'student') {
    studentView.classList.remove('hidden');
    loadStudentRecord(user.id);
  } else if (user.role === 'lecturer') {
    lecturerView.classList.remove('hidden');
    loadRoster();
  } else {
    dashboard.classList.add('hidden');
    authSection.classList.remove('hidden');
    accountMenu.classList.add('hidden');
    showStatus(authStatus, 'Unable to load a dashboard for this account role.', 'error');
    return;
  }

  setCryptoDemoStudents(user);
  setProfileDetails(user);
  setAccountPopoverOpen(false);
}

function setCryptoDemoStudents(user, students = []) {
  cryptoDemoStudent.replaceChildren();

  const route = getCurrentRoute();
  const availableStudents = user.role === 'student'
    ? [{ id: user.id, display_name: user.displayName }]
    : route.type === 'student-record'
      ? [{ id: route.studentId, display_name: route.studentId }]
      : students;

  availableStudents.forEach(student => {
    const option = document.createElement('option');
    option.value = student.id;
    option.textContent = `${student.display_name} (${student.id})`;
    cryptoDemoStudent.append(option);
  });

  if (availableStudents.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No authorized student records available';
    cryptoDemoStudent.append(option);
  }

  cryptoDemoStudent.disabled = user.role === 'student' || availableStudents.length === 0;
}

function setLoggedOut() {
  dashboard.classList.add('hidden');
  cryptoDemo.classList.add('hidden');
  authSection.classList.remove('hidden');
  accountMenu.classList.add('hidden');
  currentUser = null;
  setAccountPopoverOpen(false);
  studentView.classList.add('hidden');
  lecturerView.classList.add('hidden');
  showStatus(authStatus, '');
}

async function loadStudentRecord(studentId) {
  try {
    const res = await fetch(`/students/${studentId}`, { credentials: 'include' });
    if (!res.ok) {
      myRecord.innerHTML = `<p class="status error">Failed to load record (${res.status})</p>`;
      return;
    }
    const data = await res.json();
    let html = '';
    if (data.grades.length === 0) {
      html += '<p>No grades yet.</p>';
    } else {
      html += '<table><thead><tr><th>Course</th><th>Grade</th><th>Updated</th></tr></thead><tbody>';
      data.grades.forEach(g => {
        html += `<tr><td>${g.course_name} (${g.course_id})</td><td>${g.value}</td><td>${g.updated_at || '—'}</td></tr>`;
      });
      html += '</tbody></table>';
    }
    myRecord.innerHTML = html;
  } catch (err) {
    console.error('Failed to load student record:', err);
    myRecord.innerHTML = '<p class="status error">Unable to load this record. Please try again.</p>';
  }
}

async function loadRoster() {
  try {
    const res = await fetch('/courses/C101/roster', { credentials: 'include' });
    if (!res.ok) {
      rosterEl.innerHTML = `<p class="status error">Failed to load roster (${res.status})</p>`;
      return;
    }
    const data = await res.json();
    let html = '<table><thead><tr><th>Student</th><th>ID</th><th>Grade</th></tr></thead><tbody>';
    data.roster.forEach(s => {
      html += `<tr><td>${s.display_name}</td><td>${s.id}</td><td>${s.grade ?? '—'}</td></tr>`;
    });
    html += '</tbody></table>';
    rosterEl.innerHTML = html;
    if (currentUser?.role === 'lecturer') {
      setCryptoDemoStudents(currentUser, data.roster);
    }
  } catch (err) {
    console.error('Failed to load course roster:', err);
    rosterEl.innerHTML = '<p class="status error">Unable to load this roster. Please try again.</p>';
  }
}

// Event listeners
accountToggle.addEventListener('click', () => {
  setAccountPopoverOpen(accountPopover.classList.contains('hidden'));
});

document.addEventListener('click', event => {
  if (!accountMenu.contains(event.target)) setAccountPopoverOpen(false);
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !accountPopover.classList.contains('hidden')) {
    setAccountPopoverOpen(false);
    accountToggle.focus();
  }
});

$('#btn-register').addEventListener('click', async () => {
  const username = $('#username').value.trim();
  if (!username) return showStatus(authStatus, 'Enter a username', 'error');
  showStatus(authStatus, 'Creating passkey…');
  try {
    const result = await registerPasskey(username);
    showStatus(authStatus, `Passkey registered successfully (credential stored for ${username})`, 'success');
  } catch (err) {
    showStatus(authStatus, err.message, 'error');
  }
});

$('#btn-login').addEventListener('click', async () => {
  const username = $('#username').value.trim();
  if (!username) return showStatus(authStatus, 'Enter a username', 'error');
  showStatus(authStatus, 'Authenticating with passkey…');
  try {
    const result = await loginWithPasskey(username);
    showStatus(authStatus, 'Signed in successfully', 'success');
    setLoggedIn(result.user);
  } catch (err) {
    showStatus(authStatus, err.message, 'error');
  }
});

$('#btn-logout').addEventListener('click', async () => {
  await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
  setLoggedOut();
});

$('#btn-update-grade').addEventListener('click', async () => {
  const studentId = $('#grade-student').value.trim();
  const value = parseFloat($('#grade-value').value);
  if (!studentId || isNaN(value)) {
    return showStatus(gradeStatus, 'Provide student ID and a numeric grade', 'error');
  }
  const res = await fetch(`/courses/C101/grades/${studentId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ value }),
  });
  const data = await res.json();
  if (res.ok) {
    showStatus(gradeStatus, `Grade updated to ${data.value}`, 'success');
    loadRoster();
  } else {
    showStatus(gradeStatus, data.message || data.error || 'Update failed', 'error');
  }
});

$('#btn-run-crypto-demo').addEventListener('click', async event => {
  const button = event.currentTarget;
  const status = $('#crypto-demo-status');
  const output = $('#crypto-demo-result');

  button.disabled = true;
  showStatus(status, 'Running the encryption and integrity checks…');
  output.classList.add('hidden');

  try {
    const studentId = cryptoDemoStudent.value;
    if (!studentId) throw new Error('No authorized student record is available to encrypt.');

    const res = await fetch(`/demo/aes-gcm/${encodeURIComponent(studentId)}`, {
      method: 'POST',
      credentials: 'include',
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('The server returned a page instead of the encryption result. Restart the portal server and try again.');
    }
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Demo request failed (${res.status})`);
    }

    output.textContent = JSON.stringify(data, null, 2);
    output.classList.remove('hidden');
    showStatus(status, 'Encryption, exact decryption, fresh nonce, and tamper checks passed.', 'success');
  } catch (err) {
    console.error('AES-GCM portal demonstration failed:', err);
    showStatus(status, err.message || 'Unable to run the encryption demonstration.', 'error');
  } finally {
    button.disabled = false;
  }
});

// On load – check existing session
(async () => {
  try {
    const res = await fetch('/auth/me', { credentials: 'include' });
    if (res.ok) {
      const user = await res.json();
      setLoggedIn(user);
    }
  } catch (_) { /* not logged in */ }
})();
