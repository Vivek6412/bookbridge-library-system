export function AdminBookRow({
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
