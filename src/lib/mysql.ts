const enabled = process.env.NEXT_PUBLIC_DB_ENABLED === 'true'

export const mysqlConfigured = enabled

type RequestState = {
  operation: 'query' | 'rpc'
  table?: string
  action?: 'select' | 'insert' | 'update' | 'delete' | 'upsert'
  fields?: string
  payload?: Record<string, unknown>
  filters?: { column: string; value: string | number | null }[]
  or?: string
  order?: { column: string; ascending?: boolean }
  single?: boolean
  maybeSingle?: boolean
  name?: string
  args?: Record<string, unknown>
}

function queryChain(table: string) {
  const state: RequestState = { operation: 'query', table, action: 'select' }
  const chain: any = {
    select(fields = '*') {
      state.fields = fields
      return chain
    },
    order(column: string, options?: { ascending?: boolean }) {
      state.order = { column, ascending: options?.ascending }
      return chain
    },
    eq(column: string, value: string | number | null) {
      state.filters ||= []
      state.filters.push({ column, value })
      return chain
    },
    maybeSingle() {
      state.maybeSingle = true
      return chain
    },
    insert(payload: Record<string, unknown>) {
      state.action = 'insert'
      state.payload = payload
      return chain
    },
    update(payload: Record<string, unknown>) {
      state.action = 'update'
      state.payload = payload
      return chain
    },
    delete() {
      state.action = 'delete'
      return chain
    },
    upsert(payload: Record<string, unknown>) {
      state.action = 'upsert'
      state.payload = payload
      return chain
    },
    single() {
      state.single = true
      return chain
    },
    or(expression: string) {
      state.or = expression
      return chain
    },
    then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
      return execute(state).then(resolve, reject)
    },
  }
  return chain
}

async function execute(state: RequestState) {
  try {
    const response = await fetch('/api/db', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(state),
    })
    const result = await response.json() as { data: unknown; error: { message?: string; code?: string } | null }
    if (!response.ok && !result.error) {
      return { data: null, error: { message: 'Database operation failed.' } }
    }
    return result
  } catch (error) {
    return {
      data: null,
      error: { message: error instanceof Error ? error.message : 'Database request failed.' },
    }
  }
}

function rpc(name: string, args?: Record<string, unknown>) {
  return execute({ operation: 'rpc', name, args })
}

export const mysql: any = enabled
  ? {
      from(table: string) { return queryChain(table) },
      rpc,
    }
  : null
