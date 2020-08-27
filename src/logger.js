const log4js = require('log4js')

const config = {
  appenders: {
    everything: {
      type: 'file',
      filename: 'appfiles/everything.log',
      layout: { type: 'pattern', pattern: '%d{yyyy-MM-dd hh:mm:ss} %p %m' },
    },
    console: {
      type: 'stdout',
      layout: { type: 'pattern', pattern: '%[%d{yyyy-MM-dd hh:mm:ss} %p%] %m' },
    },
    bad: {
      type: 'file',
      filename: 'appfiles/bad.log',
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
