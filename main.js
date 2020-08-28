const logger = require('./src/logger.js')

try {
  const menubar = require('./src/menubar.js')

  if (process.env.APP_ENV === 'dev') {
    process.env.DONT_SEND_MAIL = true
    menubar.init({
      openServerNow: true,
      openBrowserNow: false,
    })
  } else {
    menubar.init({
      openServerNow: false,
      openBrowserNow: false,
    })
  }

} catch(err) {
  logger.error(err)
}
