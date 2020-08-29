const log4js = require('log4js')
const paths = require('./paths')

const kb = 1024
const mb = 1024*kb
const config = {
  appenders: {
    everything: {
      type: 'file',
      filename: paths.logfile,
      maxLogSize: 2*mb,
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

module.exports = logger
