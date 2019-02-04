module.exports = JsonDecode

function JsonDecode () {
  var expectedBytes = null
  var accum = Buffer.alloc(0)

  return function (buf) {
    accum = Buffer.concat([accum, buf])

    if (expectedBytes === null && accum.length < 4) return

    if (expectedBytes === null) {
      expectedBytes = accum.readUInt32LE(0)
    }

    if (accum.length >= expectedBytes + 4) {
      var json = accum.slice(4, expectedBytes + 4).toString()
      var obj = JSON.parse(json)
      return obj
    }
  }
}
