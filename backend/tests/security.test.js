// Security measures from the review in docs/security-review.md.
const { test, describe, beforeEach, after } = require('node:test')
const assert = require('node:assert')
const supertest = require('supertest')
const app = require('../app')
const db = require('../db/db')
const { resetDb, loginAs } = require('./helper')

const api = supertest(app)
const NEWLINE = String.fromCharCode(10)

beforeEach(resetDb)

after(() => db.destroy())

describe('headers', () => {
  test('a strict Content Security Policy, allowing only Turnstile from outside', async () => {
    const response = await api.get('/api/health').expect(200)
    const policy = response.headers['content-security-policy']
    assert.match(policy, /default-src 'self'/)
    assert.match(policy, /script-src 'self' https:\/\/challenges\.cloudflare\.com/)
    assert.match(policy, /frame-ancestors 'none'/)
    assert.match(policy, /object-src 'none'/)
    assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval/)
  })

  test('the usual helmet headers are there', async () => {
    const response = await api.get('/api/health').expect(200)
    assert.strictEqual(response.headers['x-content-type-options'], 'nosniff')
    assert.strictEqual(response.headers['x-powered-by'], undefined)
  })
})

describe('input', () => {
  test('names with line breaks are refused (they could reach email headers)', async () => {
    const anna = await loginAs('anna')
    await anna.post('/api/employees').send({ name: `Kalle${NEWLINE}Bcc: x@example.com`, email: 'kalle@example.com' }).expect(400)
    await anna.put('/api/bar').send({
      name: `Own Bar${NEWLINE}X`, timezone: 'Europe/Helsinki', opensAt: '10:00', closesAt: '04:00'
    }).expect(400)
  })

  test('the session cookie is httpOnly and SameSite', async () => {
    const response = await api.post('/api/login').send({ login: 'anna', password: 'test-password' }).expect(200)
    const cookie = response.headers['set-cookie'][0]
    assert.match(cookie, /HttpOnly/)
    assert.match(cookie, /SameSite=Lax/)
  })
})
