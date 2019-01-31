var handshake = require('.')
var hyperlog = require('hyperlog')
var memdb = require('memdb')
var eos = require('end-of-stream')
var pump = require('pump')

var logs = []

function inner (id) {
  var log = hyperlog(memdb())
  var ops = new Array(1).fill(0).map(function () {
    return {
      value: id + '_' + String(Math.random()).substring(6),
      links: []
    }
  })
  log.batch(ops)
  logs.push(log)
  return log.replicate()
}

function peer (id) {
  var payload = { protocolVersion: 6, initiator: id }
  // if (id==='b') payload.protocolVersion = 5

  var shake = function (req, accept) {
    console.log(id, 'got handshake', req)
    if (req.protocolVersion >= 6) {
      accept()
    } else {
      accept(new Error('version must be >= 6'))
    }
  }

  return handshake(inner(id), payload, shake)
}

var a = peer('a')
var b = peer('b')

pump(a, b, a, function (err) {
  console.log('pump end', err ? err.message : '')
  logs[0].createReadStream().on('data', console.log.bind(console, 'a'))
  logs[1].createReadStream().on('data', console.log.bind(console, 'b'))
})

// eos(a, function (err) {
//   console.log('eos a', err ? err.message : '')
//   logs[0].createReadStream().on('data', console.log.bind(console, 'a'))
// })
// eos(b, function (err) {
//   console.log('eos b', err ? err.message : '')
//   logs[1].createReadStream().on('data', console.log.bind(console, 'b'))
// })


