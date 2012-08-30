Have you ever wanted to utilize `Content-Encoding: chunked` in XHR, without waiting for the entire request to complete? With Streamable, you can!

## Overview

[HTTP/1.1 chunked encoding](http://en.wikipedia.org/wiki/Chunked_transfer_encoding) is a really useful feature of the protocol, however, its really disappointing that we cannot interact with it directly via XHR. Instead, we have to wait for the entire request/response cycle to be complete, before we can start interacting with the data thats coming to us over the wire!

Since we cannot rely on the HTTP protocol alone, we use a hybrid strategy that negotiates initially over HTTP at first, then coordinates chunked data transmission using asynchronous pipelines. Ideally, this is accomplished using [WebSockets](http://en.wikipedia.org/wiki/WebSocket), but will feature detect as you would expect, thanks to [socket.io](http://socket.io). So rather than reinventing the HTTP protocol over sockets, we couple the two protocols together into a single API.

Streamable is designed to feel transparent. If you access a streamable REST endpoint without the Streamable client, native chunked encoding will happen in its place. You can also explicitly disable Streamable for a particular request by sending the `x-streamable-bypass` request header. If streamable is bypassed, each message will be delimeted with `\r\n`. This is also configurable by provided the `x-streamable-delimiter` request header, providing the value you'd like to use instead.

## Getting Started

install Streamable using npm:

```
npm install streamable
```

## Server

Streamable is implemented as an [Express/Connect](http://www.expressjs.com) middleware, so its really simple to use. It assumes you've got both Socket.io and Express modules already included in your app.

```js
// setup an express 3.x server
var express = require('express');
var app     = express();
var server  = require('http').createServer(app);

// setup a socket.io server and attach it to express
var io = require('socket.io').listen(server);
```

Once you've got that setup, its easy to setup Streamable, just pass in your socket.io server instance and the middleware is ready to go.

```js
var streamable = require('streamable').streamable(io);
```

At this point, we just drop the Streamable middleware into our routes

```js
app.get('/myAPI', streamable, function(req, res){
  res.write('streaming…');
  res.write('streaming…');
  res.end();
});
```

The streamable API also allows you to send fatal and non-fatal errors via the `res` object.

```js
res.fatal(new Error('this will fire the onError event and close the response stream'));
res.error(new Error('this will fire the onError event and keep going'));
```

the write API also supports `json` as a valid encoding, for convenience.

```js
res.write(["here", "is", {some, "data"}], 'json');
```

## Client

The client side requires you to have [jQuery](http://www.jquery.com) (for XHR) and the socket.io client-side library. Make sure those are loaded before adding the Streamable client JavaScript module. Once its all loaded up, its really easy to start using.

```html
<script type="text/javascript">
  Streamable.get("/myAPI", {
    onData  : function(data)  { console.log('data:' , data); },
    onError : function(e) { console.log('error:', e); },
    onEnd   : function()  { console.log('end'); }
  });
</script>
```

the `onData` call will happen n times--once per write. The `onEnd` call is guaranteed to be called one time after all `onData` and/or `onError` events have fired. If you've passed multiple values to write on the server-side, you can expect them as arguments in the same order of your `onData` event handler.

## License

Copyright (C) 2012 Derek Perez <derek@derekperez.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"),
to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
