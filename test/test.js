var test = require('tape')
var handshake = require('..')
var hyperlog = require('hyperlog')
var memdb = require('memdb')
var pump = require('pump')
var collect = require('collect-stream')
var counterDuplex = require('./counter')

test('counter', function (t) {
  t.plan(3)

  var a = counterDuplex('a')
  var b = counterDuplex('b')

  var shake = function (req, accept) {
    accept()
  }

  var r1 = handshake(a, {}, shake)
  var r2 = handshake(b, {}, shake)

  pump(r1, r2, r1, function (err) {
    t.error(err)
    t.deepEquals(a.processed, [
      { left: 3, sender: 'b' },
      { left: 2, sender: 'b' },
      { left: 1, sender: 'b' }
    ])
    t.deepEquals(b.processed, [
      { left: 3, sender: 'a' },
      { left: 2, sender: 'a' },
      { left: 1, sender: 'a' }
    ])
  })
})

test('hyperlog', function (t) {
  t.plan(9)

  var logA = hyperlog(memdb())
  var logB = hyperlog(memdb())

  logA.append('hello from A', function (err) {
    t.error(err)
    logB.append('greetings from B', function (err) {
      t.error(err)
      ready()
    })
  })

  function makePayload (id) {
    var payload = { protocolVersion: 6, initiator: id }
    return payload
  }

  function ready () {
    var shake = function (req, accept) {
      if (req.protocolVersion >= 6) {
        t.ok(true)
        accept()
      } else {
        t.fail()
        accept(new Error('version must be >= 6'))
      }
    }

    var r1 = handshake(logA.replicate(), makePayload('a'), shake)
    var r2 = handshake(logB.replicate(), makePayload('b'), shake)

    pump(r1, r2, r1, function (err) {
      t.error(err)
      collect(logA.createReadStream(), function (err, res) {
        t.error(err)
        t.equal(res.length, 2)
      })

      collect(logB.createReadStream(), function (err, res) {
        t.error(err)
        t.equal(res.length, 2)
      })
    })
  }
})

test('rejected handshake', function (t) {
  t.plan(10)

  var logA = hyperlog(memdb())
  var logB = hyperlog(memdb())

  logA.append('hello from A', function (err) {
    t.error(err)
    logB.append('greetings from B', function (err) {
      t.error(err)
      ready()
    })
  })

  function ready () {
    var shake = function (req, accept) {
      if (req.protocolVersion >= 6) {
        t.ok(true)
        accept()
      } else {
        t.ok(true)
        accept(new Error('version must be >= 6'))
      }
    }

    var r1 = handshake(logA.replicate(), { protocolVersion: 6, initiator: 'a' }, shake)
    var r2 = handshake(logB.replicate(), { protocolVersion: 3, initiator: 'b' }, shake)

    pump(r1, r2, r1, function (err) {
      t.ok(err instanceof Error)
      t.equal(err.message, 'version must be >= 6')

      collect(logA.createReadStream(), function (err, res) {
        t.error(err)
        t.equal(res.length, 1)
      })

      collect(logB.createReadStream(), function (err, res) {
        t.error(err)
        t.equal(res.length, 1)
      })
    })
  }
})

test('slow handshake', function (t) {
  t.plan(3)

  var a = counterDuplex('a')
  var b = counterDuplex('b')

  var shake = function (req, accept) {
    var delay = Math.floor(Math.random() * 4000)
    setTimeout(accept, delay)
  }

  var r1 = handshake(a, {}, shake)
  var r2 = handshake(b, {}, shake)

  pump(r1, r2, r1, function (err) {
    t.error(err)
    t.deepEquals(a.processed, [
      { left: 3, sender: 'b' },
      { left: 2, sender: 'b' },
      { left: 1, sender: 'b' }
    ])
    t.deepEquals(b.processed, [
      { left: 3, sender: 'a' },
      { left: 2, sender: 'a' },
      { left: 1, sender: 'a' }
    ])
  })
})
