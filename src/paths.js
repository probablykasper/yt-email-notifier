const fs = require('fs')
const path = require('path')

const paths = {}
module.exports = paths

if (process.env.APP_ENV === 'dev') {
  paths.dataDir = path.join(__dirname, '../appfiles/space.kasper.youtube-email-notifier')
  paths.settings = path.join(__dirname, '../appfiles/space.kasper.youtube-email-notifier/settings.json')
} else {
  paths.dataDir = '~/Library/Application Support/space.kasper.youtube-email-notifier'
  paths.settings = path.resolve(paths.dataDir, 'settings.json')
}

if (!fs.existsSync(paths.dataDir)) fs.mkdirSync(paths.dataDir, { recursive: true })
