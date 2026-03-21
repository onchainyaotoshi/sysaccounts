import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockFetch = jest.fn();
global.fetch = mockFetch;

process.env.ACCOUNTS_URL = 'https://accounts.test';

const { default: authProxyRouter } = await import('../routes/authProxy.js');

const app = express();
app.use(express.json());
app.use('/auth/proxy', authProxyRouter);

describe('auth proxy routes', () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it('POST /auth/proxy/token forwards to accounts /token', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ access_token: 'tok', token_type: 'bearer', expires_in: 3600, scope: 'openid email' }),
    });

    const res = await request(app).post('/auth/proxy/token').send({ grant_type: 'authorization_code', code: 'abc' });
    expect(res.status).toBe(200);
    expect(res.body.access_token).toBe('tok');
    expect(mockFetch).toHaveBeenCalledWith('https://accounts.test/token', expect.objectContaining({ method: 'POST' }));
  });

  it('GET /auth/proxy/me forwards to accounts /me', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ sub: '123', email: 'u@t.com' }),
    });

    const res = await request(app).get('/auth/proxy/me').set('Authorization', 'Bearer tok123');
    expect(res.status).toBe(200);
    expect(res.body.sub).toBe('123');
    expect(mockFetch).toHaveBeenCalledWith('https://accounts.test/me', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer tok123' }),
    }));
  });

  it('POST /auth/proxy/logout forwards to accounts /logout', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ message: 'ok' }),
    });

    const res = await request(app).post('/auth/proxy/logout').set('Authorization', 'Bearer tok').send({ token: 'tok' });
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith('https://accounts.test/logout', expect.objectContaining({ method: 'POST' }));
  });

  it('returns 502 when accounts server is unreachable', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
    const res = await request(app).post('/auth/proxy/token').send({});
    expect(res.status).toBe(502);
  });
});
