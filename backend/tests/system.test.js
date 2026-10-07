const { test, describe, beforeEach, after } = require('node:test')
const assert = require('node:assert')
const path = require('node:path')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const supertest = require('supertest')
const app = require('../app')
const db = require('../db/db')
const { resetDb } = require('./helper')
const { version } = require('../package.json')

const api = supertest(app)

beforeEach(resetDb)

after(() => db.destroy())

describe('public endpoints', () => {
  test('health reports ok and the version, without logging in', async () => {
    const response = await api.get('/api/health').expect(200)
    assert.deepStrictEqual(response.body, { status: 'ok', version })
  })

  test('app info has the version, mode and source code link', async () => {
    const response = await api.get('/api/app-info').expect(200)
    assert.strictEqual(response.body.version, version)
    assert.strictEqual(response.body.deploymentMode, 'self-hosted')
    assert.match(response.body.sourceUrl, /^https:\/\//)
  })
})

describe('configuration checks', () => {
  // Loads utils/config.js again with the given environment variables. An empty
  // string stands for "not set": dotenv would refill a deleted variable from .env.
  const configWith = (vars) => {
    const saved = { ...process.env }
    Object.assign(process.env, vars)
    for (const [key, value] of Object.entries(vars)) if (value === undefined) delete process.env[key]
    const configPath = require.resolve('../utils/config')
    delete require.cache[configPath]
    try {
      return require('../utils/config')
    } finally {
      process.env = saved
      delete require.cache[configPath]
    }
  }

  test('production refuses a missing, short or placeholder session secret', () => {
    const base = { NODE_ENV: 'production', DATABASE_URL: 'postgres://x' }
    assert.match(configWith({ ...base, SESSION_SECRET: '' }).problems().join(), /SESSION_SECRET is not set/)
    assert.match(configWith({ ...base, SESSION_SECRET: 'short' }).problems().join(), /at least 32 characters/)
    assert.match(configWith({ ...base, SESSION_SECRET: 'replace-with-a-long-random-string' }).problems().join(), /at least 32/)
    assert.deepStrictEqual(configWith({ ...base, SESSION_SECRET: 'a'.repeat(64) }).problems(), [])
  })

  test('an unknown deployment mode is refused', () => {
    const config = configWith({ DEPLOYMENT_MODE: 'cloud' })
    assert.match(config.problems().join(), /DEPLOYMENT_MODE must be one of/)
  })

  test('cookies are secure in production unless turned off', () => {
    assert.strictEqual(configWith({ NODE_ENV: 'production' }).COOKIE_SECURE, true)
    assert.strictEqual(configWith({ NODE_ENV: 'production', COOKIE_SECURE: 'false' }).COOKIE_SECURE, false)
  })
})

describe('create-admin command', () => {
  const run = (args, env = {}) =>
    promisify(execFile)(process.execPath, [path.join(__dirname, '../scripts/createAdmin.js'), ...args], {
      env: { ...process.env, NODE_ENV: 'test', ...env }
    })

  test('creates an admin who can log in', async () => {
    const { stdout } = await run(['--username', 'Owner', '--name', 'Bar Owner'], { ADMIN_PASSWORD: 'a-good-password' })
    assert.match(stdout, /Admin owner created/)

    const login = await api.post('/api/login').send({ username: 'owner', password: 'a-good-password' }).expect(200)
    assert.deepStrictEqual(login.body.groups, ['adminGroup'])
    assert.strictEqual(login.body.barId, null)
  })

  test('refuses a taken username or a weak password', async () => {
    await assert.rejects(run(['--username', 'admin', '--name', 'X'], { ADMIN_PASSWORD: 'a-good-password' }), /already in use/)
    await assert.rejects(run(['--username', 'newadmin', '--name', 'X'], { ADMIN_PASSWORD: 'short' }), /password must be/)
    await assert.rejects(run([], { ADMIN_PASSWORD: 'a-good-password' }), /Usage/)
  })
})
