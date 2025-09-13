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

// Single-file HTTP function compatible with Google Cloud Functions (Gen 2)
// and Cloud Run via Functions Framework.

import functionsFramework from '@google-cloud/functions-framework';
import { readFileSync } from 'node:fs';
import fetch from 'node-fetch';

function resolvePublicKey() {
  const fromEnv = normalizePem(process.env.TESLA_PUBLIC_KEY) || tryDecodeBase64(process.env.TESLA_PUBLIC_KEY_BASE64) || tryReadFile(process.env.TESLA_PUBLIC_KEY_FILE);
  if (fromEnv) return fromEnv;

  const IN_SOURCE_PUBLIC_KEY = `
-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEE/508A42d9++IF62A/5NfKqQ9wJ/
3WPEaNbFALv3jl0cW8N4x82+3cNer3aLz8VjPYf2d2c6z1gI4a/sBCHwZw==
-----END PUBLIC KEY-----
`;
  return normalizePem(IN_SOURCE_PUBLIC_KEY) || undefined;
}

// Tesla endpoints
const REGION_URLS = {
  na: 'https://fleet-api.prd.na.vn.cloud.tesla.com',
  eu: 'https://fleet-api.prd.eu.vn.cloud.tesla.com',
};
const TESLA_AUTH_URL = 'https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token';

// Helpers: unified responses
function sendJson(res, status, body) {
  res.status(status);
  res.set('Content-Type', 'application/json');
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.send(JSON.stringify(body));
}

function sendText(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.status(status);
  res.set('Content-Type', contentType);
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.send(body);
}

function sendHtml(res, status, html) {
  return sendText(res, status, html, 'text/html; charset=utf-8');
}

