import { StatCard } from '../ui/StatCard';
import { PanelHeading } from '../ui/PanelHeading';
import { EmptyState } from '../ui/EmptyState';
import { AdminBookRow } from './AdminBookRow';
import { RequestTable } from '../shared/RequestTable';

export function AdminDashboard(props) {
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
