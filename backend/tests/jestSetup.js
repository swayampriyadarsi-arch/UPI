// Sets NODE_ENV=test before any module loads
// This ensures db.js throws instead of calling process.exit(1)
process.env.NODE_ENV = 'test';
