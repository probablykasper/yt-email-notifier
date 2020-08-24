const SysTrayModule = require('systray')
const SysTray = SysTrayModule.default
const opener = require('opener')

const server = require('./server.js')

module.exports.init = async function(options = {}) {

  if (options.openServerNow) {
    await server.open()
    if (options.openBrowserNow) opener('http://localhost:9199')
  }

  const items = [
    {
      title: 'Settings',
      tooltip: null,
      checked: false,
      enabled: true,
      handler: async () => {
        await server.open()
        opener('http://localhost:9199')
      },
    },
    {
      title: 'Exit',
      tooltip: null,
      checked: false,
      enabled: true,
      handler: (systray) => {
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
    if (handler) handler(systray)
  })

}

