const http = require('http')
const getPort = require('get-port')
const fs = require('fs')
const path = require('path')

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' })
  try {
    const file = path.resolve(__dirname, './web/index.html')
    var data = fs.readFileSync(file)
  } catch(err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404)
      res.write('Error: File Not Found')
    } else {
      res.writeHead(500)
      res.write('Internal Server Error')
    }
  }
  res.write(data)
  res.end()
})

function isOpen() {
  return server.listening
}
module.exports.isOpen = isOpen
let port

module.exports.open = async () => {
  if (isOpen()) return port
  port = await getPort({port: 9199})
  console.log('Found available port', port)

  server.listen(port, err => {
    if (err) return console.log('ERROR OPENING SERVER')
    console.log('Server listening on port', port)
    module.exports.isOpen = false
  })
  return port
}

module.exports.close = async () => {
  server.close()
  module.exports.isOpen = false
}
