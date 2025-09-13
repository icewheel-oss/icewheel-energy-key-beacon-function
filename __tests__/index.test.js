/*
 * IceWheel Energy
 * Copyright (C) 2025 IceWheel LLC
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 */

/*
 * IceWheel Energy - Cloud Function Tests
 */

/** @jest-environment node */

import { jest } from '@jest/globals';
import { beacon } from '../index.js';

// Helper to create an Express-like mock response
function createMockRes() {
  const headers = {};
  let statusCode = 200;
  let body = undefined;
  return {
    status(code) {
      statusCode = code;
      return this;
    },
    set(key, val) {
      headers[key] = val;
      return this;
    },
    send(payload) {
      body = payload;
      return this;
    },
    get sentBody() {
      return body;
    },
    get statusCodeValue() {
      return statusCode;
    },
    get headerMap() {
      return headers;
    },
  };
}

// Helper to create a basic req object
function createReq({ method = 'GET', url = '/', pathStr, headers = {}, body } = {}) {
  return {
    method,
    url,
    path: typeof pathStr === 'string' ? pathStr : url,
    ip: '127.0.0.1',
    get(name) {
      const k = Object.keys(headers).find((h) => h.toLowerCase() === String(name).toLowerCase());
      return k ? headers[k] : undefined;
    },
    headers,
    body,
  };
}

// Reset env and globals between tests
beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.TESLA_PUBLIC_KEY;
});

describe('icewheel-energy-key-beacon-function beacon handler', () => {
  test('GET /.well-known/... returns PEM with correct headers', async () => {
    process.env.TESLA_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nABC\n-----END PUBLIC KEY-----';

    const req = createReq({ method: 'GET', url: '/.well-known/appspecific/com.tesla.3p.public-key.pem' });
    const res = createMockRes();

    await beacon(req, res);

    expect(res.statusCodeValue).toBe(200);
    expect(res.headerMap['Content-Type']).toBe('application/x-pem-file');
    expect(res.sentBody).toContain('-----BEGIN PUBLIC KEY-----');
  });

  test('GET / returns HTML index with title', async () => {
    const req = createReq({ method: 'GET', url: '/' });
    const res = createMockRes();

    await beacon(req, res);

    expect(res.statusCodeValue).toBe(200);
    expect(res.headerMap['Content-Type']).toMatch(/text\/html/);
    expect(res.sentBody).toContain('Icewheel Energy Key Beacon');
  });

  test('GET /index.html returns HTML index', async () => {
    const req = createReq({ method: 'GET', url: '/index.html' });
    const res = createMockRes();

    await beacon(req, res);

    expect(res.statusCodeValue).toBe(200);
    expect(res.headerMap['Content-Type']).toMatch(/text\/html/);
  });

  test('POST requests to API endpoints return 400 JSON error when required params are missing', async () => {
    const endpoints = ['/get-token', '/verify', '/register'];

    for (const endpoint of endpoints) {
      const req = createReq({ method: 'POST', url: endpoint, body: {} });
      const res = createMockRes();
      await beacon(req, res);
      expect(res.statusCodeValue).toBe(400);
      expect(res.headerMap['Content-Type']).toMatch(/application\/json/);
      let parsed;
      try {
        parsed = JSON.parse(res.sentBody);
      } catch {
        parsed = null;
      }
      expect(parsed && parsed.error).toBe(
        endpoint === '/get-token'
          ? 'clientId and clientSecret are required'
          : 'Domain, token, and regions are required'
      );
    }
  });

  test('GET to unknown path returns 404', async () => {
    const req = createReq({ method: 'GET', url: '/foo/bar' });
    const res = createMockRes();
    await beacon(req, res);
    expect(res.statusCodeValue).toBe(404);
    expect(res.sentBody).toBe('Not Found');
  });
});
