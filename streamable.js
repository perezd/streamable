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
   a REST request. basic API: write/end. */
function genStream(sessionId, streamId) {
  var stream;
  var socketSession = __sockets[sessionId];

  if (socketSession) {
    stream = {

      write: function() {
        var args = Array.prototype.slice.call(arguments, 0);
        args.unshift(streamId);
        socketSession.emit.apply(socketSession, args);
      },

      end: function() {
        socketSession.emit(streamId, '\n\n\n\n');
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
    io.on('connection', function(socket) {
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
      res.write = stream.write;
      res.end   = stream.end;
      next();
    });
  }
}
