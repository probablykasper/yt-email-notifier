const logger = require('./src/logger.js')

try {
  const menubar = require('./src/menubar.js')

  menubar.init({
    openServerNow: true,
    openBrowserNow: false,
  })
} catch(err) {
  logger.error(err)
}
