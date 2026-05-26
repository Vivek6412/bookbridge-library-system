import { all, get, insert, run } from '../db/database.js';
import { cleanText, nowIso, addDays } from '../utils/helpers.js';
import { publicBook } from '../utils/formatters.js';

export async function getAllBooks(req, res) {
  const q = cleanText(req.query.q).toLowerCase();
  const books = await all(
    `SELECT * FROM books
     WHERE ? = ''
        OR lower(title) LIKE ?
        OR lower(author) LIKE ?
        OR lower(COALESCE(issued_to, '')) LIKE ?
     ORDER BY created_at DESC`,
    [q, `%${q}%`, `%${q}%`, `%${q}%`]
  );

  res.json({ books: books.map(publicBook) });
}

export async function createBook(req, res) {
  const title = cleanText(req.body.title);
  const author = cleanText(req.body.author);

  if (!title || !author) {
    return res.status(400).json({ message: 'Title and author are required.' });
  }

  const timestamp = nowIso();
  const bookId = await insert(
    `INSERT INTO books
      (title, author, status, issued_to, issued_user_id, due_date, created_by, created_at, updated_at)
     VALUES (?, ?, 'available', NULL, NULL, NULL, ?, ?, ?)`,
    [title, author, req.user.id, timestamp, timestamp]
  );

  res.status(201).json({
    book: publicBook(await get('SELECT * FROM books WHERE id = ?', [bookId]))
  });
}

export async function updateBook(req, res) {
  const title = cleanText(req.body.title);
  const author = cleanText(req.body.author);
  const book = await get('SELECT * FROM books WHERE id = ?', [req.params.id]);

  if (!book) {
    return res.status(404).json({ message: 'Book not found.' });
  }

  if (!title || !author) {
    return res.status(400).json({ message: 'Title and author are required.' });
  }

  await run('UPDATE books SET title = ?, author = ?, updated_at = ? WHERE id = ?', [
    title,
    author,
    nowIso(),
    req.params.id
  ]);

  res.json({ book: publicBook(await get('SELECT * FROM books WHERE id = ?', [req.params.id])) });
}

export async function deleteBook(req, res) {
  const book = await get('SELECT * FROM books WHERE id = ?', [req.params.id]);
  if (!book) {
    return res.status(404).json({ message: 'Book not found.' });
  }

  await run('DELETE FROM books WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}

export async function issueBook(req, res) {
  const book = await get('SELECT * FROM books WHERE id = ?', [req.params.id]);
  const issuedTo = cleanText(req.body.issuedTo || req.body.issued_to);

  if (!book) {
    return res.status(404).json({ message: 'Book not found.' });
  }

  if (book.status === 'issued') {
    return res.status(409).json({ message: 'This book is already issued.' });
  }

  if (!issuedTo) {
    return res.status(400).json({ message: 'Issued-to name is required.' });
  }

  await run(
    `UPDATE books
     SET status = 'issued', issued_to = ?, issued_user_id = NULL, due_date = ?, updated_at = ?
     WHERE id = ?`,
    [issuedTo, addDays(7), nowIso(), req.params.id]
  );

  res.json({ book: publicBook(await get('SELECT * FROM books WHERE id = ?', [req.params.id])) });
}

export async function returnBook(req, res) {
  const book = await get('SELECT * FROM books WHERE id = ?', [req.params.id]);

  if (!book) {
    return res.status(404).json({ message: 'Book not found.' });
  }

  if (book.status !== 'issued') {
    return res.status(409).json({ message: 'This book is not currently issued.' });
  }

  let fine = 0;
  if (book.due_date) {
    const today = new Date();
    const dueDate = new Date(`${book.due_date}T00:00:00`);
    const daysLate = Math.max(0, Math.ceil((today - dueDate) / 86_400_000));
    fine = daysLate * 10;
  }

  if (book.issued_user_id) {
    await run(
      `UPDATE book_requests
       SET status = 'returned', returned_at = ?
       WHERE book_id = ? AND user_id = ? AND status = 'approved'`,
      [nowIso(), req.params.id, book.issued_user_id]
    );
  }

  await run(
    `UPDATE books
     SET status = 'available', issued_to = NULL, issued_user_id = NULL, due_date = NULL, updated_at = ?
     WHERE id = ?`,
    [nowIso(), req.params.id]
  );

  res.json({
    fine,
    book: publicBook(await get('SELECT * FROM books WHERE id = ?', [req.params.id]))
  });
}
