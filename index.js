import SysTrayModule from 'systray'
const SysTray = SysTrayModule.default
import http from 'http'
import getPort from 'get-port'
import fs from 'fs'
import open from 'open'

let server = null
let port = null
async function openServer() {
  port = await getPort({port: getPort.makeRange(3000, 3100)})
  console.log('Found available port', port)

  const newServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    fs.readFile('web/index.html', (err, data) => {
      if (err) {
        res.writeHead(404)
        res.write('Error: File Not Found')
      } else {
        res.write(data)
      }
      res.end()
    })
  })
  newServer.listen(port, err => {
    if (err) console.log('ERROR OPENING SERVER')
    else console.log('Server listening on port', port)
  })
  server = newServer
}
function closeServer() {
  if (server !== null) {
    server.close()
    port = null
  }
}




const items = []

items.push({
  title: "Settings",
  tooltip: null,
  checked: false,
  enabled: true,
  handler: async (systray) => {
    await openServer()
    await open('http://localhost:' + port)
  }
})
items.push({
  title: "Exit",
  tooltip: null,
  checked: false,
  enabled: true,
  handler: (systray) => {
    systray.kill()
    closeServer()
  }
})

const systray = new SysTray({
	menu: {
		// you should using .png icon in macOS/Linux, but .ico format in windows
		icon: "icon.png",
		title: "Y",
		tooltip: "Tips",
		items: items
	},
	debug: false,
	copyDir: true, // copy go tray binary to outside directory, useful for packing tool like pkg.
})

systray.onClick(action => {
  const index = action.seq_id
  const handler = items[index].handler
  if (handler) handler(systray)
	// if (action.seq_id === 0) {
	// 	systray.sendAction({
	// 		type: 'update-item',
	// 		item: {
	// 			...action.item,
	// 			checked: !action.item.checked,
	// 		},
	// 		seq_id: action.seq_id,
	// 	})
	// } else if (action.seq_id === 1) {
	// 	// open the url
	// 	console.log('open the url', action)
	// } else if (action.seq_id === 2) {
	// 	systray.kill()
	// }
})