// Helper: read JSON body safely
async function parseJson(req) {
  return new Promise((resolve, reject) => {
    try {
      if (req.body && typeof req.body === 'object') return resolve(req.body);
      let data = '';
      req.on('data', (chunk) => { data += chunk; });
      req.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch (e) {
          reject(new Error('Invalid JSON body'));
        }
      });
      req.on('error', (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}

// Public key resolution
function normalizePem(input) {
  if (!input) return undefined;
  const unescaped = String(input).replace(/\\n/g, '\n').trim();
  return unescaped.length > 0 ? unescaped : undefined;
}

function tryDecodeBase64(input) {
  if (!input) return undefined;
  try {
    const decoded = Buffer.from(input, 'base64').toString('utf8');
    const normalized = normalizePem(decoded);
    if (normalized && /-----BEGIN [A-Z ]+-----/.test(normalized)) return normalized;
  } catch {}
  return undefined;
}

function tryReadFile(path) {
  if (!path) return undefined;
  try {
    return normalizePem(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
  }
}

// Simple HTML UI (Bootstrap)
function renderIndexHtml(publicKey) {
  const keyBlock = publicKey
    ? `<pre id="publicKey" class="small border rounded p-3 bg-light" style="white-space:pre-wrap;word-break:break-all;">${escapeHtml(publicKey)}</pre>`
    : `<div class="alert alert-warning">Public key not configured. Set env vars or paste into index.js.</div>`;

  const curlCommand = `curl -X POST "${TESLA_AUTH_URL}" \\\n` +
    `-H "Content-Type: application/x-www-form-urlencoded" \\\n` +
    `-d "grant_type=client_credentials" \\\n` +
    `-d "client_id=YOUR_CLIENT_ID" \\\n` +
    `-d "client_secret=YOUR_CLIENT_SECRET" \\\n` +
    `-d "scope=openid user_data vehicle_device_data vehicle_cmds vehicle_charging_cmds energy_device_data energy_cmds offline_access" \\\n` +
    `-d "audience=${REGION_URLS.na}"`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Icewheel Energy Key Beacon</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet" />
  <style>
    body { padding-top: 24px; padding-bottom: 40px; }
    .text-xs { font-size: .8rem; }
    code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
  </style>
</head>
<body>
  <div class="container">
    <div class="text-center mb-4">
      <h1><i class="bi bi-lightning-charge-fill"></i> Icewheel Energy Key Beacon</h1>
      <p class="lead text-muted">A minimal web app to host your Tesla public key and interact with the Fleet API.</p>
    </div>

    <div class="row justify-content-center">
      <div class="col-lg-9">

        <!-- Public Key -->
        <div class="card my-4">
          <div class="card-header"><strong><i class="bi bi-key"></i> 1. Your Public Key</strong></div>
          <div class="card-body">
            ${keyBlock}
            ${publicKey ? `<div class="mt-2"><button id="copyKeyBtn" class="btn btn-outline-secondary btn-sm"><i class="bi bi-clipboard"></i> Copy</button></div>` : ''}
          </div>
        </div>

        <!-- App Config -->
        <div class="card mb-4">
          <div class="card-header"><strong><i class="bi bi-gear"></i> 2. Important: Tesla App Configuration</strong></div>
          <div class="card-body">
            <p>In your Tesla Developer account, you must configure your app with the following URLs. The values are generated based on the current domain.</p>
            <label class="form-label mt-2"><strong>Allowed Origin(s)</strong></label>
            <div class="input-group mb-2"><input type="text" class="form-control" id="originLocal" value="http://localhost:8081" readonly /><button class="btn btn-outline-secondary" type="button" id="copyOriginLocalBtn"><i class="bi bi-clipboard"></i> Copy</button></div>
            <div class="input-group mb-3"><input type="text" class="form-control" id="originCurrent" readonly /><button class="btn btn-outline-secondary" type="button" id="copyOriginCurrentBtn"><i class="bi bi-clipboard"></i> Copy</button></div>
            <label class="form-label"><strong>Allowed Redirect URI(s)</strong></label>
            <div class="input-group mb-2"><input type="text" class="form-control" id="redirectLocal" value="http://localhost:8081/api/tesla/fleet/auth/callback" readonly /><button class="btn btn-outline-secondary" type="button" id="copyRedirectLocalBtn"><i class="bi bi-clipboard"></i> Copy</button></div>
            <div class="input-group mb-3"><input type="text" class="form-control" id="redirectCurrent" readonly /><button class="btn btn-outline-secondary" type="button" id="copyRedirectCurrentBtn"><i class="bi bi-clipboard"></i> Copy</button></div>
            <label class="form-label"><strong>Allowed Returned URL(s)</strong></label>
            <div class="input-group mb-2"><input type="text" class="form-control" id="returnedLocal" value="http://localhost:8081" readonly /><button class="btn btn-outline-secondary" type="button" id="copyReturnedLocalBtn"><i class="bi bi-clipboard"></i> Copy</button></div>
            <div class="input-group"><input type="text" class="form-control" id="returnedCurrent" readonly /><button class="btn btn-outline-secondary" type="button" id="copyReturnedCurrentBtn"><i class="bi bi-clipboard"></i> Copy</button></div>
          </div>
        </div>

        <!-- Get Token -->
        <div class="card mb-4">
          <div class="card-header"><strong><i class="bi bi-shield-lock"></i> 3. Partner Authentication Token</strong></div>
          <div class="card-body">
            <form id="tokenForm" class="row g-3">
              <div class="col-md-6">
                <label class="form-label">Client ID</label>
                <input type="text" class="form-control" id="clientId" placeholder="YOUR_CLIENT_ID" autocomplete="username" />
              </div>
              <div class="col-md-6">
                <label class="form-label">Client Secret</label>
                <input type="password" class="form-control" id="clientSecret" placeholder="YOUR_CLIENT_SECRET" autocomplete="current-password" />
              </div>
              <div class="col-12">
                <button class="btn btn-primary" type="submit"><i class="bi bi-key"></i> Generate Token</button>
                <span id="tokenError" class="text-danger ms-3"></span>
              </div>
              <div class="col-12">
                <label class="form-label mt-2">Partner Access Token</label>
                <input type="text" class="form-control" id="partnerToken" placeholder="Paste or generate token here" />
              </div>
            </form>
            <div class="accordion mt-4" id="curlAccordion">
              <div class="accordion-item">
                <h2 class="accordion-header" id="curlHeading"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseCurl">Show cURL Command</button></h2>
                <div id="collapseCurl" class="accordion-collapse collapse" aria-labelledby="curlHeading"><div class="accordion-body"><p>You can generate a partner token directly using the command line.</p><pre class="bg-light p-3 rounded small"><code>${escapeHtml(curlCommand)}</code></pre></div></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Domain -->
        <div class="card mb-4">
          <div class="card-header"><strong><i class="bi bi-globe"></i> 4. Domain</strong></div>
          <div class="card-body"><div class="mb-3"><label for="domainInput" class="form-label">Your Registered Domain</label><input type="text" class="form-control" id="domainInput" placeholder="example.com" /></div></div>
        </div>

        <!-- Actions -->
        <div class="card mb-4">
          <div class="card-header"><strong><i class="bi bi-wrench-adjustable-circle"></i> 5. Actions</strong></div>
          <div class="card-body">
            <form id="registerForm" class="mb-4">
              <p class="mb-2">Register your domain with Tesla in one or more regions.</p>
              <div class="d-flex align-items-center">
                <div class="me-3"><strong>Regions:</strong></div>
                <div class="form-check form-check-inline"><input class="form-check-input" type="checkbox" value="na" id="registerNa" checked /><label class="form-check-label" for="registerNa">North America</label></div>
                <div class="form-check form-check-inline"><input class="form-check-input" type="checkbox" value="eu" id="registerEu" /><label class="form-check-label" for="registerEu">Europe</label></div>
                <button class="btn btn-warning ms-auto" type="submit"><i class="bi bi-upload"></i> Register</button>
              </div>
              <span id="registerError" class="text-danger d-block mt-2"></span>
            </form>
            <hr/>
            <form id="verifyForm" class="mt-4">
              <p class="mb-2">Verify that your domain is correctly registered.</p>
              <div class="d-flex align-items-center">
                <div class="me-3"><strong>Regions:</strong></div>
                <div class="form-check form-check-inline"><input class="form-check-input" type="checkbox" value="na" id="verifyNa" checked /><label class="form-check-label" for="verifyNa">North America</label></div>
                <div class="form-check form-check-inline"><input class="form-check-input" type="checkbox" value="eu" id="verifyEu" /><label class="form-check-label" for="verifyEu">Europe</label></div>
                <button class="btn btn-success ms-auto" type="submit"><i class="bi bi-search"></i> Verify</button>
              </div>
              <span id="verifyError" class="text-danger d-block mt-2"></span>
            </form>
            <div id="results" class="mt-3"></div>
          </div>
        </div>

      </div>
    </div>

    <footer class="pt-4 pb-3">
        <hr />
        <div class="alert alert-info mt-4"><h5 class="alert-heading"><i class="bi bi-shield-check"></i> Your Data Stays in Your Browser</h5><p>This is a fully client-side application. All data you enter, including your Client ID and Secret, is processed directly in your browser and is <strong>never sent to or stored on our server</strong>. The only network requests made are directly from your browser to the official Tesla API endpoints.</p><hr><p class="mb-0"><strong>You can verify this claim:</strong> Open your browser's Developer Tools (F12 or Ctrl+Shift+I), go to the "Network" tab, and observe the requests made when you use the forms.</p></div>
        <div class="text-center text-muted mt-4"><small>Copyright &copy; 2025 Icewheel LLC. All Rights Reserved.<span class="mx-2">&middot;</span><a href="https://github.com/icewheel-oss/icewheel-energy-key-beacon/" target="_blank" rel="noopener noreferrer" class="text-muted text-decoration-none">GitHub</a></small></div>
    </footer>

  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    function escapeHtml(s){return s.replace(/[&<>\"\']/g,c=>({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[c]));}

    function setupCopyHandler(buttonId, sourceElementId) {
      const copyButton = document.getElementById(buttonId);
      const sourceElement = document.getElementById(sourceElementId);
      if (!copyButton || !sourceElement) return;
      copyButton.addEventListener('click', async () => {
        const textToCopy = sourceElement.value !== undefined ? sourceElement.value : sourceElement.innerText;
        try {
          await navigator.clipboard.writeText(textToCopy);
          const originalContent = copyButton.innerHTML;
          copyButton.innerHTML = '<i class="bi bi-clipboard-check"></i> Copied';
          setTimeout(() => { copyButton.innerHTML = originalContent; }, 1500);
        } catch (err) { console.error('Failed to copy: ', err); }
      });
    }

    document.addEventListener('DOMContentLoaded', () => {
      const currentOrigin = window.location.origin;
      const redirectPath = '/api/tesla/fleet/auth/callback';
      document.getElementById('originCurrent').value = currentOrigin;
      document.getElementById('redirectCurrent').value = currentOrigin + redirectPath;
      document.getElementById('returnedCurrent').value = currentOrigin;

      if (document.getElementById('publicKey')) setupCopyHandler('copyKeyBtn', 'publicKey');
      setupCopyHandler('copyOriginLocalBtn', 'originLocal');
      setupCopyHandler('copyOriginCurrentBtn', 'originCurrent');
      setupCopyHandler('copyRedirectLocalBtn', 'redirectLocal');
      setupCopyHandler('copyRedirectCurrentBtn', 'redirectCurrent');
      setupCopyHandler('copyReturnedLocalBtn', 'returnedLocal');
      setupCopyHandler('copyReturnedCurrentBtn', 'returnedCurrent');
    });

    // Get token
    document.getElementById('tokenForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const clientId = document.getElementById('clientId').value.trim();
      const clientSecret = document.getElementById('clientSecret').value.trim();
      const err = document.getElementById('tokenError');
      err.textContent='';
      try {
        const r = await fetch('/get-token', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ clientId, clientSecret }) });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Failed to get token');
        document.getElementById('partnerToken').value = data.access_token || '';
      } catch (e){ err.textContent = e.message || String(e); }
    });

    // Register
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const domain = document.getElementById('domainInput').value.trim();
      const token = document.getElementById('partnerToken').value.trim();
      const regions = Array.from(document.querySelectorAll('#registerForm input[type=checkbox]:checked')).map(el => el.value);
      const err = document.getElementById('registerError');
      const out = document.getElementById('results');
      err.textContent=''; out.innerHTML='';
      try {
        const r = await fetch('/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ domain, token, regions }) });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Register failed');
        out.innerHTML = renderResults(data);
      } catch (e){ err.textContent = e.message || String(e); }
    });

    // Verify
    document.getElementById('verifyForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const domain = document.getElementById('domainInput').value.trim();
      const token = document.getElementById('partnerToken').value.trim();
      const regions = Array.from(document.querySelectorAll('#verifyForm input[type=checkbox]:checked')).map(el => el.value);
      const err = document.getElementById('verifyError');
      const out = document.getElementById('results');
      err.textContent=''; out.innerHTML='';
      try {
        const r = await fetch('/verify', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ domain, token, regions }) });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Verify failed');
        out.innerHTML = renderResults(data);
      } catch (e){ err.textContent = e.message || String(e); }
    });

    function renderResults(results){
       if (!Array.isArray(results)) return '<div class="alert alert-danger">Unexpected response</div>';
      return results.map(function(r){
        var ok = r.status === 'fulfilled';
        var title = ok ? '✅ ' + ((r.value && r.value.region) || '') + ' Success' : '❌ ' + ((r.value && r.value.region) || '') + ' Failed';
        var data = ok ? (r.value && r.value.data) : { error: (r.reason && r.reason.message) };
        var url = ok ? (r.value && r.value.url) : null;
        var html = '<div class="alert ' + (ok ? 'alert-success' : 'alert-danger') + '">' 
          + '<h6 class="mb-2">' + title + '</h6>' 
          + (url ? ('<div class="text-muted text-xs">Request URL: ' + escapeHtml(url) + '</div>') : '') 
          + '<pre class="text-xs" style="white-space:pre-wrap;word-break:break-all;">' + escapeHtml(JSON.stringify(data, null, 2)) + '</pre>' 
          + '</div>';
        return html;
      }).join('');
    }
  </script>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>\"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// The single exported HTTP function handler
