var handshake = require('.')
var hyperlog = require('hyperlog')
var memdb = require('memdb')
var pump = require('pump')

var logA = hyperlog(memdb())
var logB = hyperlog(memdb())

logA.append('hello from A', function () {
  logB.append('greetings from B', function () {
    ready()
  })
})

function makePayload (id) {
  var payload = { protocolVersion: 6, initiator: id }
  return payload
}

function ready () {
  var shake = function (req, accept) {
    console.log('got handshake', req)
    if (req.protocolVersion >= 6) {
      accept()
    } else {
      accept(new Error('version must be >= 6'))
    }
  }

  var r1 = handshake(logA.replicate(), makePayload('a'), shake)
  var r2 = handshake(logB.replicate(), makePayload('b'), shake)

  pump(r1, r2, r1, function (err) {
    console.log('pump end', err ? err.message : '')
    logA.createReadStream().on('data', function (node) { console.log('A ->', node.value.toString()) })
    logB.createReadStream().on('data', function (node) { console.log('B ->', node.value.toString()) })
  })
}
