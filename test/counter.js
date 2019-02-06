var stream = require('stream')

module.exports = function (id) {
  var counter = new stream.Duplex({allowHalfOpen: false})
  counter.processed = []

  var payloadsLeft = 3

  counter._read = function () {
    if (!payloadsLeft) return this.push(null)

    var payload = JSON.stringify({ sender: id, left: payloadsLeft })

    var prefix = Buffer.alloc(4)
    prefix.writeUInt32LE(payload.length, 0)

    this.push(prefix)
    this.push(payload.slice(0, 10))
    this.push(payload.slice(10))

    payloadsLeft--
  }

  var expected = 0
  var accum = Buffer.alloc(0)
  counter._write = function (chunk, enc, next) {
    accum = Buffer.concat([accum, chunk])
    tryParse()
    process.nextTick(next)
  }

  function tryParse () {
    // haven't recv'd prefix len yet
    if (!expected && accum.length < 4) return

    // read prefix length
    if (!expected) {
      expected = accum.readUInt32LE(0)
      accum = accum.slice(4)
    }

    // read next chunk
    if (accum.length >= expected) {
      var buf = accum.slice(0, expected)
      var value = JSON.parse(buf.toString())
      counter.processed.push(value)
      accum = accum.slice(expected)
      expected = 0
      tryParse()
    }
  }

  // exposes '.processed' so you can examine the payloads received
  return counter
}
