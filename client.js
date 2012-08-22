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

  if (!jQuery) { throw new Error("jQuery is required"); }
  if (!io)     { throw new Error("socket.io is required"); }

  var socket = io.connect('http://localhost:6565');
  var client = {};

  /* a user may start interacting with our request API before
     we can guarantee that we're connected to the socket
     so we must queue up all the requests, and flush them once
     we're sure we're connected to the socket. */

  var _reqQueue = [];
  var notConnected = true;

  socket.once('connect', function() {
    notConnected = false;
    _reqQueue.forEach(function(req) {
      client.get.apply(null, req);
    });
    _reqQueue = [];
  });


  var handleDone = function(events) {
    return function ajaxDone(data) {
      if (!data.streamId) {
        return events.onError(new Error("streamId not provided in response"));
      }

      socket.on(data.streamId, function onData(payload) {
        if (payload == '\n\n\n\n') {
          socket.removeAllListeners(data.streamId);
          events.onEnd();
        } else {
          events.onData(payload);
        }
      });

    };
  };


  var handleFail = function(events) {
    return function ajaxFail(jqXHR, textStatus, errorThrown) {
      events.onError(errorThrown);
      events.onEnd();
    };
  };


  client.get = function(url, options, events) {

    if (notConnected) {
      _reqQueue.push([url, options, events]);
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

    /* event API is very similar to what you
       would expect in node.js/EventEmitter.
       ie: expect n data/errors calls and a single
       end event, at the very end, always. */
    if(!events.onData)  { events.onData  = function(){} };
    if(!events.onError) { events.onError = function(error){ throw err; } };
    if(!events.onEnd)   { events.onEnd   = function(){} };

    jQuery.ajax({
      url      : url,
      dataType : 'json',
      data     : params,
    })
      .done(handleDone(events))
      .fail(handleFail(events));

  };

  this.streamClient = client;

}.call(this));
