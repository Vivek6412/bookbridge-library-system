import { useEffect, useMemo, useState } from 'react';
import { api } from './services/api';
import { AuthPage } from './pages/AuthPage';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { StudentDashboard } from './components/student/StudentDashboard';

const appName = 'BookBridge';

const emptyAuthForm = {
  name: '',
  email: '',
  password: '',
  role: 'student'
};

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
      <AuthPage
        appName={appName}
        authMode={authMode}
        setAuthMode={setAuthMode}
        authForm={authForm}
        updateAuthForm={updateAuthForm}
        submitAuth={submitAuth}
        message={message}
      />
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
