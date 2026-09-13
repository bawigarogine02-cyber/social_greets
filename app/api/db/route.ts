import { NextResponse } from 'next/server'
import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise'
import { randomUUID } from 'node:crypto'

export const runtime = 'nodejs'

type Filter = { column: string; value: string | number | null }
type DbRequest = {
  operation: 'query' | 'rpc'
  table?: string
  action?: 'select' | 'insert' | 'update' | 'delete' | 'upsert'
  fields?: string
  payload?: Record<string, unknown>
  filters?: Filter[]
  or?: string
  order?: { column: string; ascending?: boolean }
  single?: boolean
  maybeSingle?: boolean
  name?: string
  args?: Record<string, unknown>
}

const tables = new Set([
  'profiles',
  'greetings',
  'banners',
  'friends',
  'conversations',
  'chat_messages',
  'notifications',
  'password_requests',
  'site_settings',
])

let pool: Pool | null = null
type DbConnection = Pool | PoolConnection

function getPool() {
  if (!process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_USER) return null
  pool ||= mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    waitForConnections: true,
    connectionLimit: 5,
  })
  return pool
}

function identifier(value: string | undefined, fallback = '*') {
  const name = value || fallback
  if (name !== '*' && !/^[a-z_][a-z0-9_]*(,\s*[a-z_][a-z0-9_]*)*$/i.test(name)) {
    throw new Error('Invalid database field.')
  }
  return name === '*' ? '*' : name.split(',').map(field => `\`${field.trim()}\``).join(', ')
}

function tableName(value: string | undefined) {
  if (!value || !tables.has(value)) throw new Error('Invalid database table.')
  return `\`${value}\``
}

