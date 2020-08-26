const fs = require('fs')
const path = require('path')
const os = require('os')

const paths = {}
module.exports = paths

if (process.env.APP_ENV === 'dev') {
  paths.appDataDir = path.join(__dirname, '../appfiles/Application Support folder')
  paths.settings = path.join(paths.appDataDir, 'settings.json')
  paths.logfile = path.join(paths.appDataDir, 'all.log')
  paths.logfileErr = path.join(paths.appDataDir, 'error.log')
} else {
  paths.homedir = os.homedir()
  paths.appDataDir = path.join(paths.homedir, 'Library/Application Support/YouTube Email Notifier')
  paths.settings = path.join(paths.appDataDir, 'settings.json')
  paths.logfile = path.join(paths.appDataDir, 'all.log')
  paths.logfileErr = path.join(paths.appDataDir, 'error.log')
  paths.appBinary = process.execPath
  paths.appBundle = path.join(paths.appBinary, '../../..')
}

if (!fs.existsSync(paths.appDataDir)) fs.mkdirSync(paths.appDataDir, { recursive: true })
