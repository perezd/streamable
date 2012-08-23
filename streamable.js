var randBytes = require('crypto').randomBytes;

/* module-level cache of socket sessions
   used to reference sockets known by
   this process to stream information to them. */
var __sockets = {};


/* basic random bytes generator, used
   as the values of our streamIds. */
function genStreamId() {
  return randBytes(8).toString('hex');
}


/* generates a stream object to be used within
   a REST request. basic API: write/error/end. */
function genStream(sessionId, streamId) {
  var stream;
  var socketSession = __sockets[sessionId];

  var _write = function(data) {
    socketSession.emit(streamId, data);
  };

  if (socketSession) {
    stream = {

      sessionId : sessionId,
      streamId  : streamId,
      socket    : socketSession,

      write: function() {
        _write(Array.prototype.slice.call(arguments, 0));
      },

      error: function(err) {
        if (err instanceof Error && err.message) { err = err.message; }
        _write(['err', err]);
      },

      fatal: function(err) {
        if (err instanceof Error && err.message) { err = err.message; }
        _write(['err.', err]);
      },

      end: function() {
        _write(['\n\n\n\n']);
      }

    }
  }

  return stream;
}


/* facilitates the streaming transaction with the REST
   interface. requires knowledge of the sid/sessionId
   and returns a streamId handle for the client to subscribe to. */
function streamResponse(req, res, fn) {
  var sessionId = req.query.sid;
  if (!sessionId) { return res.json({error: 'sid missing from request'}, 400); }

  var streamId = genStreamId();
  var stream   = genStream(sessionId, streamId)

  if (stream) {
    // signal to our caller that we have a stream
    // id that they need to subscribe to.
    res.json({streamId: streamId});
    process.nextTick(function() { fn(stream); });
  } else {
    res.json({error: 'stream cannot be initialized'}, 400);
  }

}


exports.streamable = function(io) {

  /* because streamable relies on knowing
     about active socket.io sessions in our
     process, we must keep an up-to-date mapping
     of session ids to socket references. */
  if (!io.__streamableInit) {
    io.of('/streamable').on('connection', function(socket) {
      var socketId = socket.id;
      __sockets[socketId] = socket;
      socket.once('disconnect', function(){
        delete __sockets[socketId];
      });
    });
    io.__streamableInit = true;
  }

  return function streamableMiddleware(req, res, next) {
    streamResponse(req, res, function(stream) {
      var ackTimeout, ackEvent = stream.streamId+'ack';

      // if the response stream is not acknowledged
      // in a timely fashion, we give up on it.
      ackTimeout = setTimeout(function() {
        stream.socket.removeAllListeners(ackEvent);
        stream.fatal(new Error("stream acknowledgement timed out"));
      }, 5000);

      // once our response stream has been
      // acknowledged, we allow our middleware
      // to progress.
      stream.socket.once(ackEvent, function() {
        clearTimeout(ackTimeout);

        // writes a buffer to the stream.
        res.write = stream.write;

        // writes a non-fatal error to the stream.
        res.error = stream.error;

        // writes a fatal error to the stream, with intent to close the stream.
        res.fatal = stream.fatal;

        // closes the stream.
        res.end   = stream.end;

        next();
      });

    });
  }
}
