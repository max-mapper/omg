var stream = require('stream')
var events = require('events')
var util = require('util')
var app = new events.EventEmitter

function render( template, target, data ) {
  if (! (target instanceof jQuery)) target = $( "." + target + ":first" );
  target.html( $.mustache( $( "." + template + "Template:first" ).html(), data || {} ) );
}

function getProfile(cb) {
  request('/me', function(err, resp, data) {
    if (err) return cb(err)
    return cb(false, JSON.parse(data))
  })
}

function getFeed(cb) {
  request('/feed', function(err, resp, data) {
    if (err) return cb(err)
    return cb(false, JSON.parse(data))
  })
}


$(function() {
  getProfile(function(err, profile) {
    if (err || profile.error) profile = false
    app.profile = profile
    render('nav', '#navigation', profile)
    if (!profile) return
    render('profile', '#wrapper', profile)
    getFeed(function(err, feed) {
      console.log(feed)
    })
  })
})
