// connect YouTube Account
document.querySelector('.connect-yt-account').addEventListener('click', () => {
  const url = 'https://accounts.google.com/o/oauth2/v2/auth'
  +'?scope='+encodeURIComponent('https://www.googleapis.com/auth/youtube.readonly')
  +'&client_id='+encodeURIComponent('360374944795-g9e4g54m6chuvees28r3s10bqgg24cnk.apps.googleusercontent.com')
  +'&redirect_uri='+encodeURI('http://localhost:9199')
  +'&response_type=token'
  +'&prompt=consent'
  +'&state='+new Date().getTime()

  location = url
})

const ws = new WebSocket('ws://localhost:9198')

ws.onopen = () => {

  console.log('WS open')

  if (location.hash !== '') {
    const hash = location.hash.substr(1)
    const pairs = hash.split('&')
    const hashObj = {}
    for (const pair of pairs) {
      const key = pair.split('=')[0]
      const value = pair.split('=')[1]
      hashObj[key] = value
    }
    ws.send(JSON.stringify({
      type: 'hash',
      data: hashObj,
    }))
  }

}

ws.onerror = (err) => {
  console.log(err)
}

ws.onmessage = (e) => {
  console.log('MSG:')
  console.log(e) //e.data
}
