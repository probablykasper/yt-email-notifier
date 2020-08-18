const connect = require('connect')
const serveStatic = require('serve-static')
const WebSocket = require('ws')
const fetch = require('node-fetch')

const server = connect()
server.use(serveStatic('src/web'))

const store = {
  users: []
}

async function fetchYT(user, options) {
  let url = options.url
  if (options.query) {
    url += '?'
    for (const key in options.query) {
      url += key+'='+options.query[key]+'&'
    }
  }
  if (!options.headers) options.headers = {}
  if (user.tokenType === 'Bearer') {
    options.headers.Authorization = 'Bearer '+user.accessToken
  }
  const res = await fetch(url, options)
  const json = await res.json()
  return json
}

const wss = new WebSocket.Server({ port: 9198 })

async function addUserFromHash(hash) {
  const newUser = {
    accessToken: hash.access_token,
    tokenType: hash.token_type,
    expiresInSecs: hash.expiresIn,
    scope: 'https://www.googleapis.com/auth/youtube.readonly',
    timestamp: hash.state,
  }
  const json = await fetchYT(newUser, {
    url: 'https://www.googleapis.com/youtube/v3/channels',
    query: { part: 'snippet', mine: true },
  })
  newUser.id = json.items[0].id
  store.users.push(newUser)
  console.log('Added new user', newUser)
}

wss.on('connection', (ws) => {
  console.log('WS open')

  ws.on('message', async (msg) => {
    const { type, data } = JSON.parse(msg)
    console.log(`WS "${type}" message received:`, data)

    if (type === 'hash') {
      if (data.access_token && data.scope === 'https://www.googleapis.com/auth/youtube.readonly') {
        addUserFromHash(data)
      }

    }
  })

})


function isOpen() {
  return server.listening
}
module.exports.isOpen = isOpen
const port = 9199

module.exports.open = async () => {
  if (isOpen()) return
  server.listen(port, err => {
    if (err) return console.log('ERROR OPENING SERVER')
    console.log('Server listening on port', port)
    module.exports.isOpen = false
  })
}

module.exports.close = async () => {
  server.close()
  module.exports.isOpen = false
}
