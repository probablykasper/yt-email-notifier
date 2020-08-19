const ws = new WebSocket('ws://localhost:9198')


ws.onopen = () => {

  console.log('WS open')

}

ws.onerror = (err) => {
  console.log(err)
}

let store
function storeUpdate() {
  ws.send(JSON.stringify({ type: 'storeUpdate', data: store }))
}

function render() {
  const source = document.getElementById('app-template').innerHTML
  const template = window.Handlebars.compile(source)
  const html = template(store)
  document.getElementById('app').innerHTML = html

  // document.getElementById('add-channels').addEventListener('click', () => {
    
  // })
}
function newEmail(input) {
  store.emails.push(input)
  storeUpdate()
}

ws.onmessage = (e) => {
  const { type, data } = JSON.parse(e.data)

  if (type === 'initStore') {
    console.log(data)
    store = data
    render(data)
  }

}

