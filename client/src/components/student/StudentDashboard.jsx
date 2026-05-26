import { StatCard } from '../ui/StatCard';
import { PanelHeading } from '../ui/PanelHeading';
import { EmptyState } from '../ui/EmptyState';
import { statusLabel } from '../../services/api';

export function StudentDashboard({
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
