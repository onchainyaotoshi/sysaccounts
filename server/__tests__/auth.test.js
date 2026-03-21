import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockFetch = jest.fn();
global.fetch = mockFetch;

process.env.ACCOUNTS_URL = 'https://accounts.test';

const { createAuthMiddleware } = await import('../middleware/auth.js');

describe('auth middleware', () => {
  let middleware, req, res, next;

  beforeEach(() => {
    middleware = createAuthMiddleware();
    req = { headers: {}, path: '' };
    res = { status: jest.fn(() => res), json: jest.fn() };
    next = jest.fn();
    mockFetch.mockReset();
  });

  it('skips /health (Express strips /api mount prefix)', async () => {
    req.path = '/health';
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns 401 when no Authorization header', async () => {
    req.path = '/users';
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for invalid token', async () => {
    req.path = '/users';
    req.headers.authorization = 'Bearer bad-token';
    mockFetch.mockResolvedValue({ ok: false, status: 401 });
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('calls next and sets req.user for valid token', async () => {
    req.path = '/users';
    req.headers.authorization = 'Bearer good-token';
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ sub: '123', email: 'user@test.com', email_verified: true }),
    });
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ sub: '123', email: 'user@test.com', email_verified: true });
  });

  it('uses cache on second call with same token', async () => {
    req.path = '/users';
    req.headers.authorization = 'Bearer cached-token';
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ sub: '456', email: 'cached@test.com', email_verified: true }),
    });
    await middleware(req, res, next);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const req2 = { headers: { authorization: 'Bearer cached-token' }, path: '/users' };
    const res2 = { status: jest.fn(() => res2), json: jest.fn() };
    const next2 = jest.fn();
    await middleware(req2, res2, next2);
    expect(next2).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
