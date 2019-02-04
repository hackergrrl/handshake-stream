var stream = require('stream')
var duplexify = require('duplexify')
var decoder = require('./decoder')

module.exports = HandshakeStream

function HandshakeStream (protocol, payload, shake) {
  var res = duplexify.obj()
  var upgraded = false
  var decode = decoder()

  var w = new stream.Writable()
  w._write = function (chunk, enc, next) {
    if (upgraded) {
      // once the handshake is accepted, start forwarding incoming data to
      // the inner protocol stream
      var ok = protocol.write(chunk)
      if (!ok) protocol.once('drain', next) // respect backpressure from protocol
      else next()
    } else {
      // accumulate buffer chunks from the stream until the full handshake
      // object is collected
      var msg
      try {
        msg = decode(chunk)
      } catch (e) {
        next(e)
      }
      if (!msg) return next()

      shake(msg, function (err) {
        next(err)
        if (err) return

        // upgrade the stream to the inner protocol
        upgraded = true
        protocol.on('data', function (data) {
          res.push(data)
        })
        protocol.on('finish', function () {
          res.end()
        })
        protocol.resume()
      })
    }
  }

  var r = new stream.Readable()
  r._read = function () {
  }

  // write length-prefixed json
  var json = JSON.stringify(payload)
  var lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32LE(json.length, 0)
  r.push(lenBuf)
  r.push(json)

  res.setReadable(r)
  res.setWritable(w)

  return res
}
