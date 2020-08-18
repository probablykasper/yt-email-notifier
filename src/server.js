const connect = require('connect')
const serveStatic = require('serve-static')
const WebSocket = require('ws')
const fetch = require('node-fetch')

const clientId = '360374944795-g9e4g54m6chuvees28r3s10bqgg24cnk.apps.googleusercontent.com'

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
  if (json.error) throw json.error
  return json
}

const wss = new WebSocket.Server({ port: 9198 })

// setInterval(() => {
//   console.log('REFRESH TOKEN>......')
//   fetchYT({
//     url: 'https://www.googleapis.com/auth/youtube.readonly',
//     headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
//     body: ''
//       + 'client_id=360374944795-g9e4g54m6chuvees28r3s10bqgg24cnk.apps.googleusercontent.com'
//       +'&client_secret=cdk0q2VdKz1HvmXTO1HutwEH'
//       +'&refresh_token=1/6BMfW9j53gdGImsixUH6kU5RsR4zwI9lUVX-tqf8JXQ'
//       +'&grant_type=refresh_token',
//   })
// }, 1000*10)
// }, 1000*60*30)

async function addUserFromHash(hash) {
  // handle access token response from google
  const newUser = {
    accessToken: hash.access_token,
    tokenType: hash.token_type,
    expiresInSecs: hash.expires_in,
    scope: 'https://www.googleapis.com/auth/youtube.readonly',
    timestamp: hash.state,
  }

  const expirationTime = Number(newUser.timestamp)/1000 + newUser.expiresInSecs
  const currentTime = new Date().getTime()/1000
  console.log('Access token minutes left: ', (expirationTime - currentTime)/60)

  // validate user's access token
  console.log('Validating access token')
  await fetchYT(newUser, {
    url: 'https://www.googleapis.com/oauth2/v1/tokeninfo',
    query: { access_token: newUser.accessToken },
  }).then(data => {
    console.log('VALIDATE:')
    console.log(data)
    if (data.audience !== clientId) throw new Error('client ID mismatch')
    console.log(data)
  }).catch(err => {
    await fetchYT(newUser, {
      query: { grant_type: 'authorization_code' },
    })
    // throw 'Error validating access token: '+err
  })


  await fetchYT(newUser, {
    url: 'https://www.googleapis.com/youtube/v3/channels',
    query: { part: 'snippet', mine: true },
  }).then(json => {
    newUser.id = json.items[0].id
    store.users.push(newUser)
    console.log('Added new user', newUser)
  }).catch(err => {
    console.log('ERR', err)
  })
  
}

wss.on('connection', (ws) => {
  console.log('WS open')

  ws.on('message', async (msg) => {
    const { type, data } = JSON.parse(msg)
    console.log(`WS "${type}" message received:`, data)

    if (type === 'hash') {
      if (data.access_token && data.scope === 'https://www.googleapis.com/auth/youtube.readonly') {
        addUserFromHash(data).catch(err => {
          console.log('Failed to add new user:', err)
        })
      }

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
