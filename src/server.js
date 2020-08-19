const connect = require('connect')
const serveStatic = require('serve-static')
const WebSocket = require('ws')
// const fetch = require('node-fetch')

const server = connect()
server.use(serveStatic('src/web'))


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
  channels: ['Linus Tech Tips', 'Half as Interesting'],
  emails: ['test@example.com', 'test2@example.com']
}

const wss = new WebSocket.Server({ port: 9198 })

wss.on('connection', (ws) => {
  console.log('WS open')

  ws.send(JSON.stringify({ type: 'initStore', data: store }))

  ws.on('message', async (msg) => {
    const { type, data } = JSON.parse(msg)
    console.log(`WS "${type}" message received:`, data)

    if (type === 'storeUpdate') {
      store = data
      ws.send(JSON.stringify({ type: 'initStore', data: store }))
    }
  })

})


let isOpen = false
const port = 9199

module.exports.open = async () => {
  if (isOpen) return
  server.listen(port, err => {
    if (err) return console.log('ERROR OPENING SERVER')
    console.log('Server listening on port', port)
    isOpen = true
  })
}

module.exports.close = async () => {
  server.close()
  module.exports.isOpen = false
}
