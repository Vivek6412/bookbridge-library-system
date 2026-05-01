import { useEffect, useMemo, useState } from 'react';

const appName = 'BookBridge';

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong.');
  }

  return data;
}

const emptyAuthForm = {
  name: '',
  email: '',
  password: '',
  role: 'student'
};

function statusLabel(status) {
  return status.replace('_', ' ');
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState(emptyAuthForm);
  const [books, setBooks] = useState([]);
  const [requests, setRequests] = useState([]);
  const [bookForm, setBookForm] = useState({ title: '', author: '' });
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', author: '' });
  const [issueId, setIssueId] = useState(null);
  const [issueName, setIssueName] = useState('');

  const stats = useMemo(() => {
    const issued = books.filter((book) => book.status === 'issued').length;
    const pending = requests.filter((request) => request.status === 'pending').length;
    const myActive = requests.filter((request) => request.status === 'approved').length;

    return {
      total: books.length,
      available: books.length - issued,
      issued,
      pending,
      myActive
    };
  }, [books, requests]);

  const requestByBook = useMemo(() => {
    return requests.reduce((map, request) => {
      if (!map[request.bookId]) map[request.bookId] = request;
      return map;
    }, {});
  }, [requests]);

  async function loadUser() {
    const data = await api('/api/auth/me');
    setUser(data.user);
    return data.user;
  }

  async function loadBooks(query = search) {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    const data = await api(`/api/books${params.toString() ? `?${params}` : ''}`);
    setBooks(data.books);
  }

  async function loadRequests() {
    const data = await api('/api/requests');
    setRequests(data.requests);
  }

  async function refreshAll(query = search) {
    await Promise.all([loadBooks(query), loadRequests()]);
  }

  useEffect(() => {
    loadUser()
      .then((currentUser) => {
        if (currentUser) return refreshAll('');
        return null;
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    const timeout = window.setTimeout(() => {
      loadBooks(search).catch((error) => setMessage(error.message));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [search, user]);

  function updateAuthForm(event) {
    setAuthForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  }

  async function submitAuth(event) {
    event.preventDefault();
    setMessage('');

    const path = authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
    const body =
      authMode === 'signup'
        ? authForm
        : { email: authForm.email, password: authForm.password };

    try {
      const data = await api(path, {
        method: 'POST',
        body: JSON.stringify(body)
      });
      setUser(data.user);
      setAuthForm(emptyAuthForm);
      await refreshAll('');
      setMessage(`Welcome, ${data.user.name}.`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setBooks([]);
    setRequests([]);
    setMessage('');
  }

  async function addBook(event) {
    event.preventDefault();
    setMessage('');

    try {
      await api('/api/books', {
        method: 'POST',
        body: JSON.stringify(bookForm)
      });
      setBookForm({ title: '', author: '' });
      await refreshAll();
      setMessage('Book added.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  function startEdit(book) {
    setEditingId(book.id);
    setEditForm({ title: book.title, author: book.author });
  }

  async function saveEdit(bookId) {
    setMessage('');
    try {
      await api(`/api/books/${bookId}`, {
        method: 'PUT',
        body: JSON.stringify(editForm)
      });
      setEditingId(null);
      await refreshAll();
      setMessage('Book updated.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function removeBook(bookId) {
    if (!window.confirm('Remove this book?')) return;
    setMessage('');

    try {
      await api(`/api/books/${bookId}`, { method: 'DELETE' });
      await refreshAll();
      setMessage('Book removed.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function issueBook(bookId) {
    setMessage('');
    try {
      await api(`/api/books/${bookId}/issue`, {
        method: 'POST',
        body: JSON.stringify({ issuedTo: issueName })
      });
      setIssueId(null);
      setIssueName('');
      await refreshAll();
      setMessage('Book issued.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function returnBook(bookId) {
    setMessage('');
    try {
      const data = await api(`/api/books/${bookId}/return`, { method: 'POST' });
      await refreshAll();
      setMessage(`Book returned. Fine: Rs ${data.fine}.`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function requestBook(bookId) {
    setMessage('');
    try {
      await api(`/api/books/${bookId}/request`, { method: 'POST' });
      await refreshAll();
      setMessage('Request sent to the administrator.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function decideRequest(requestId, action) {
    setMessage('');
    try {
      await api(`/api/requests/${requestId}/${action}`, { method: 'POST' });
      await refreshAll();
      setMessage(action === 'approve' ? 'Request approved and book issued.' : 'Request rejected.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (loading) {
    return (
      <main className="loading-screen">
        <span className="loader" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="auth-page">
        <section className="auth-visual">
          <p className="eyebrow">{appName}</p>
          <h1>Smart Library Portal</h1>
          <p className="auth-copy">
            A role-based library system where students request books and administrators manage
            approvals, inventory, and issue records.
          </p>
        </section>

        <section className="auth-panel">
          <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
            <button
              className={authMode === 'login' ? 'active' : ''}
              onClick={() => setAuthMode('login')}
              type="button"
            >
              Login
            </button>
            <button
              className={authMode === 'signup' ? 'active' : ''}
              onClick={() => setAuthMode('signup')}
              type="button"
            >
              Signup
            </button>
          </div>

          <form className="auth-form" onSubmit={submitAuth}>
            {authMode === 'signup' && (
              <>
                <label>
                  Name
                  <input
                    name="name"
                    value={authForm.name}
                    onChange={updateAuthForm}
                    autoComplete="name"
                    required
                  />
                </label>

                <label>
                  Account type
                  <select name="role" value={authForm.role} onChange={updateAuthForm}>
                    <option value="student">Student</option>
                    <option value="admin">Administrator</option>
                  </select>
                </label>
              </>
            )}
            <label>
              Email
              <input
                name="email"
                type="email"
                value={authForm.email}
                onChange={updateAuthForm}
                autoComplete="email"
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                value={authForm.password}
                onChange={updateAuthForm}
                autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                minLength={8}
                required
              />
            </label>

            {message && <p className="notice">{message}</p>}

            <button className="primary-button" type="submit">
              {authMode === 'signup' ? 'Create account' : 'Login'}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">{appName}</p>
          <h1>{user.role === 'admin' ? 'Administrator Console' : 'Student Portal'}</h1>
        </div>
        <div className="user-area">
          <span className="role-pill">{user.role === 'admin' ? 'Administrator' : 'Student'}</span>
          <span>{user.name}</span>
          <button className="ghost-button" onClick={logout} type="button">
            Logout
          </button>
        </div>
      </header>

      {user.role === 'admin' ? (
        <AdminDashboard
          books={books}
          bookForm={bookForm}
          setBookForm={setBookForm}
          addBook={addBook}
          search={search}
          setSearch={setSearch}
          stats={stats}
          message={message}
          editingId={editingId}
          editForm={editForm}
          setEditForm={setEditForm}
          startEdit={startEdit}
          setEditingId={setEditingId}
          saveEdit={saveEdit}
          removeBook={removeBook}
          issueId={issueId}
          setIssueId={setIssueId}
          issueName={issueName}
          setIssueName={setIssueName}
          issueBook={issueBook}
          returnBook={returnBook}
          requests={requests}
          decideRequest={decideRequest}
        />
      ) : (
        <StudentDashboard
          books={books}
          requests={requests}
          requestByBook={requestByBook}
          requestBook={requestBook}
          search={search}
          setSearch={setSearch}
          stats={stats}
          message={message}
        />
      )}
    </main>
  );
}

function AdminDashboard(props) {
  const pendingRequests = props.requests.filter((request) => request.status === 'pending');
  const handledRequests = props.requests.filter((request) => request.status !== 'pending');

  return (
    <>
      <section className="stats-grid" aria-label="Library statistics">
        <StatCard label="Total Books" value={props.stats.total} />
        <StatCard label="Issued" value={props.stats.issued} />
        <StatCard label="Pending Requests" value={props.stats.pending} />
      </section>

      <section className="workspace admin-workspace">
        <aside className="side-panel">
          <h2>Add Book</h2>
          <form onSubmit={props.addBook} className="book-form">
            <label>
              Title
              <input
                value={props.bookForm.title}
                onChange={(event) =>
                  props.setBookForm((current) => ({ ...current, title: event.target.value }))
                }
                required
              />
            </label>
            <label>
              Author
              <input
                value={props.bookForm.author}
                onChange={(event) =>
                  props.setBookForm((current) => ({ ...current, author: event.target.value }))
                }
                required
              />
            </label>
            <button className="primary-button" type="submit">
              Add Book
            </button>
          </form>

          {props.message && <p className="notice dashboard-notice">{props.message}</p>}
        </aside>

        <section className="book-panel">
          <PanelHeading
            title="Inventory"
            count={`${props.books.length} records shown`}
            search={props.search}
            setSearch={props.setSearch}
          />

          <div className="book-list">
            {props.books.map((book) => (
              <AdminBookRow key={book.id} book={book} {...props} />
            ))}

            {props.books.length === 0 && <EmptyState title="No books found" text="Add a book or change the search term." />}
          </div>
        </section>
      </section>

      <section className="request-panel">
        <div className="panel-heading compact">
          <div>
            <h2>Student Requests</h2>
            <p>{pendingRequests.length} waiting for approval</p>
          </div>
        </div>
        <RequestTable
          requests={pendingRequests}
          emptyText="No pending requests."
          onApprove={(id) => props.decideRequest(id, 'approve')}
          onReject={(id) => props.decideRequest(id, 'reject')}
        />
      </section>

      <section className="request-panel">
        <div className="panel-heading compact">
          <div>
            <h2>Access History</h2>
            <p>Monitor approved, rejected, and returned records</p>
          </div>
        </div>
        <RequestTable requests={handledRequests} emptyText="No access history yet." />
      </section>
    </>
  );
}

function StudentDashboard({
  books,
  requests,
  requestByBook,
  requestBook,
  search,
  setSearch,
  stats,
  message
}) {
  const activeRequests = requests.filter((request) =>
    ['pending', 'approved'].includes(request.status)
  );

  return (
    <>
      <section className="stats-grid" aria-label="Student library statistics">
        <StatCard label="Books Available" value={stats.available} />
        <StatCard label="My Pending Requests" value={stats.pending} />
        <StatCard label="My Issued Books" value={stats.myActive} />
      </section>

      <section className="student-layout">
        <section className="book-panel">
          <PanelHeading
            title="Book Catalog"
            count={`${books.length} books shown`}
            search={search}
            setSearch={setSearch}
          />

          {message && <p className="notice catalog-notice">{message}</p>}

          <div className="book-list">
            {books.map((book) => {
              const request = requestByBook[book.id];
              const isAvailable = book.status === 'available';
              const canRequest = isAvailable && (!request || ['rejected', 'returned'].includes(request.status));

              return (
                <article className="student-book-row" key={book.id}>
                  <div>
                    <h3>{book.title}</h3>
                    <p>{book.author}</p>
                  </div>
                  <div className="book-status">
                    <span className={`status-pill ${book.status}`}>{book.status}</span>
                    {request && (
                      <small>
                        Your request: <strong>{statusLabel(request.status)}</strong>
                      </small>
                    )}
                  </div>
                  <button
                    className="accent-button"
                    disabled={!canRequest}
                    onClick={() => requestBook(book.id)}
                    type="button"
                  >
                    {request?.status === 'pending'
                      ? 'Requested'
                      : request?.status === 'approved'
                        ? 'Issued'
                        : isAvailable
                          ? 'Request Book'
                          : 'Unavailable'}
                  </button>
                </article>
              );
            })}

            {books.length === 0 && <EmptyState title="No books found" text="Try another search term." />}
          </div>
        </section>

        <aside className="side-panel">
          <h2>My Activity</h2>
          <div className="activity-list">
            {activeRequests.map((request) => (
              <article key={request.id}>
                <strong>{request.bookTitle}</strong>
                <span className={`status-pill ${request.status}`}>{statusLabel(request.status)}</span>
                {request.status === 'approved' && <small>Due {request.dueDate}</small>}
              </article>
            ))}
            {activeRequests.length === 0 && <p className="muted">No active requests yet.</p>}
          </div>
        </aside>
      </section>
    </>
  );
}

function AdminBookRow({
  book,
  editingId,
  editForm,
  setEditForm,
  startEdit,
  setEditingId,
  saveEdit,
  removeBook,
  issueId,
  setIssueId,
  issueName,
  setIssueName,
  issueBook,
  returnBook
}) {
  return (
    <article className="book-row">
      <div className="book-main">
        {editingId === book.id ? (
          <div className="edit-grid">
            <input
              value={editForm.title}
              onChange={(event) =>
                setEditForm((current) => ({ ...current, title: event.target.value }))
              }
            />
            <input
              value={editForm.author}
              onChange={(event) =>
                setEditForm((current) => ({ ...current, author: event.target.value }))
              }
            />
          </div>
        ) : (
          <>
            <h3>{book.title}</h3>
            <p>{book.author}</p>
          </>
        )}
      </div>

      <div className="book-status">
        <span className={`status-pill ${book.status}`}>{book.status}</span>
        {book.status === 'issued' && (
          <small>
            {book.issuedTo} | Due {book.dueDate}
          </small>
        )}
      </div>

      <div className="row-actions">
        {editingId === book.id ? (
          <>
            <button type="button" onClick={() => saveEdit(book.id)}>
              Save
            </button>
            <button type="button" onClick={() => setEditingId(null)}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => startEdit(book)}>
              Edit
            </button>
            <button type="button" onClick={() => removeBook(book.id)}>
              Remove
            </button>
          </>
        )}

        {book.status === 'available' ? (
          issueId === book.id ? (
            <div className="issue-box">
              <input
                value={issueName}
                onChange={(event) => setIssueName(event.target.value)}
                placeholder="Student name"
              />
              <button type="button" onClick={() => issueBook(book.id)}>
                Issue
              </button>
            </div>
          ) : (
            <button
              className="accent-button"
              type="button"
              onClick={() => {
                setIssueId(book.id);
                setIssueName('');
              }}
            >
              Direct Issue
            </button>
          )
        ) : (
          <button className="accent-button" type="button" onClick={() => returnBook(book.id)}>
            Return
          </button>
        )}
      </div>
    </article>
  );
}

function RequestTable({ requests, emptyText, onApprove, onReject }) {
  if (requests.length === 0) {
    return <EmptyState title={emptyText} text="Records will appear here as students use the catalog." />;
  }

  return (
    <div className="request-list">
      {requests.map((request) => (
        <article className="request-row" key={request.id}>
          <div>
            <h3>{request.bookTitle}</h3>
            <p>{request.bookAuthor}</p>
          </div>
          <div>
            <strong>{request.studentName}</strong>
            <p>{request.studentEmail}</p>
          </div>
          <div className="book-status">
            <span className={`status-pill ${request.status}`}>{statusLabel(request.status)}</span>
            {request.dueDate && <small>Due {request.dueDate}</small>}
          </div>
          {onApprove && onReject && (
            <div className="row-actions">
              <button className="accent-button" type="button" onClick={() => onApprove(request.id)}>
                Approve
              </button>
              <button type="button" onClick={() => onReject(request.id)}>
                Reject
              </button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function PanelHeading({ title, count, search, setSearch }) {
  return (
    <div className="panel-heading">
      <div>
        <h2>{title}</h2>
        <p>{count}</p>
      </div>
      <input
        className="search-input"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search title, author, or student"
      />
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
