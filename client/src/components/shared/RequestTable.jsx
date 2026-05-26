import { EmptyState } from '../ui/EmptyState';
import { statusLabel } from '../../services/api';

export function RequestTable({ requests, emptyText, onApprove, onReject }) {
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
