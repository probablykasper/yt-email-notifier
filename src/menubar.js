const SysTrayModule = require('systray')
const SysTray = SysTrayModule.default
const openurl = require('openurl')

const server = require('./server.js')

module.exports.init = async function(openSettingsNow) {

  if (openSettingsNow === true) {
    const port = await server.open()
    openurl.open('http://localhost:'+port)
  }

  const items = [
    {
      title: 'Settings',
      tooltip: null,
      checked: false,
      enabled: true,
      handler: async () => {
        const port = await server.open()
        openurl.open('http://localhost:'+port)
      },
    },
    {
      title: 'Exit',
      tooltip: null,
      checked: false,
      enabled: true,
      handler: (systray) => {
        systray.kill()
        // closeServer()
      },
    },
  ]

  const systray = new SysTray({
    menu: {
      // you should using .png icon in macOS/Linux, but .ico format in windows
      icon: 'icon.png',
      title: 'ϟϟ',
      items: items
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

