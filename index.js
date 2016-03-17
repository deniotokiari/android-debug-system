var express = require('express');
var socket = require('socket.io');
var backend = require('./app');
var net = require('net');

var app = express();

app.use(express.static(__dirname + '/public'));

var server = app.listen(3000);
var io = socket.listen(server);

io.sockets.on('connection', function (socket) {
    backend.init(net, io, socket);
});