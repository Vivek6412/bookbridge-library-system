export const sessionCookie = 'library_session';
export const isProduction = process.env.NODE_ENV === 'production';
export const sessionSecret = process.env.SESSION_SECRET || 'development-session-secret-change-me';
