const { createServer } = require('http')
const next = require('next')
const { WebSocketServer } = require('ws')

const port = Number(process.env.PORT || 3000)
const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev, hostname: '0.0.0.0', port })
const handle = app.getRequestHandler()

const sockets = new Set()

function broadcastRefresh() {
  const payload = JSON.stringify({ type: 'refresh' })
  for (const socket of sockets) {
    if (socket.readyState === 1) {
      socket.send(payload)
    }
  }
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    if (req.url === '/_realtime') {
      res.writeHead(426, { 'Upgrade': 'websocket' })
      res.end()
      return
    }
    handle(req, res)
  })

  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (request, socket, head) => {
    const pathname = request.url || '/'
    if (pathname !== '/_realtime') {
      socket.destroy()
      return
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      sockets.add(ws)
      ws.on('close', () => sockets.delete(ws))
      ws.on('message', () => {
        // keep the socket alive and ready for push notifications
      })
    })
  })

  server.listen(port, '0.0.0.0', () => {
    console.log(`Server ready on http://localhost:${port}`)
  })

  globalThis.__SOCIAL_GREETING_WS__ = { broadcastRefresh }
})

module.exports = { broadcastRefresh: () => {
  if (globalThis.__SOCIAL_GREETING_WS__) globalThis.__SOCIAL_GREETING_WS__.broadcastRefresh()
} }
