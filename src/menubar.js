const SysTrayModule = require('systray')
const SysTray = SysTrayModule.default
const opener = require('opener')
const AutoLaunch = require('auto-launch')
const server = require('./server.js')
const paths = require('./paths.js')
const logger = require('./logger.js')

module.exports.init = async function(options = {}) {

  if (options.openServerNow) {
    await server.open(options.port)
    if (options.openBrowserNow) opener('http://localhost:'+options.port)
  }

  const autoLauncher = process.env.APP_ENV === 'dev'
    ? null
    : new AutoLaunch({
      name: 'YouTube Email Notifier',
      path: paths.appBundle,
    })

  const items = [
    {
      title: 'Check Now',
      tooltip: null,
      checked: false,
      enabled: true,
      handler: async () => {
        await server.restartIntervals()
      },
    },
    {
      title: 'Settings',
      tooltip: null,
      checked: false,
      enabled: true,
      handler: async () => {
        await server.open(options.port)
        opener('http://localhost:'+options.port)
      },
    },
    {
      title: 'Launch on Startup',
      tooltip: null,
      checked: autoLauncher ? await autoLauncher.isEnabled() : false,
      enabled: autoLauncher ? true : false,
      handler: async (action) => {
        if (process.APP_ENV !== 'dev') {
          logger.info('appbundle: '+paths.appBundle)
          if (!action.item.checked) {
            logger.info('launch on startup: enabling')
            action.item.checked = true
            if (autoLauncher) await autoLauncher.enable()
            systray.sendAction({
              type: 'update-item',
              item: action.item,
              seq_id: action.seq_id,
            })
          } else {
            logger.info('launch on startup: disabling')
            action.item.checked = false
            if (autoLauncher) await autoLauncher.disable()
            systray.sendAction({
              type: 'update-item',
              item: action.item,
              seq_id: action.seq_id,
            })
          }
        }
      },
    },
    {
      title: 'Exit',
      tooltip: null,
      checked: false,
      enabled: true,
      handler: (action, systray) => {
        systray.kill()
      },
    },
  ]

  const systray = new SysTray({
    menu: {
      // you should using .png icon in macOS/Linux, but .ico format in windows
      icon: 'icon.png',
      title: 'ϟϟ',
      items: items,
    },
    debug: false,
    copyDir: true, // copy go tray binary to outside directory, useful for packing tool like pkg.
  })

  systray.onClick(action => {
    const index = action.seq_id
    const handler = items[index].handler
    if (handler) handler(action, systray)
  })

}

