import { all, get, insert, run } from '../db/database.js';
import { nowIso, addDays } from '../utils/helpers.js';
import { publicRequest } from '../utils/formatters.js';

export async function getRequestById(id) {
  return get(
    `SELECT book_requests.*, users.name AS student_name, users.email AS student_email,
            books.title AS book_title, books.author AS book_author,
            books.due_date, books.issued_to
     FROM book_requests
     JOIN users ON users.id = book_requests.user_id
     JOIN books ON books.id = book_requests.book_id
     WHERE book_requests.id = ?`,
    [id]
  );
}

export async function createRequest(req, res) {
  const book = await get('SELECT * FROM books WHERE id = ?', [req.params.id]);

  if (!book) {
    return res.status(404).json({ message: 'Book not found.' });
  }

  if (book.status !== 'available') {
    return res.status(409).json({ message: 'This book is currently issued.' });
  }

  const existing = await get(
    `SELECT * FROM book_requests
     WHERE book_id = ? AND user_id = ? AND status = 'pending'`,
    [req.params.id, req.user.id]
  );

  if (existing) {
    return res.status(409).json({ message: 'You already have a pending request for this book.' });
  }

  const requestId = await insert(
    `INSERT INTO book_requests (book_id, user_id, status, requested_at)
     VALUES (?, ?, 'pending', ?)`,
    [req.params.id, req.user.id, nowIso()]
  );

  res.status(201).json({ request: publicRequest(await getRequestById(requestId)) });
}

export async function getAllRequests(req, res) {
  const query =
    req.user.role === 'admin'
      ? [
          `SELECT book_requests.*, users.name AS student_name, users.email AS student_email,
                  books.title AS book_title, books.author AS book_author,
                  books.due_date, books.issued_to
           FROM book_requests
           JOIN users ON users.id = book_requests.user_id
           JOIN books ON books.id = book_requests.book_id
           ORDER BY book_requests.requested_at DESC`,
          []
        ]
      : [
          `SELECT book_requests.*, users.name AS student_name, users.email AS student_email,
                  books.title AS book_title, books.author AS book_author,
                  books.due_date, books.issued_to
           FROM book_requests
           JOIN users ON users.id = book_requests.user_id
           JOIN books ON books.id = book_requests.book_id
           WHERE book_requests.user_id = ?
           ORDER BY book_requests.requested_at DESC`,
          [req.user.id]
        ];

  res.json({ requests: (await all(query[0], query[1])).map(publicRequest) });
}

export async function approveRequest(req, res) {
  const request = await getRequestById(req.params.id);

  if (!request) {
    return res.status(404).json({ message: 'Request not found.' });
  }

  if (request.status !== 'pending') {
    return res.status(409).json({ message: 'This request has already been handled.' });
  }

  const book = await get('SELECT * FROM books WHERE id = ?', [request.book_id]);
  if (!book || book.status !== 'available') {
    return res.status(409).json({ message: 'This book is not available anymore.' });
  }

  const timestamp = nowIso();
  await run(
    `UPDATE book_requests
     SET status = 'approved', decided_at = ?, decided_by = ?
     WHERE id = ?`,
    [timestamp, req.user.id, req.params.id]
  );
  await run(
    `UPDATE books
     SET status = 'issued', issued_to = ?, issued_user_id = ?, due_date = ?, updated_at = ?
     WHERE id = ?`,
    [request.student_name, request.user_id, addDays(7), timestamp, request.book_id]
  );
  await run(
    `UPDATE book_requests
     SET status = 'rejected', decided_at = ?, decided_by = ?
     WHERE book_id = ? AND status = 'pending' AND id != ?`,
    [timestamp, req.user.id, request.book_id, req.params.id]
  );

  res.json({ request: publicRequest(await getRequestById(req.params.id)) });
}

export async function rejectRequest(req, res) {
  const request = await getRequestById(req.params.id);

  if (!request) {
    return res.status(404).json({ message: 'Request not found.' });
  }

  if (request.status !== 'pending') {
    return res.status(409).json({ message: 'This request has already been handled.' });
  }

  await run(
    `UPDATE book_requests
     SET status = 'rejected', decided_at = ?, decided_by = ?
     WHERE id = ?`,
    [nowIso(), req.user.id, req.params.id]
  );

  res.json({ request: publicRequest(await getRequestById(req.params.id)) });
}
