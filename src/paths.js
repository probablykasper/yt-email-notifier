const fs = require('fs')
const path = require('path')
const os = require('os')

const paths = {}
module.exports = paths

if (process.env.APP_ENV === 'dev') {
  paths.appDataDir = path.join(__dirname, '../appfiles')
} else {
  paths.homedir = os.homedir()
  paths.appDataDir = path.join(paths.homedir, 'Library/Application Support/YouTube Email Notifier')
  paths.appBinary = process.execPath
  paths.appBundle = path.join(paths.appBinary, '../../..')
}
paths.settings = path.join(paths.appDataDir, 'settings.json')
paths.db = path.join(paths.appDataDir, 'videos.db')
paths.logfile = path.join(paths.appDataDir, 'everything.log')
paths.logfileBad = path.join(paths.appDataDir, 'bad.log')

if (!fs.existsSync(paths.appDataDir)) fs.mkdirSync(paths.appDataDir, { recursive: true })
