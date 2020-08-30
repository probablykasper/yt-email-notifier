const log4js = require('log4js')
const EventEmitter = require('events')
const paths = require('./paths.js')

const kb = 1024
const mb = 1024*kb
const config = {
  appenders: {
    everything: {
      type: 'file',
      filename: paths.logfile,
      maxLogSize: 2*mb,
      keepFileExt: true,
      layout: { type: 'pattern', pattern: '%d{yyyy-MM-dd hh:mm:ss} %p %m' },
    },
    console: {
      type: 'stdout',
      layout: { type: 'pattern', pattern: '%[%d{yyyy-MM-dd hh:mm:ss} %p%] %m' },
    },
    bad: {
      type: 'file',
      filename: paths.logfileBad,
      maxLogSize: 2*mb,
      keepFileExt: true,
      layout: { type: 'pattern', pattern: '%d{yyyy-MM-dd hh:mm:ss} %p %m' },
    },
    badFilter: { type: 'logLevelFilter', appender: 'bad', level: 'warn' },
  },
  categories: {
    default: { appenders: ['badFilter', 'everything'], level: 'debug' },
  },
}
if (process.env.APP_ENV === 'dev') {
  config.categories.default.appenders.push('console')
}
log4js.configure(config)

const logger = log4js.getLogger()

module.exports.eventEmitter = new EventEmitter()

module.exports.error = (...args) => {
  module.exports.eventEmitter.emit('new-error')
  logger.error(...args)
}
module.exports.info = (...args) => {
  logger.info(...args)
}
module.exports.warn = (...args) => {
  logger.warn(...args)
}
