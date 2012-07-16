var path = require('path')
var tako = require('tako')
var filed = require('filed')
var gist = require('gist')
var request = require('request').defaults({json: true})
var qs = require('querystring')
var plumbdb = require('plumbdb')
var https = require('https')
var _ = require('underscore')

var htmldir = path.resolve(__dirname, 'attachments')

var t = tako()

var options = {
  clientID: process.env['OMG_KEY'],
  clientSecret: process.env['OMG_SECRET'],
  callbackURL: process.env['OMG_VHOST'] + '/instagramcallback'
}
console.log(options)

t.route('/', function (req, resp) {
  filed(path.join(htmldir, 'index.html')).pipe(resp)
})

t.route('/me', function (req, resp) {
  resp.setHeader('content-type', 'application/json')
  resp.end(JSON.stringify(req.user))
}).must('auth')

t.route('/feed', function (req, resp) {
  url = 'https://api.instagram.com/v1/users/self/media/recent?' + qs.stringify({access_token: req.user.token})
  if (req.qs && req.qs.next_url) url = req.qs.next_url
  request(url, function(err, res, json) {
    json.data = _.filter(json.data, function(item) { return item.location && item.location.latitude })
    resp.setHeader('content-type', 'application/json')
    resp.end(JSON.stringify(json))
  })
}).must('auth')

t.route('/logout', function (req, resp) {
  setCookie('', resp)
  resp.statusCode = 302
  resp.setHeader('location', process.env['OMG_VHOST'])
  resp.end()
})

t.route('/list-:dataset', function (req, resp) {
  getItems(req.params.dataset, function(err, items) {
    resp.setHeader('content-type', 'application/json')
    resp.end(JSON.stringify({items: items}))
  })
})

t.route('/add-:dataset', function (req, resp) {
  req.on('json', function(json) {
    resp.setHeader('content-type', 'application/json')
    t.db.put(req.params.dataset + ':' + json.id, JSON.stringify(json), function(err) {
      resp.end('{"ok": true}')
    })
    
  })
}).must('auth').methods('PUT', 'POST')
  
t.route('/instagram', function (req, resp) {
  var u = 'https://api.instagram.com/oauth/authorize'
      + '?client_id=' + options.clientID
      + '&redirect_uri=' + options.callbackURL
      + '&response_type=code'
      + '&scope=basic'
  resp.statusCode = 302
  resp.setHeader('location', u)
  resp.end()
})

t.route('/instagramcallback', function (req, resp) {
  var reqBody = { 
    client_id: options.clientID,
    client_secret: options.clientSecret,
    redirect_uri: options.callbackURL,
    grant_type: "authorization_code",
    code: req.qs.code
  }
  request.post({
      uri: 'https://api.instagram.com/oauth/access_token',
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "accept": "application/json"
      },
      body: qs.encode(reqBody)
    }, 
    function (e, r, data) {
      resp.statusCode = 200
      if (e || data.error) return resp.end(JSON.stringify(data))
      var token = data.access_token
      data.user.token = data.access_token
      setCookie(token, resp)
      saveUser(data, resp)
    }
  )
})

t.route('/*').files(htmldir)

t.auth(function(req, resp, cb) {
  var token = extractToken(req)
  if (!token) return cb(null)
  t.db.get(token, function(err, doc) {
    if (err || !doc) return cb(null)
    cb(JSON.parse(doc))
  })
})

function saveUser(data, resp) {
  t.db.put(data.access_token, JSON.stringify(data.user), function(err) {
    if (err) {
      resp.statusCode = 500
      return resp.end('error saving user')
    }
    resp.statusCode = 302
    resp.setHeader('location', process.env['OMG_VHOST'])
    resp.end()
  })
}

function getItems(dataset, cb) {
  var items = []
  var error = false
  t.plumb.keyStream(dataset)
    .on('data', function(doc) { items.push(doc) })
    .on('error', function(err) {
      error = true
      cb(err)
    })
    .on('end', function() {
      if (!error) cb(false, items)
    })
}

function setCookie(id, resp) {
  var twoWeeks = new Date(new Date().getTime()+1209726000).toUTCString()
  resp.setHeader('set-cookie', ['Token='+id + '; Version=1; Path=/; HttpOnly; Expires=' + twoWeeks])
  resp.setHeader('x-token', id)
}

function extractToken(req) {
  if (req.headers.cookie) {
    var cookies = parseCookies(req.headers.cookie)
    if (cookies['Token']) return cookies['Token']
  }
  if (req.headers['x-token']) return req.headers['x-token']
  if (req.qs && req.qs.token) return req.qs.token
  return false
}

function parseCookies(cookie) {
  var cookies = {}
  cookie.split(';').forEach(function( cookie ) {
    var parts = cookie.split('=')
    cookies[ parts[ 0 ].trim() ] = ( parts[ 1 ] || '' ).trim()
  })
  return cookies
}

t.plumb = plumbdb('data', function(err, db) {
  t.db = db
  var port = 80
  t.httpServer.listen(port, function () {
    console.log('dun runnin on', port)
  })
})