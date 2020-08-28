const http = require('http')
const fs = require('fs')
const connect = require('connect')
const serveStatic = require('serve-static')
const WebSocket = require('ws')
const fetch = require('node-fetch')
const paths = require('./paths.js')
const logger = require('./logger.js')

const nodemailer = require('nodemailer')
let mailTransporter = nodemailer.createTransport({
  sendmail: true,
})

const Datastore = require('nedb')
const db = new Datastore({ filename: paths.db, autoload: true })

const app = connect()
app.use(serveStatic('src/web'))
let server

let store
if (fs.existsSync(paths.settings)) {
  store = JSON.parse(fs.readFileSync(paths.settings, 'utf8'))
} else {
  store = {
    apiKey: '',
    fromEmail: '',
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
            const videoDoc = await new Promise((resolve, reject) => {
              db.findOne({ _id: video.snippet.resourceId.videoId }, (err, doc) => {
                if (err) reject(err)
                else resolve(doc)
              })
            })
            if (!videoDoc) {
              const doc = {
                _id: video.snippet.resourceId.videoId,
                thumbnails: {
                  high: video.snippet.thumbnails.high.url,
                },
                title: video.snippet.title,
                channelTitle: video.snippet.channelTitle,
                publishedAt: publishedAt.getTime(),
              }
              if (video.snippet.thumbnails.standard) {
                doc.thumbnails.standard = video.snippet.thumbnails.standard.url
              }
              if (video.snippet.thumbnails.maxres) {
                doc.thumbnails.maxres = video.snippet.thumbnails.maxres.url
              }
              console.log('- NEW VID '+doc._id+' (this is where we send the email')
              await sendMail(store.fromEmail, instance.email, doc, channel)
            }
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

function htmlEncode(str) {
  return str
    .replace('&', '&amp;')
    .replace('<', '&lt;')
    .replace('>', '&gt;')
    .replace('\'', '&#39;')
    .replace('"', '&quot;')
}

async function sendMail(fromEmail, toEmail, videoDoc, channel) {
  const emailTitle = videoDoc.channelTitle+' just uploaded a video'
  let thumbnailUrl = videoDoc.thumbnails.high
  if (videoDoc.thumbnails.standard) thumbnailUrl = videoDoc.thumbnails.standard
  if (videoDoc.thumbnails.maxres) thumbnailUrl = videoDoc.thumbnails.maxres
  const videoUrl = 'https://youtube.com/watch?v='+videoDoc._id
  const channelUrl = 'https://www.youtube.com/channel/'+channel.id
  const html = `
    <html>
      <head>
        <title>${htmlEncode(emailTitle)}</title>
      </head>
      <body>
        <table align="center" width="608" border="0" cellpadding="0" cellspacing="0"><tbody><tr>
          <td width="20"></td>
          <td>
            <table align="center" width="608" border="0" cellpadding="0" cellspacing="0">
              <tbody>
                <tr>
                  <td>
                    <a href="${htmlEncode(videoUrl)}" class="nonplayable">
                      <table width="608" height="342" style="background-repeat:no-repeat;background-size:100% auto;background-position:center;" background="${htmlEncode(thumbnailUrl)}" border="0" cellpadding="0" cellspacing="0">
                        <tbody>
                          <tr>
                            <td width="608" style="max-height:342px;"></td>
                          </tr>
                        </tbody>
                      </table>
                    </a>
                  </td>
                </tr>
                <tr height="16"></tr>
                <tr>
                  <table border="0" cellpadding="0" cellspacing="0">
                    <tbody>
                      <tr>
                        <td valign="top">
                          <img width="42" style="display:block;" src="${htmlEncode(channel.icon)}">
                        </td>
                        <td width="16"></td>
                        <td valign="top">
                          <table border="0" cellpadding="0" cellspacing="0">
                            <tbody>
                              <tr>
                                <td>
                                  <a style="text-decoration:none;color:#212121;font-size:14px;font-family:Roboto,sans-serif" href="${htmlEncode(videoUrl)}" class="nonplayable">${htmlEncode(videoDoc.title)}</a>
                                </td>
                              </tr>
                              <tr>
                                <td>
                                  <a style="text-decoration:none;color:#757575;font-size:12px;font-family:Roboto,sans-serif" href="${htmlEncode(channelUrl)}">${htmlEncode(videoDoc.channelTitle)}</a>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </tr>
                <tr>
                  <td>
                    <hr style="display:block;height:1px;border:0;border-top:1px solid #eaeaea;margin:16px 0px;padding:0">
                  </td>
                </tr>
                <tr>
                  <td style="color:#757575;font-size:12px;font-family:Roboto,sans-serif">
                    You received this email because you chose to get upload notifications from YouTube Email Notifier. If you don't want these emails anymore, open the settings of the YouTube Email Notifier app.
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
          <td width="20"></td>
        </tr></tbody></table>
      </body>
    </html>
  `
  mailTransporter.sendMail({
    from: `YT Email Notifier <${fromEmail}>`,
    to: toEmail,
    subject: emailTitle,
    html: html,
  }, (err, info) => {
    if (err) {
      logger.error(`Mail (${videoDoc._id}) error sending:`, err)
      logger.info(`Mail (${videoDoc._id}) info:`, info)
    } else if (info.rejected) {
      logger.error(`Mail (${videoDoc._id}) seems to have been rejected`)
      logger.info(`Mail (${videoDoc._id}) info:`, info)
    } else {
      logger.info(`Mail (${videoDoc._id}) info:`, info)
      // logger.info('new doc', videoDoc)
      // db.insert(videoDoc)
    }
  })
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
      if (type === 'setup') {
        store.apiKey = data.apiKey
        store.fromEmail = data.fromEmail
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
