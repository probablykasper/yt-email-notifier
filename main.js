const logger = require('./src/logger.js')

try {
  const menubar = require('./src/menubar.js')

  if (process.env.APP_ENV === 'dev') {
    process.env.DONT_SEND_MAIL = true
    menubar.init({
      openServerNow: true,
      openBrowserNow: false,
      port: 9299,
    })
  } else {
    menubar.init({
      openServerNow: false,
      openBrowserNow: false,
      port: 9199,
    })
  }

} catch(err) {
  logger.error(err)
}
