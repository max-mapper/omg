var stream = require('stream')
var events = require('events')
var util = require('util')
var app = new events.EventEmitter
app.gramCache = []

function render( template, data ) {
  return $.mustache( $( "." + template + "Template:first" ).html(), data || {} )
}

function getProfile(cb) {
  request('/me', function(err, resp, data) {
    if (err) return cb(err)
    return cb(false, JSON.parse(data))
  })
}

function getFeed(next, cb) {
  var url = '/feed'
  if (cb) url += '?next_url=' + encodeURIComponent(next)
  else var cb = next
  request(url, function(err, resp, data) {
    if (err) return cb(err)
    data = JSON.parse(data)
    app.gramCache = app.gramCache.concat(data.data)
    return cb(false, data)
  })
}

function renderFeed(err, feed) {
  app.next_url = feed.pagination.next_url
  _.each(feed.data, function(item) {
    item.image = item.images.thumbnail.url
  })
  // todo this code sucks
  if ($('#wrapper .images').length === 0) $('#wrapper').append(render('feedContainer'))
  var imgs = $('#wrapper .images')
  imgs.append(render('feed', {items: feed.data}))
}

function addPhotoToDataset(id) {
  var dataset = $('.selected').attr('data-set')
  var doc = _.find(app.gramCache, function(item) { return item.id+"" === id+"" })
  console.log(dataset, id, doc)
  request({url:'/add-' + dataset, method: 'POST', json: doc}, function(err, resp, json) {
    console.log(err, json)
  })
}

function setupClicks() {
  var box = $('.box')
  var veiled = function(e) {
    var id = $(e.currentTarget).attr('data-id')
    addPhotoToDataset(id)
    $(e.currentTarget).find('.veilbox').toggleClass("veil")
  }
  box.live('click', veiled)

  var select = $('#select')
  var selection = function(e) {
    e.preventDefault()
    getFeed(app.next_url, renderFeed)
  }
  select.live('click', selection)
}

function locateAndSetMap(callback) {
  app.map.locate()
  app.map.on('locationfound', function(data) {
    app.map.setView(data.latlng, 13)
    if (callback) callback()
  })
}

function showMap(container) {
  app.map = new L.Map(container || 'mapbox', {zoom: 12, attributionControl: false, zoomControl: false})
  // var tiles ="http://tile.stamen.com/terrain/{z}/{x}/{y}.jpg"
  var tiles ="http://a.tiles.mapbox.com/v3/mapbox.mapbox-streets/{z}/{x}/{y}.png"
  var layer = new L.TileLayer(tiles, {maxZoom: 17, minZoom: 8, detectRetina: true})
  app.map.addLayer(layer)
}

function addMarkerToMap(photo) {
  var markerLocation = new L.LatLng(photo.location.latitude, photo.location.longitude)
  var marker = new L.Marker(markerLocation)
  app.map.addLayer(marker)
  var meta = {
    venue: photo.location.name,
    thumbnail: photo.images.thumbnail.url
  }
  marker.bindPopup(render('mapMarker', meta), {closeButton: false, offset: new L.Point(0, -40)})
}

function showPhotosOnMap(photos) {
  _.each(photos, function(photo) {
    addMarkerToMap(photo)
  })
}

function bootstrap() {
  getProfile(function(err, profile) {
    if (err || profile.error) profile = false
    app.profile = profile
    $('#navigation').html(render('nav', profile))
    if (!profile) return
    setupClicks()
  })
}


$(function() {
  var routes = {
    feed: function() {
      $('#wrapper').html('')
      getFeed(renderFeed)
      $('#wrapper').append(render('listPicker'))
      $('#lists').html(render('recentLists', {action: '/edit', title: "Select a list to add photos to"}))
      $('.listGroup').click(function(e) {
        $('.selected').removeClass('selected')
        $(e.currentTarget).toggleClass('selected')
      })
    },
	  home: function() {
      $('#wrapper').html(render('home'))
      $('#listbox').html(render('recentLists', {action: '/view', title: "Recently Updated Lists"}))
      showMap()
      locateAndSetMap()
	  }
  }
  
  // reset to front page on refresh for now
  window.location.href="/#/"
  bootstrap()
  
  Router({
    '/': {
      on: function() {
        window.location.href="/#/home"
      }
    },
    '/:page': { 
      on: function(page) {
        console.log(page)
        routes[page]()
      }
    },
    '/edit/:page': { 
      on: function(page) {

      }
    },
    '/view/:page': { 
      on: function(page) {
        request({url:'/list-' + page, json: true}, function(err, resp, data) {
          showPhotosOnMap(data.items)
        })
      }
    }
  }).init('/')
  
})
