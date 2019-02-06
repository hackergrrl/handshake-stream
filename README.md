# handshake-stream

> wrap a duplex stream with a two-way handshake

## purpose

Sometimes you have a protocol that operates over a duplex stream, but you'd
like both sides to exchange some data before proceeding to that protocol, like
ensuring that each side has a compatible protocol version, or that it is in
fact the peer you're expecting to communicate with.

`handshake-stream` wraps the inner protocol with a two-way handshake that gives
both peers a chance to inspect the data sent by the other end and decide
whether to proceed to that inner protocol.

## example

Let's create two [hyperlog][hyperlog]s (append-only graph databases that can
replicate with eachother using a duplex stream) and wrap them in a handshake
that checks for a sufficiently high version number:

```js
var handshake = require('handshake-stream')
var hyperlog = require('hyperlog')
var memdb = require('memdb')
var pump = require('pump')

// create two hyperlog databases
var logA = hyperlog(memdb())
var logB = hyperlog(memdb())

// write 1 entry to each
logA.append('hello from A', function () {
  logB.append('greetings from B', function () {
    ready()
  })
})

// generate the handshake data each side might want to send
var payloadA = { protocolVersion: 6, sender: 'a' }
var payloadB = { protocolVersion: 6, sender: 'b' }

// the 'handshake' is a function with the other side's payload ('req' below)
// and an accept function that upgrades the handshake to the underlying
// hyperlog protocol if non-truthy, or emits an error and terminates the
// pipeline if anything else is passed in.
var shake = function (req, accept) {
  console.log('got handshake', req)
  if (req.protocolVersion >= 6) {
    accept()
  } else {
    accept(new Error('version must be >= 6'))
  }
}

function ready () {
  var r1 = handshake(logA.replicate(), payloadA, shake)
  var r2 = handshake(logB.replicate(), payloadB, shake)

  // replicate the hyperlogs together
  pump(r1, r2, r1, function (err) {
    console.log('pump end', err ? err.message : '')

    // dump each hyperlog's contents; they should each have each other's entry + their own
    logA.createReadStream().on('data', function (node) { console.log('A ->', node.value.toString()) })
    logB.createReadStream().on('data', function (node) { console.log('B ->', node.value.toString()) })
  })
}
```

outputs

```
got handshake { protocolVersion: 6, initiator: 'a' }
got handshake { protocolVersion: 6, initiator: 'b' }
pump end 
A -> hello from A
B -> greetings from B
A -> greetings from B
B -> hello from A
```

## API

> var handshake = require('handshake-stream')

### var stream = handshake(protocol, payload, shake)

Returns a duplex stream that wraps the duplex stream `protocol`.

The object `payload`is sent to whatever `stream` is piped to, and the function
`shake` is called when the remote's payload has been received.

`shake` is called as `shake(payload, accept)`, where `payload` is the object
sent by the remote, and `accept` is a function you can asynchronously call as
`accept()` to permit the inner `protocol` to proceed, or `accept(new Error('...'))`
to signal that the connection ought to be terminated. The inner protocol will
only proceed if both sides accept the other's handshake payload.

### install

With [node.js](https://nodejs.org) installed, install from npm:

```
npm install handshake-stream
```

### how it works

Internally, handshake-stream creates a Duplex stream with its own readable and writable ends to manage all incoming & outgoing data.

Upon creation, the readable side provides the following bytes in order: `<LEN><PAYLOAD><ACCEPT-SIGNAL><REST>`, where

- `LEN` is a UInt32LE of the length of `PAYLOAD`
- `PAYLOAD` is a JSON-encoded string
- `ACCEPT-SIGNAL` is a UInt8 with all 1s set (127)
- `REST` is whatever readable bytes the inner protocol provides

Only `<LEN><PAYLOAD>` are sent initially, and `ACCEPT-SIGNAL` is only sent once the `accept()` callback is called to indicate that the program would like to proceed to the inner protocol. After that, the inner protocol's readable & writable ends are hooked up and the stream proceeds as though handshake-stream was never even there. The `drain` event is listened to on the inner protocol to respect backpressure.

## license

ISC

[hyperlog]: https://github.com/mafintosh/hyperlog
