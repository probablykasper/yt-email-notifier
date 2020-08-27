const http = require('http')
const fs = require('fs')
const connect = require('connect')
const serveStatic = require('serve-static')
const WebSocket = require('ws')
const fetch = require('node-fetch')
const Datastore = require('nedb')
const paths = require('./paths.js')
const logger = require('./logger.js')

const app = connect()
app.use(serveStatic('src/web'))
let server

let store
if (fs.existsSync(paths.settings)) {
  store = JSON.parse(fs.readFileSync(paths.settings, 'utf8'))
} else {
  store = {
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
            icon: 'https://yt3.ggpht.com/a/AATXAJwLt5qcWgwpO6Noz11FaNogK45FeQyBy1Lru0vHGQ=s240-c-k-c0xffffffff-no-rj-mo',
            id: 'UCJ6td3C9QlPO9O_J5dF4ZzA',
            uploadsPlaylistId: 'UUJ6td3C9QlPO9O_J5dF4ZzA',
            name: 'Monstercat: Uncaged',
          },
          {
            icon: 'https://yt3.ggpht.com/a/AATXAJy3pMToshtoxjKPLHwSCv7ab4UEO0m7wRbly6i8Gw=s240-c-k-c0xffffffff-no-rj-mo',
            id: 'UCCvVpbYRgYjMN7mG7qQN0Pg',
            uploadsPlaylistId: 'UUCvVpbYRgYjMN7mG7qQN0Pg',
            name: 'Bass Nation',
          },
          {
            icon: 'https://yt3.ggpht.com/a/AATXAJwvW4WzARWJorw4NG4eNg5gnR3nZ_brzwdHpz_Bvw=s240-c-k-c0xffffffff-no-rj-mo',
            id: 'UCcJL2ld6kxy_nuV1u7PVQ0g',
            uploadsPlaylistId: 'UUcJL2ld6kxy_nuV1u7PVQ0g',
            name: 'DrDisRespect',
          },
        ],
      },
    ],
  }
}

async function fetchYT(options) {
  let url = options.url
  if (!options.query) options.query = {}
  options.query.key = store.apiKey
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

let intervals = []

const pLimit = require('p-limit')
const limit = pLimit(1)
async function refresh(instance) {
  try {
    const channelCount = instance.channels.length
    const queries = []
    for (let i = 0; i < channelCount; i++) {
      const channel = instance.channels[i]
      const query = async () => {
        await new Promise(resolve => setTimeout(resolve, 1000))
        logger.info(instance.email, channel.name)
        const uploads = await fetchYT({
          url: 'https://www.googleapis.com/youtube/v3/playlistItems',
          query: {
            part: 'snippet,contentDetails',
            playlistId: channel.uploadsPlaylistId,
            maxResults: 50,
          },
        })
        for (let i = 0; i < uploads.items.length; i++) {
          // weird date situation:
          //  `snippet.publishedAt` is when the video was added to the uploads playlist.
          //  `contentDetails.videoPublishedAt` is when the video was published
          //  Soemtimes these are a few seconds different, other times an hour
          //  (like with Monstercat). No idea why.
          //  Additionally, I tried to compare with what YouTube shows:
          //  - What YouTube shows: 19:56 (should be up to 1 hour inaccurate)
          //  - publishedAt: 17:31
          //  - 18:00
          //  YouTube only shows "9 hours ago", so you'd expect it to be up to
          //  an hour off... But it's almost 2 hours off, if not 2.5 hours.
          //  :/

          const video = uploads.items[i]
          const publishedAt = new Date(video.contentDetails.videoPublishedAt)
          if (publishedAt.getTime() >= instance.lastSyncedAt) {
            logger.info(' - VID ', video.snippet.title)
          }
        }
      }
      queries.push(limit(query))
    }
    await Promise.all(queries)
  } catch(err) {
    logger.error(err)
  }
}

function restartIntervals() {
  for (let i = 0; i < intervals.length; i++) {
    clearInterval(intervals[i])
  }
  intervals = []

  for (let i = 0; i < store.instances.length; i++) {
    const instance = store.instances[i]
    const intervalTime = instance.minutesBetweenRefreshes*1000*60
    refresh(instance)
    const interval = setInterval(refresh, intervalTime, instance)
    intervals.push(interval)
  }
}
restartIntervals()

const wss = new WebSocket.Server({ noServer: true })
let connection = null

wss.on('connection', async (ws) => {
  function send(type, data) {
    ws.send(JSON.stringify({ type, data }))
  }
  function storeUpdate() {
    fs.writeFileSync(paths.settings, JSON.stringify(store, null, '  '))
    send('newStore', store)
  }

  if (connection) {
    connection.close(1000, 'old connection')
  }
  connection = ws
  logger.info('WS Open')
  send('newStore', store)

  ws.on('close', (code, reason) => {
    if (reason === 'old connection') {
      logger.info('WS Close old connection')
    } else {
      logger.info('WS Close')
      connection = null
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
    logger.info(`WS "${type}" message received:`, data)

    try {
      if (type === 'setApiKey') {
        store.apiKey = data.key
        storeUpdate()

      } else if (type === 'newEmail') {
        data.channels = []
        if (!data.lastSyncedAt) data.lastSyncedAt = new Date().getTime()
        store.instances.push(data)
        storeUpdate()

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
        storeUpdate()
      }
    } catch(err) {
      logger.error(err)
      send('error', err instanceof Error ? err.toString() : err)
    }
  })

})


let isOpen = false
const port = 9199

module.exports.open = async () => {
  if (isOpen) return
  server = http.createServer(app).listen(port, err => {
    if (err) return logger.error('ERROR OPENING SERVER')
    logger.info('Server listening on http://localhost:'+port)
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
    logger.info('Closing server')
    server.close()
    isOpen = false
  } else {
    logger.warn('Server close called, but is already closed')
  }
}
