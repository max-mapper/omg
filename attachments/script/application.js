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
    getFeed(function(err, feed) {
		var items = _.map(feed.data, function(item) {
			return {
				image: item.images.thumbnail.url
			} 
		})
	    render('feed', '#wrapper', {items: items})
		var box = $('.box')
	    var veiled = function(e) {
	      var veil = $('.veil')
	      $(e.target).toggleClass("veil")

	    }
	    box.click(veiled)

	    var select = $('#select')
	    var selection = function(e) {
	      console.log($(".veil"))
	    }
	    select.click(selection)
	
    })
  })

    



})
