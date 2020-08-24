const $ = window.$

const ws = new WebSocket('ws://localhost:9198')

ws.onopen = () => {
  console.log('WS open')
}

ws.onerror = (err) => {
  $('#offline-modal').addClass('is-active')
}
ws.onclose = () => {
  $('#offline-modal').addClass('is-active')
}

function render(store) {
  const source = document.getElementById('app-template').innerHTML
  const template = window.Handlebars.compile(source)
  const html = template(store)
  document.getElementById('app').innerHTML = html

  const datetime = $('#new-email-datetime')
  datetime.val(new Date().toLocaleString())
  $('#new-email-form').submit((e) => {
    e.preventDefault()
    const time = Date.parse(datetime.val())
    if (!time) return alert('Invalid date/time')
    window.a('newEmail', {
      email: $('#new-email-input').val(),
      timeLastSynced: time,
    })
    $('#new-email-modal').removeClass('is-active')
    return false
  })
}

window.a = function(type, data) {
  const msg = {
    type: type, data: data,
  }
  ws.send(JSON.stringify(msg))
}

ws.onmessage = (e) => {
  const { type, data } = JSON.parse(e.data)

  if (type === 'newStore') {
    console.log(data)
    render(data)
  }

}