export async function beacon(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return res.status(204).send('');
    }

    const path = (req.path || req.url || '').split('?')[0];

    if (req.method === 'GET') {
      if (path === '/' || path.endsWith('/index.html')) return sendHtml(res, 200, renderIndexHtml(resolvePublicKey()));
      if (path === '/.well-known/appspecific/com.tesla.3p.public-key.pem') {
        const pk = resolvePublicKey();
        return pk ? sendText(res, 200, pk, 'application/x-pem-file') : sendText(res, 404, 'Public key not found');
      }
    }

    if (req.method === 'POST') {
      const body = await parseJson(req);
      if (path.endsWith('/get-token')) {
        const { clientId, clientSecret } = body;
        if (!clientId || !clientSecret) return sendJson(res, 400, { error: 'clientId and clientSecret are required' });

        const params = new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret, scope: 'openid user_data vehicle_device_data vehicle_cmds vehicle_charging_cmds energy_device_data energy_cmds offline_access', audience: REGION_URLS.na });
        const apiResponse = await fetch(TESLA_AUTH_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
        const data = await apiResponse.json().catch(() => ({}));
        return sendJson(res, apiResponse.status, data);
      }

      if (path.endsWith('/register') || path.endsWith('/verify')) {
        const { domain, token, regions } = body;
        if (!domain || !token || !Array.isArray(regions) || regions.length === 0) return sendJson(res, 400, { error: 'Domain, token, and regions are required' });

        const promises = regions.map(async (region) => {
          if (!REGION_URLS[region]) throw new Error(`Invalid region: ${region}`);
          const isRegister = path.endsWith('/register');
          const url = isRegister ? `${REGION_URLS[region]}/api/1/partner_accounts` : `${REGION_URLS[region]}/api/1/partner_accounts/public_key?domain=${encodeURIComponent(domain)}`;
          const options = {
            method: isRegister ? 'POST' : 'GET',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: isRegister ? JSON.stringify({ domain }) : undefined,
          };
          const apiResponse = await fetch(url, options);
          const data = await apiResponse.json().catch(() => ({}));
          if (!apiResponse.ok) throw new Error(`API error for ${region}: ${data.error || data.msg || 'Unknown'}`);
          return { region, data, url };
        });

        const results = await Promise.allSettled(promises);
        const formatted = results.map(r => (r.status === 'fulfilled' ? { ...r, value: { ...r.value, region: r.value.region } } : { status: 'rejected', reason: { message: r.reason.message }, value: { region: (r.reason.message.match(/for (\w+)/) || [])[1] || 'unknown' } }));
        return sendJson(res, 200, formatted);
      }
    }

    return sendText(res, 404, 'Not Found');
  } catch (err) {
    return sendJson(res, 500, { error: err instanceof Error ? err.message : 'Internal Server Error' });
  }
}

// Register with Functions Framework for local development, Cloud Run, and Gen2.
if (process.env.NODE_ENV !== 'test') {
  functionsFramework.http('beacon', beacon);
}
