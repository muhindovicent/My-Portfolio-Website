process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.SESSION_SECRET = 'test-session-secret-at-least-32-chars!!';
process.env.COOKIE_SECRET = 'test-cookie-secret-at-least-32-chars!!';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.ADMIN_EMAIL = 'owner@test.example.com';
process.env.ADMIN_PASSWORD = 'TestPassword123!';
process.env.NODE_ENV = 'test';
process.env.PORT = '4001';
