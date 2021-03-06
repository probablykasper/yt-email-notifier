const $ = window.$

const ws = new WebSocket('ws://localhost:'+location.port+'/ws')

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

$(document).ready(() => {
  const converter = new window.showdown.Converter()
  fetch('/README.md', {
    type: 'GET',
  })
    .then(response => response.text())
    .then((markdown) => {
      const html = converter.makeHtml(markdown)
      $('#help-modal-content').html(html)
    }).catch(() => {
      console.log('err')
    })

})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const tag = e.target.nodeName
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      $(':focus').blur()
    } else {
      $('.modal.is-active').removeClass('is-active')
    }
  }
})

let doneFunc

function render(data) {
  const source = document.getElementById('app-template').innerHTML
  window.Handlebars.registerHelper('showDate', function(timeNumber) {
    return new Date(timeNumber).toLocaleString()
  })
  const template = window.Handlebars.compile(source)
  const html = template(data)
  document.getElementById('app').innerHTML = html

  const maxConcMin = $('#max-concurrent-requests-input').attr('min')
  const maxConcMax = $('#max-concurrent-requests-input').attr('max')
  function validateMaxConcReq(value) {
    if (!Number.isInteger(Number(value))) return false
    else if (value < Number(maxConcMin)) return false
    else if (value > Number(maxConcMax)) return false
    else return true
  }
  $('#max-concurrent-requests-input').keypress((e) => {
    const charCode = (e.which) ? e.which : e.keyCode
    // allow only numbers and special keys
    if (charCode > 31 && (charCode < 48 || charCode > 57)) return false
    // if number was pressed, validate new value
    if (charCode >= 48 || charCode <= 57) {
      const newValue = Number(e.target.value + e.key)
      if (!validateMaxConcReq(newValue)) return false
    }
    return true
  })
  $('#setup-form').submit((e) => {
    e.preventDefault()
    const maxConcurrentRequests = Number($('#max-concurrent-requests-input').val())
    if (!validateMaxConcReq(maxConcurrentRequests)) {
      return alert(`Max concurrent requests must be an integer from ${maxConcMin} to ${maxConcMax}`)
    }
    window.a('setup', {
      apiKey: $('#api-key-input').val(),
      fromEmail: $('#from-email-input').val(),
      maxConcurrentRequests: maxConcurrentRequests,
    })
    return false
  })

  $('#new-email-form').submit((e) => {
    e.preventDefault()
    window.a('newEmail', {
      email: $('#new-email-input').val(),
      minutesBetweenRefreshes: $('#new-email-minutes-input').val() || 60,
    })
    $('#new-email-modal').removeClass('is-active')
    return false
  })

  let editInstanceIndex
  $('.edit-email-button').click((e) => {
    const instanceIndex = Number(e.target.dataset.instance)
    editInstanceIndex = instanceIndex
    const instance = data.instances[instanceIndex]
    $('#edit-email-input').val(instance.email)
    $('#edit-email-minutes-input').val(instance.minutesBetweenRefreshes)
    $('#edit-email-modal').addClass('is-active')
  })
  $('#edit-email-form').submit((e) => {
    e.preventDefault()
    if (typeof editInstanceIndex === 'number') {
      window.a('editEmail', {
        instanceIndex: editInstanceIndex,
        email: $('#edit-email-input').val(),
        minutesBetweenRefreshes: $('#edit-email-minutes-input').val() || 60,
      })
    }
    $('#edit-email-modal').removeClass('is-active')
    return false
  })

  let deleteInstanceIndex
  $('.delete-email-button').click((e) => {
    const instanceIndex = Number(e.target.dataset.instance)
    deleteInstanceIndex = instanceIndex
    const instance = data.instances[instanceIndex]
    $('#delete-email-email').text(instance.email)
    $('#delete-email-channels-count').text(instance.channels.length)
    $('#delete-email-modal').addClass('is-active')
  })
  $('#delete-email-form').submit((e) => {
    e.preventDefault()
    if (typeof deleteInstanceIndex === 'number') {
      window.a('deleteEmail', {
        instanceIndex: deleteInstanceIndex,
      })
      console.log('AHYEP', deleteInstanceIndex)
    }
    $('#delete-email-modal').removeClass('is-active')
    return false
  })

  const datetime = $('#add-channel-datetime')
  datetime.val(new Date().toLocaleString())
  $('#add-channel-form').submit((e) => {
    e.preventDefault()
    $('#add-channel-modal button[type="submit"]').addClass('is-loading')
    const time = Date.parse(datetime.val())
    if (!time) {
      $('#add-channel-modal button[type="submit"]').removeClass('is-loading')
      return alert('Invalid date/time')
    }
    window.a('addChannel', {
      instance: $('#add-channel-select-instance select').val(),
      channel: $('#add-cannel-input').val(),
      fromTime: time,
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
    if (typeof data === 'object') {
      $('#error-modal pre').text(JSON.stringify(data, null, '  '))
    } else {
      $('#error-modal pre').text(data)
    }
    $('#error-modal').addClass('is-active')
  }

}

