/*
Copyright (C) 2012 Derek Perez <derek@derekperez.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"),
to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

(function(){

  if (!window.jQuery) { throw new Error("jQuery is required"); }
  if (!window.io)     { throw new Error("socket.io is required"); }


  var socket     = null
  var streamable = {
    config: {
      host: window.location.origin // assume localhost and local protocol.
    }
  };


  /* a user may start interacting with our request API before
     we can guarantee that we're connected to the socket
     so we must queue up all the requests, and flush them once
     we're sure we're connected to the socket. */

  var _reqQueue        = [];

  /* socket connectivity is managed in a lazy fashion.
     ie: if Streamable is required into the browser, but never
     used, we don't waste a socket connection. */
  var _NOT_CONNECTED = 0
  ,   _CONNECTING    = 1
  ,   _CONNECTED     = 2
  , connectionStatus = _NOT_CONNECTED;

  var doConnectLazy = function() {
    socket = io.connect(streamable.config.host+'/streamable');
    connectionStatus = _CONNECTING;

    socket.on('connect', function() {
      connectionStatus = _CONNECTED;
      _reqQueue.forEach(function(req) {
        streamable.get.apply(null, req);
      });
      _reqQueue = [];
    });

    socket.on('error', function(e) {
      connectionStatus = _NOT_CONNECTED;
      throw e;
    });

    socket.on('disconnect', function() {
      connectionStatus = _NOT_CONNECTED // not connected.
    });
  };


  var handleDone = function(events) {
    return function ajaxDone(data) {
      if (!data.streamId) {
        return events.onError(new Error("streamId not provided in response"));
      }

      socket.on(data.streamId, function onData(payload) {
        // this is a completion.
        if (payload[0] === 'end') {
          socket.removeAllListeners(data.streamId);
          events.onEnd();

        // this is a terminating error.
        } else if (payload[0] === 'err.') {
          events.onError(payload[1]);
          socket.removeAllListeners(data.streamId);
          events.onEnd();

        // this is a non-terminating error.
        } else if (payload[0] === 'err') {
          events.onError(payload[1]);

        // this is a data payload.
        } else if (payload[0] === 'data') {
          try {
            events.onData.call(events, JSON.parse(payload[1]));
          } catch (err) {
            events.onData.call(events, payload[1]);
          }

        }
      });

      // notify server that we're ready to receive
      // our response stream.
      socket.emit(data.streamId+'ack');

    }
  };


  var handleFail = function(events) {
    return function ajaxFail(jqXHR, textStatus, errorThrown) {
      events.onError(errorThrown);
      events.onEnd();
    }
  };

  // From: https://github.com/dominictarr/crypto-browserify/blob/master/rng.js
  // NOTE: Math.random() does not guarantee "cryptographic quality"
  var mathRNG = function(size) {
    var bytes = new Array(size);
    var r;

    for (var i = 0, r; i < size; i++) {
      if ((i & 0x03) == 0) r = Math.random() * 0x100000000;
      bytes[i] = r >>> ((i & 0x03) << 3) & 0xff;
    }

    return bytes;
  };

  streamable.get = function(url, options, events) {
    if (connectionStatus != _CONNECTED) {
      _reqQueue.push([url, options, events]);
      if (connectionStatus != _CONNECTING) { doConnectLazy(); }
      return;
    }

    /* options allow you to send URL k/v
       params along with your request easily
       without doing the encoding by hand. */
    if (typeof options == 'object' && !events) {
      events  = options;
      options = {};
    }

    /* we embed our socket session into our request
       so that we know which session to send the stream to. */
    var params = options.params ? options.params : {};
    params.sid = socket.socket.sessionid;

    /* introduce randomness to querystring to make
       each request unique. */
    params['r' + mathRNG(8).join('')] = 1;

    /* event API is very similar to what you
       would expect in node.js/EventEmitter.
       ie: expect n data/errors calls and a single
       end event, at the very end, always. */
    if(!events.onData)  { events.onData  = function(){}; };
    if(!events.onError) { events.onError = function(error){ throw err; }; };
    if(!events.onEnd)   { events.onEnd   = function(){}; };

    jQuery.ajax({
      url      : url,
      dataType : 'json',
      data     : params
    })
      .done(handleDone(events))
      .fail(handleFail(events));
  };

  this.Streamable = streamable;

}.call(this));
