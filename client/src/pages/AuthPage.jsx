export function AuthPage({
  appName,
  authMode,
  setAuthMode,
  authForm,
  updateAuthForm,
  submitAuth,
  message
}) {
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