function buildWhere(filters: Filter[] = [], or?: string) {
  const clauses: string[] = []
  const values: unknown[] = []
  for (const filter of filters) {
    if (!/^[a-z_][a-z0-9_]*$/i.test(filter.column)) throw new Error('Invalid filter.')
    clauses.push(`\`${filter.column}\` ${filter.value === null ? 'IS NULL' : '= ?'}`)
    if (filter.value !== null) values.push(filter.value)
  }

  if (or) {
    const pairs = [...or.matchAll(/(?:from_username|to_username)\.eq\.([a-zA-Z0-9_]+)/g)].map(match => match[0].split('.'))
    if (pairs.length === 4 && pairs.every(pair => pair.length === 3)) {
      clauses.push('((`from_username` = ? AND `to_username` = ?) OR (`from_username` = ? AND `to_username` = ?))')
      values.push(pairs[0][2], pairs[1][2], pairs[2][2], pairs[3][2])
    } else {
      throw new Error('Unsupported database filter.')
    }
  }

  return { sql: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', values }
}

function normalizeRows(rows: unknown): Record<string, unknown>[] {
  if (!Array.isArray(rows)) return []
  return rows.map(row => {
    if (!row || typeof row !== 'object') return row
    const next = { ...(row as Record<string, unknown>) }
    for (const field of ['reactions', 'comments', 'member_usernames']) {
      if (typeof next[field] === 'string') {
        try { next[field] = JSON.parse(next[field] as string) } catch { /* keep malformed legacy data readable */ }
      }
    }
    return next
  })
}

async function selectRows(connection: DbConnection, request: DbRequest, forTable: string) {
  const where = buildWhere(request.filters, request.or)
  const order = request.order
    ? ` ORDER BY ${identifier(request.order.column, 'created_at')} ${request.order.ascending === false ? 'DESC' : 'ASC'}`
    : ''
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT ${identifier(request.fields)} FROM ${forTable}${where.sql}${order}`,
    where.values,
  )
  return normalizeRows(rows)
}

async function queryDatabase(request: DbRequest, connection: DbConnection) {
  const table = tableName(request.table)
  const action = request.action || 'select'

  if (action === 'select') {
    const rows = await selectRows(connection, request, table)
    return { data: request.single || request.maybeSingle ? (Array.isArray(rows) ? rows[0] || null : null) : rows, error: null }
  }

  if (action === 'insert' || action === 'upsert') {
    const payload = { ...(request.payload || {}) }
    if (payload.id === undefined && request.table !== 'site_settings') payload.id = randomUUID()
    const fields = Object.keys(payload)
    if (!fields.length) throw new Error('Nothing to insert.')
    fields.forEach(field => { if (!/^[a-z_][a-z0-9_]*$/i.test(field)) throw new Error('Invalid database field.') })
      const jsonFields = new Set(['reactions', 'comments', 'member_usernames', 'pinned_by', 'blocked_by'])
    const values = fields.map(field => {
      const value = payload[field] === undefined ? null : payload[field]
      return jsonFields.has(field) && value != null && typeof value !== 'string' ? JSON.stringify(value) : value
    })
    const marks = fields.map(() => '?').join(', ')
    const update = fields.filter(field => field !== 'id').map(field => `\`${field}\` = VALUES(\`${field}\`)`).join(', ')
    const sql = action === 'upsert'
      ? `INSERT INTO ${table} (${fields.map(field => `\`${field}\``).join(', ')}) VALUES (${marks}) ON DUPLICATE KEY UPDATE ${update || '`id` = `id`'}`
      : `INSERT INTO ${table} (${fields.map(field => `\`${field}\``).join(', ')}) VALUES (${marks})`
    await connection.query<ResultSetHeader>(sql, values)
    const idFilter = payload.id !== undefined ? [{ column: 'id', value: String(payload.id) }] : []
    const rows = await selectRows(connection, { ...request, action: 'select', filters: idFilter, fields: request.fields || '*' }, table)
    return { data: request.single || request.maybeSingle ? (Array.isArray(rows) ? rows[0] || null : null) : rows, error: null }
  }

  const where = buildWhere(request.filters, request.or)
  if (!where.sql) throw new Error('A filter is required for update or delete.')

  if (action === 'update') {
    const payload = request.payload || {}
    const fields = Object.keys(payload)
    fields.forEach(field => { if (!/^[a-z_][a-z0-9_]*$/i.test(field)) throw new Error('Invalid database field.') })
    if (!fields.length) throw new Error('Nothing to update.')
    const jsonFields = new Set(['reactions', 'comments', 'member_usernames', 'pinned_by', 'blocked_by'])
    const values = fields.map(field => {
      const value = payload[field]
      return jsonFields.has(field) && value != null && typeof value !== 'string' ? JSON.stringify(value) : value
    })
    await connection.query(`UPDATE ${table} SET ${fields.map(field => `\`${field}\` = ?`).join(', ')}${where.sql}`, [...values, ...where.values])
    const rows = await selectRows(connection, { ...request, action: 'select', fields: request.fields || '*' }, table)
    return { data: request.single || request.maybeSingle ? (Array.isArray(rows) ? rows[0] || null : null) : rows, error: null }
  }

  if (action === 'delete') {
    await connection.query(`DELETE FROM ${table}${where.sql}`, where.values)
    return { data: null, error: null }
  }

  throw new Error('Unsupported database operation.')
}

async function rpc(name: string | undefined, args: Record<string, unknown> = {}, connection: DbConnection) {
  if (name === 'register_profile') {
    await connection.query(
      'INSERT INTO `profiles` (`id`, `username`, `display`, `password_hash`, `role`) VALUES (?, ?, ?, ?, ?)',
      [args.p_id, args.p_username, args.p_display, args.p_password_hash, 'user'],
    )
    const [rows] = await connection.query<RowDataPacket[]>('SELECT * FROM `profiles` WHERE `username` = ?', [args.p_username])
    return { data: normalizeRows(rows)[0] || null, error: null }
  }
  if (name === 'find_profile') {
    const [rows] = await connection.query<RowDataPacket[]>('SELECT * FROM `profiles` WHERE `username` = ? LIMIT 1', [args.p_username])
    return { data: normalizeRows(rows)[0] || null, error: null }
  }
  if (name === 'list_profiles') {
    const [rows] = await connection.query<RowDataPacket[]>('SELECT * FROM `profiles` ORDER BY `created_at`')
    return { data: normalizeRows(rows), error: null }
  }
  if (name === 'reset_social_greetings') {
    for (const table of ['chat_messages', 'conversations', 'notifications', 'friends', 'greetings', 'banners', 'profiles']) {
      await connection.query(`DELETE FROM \`${table}\``)
    }
    return { data: null, error: null }
  }
  throw new Error('Unsupported database function.')
}

export async function POST(request: Request) {
  const database = getPool()
  if (!database) return NextResponse.json({ data: null, error: { message: 'Database environment is not configured.' } }, { status: 503 })

  let connection
  try {
    const body = await request.json() as DbRequest
    connection = await database.getConnection()
    const result = body.operation === 'rpc'
      ? await rpc(body.name, body.args, connection)
      : await queryDatabase(body, connection)

    if (body.operation !== 'rpc' && body.action && ['insert', 'update', 'delete', 'upsert'].includes(body.action)) {
      try {
        globalThis.__SOCIAL_GREETING_WS__?.broadcastRefresh?.()
      } catch {
        // WebSocket server not available during static or limited runtime cases.
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    const mysqlError = error as { message?: string; code?: string }
    return NextResponse.json({ data: null, error: { message: mysqlError.message || 'Database operation failed.', code: mysqlError.code } }, { status: 400 })
  } finally {
    connection?.release()
  }
}
