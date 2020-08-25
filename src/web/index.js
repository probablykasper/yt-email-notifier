const $ = window.$

const ws = new WebSocket('ws://localhost:9199/ws')

ws.onopen = () => {
  console.log('WS open')
}

ws.onerror = (err) => {
  console.log('ws ERR:')
  console.log(err)
  $('#offline-modal').addClass('is-active')
}
ws.onclose = () => {
  console.log('ws Close')
  $('#offline-modal').addClass('is-active')
}

let doneFunc

function render(data) {
  const source = document.getElementById('app-template').innerHTML
  const template = window.Handlebars.compile(source)
  const html = template(data)
  document.getElementById('app').innerHTML = html

  $('#api-key-form').submit((e) => {
    e.preventDefault()
    window.a('setApiKey', {
      key: $('#api-key-input').val(),
    })
    return false
  })

  const datetime = $('#new-email-datetime')
  datetime.val(new Date().toLocaleString())
  $('#new-email-form').submit((e) => {
    e.preventDefault()
    const time = Date.parse(datetime.val())
    if (!time) return alert('Invalid date/time')
    window.a('newEmail', {
      email: $('#new-email-input').val(),
      lastSyncedAt: time,
    })
    $('#new-email-modal').removeClass('is-active')
    return false
  })

  $('#add-channel-form').submit((e) => {
    e.preventDefault()
    $('#add-channel-modal button[type="submit"]').addClass('is-loading')
    window.a('addChannel', {
      instance: $('#add-channel-select-instance select').val(),
      channel: $('#add-cannel-input').val(),
    })
    doneFunc = () => {
      $('#add-channel-modal button[type="submit"]').removeClass('is-loading')
      $('#add-channel-modal').removeClass('is-active')
    }
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
    if (doneFunc) doneFunc()
    console.log(data)
    render(data)
  } else if (type === 'error') {
    if (doneFunc) doneFunc()
    console.log('error from server:', data)
    $('#error-modal pre').text(JSON.stringify(data, null, '  '))
    $('#error-modal').addClass('is-active')
  }

}

