const winston = require('winston')

const paths = require('./paths')

module.exports = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: paths.logfileErr, level: 'error' }),
    new winston.transports.File({ filename: paths.logfile }),
  ],
})

if (process.env.APP_ENV === 'dev') {
  module.exports.add(new winston.transports.Console({
    format: winston.format.simple(),
  }))
}
