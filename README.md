# Streamable: Super simple streaming responses for Connect/Express.

Have you ever wanted to utilize `Content-Encoding: chunked` in XHR, without waiting for the entire request to complete? With Streamable, you can!

## Getting Started

install Streamable using npm:

```
npm install streamable
```

### Server-side

Streamable assumes you're using Express/Connect as your HTTP server, and Socket.io as an async socket connection to the browser.

```js
// setup a basic express 3.x server
var express = require('express');
var app     = express();
var server  = require('http').createServer(app);

// setup a basic socket.io server
var io = require('socket.io').listen(server);
```

Once we've setup our server-side dependencies, we need to require streamable. Streamable requires knowledge of our socket.io instance.

```js
var streamable = require('streamable').streamable(io);
```

Now that we're all configured, we can start using streamable in our REST API.

```js
app.get('/foo', streamable, function(req, res) {
  res.write({foo: 'bar'});
  res.write("whatever data I want");
  res.write("multiple", ["arguments", "work", "too"]);
  res.end();
});
```
Server-side is ready to go.

### Client-side

Streamable assumes you have jQuery and Socket.io available to your browser, so make sure they are included in page before streamble's client.js.

Once you've included everything you need, add this to your HTML:

```html
<script type="text/javascript">
  Streamable.get("/foo", {
    onData  : function(d) { console.log('data:' , d); },
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
