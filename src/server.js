const http = require('http')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const connect = require('connect')
const serveStatic = require('serve-static')
const WebSocket = require('ws')
const iso8601duration = require('iso8601-duration')
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
app.use(serveStatic(path.join(__dirname, '../web')))
app.use(serveStatic(paths.appDataDir))
app.use('/README.md', (req, res) => {
  const readmePath = path.join(__dirname, '../README.md')
  const readme = fs.readFileSync(readmePath)
  res.end(readme)
})
// serve logo for readme
app.use('/assets/logo.png', (req, res) => {
  const logoPath = path.join(__dirname, '../assets/logo.png')
  const logo = fs.readFileSync(logoPath)
  res.end(logo)
})
let server

let store
if (fs.existsSync(paths.settings)) {
  store = JSON.parse(fs.readFileSync(paths.settings, 'utf8'))
  // backwards compatibility for <=1.2.0
  if (!store.maxConcurrentRequests) store.maxConcurrentRequests = 5
} else {
  store = {
    apiKey: '',
    fromEmail: '',
    maxConcurrentRequests: 5,
    unreadErrors: false,
    instances: [],
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
  const res = await fetch(url, options).catch((e) => {
    throw { message: 'Network error '+e.code, error: e }
  })
  const json = await res.json()
  if (json.error) {
    json.error.message = `API error ${json.error.code}: ${json.error.message}`
    json.error.url = url
    throw json.error
  }
  return json
}

let intervals = []

function parseDuration(isoDur) {
  const dur = iso8601duration.parse(isoDur)
  let result = dur.seconds
  if (dur.seconds < 10) result = '0'+result
  result = dur.minutes+':'+result
  dur.hours += dur.days*24
  if (dur.hours > 0) {
    if (dur.minutes < 10) result = '0'+result
    result = dur.hours+':'+result
  }
  return result
}

const pLimit = require('p-limit')
let limit = pLimit(store.maxConcurrentRequests)
module.exports.restartIntervals = async function() {
  logger.info('Restarting intervals')
  limit.clearQueue()
  limit = pLimit(store.maxConcurrentRequests)
  for (let i = 0; i < intervals.length; i++) {
    clearInterval(intervals[i])
  }
  intervals = []

  for (let i = 0; i < store.instances.length; i++) {
    const instance = store.instances[i]
    const intervalTime = instance.minutesBetweenRefreshes*1000*60
    await refresh(instance, i)
    const interval = setInterval(refresh, intervalTime, instance, i)
    intervals.push(interval)
  }
}
module.exports.restartIntervals()

async function refresh(instance, instanceIndex) {
  logger.info('Refreshing instance index', instanceIndex)
  try {
    const channelCount = instance.channels.length
    const queries = []
    for (let i = 0; i < channelCount; i++) {
      const channel = instance.channels[i]
      const query = async () => {
        await new Promise(resolve => setTimeout(resolve, 1000))
        const uploads = await fetchYT({
          url: 'https://www.googleapis.com/youtube/v3/playlistItems',
          query: {
            part: 'snippet,contentDetails',
            playlistId: channel.uploadsPlaylistId,
            maxResults: 50,
          },
        })
        const videoItems = []
        let idList = ''
        for (let i = 0; i < uploads.items.length; i++) {
          const video = uploads.items[i]
          const id = video.snippet.resourceId.videoId
          if (idList !== '') idList += ','
          idList += id
        }
        if (idList !== '') {
          const videos = await fetchYT({
            url: 'https://www.googleapis.com/youtube/v3/videos',
            query: {
              part: 'contentDetails,liveStreamingDetails',
              id: idList.trimRight(','),
            },
          })
          for (const item of videos.items) {
            videoItems[item.id] = item
          }
        }
        logger.info(instance.email, channel.name)
        UploadsLoop:
        for (let i = uploads.items.length - 1; i >= 0; i--) {
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
          if (publishedAt.getTime() >= channel.fromTime) {
            const videoId = video.snippet.resourceId.videoId
            const lsDetails = videoItems[videoId].liveStreamingDetails
            if (lsDetails && lsDetails.scheduledStartTime) {
              if (new Date(lsDetails.scheduledStartTime) > new Date()) continue UploadsLoop
            }
            const videoDoc = await new Promise((resolve, reject) => {
              db.findOne({ _id: videoId }, (err, doc) => {
                if (err) reject(err)
                else resolve(doc)
              })
            })
            if (!videoDoc) {
              const isoDuration = videoItems[videoId].contentDetails.duration
              if (!isoDuration) {
                throw new Error(`isoDuration of video ${videoId} is ${isoDuration}`)
              }
              const doc = {
                _id: videoId,
                thumbnails: {
                  high: video.snippet.thumbnails.high.url,
                },
                title: video.snippet.title,
                channelTitle: video.snippet.channelTitle,
                publishedAt: publishedAt.getTime(),
                isoDuration: isoDuration,
              }
              if (video.snippet.thumbnails.standard) {
                doc.thumbnails.standard = video.snippet.thumbnails.standard.url
              }
              if (video.snippet.thumbnails.maxres) {
                doc.thumbnails.maxres = video.snippet.thumbnails.maxres.url
              }
              logger.info(`  ${doc._id} NEW VID`)
              if (process.env.DONT_SEND_MAIL) {
                logger.info(`  ${doc._id} Not sending mail due to env variable DONT_SEND_MAIL`)
              } else {
                await sendMail(store.fromEmail, instance.email, doc, channel)
              }
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

function generateRandomReference() {
  const randomId = [2, 2, 2, 6].reduce(
    // crux to generate UUID-like random strings
    (prev, len) => prev + '-' + crypto.randomBytes(len).toString('hex'),
    crypto.randomBytes(4).toString('hex'),
  )
  return '<'+randomId+'@random-id-to-prevent-threading.example.com>'
}

function sendMail(fromEmail, toEmail, videoDoc, channel) {
  const emailTitle = videoDoc.channelTitle+' just uploaded a video'
  let thumbnailUrl = videoDoc.thumbnails.high
  if (videoDoc.thumbnails.standard) thumbnailUrl = videoDoc.thumbnails.standard
  if (videoDoc.thumbnails.maxres) thumbnailUrl = videoDoc.thumbnails.maxres
  const videoUrl = 'https://youtube.com/watch?v='+videoDoc._id
  const channelUrl = 'https://www.youtube.com/channel/'+channel.id
  const durationText = parseDuration(videoDoc.isoDuration)
  const publishedAt = new Date(videoDoc.publishedAt)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const month = months[publishedAt.getMonth()]
  const date = month+' '+publishedAt.getDate()+', '+publishedAt.getFullYear()
  const html = `
    <html>
      <head>
        <title>${htmlEncode(emailTitle)}</title>
      </head>
      <body style="margin: 0; padding: 0;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%;max-width:636px"><tbody><tr>
          <td width="14"></td>
          <td>
            <table align="center" width="608" border="0" cellpadding="0" cellspacing="0" style="width:100%">
              <tbody>
                <tr>
                  <td>
                    <a style="text-decoration:none" href="${htmlEncode(videoUrl)}" class="nonplayable">
                      <table class="imgtable" width="608" style="background-repeat:no-repeat;background-size:cover;background-position:center;width:100%" background="${htmlEncode(thumbnailUrl)}" border="0" cellpadding="0" cellspacing="0">
                        <tbody>
                          <tr>
                            <td style="padding-bottom:53%;padding-bottom:calc(56.25% - 24px - 8px)"></td>
                          </tr>
                          <tr>
                            <td height="24" style="text-align:right" valign="bottom">
                              <span style="color:#ffffff;font-size:12px;font-family:Roboto,sans-serif;background-color:#212121;border-radius: 2px;padding:2px 4px;display:inline-block">${htmlEncode(durationText)}</span>
                            </td>
                            <td width="8"></td>
                          </tr>
                          <tr>
                            <td height="8"></td>
                          </tr>
                        </tbody>
                      </table>
                    </a>
                  </td>
                </tr>
                <tr height="16"></tr>
                <tr>
                  <td><table border="0" cellpadding="0" cellspacing="0">
                    <tbody>
                      <tr>
                        <td valign="top">
                          <a style="text-decoration:none" href="${htmlEncode(videoUrl)}" class="nonplayable">
                            <img width="42" style="display:block;" src="${htmlEncode(channel.icon)}">
                          </a>
                        </td>
                        <td width="16"></td>
                        <td valign="top">
                          <table border="0" cellpadding="0" cellspacing="0">
                            <tbody>
                              <tr>
                                <td>
                                  <a style="text-decoration:none;color:#212121;font-size:14px;font-family:Roboto,sans-serif;display: block" href="${htmlEncode(videoUrl)}" class="nonplayable">${htmlEncode(videoDoc.title)}</a>
                                </td>
                              </tr>
                              <tr>
                                <td style="text-decoration:none;color:#757575;font-size:12px;font-family:Roboto,sans-serif">
                                  <a style="text-decoration:none;color:#757575;font-size:12px;font-family:Roboto,sans-serif" href="${htmlEncode(channelUrl)}">${htmlEncode(videoDoc.channelTitle)}</a> • ${htmlEncode(date)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table></td>
                </tr>
                <tr>
                  <td>
                    <hr style="display:block;height:1px;border:0;border-top:1px solid #eaeaea;margin:16px 0px;padding:0">
                  </td>
                </tr>
                <tr>
                  <td style="color:#757575;font-size:12px;font-family:Roboto,sans-serif">You received this email because you chose to get upload notifications from <a style="text-decoration:none;font-size:12px;font-family:Roboto,sans-serif" href="https://github.com/probablykasper/yt-email-notifier">YouTube Email Notifier</a>. If you don't want these emails anymore, open the settings in the app.</td>
                </tr>
              </tbody>
            </table>
          </td>
          <td width="14"></td>
        </tr></tbody></table>
      </body>
    </html>
  `
  return new Promise((resolve, reject) => {
    mailTransporter.sendMail({
      from: `YT Email Notifier <${fromEmail}>`,
      to: toEmail,
      subject: emailTitle,
      html: html,
      headers: {
        References: generateRandomReference(), // prevent email threading
      },
    }, (err, info) => {
      if (err) {
        logger.error(`  ${videoDoc._id} Mail error sending:`, err)
        logger.info(`  ${videoDoc._id} Mail info:`, info)
        reject()
      } else if (info.rejected) {
        logger.error(`  ${videoDoc._id} Mail seems to have been rejected`)
        logger.info(`  ${videoDoc._id} Mail info:`, info)
        reject()
      } else {
        logger.info(`  ${videoDoc._id} Mail info:`, info)
        logger.info(`  ${videoDoc._id} Saving to db`)
        db.insert(videoDoc)
        resolve()
      }
    })
  })
}

const wss = new WebSocket.Server({ noServer: true })
let connection = null
let serverCloseTimeout = null

// show unread errors dot when new errors happen
logger.eventEmitter.removeAllListeners()
logger.eventEmitter.on('new-error', () => {
  if (store.unreadErrors === false) {
    store.unreadErrors = true
    fs.writeFileSync(paths.settings, JSON.stringify(store, null, '  '))
    if (connection) {
      connection.send(JSON.stringify({ type: 'newStore', data: store }))
    }
  }
})

wss.on('connection', async (ws) => {
  function send(type, data) {
    ws.send(JSON.stringify({ type, data }))
  }
  function storeUpdate() {
    fs.writeFileSync(paths.settings, JSON.stringify(store, null, '  '))
    send('newStore', store)
  }

  if (connection) connection.close(1000, 'old connection')
  connection = ws
  if (serverCloseTimeout) clearTimeout(serverCloseTimeout)
  logger.info('WS Open')
  send('newStore', store)

  ws.on('close', (code, reason) => {
    if (reason === 'old connection') {
      logger.info('WS Close old connection')
    } else {
      logger.info('WS Close')
      connection = null
      serverCloseTimeout = setTimeout(() => {
        module.exports.close()
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
        if (store.maxConcurrentRequests !== data.maxConcurrentRequests) {
          store.maxConcurrentRequests = data.maxConcurrentRequests
          module.exports.restartIntervals()
        }
        storeUpdate()

      } else if (type === 'newEmail') {
        store.instances.push({
          email: data.email,
          minutesBetweenRefreshes: data.minutesBetweenRefreshes,
          channels: [],
        })
        module.exports.restartIntervals()
        storeUpdate()

      } else if (type === 'editEmail') {
        const instance = store.instances[data.instanceIndex]
        instance.email = data.email
        if (instance.minutesBetweenRefreshes !== data.minutesBetweenRefreshes) {
          instance.minutesBetweenRefreshes = data.minutesBetweenRefreshes
          module.exports.restartIntervals()
        }
        storeUpdate()

      } else if (type === 'deleteEmail') {
        store.instances.splice(data.instanceIndex, 1)
        module.exports.restartIntervals()
        storeUpdate()

      } else if (type === 'addChannel') {
        const parseVideoId = function(url) {
          if (url.includes('youtube.com/watch') && url.includes('?v=')) {
            return url.split('?v=')[1].substring(0, 11)
          } else if (url.includes('youtube.com/watch') && url.includes('&v=')) {
            return url.split('&v=')[1].substring(0, 11)
          } else if (url.includes('youtu.be/')) {
            return url.split('youtu.be/')[1].substring(0, 11)
          }
        }
        const getChannelIdFromVideoId = async function(videoId) {
          const result = await fetchYT({
            url: 'https://youtube.googleapis.com/youtube/v3/videos',
            query: { part: 'snippet', id: videoId },
          })
          if (!result.items || !result.items[0]) {
            throw new Error(`No channel found for video ID '${videoId}':`, JSON.stringify(result))
          }
          return result.items[0].snippet.channelId
        }
        let providedUrl = data.channel
        const videoId = parseVideoId(providedUrl)
        let channelId, username
        if (videoId) {
          channelId = await getChannelIdFromVideoId(videoId)
        } else {
          const segments = providedUrl.split('/')
          const channelIdSegment = segments.indexOf('channel') + 1
          const usernameSegment = segments.indexOf('user') + 1
            || segments.indexOf('www.youtube.com') + 1
            || segments.indexOf('youtube.com') + 1
          if (channelIdSegment > 0) {
            channelId = segments[channelIdSegment]
          } else if (usernameSegment >= 0) {
            username = segments[usernameSegment]
          } else {
            throw new Error(`URL '${providedUrl}' not recognized.`)
          }
        }
        const query = { part: 'contentDetails,id,snippet' }
        if (channelId) query.id = channelId
        else query.forUsername = username
        const result = await fetchYT({
          url: 'https://www.googleapis.com/youtube/v3/channels',
          query: query,
        })
        if (!result.items) throw new Error(`Channel not found for url '${providedUrl}'.\nYou could try a video URL`)
        const channelObject = result.items[0]
        store.instances[data.instance].channels.push({
          id: channelObject.id,
          name: channelObject.snippet.title,
          icon: channelObject.snippet.thumbnails.medium.url,
          uploadsPlaylistId: channelObject.contentDetails.relatedPlaylists.uploads,
          fromTime: data.fromTime,
        })
        storeUpdate()
      }
      else if (type === 'removeChannel') {
        const index = data.index
        const instance = store.instances[data.instance]
        instance.channels.splice(index, 1)
        storeUpdate()
      
      } else if (type === 'readErrors') {
        store.unreadErrors = false
        storeUpdate()
      }

    } catch(err) {
      logger.error(err)
      send('error', err instanceof Error ? err.toString() : err)
    }
  })

})


let isOpen = false

module.exports.open = async (port) => {
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
