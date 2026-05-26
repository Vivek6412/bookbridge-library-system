export function normalizeRole(role) {
  return role === 'admin' ? 'admin' : 'student';
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: normalizeRole(user.role),
    createdAt: user.created_at
  };
}

export function publicBook(book) {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    status: book.status,
    issuedTo: book.issued_to,
    issuedUserId: book.issued_user_id,
    dueDate: book.due_date,
    createdBy: book.created_by,
    createdAt: book.created_at,
    updatedAt: book.updated_at
  };
}

export function publicRequest(request) {
  return {
    id: request.id,
    bookId: request.book_id,
    userId: request.user_id,
    status: request.status,
    requestedAt: request.requested_at,
    decidedAt: request.decided_at,
    returnedAt: request.returned_at,
    studentName: request.student_name,
    studentEmail: request.student_email,
    bookTitle: request.book_title,
    bookAuthor: request.book_author,
    dueDate: request.due_date,
    issuedTo: request.issued_to
  };
}
