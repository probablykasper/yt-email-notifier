const http = require('http')
const connect = require('connect')
const serveStatic = require('serve-static')
const WebSocket = require('ws')
// const fetch = require('node-fetch')

const app = connect()
app.use(serveStatic('src/web'))
let server

// async function fetchYT(user, options) {
//   let url = options.url
//   if (options.query) {
//     url += '?'
//     for (const key in options.query) {
//       url += key+'='+options.query[key]+'&'
//     }
//   }
//   if (!options.headers) options.headers = {}
//   if (user.tokenType === 'Bearer') {
//     options.headers.Authorization = 'Bearer '+user.accessToken
//   }
//   const res = await fetch(url, options)
//   const json = await res.json()
//   if (json.error) throw json.error
//   return json
// }

let store = {
  instances: [
    {
      email: 'test@example.com',
      timeLastSynced: 1597870637076,
      minutesBetweenRefreshes: 60,
      channels: [
        {
          icon: '',
          id: '',
          uploadsPlaylistId: '',
          name: 'Linus Tech Tips',
        },
        {
          icon: '',
          id: '',
          uploadsPlaylistId: '',
          name: 'Half as Interesting',
        },
      ],
    },
    {
      email: 'test2@example.com',
      timeLastSynced: 1597870637076,
      channels: [
        {
          icon: '',
          id: '',
          uploadsPlaylistId: '',
          name: 'Monstercat',
        },
        {
          icon: '',
          id: '',
          uploadsPlaylistId: '',
          name: 'Bass Nation',
        },
        {
          icon: '',
          id: '',
          uploadsPlaylistId: '',
          name: 'Valiant',
        },
      ],
    },
  ],
}

const wss = new WebSocket.Server({ noServer: true })
let connections = 0

wss.on('connection', (ws) => {
  connections += 1
  console.log(`WS Open (${connections} now open)`)
  send('newStore', store)

  function send(type, data) {
    ws.send(JSON.stringify({ type, data }))
  }

  ws.on('close', () => {
    connections -= 1
    console.log(`WS Close (${connections} now open)`)
    if (!connections) {
      setTimeout(() => {
        if (!connections) module.exports.close()
      }, 5000)
    }
  })

  ws.on('message', async (msg) => {
    const { type, data } = JSON.parse(msg)
    console.log(`WS "${type}" message received:`, data)

    if (type === 'newEmail') {
      if (!data.channels) data.channels = []
      if (!data.timeLastSynced) data.timeLastSynced = new Date().getTime()
      store.instances.push(data)
      ws.send(JSON.stringify({ type: 'initStore', data: store }))
    }
  })

})


let isOpen = false
const port = 9199

module.exports.open = async () => {
  if (isOpen) return
  server = http.createServer(app).listen(port, err => {
    if (err) return console.log('ERROR OPENING SERVER')
    console.log('Server listening on http://localhost:'+port)
    isOpen = true
  })
  server.on('upgrade', function upgrade(request, socket, head) {
    wss.handleUpgrade(request, socket, head, function done(ws) {
      wss.emit('connection', ws, request)
    })
  })
}

module.exports.close = async () => {
  if (isOpen) {
    console.log('Closing server')
    server.close()
    isOpen = false
  } else {
    console.log('Server close called, but is already closed')
  }
}
