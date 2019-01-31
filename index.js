var stream = require('stream')
var duplexify = require('duplexify')

module.exports = HandshakeStream

function HandshakeStream (protocol, payload, shake) {
  var res = duplexify.obj()
  var upgraded = false

  var w = new stream.Writable({objectMode:true})
  w._write = function (chunk, enc, next) {
    if (upgraded) {
      protocol.write(chunk)
      next()
    } else {
      shake(chunk, function (err) {
        next(err)
        if (err) return

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

  var r = new stream.Readable({objectMode:true})
  r._read = function () {
  }
  r.push(payload)

  res.setReadable(r)
  res.setWritable(w)

  return res
}
