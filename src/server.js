const http = require('http')
const connect = require('connect')
const serveStatic = require('serve-static')
const WebSocket = require('ws')
const fetch = require('node-fetch')

const app = connect()
app.use(serveStatic('src/web'))
let server

let store = {
  apiKey: '',
  instances: [
    {
      email: 'test@example.com',
      lastSyncedAt: 1597870637076,
      minutesBetweenRefreshes: 60,
      channels: [],
    },
    {
      email: 'test2@example.com',
      lastSyncedAt: 1597870637076,
      minutesBetweenRefreshes: 60*5,
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

async function fetchYT(options) {
  let url = options.url
  if (!options.query) options.query = { key: store.apiKey }
  if (options.query) {
    url += '?'
    for (const key in options.query) {
      url += key+'='+options.query[key]+'&'
    }
  }
  if (!options.headers) options.headers = {}
  const res = await fetch(url, options)
  const json = await res.json()
  if (json.error) throw json.error
  return json
}

const wss = new WebSocket.Server({ noServer: true })
let connection = null

function sendAll(type, data) {
  wss.clients.forEach(function each(ws) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, data }))
    }
  })
}

wss.on('connection', async (ws) => {
  function send(type, data) {
    ws.send(JSON.stringify({ type, data }))
  }

  if (connection) {
    connection.close(1000, 'old connection')
  }
  connection = ws
  console.log('WS Open')
  send('newStore', store)

  ws.on('close', (code, reason) => {
    if (reason === 'old connection') {
      console.log('WS Close old connection')
    } else {
      console.log('WS Close')
      setTimeout(() => {
        if (connection === null) {
          module.exports.close()
          connection = null
        }
      }, 5000)
    }
  })

  ws.on('message', async (msg) => {
    const { type, data } = JSON.parse(msg)
    console.log(`WS "${type}" message received:`, data)

    try {
      if (type === 'setApiKey') {
        store.apiKey = data.key
        sendAll('newStore', store)

      } else if (type === 'newEmail') {
        if (!data.channels) data.channels = []
        if (!data.lastSyncedAt) data.lastSyncedAt = new Date().getTime()
        store.instances.push(data)
        sendAll('newStore', store)

      } else if (type === 'addChannel') {
        const segments = data.channel.split('/')
        const channelIdSegment = segments.indexOf('channel') + 1
        const usernameSegment = segments.indexOf('user') + 1
          || segments.indexOf('www.youtube.com') + 1
          || segments.indexOf('youtube.com') + 1
        const query = { key: store.apiKey, part: 'contentDetails,id,snippet' }
        if (channelIdSegment > 0) {
          const channelId = segments[channelIdSegment]
          query.id = channelId
        } else if (usernameSegment >= 0) {
          const username = segments[usernameSegment]
          query.forUsername = username
        } else {
          throw new Error(`Can't deal with url '${data.channel}'. The url should have /channel/ or /user/ in it.`)
        }
        const result = await fetchYT({
          url: 'https://www.googleapis.com/youtube/v3/channels',
          query: query,
        })
        if (!result.items) throw new Error(`Channel '${data.channel}' not found`)
        const channelObject = result.items[0]
        store.instances[data.instance].channels.push({
          id: channelObject.id,
          name: channelObject.snippet.title,
          icon: channelObject.snippet.thumbnails.medium.url,
          uploadsPlaylistId: channelObject.contentDetails.relatedPlaylists.uploads,
          addedAt: new Date().getTime(),
        })
        sendAll('newStore', store)
      }
    } catch(err) {
      console.log(':::err:::')
      console.log(err)
      send('error', err instanceof Error ? err.toString() : err)
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
