// 1. setup a basic express server
var express = require('express');
var app     = express();
var server  = require('http').createServer(app);

// 2. setup a basic socket.io server
var io = require('socket.io').listen(server);

// 3. setup streamable and make it aware of our socket.io server instance.
var streamable = require('../streamable').streamable(io);

// 4. include streamable in your middleware, and have a blast!
app.get('/foobar', streamable, function(req, res) {
  var inter, counter = 30;
  inter = setInterval(function() {
    res.write(["foobar:", counter, {foo: 'bar'}], 'json');
    if (counter == 20) { res.error(new Error('send a non-fatal error')); }
    if (--counter == 0) {
      clearInterval(inter);
      res.end();
    }
  }, 50);
});


/*
static file serving stuff, nevermind me.
*/
var readFileSync = require('fs').readFileSync;

app.get('/', function(req, res){
  res.contentType('text/html');
  res.send(readFileSync("./index.html"));
});

app.get('/client.js', function(req, res){
  res.contentType('text/javascript');
  res.send(readFileSync("../client.js"));
});


server.listen(6565);
