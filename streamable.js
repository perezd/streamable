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

      write: function(data) {
        _write(['data', data]);
      },

      error: function(err) {
        _write(['err', err.toString()]);
      },

      fatal: function(err) {
        _write(['err.', err.toString()]);
      },

      end: function(data) {
        if (data) { _write(['data', data]); }
        _write(['end']);
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
  var stream   = genStream(sessionId, streamId);

  if (stream) {
    // signal to our caller that we have a stream
    // id that they need to subscribe to.
    res.json({streamId: streamId});
    process.nextTick(function() { fn(stream); });
  } else {
    res.json({error: 'stream cannot be initialized'}, 400);
  }

}


/* encode a value to a string-oriented representation.
   we currently do not support binary streaming. */
function encodeValue(value, encoding) {
  if (encoding === 'json') {
    return JSON.stringify(value);
  } else if (encoding === 'binary') {
    throw new TypeError("Binary encoding not supported. Patches accepted!");
  } else {
    return String(value);
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

    // allow the HTTP caller to decide to disable the streamable
    // responses. This will require that your REST API still
    // relies on chunked encoding primitives (write/end, etc.)
    if (req.header('x-streamable-bypass') || !req.query.sid) {

      // configurable message delimeter for non-socket streaming.
      var reqDelim = (req.header('x-streamable-delimiter') || '\r\n');

      // add fallback support for the Streamable API here.
      var origWrite = res.write;

      // because streamable's API allows you to send variable
      // arguments with each write, we must concat the writes
      // as string values, delimited by commas, followed by a
      // \n to represent the end of that "atomic" write of values.
      res.write = function(value, encoding) {
        origWrite.call(res, encodeValue(value, encoding)+reqDelim);
      };

      res.error = function(err) { res.write.call(res, String(err)); };
      res.fatal = function(err) { res.end.call(res, String(err)); };
      res.header('x-streamable-bypass', '1');
      return next();
    }

    streamResponse(req, res, function(stream) {
      var ackTimeout, ackEvent = stream.streamId+'ack';

      // if the response stream is not acknowledged
      // in a timely fashion, we give up on it.
      ackTimeout = setTimeout(function() {
        stream.socket.removeAllListeners(ackEvent);
      }, 5000);

      // once our response stream has been
      // acknowledged, we allow our middleware
      // to progress.
      stream.socket.once(ackEvent, function() {
        clearTimeout(ackTimeout);

        // writes a buffer to the stream.
        res.write = function(value, encoding) {
          stream.write.call(res, encodeValue(value, encoding));
        };

        // writes a non-fatal error to the stream.
        res.error = function(err) {
          stream.error.call(res, String(err));
        };

        // writes a fatal error to the stream, with intent to close the stream.
        res.fatal = function(err) {
          stream.fatal.call(res, String(err));
        };

        // closes the stream.
        res.end = function() {
          if (arguments.length != 0) { res.write.apply(res, arguments); }
          stream.end.call(res);
        };

        next();
      });

    });
  }
}
