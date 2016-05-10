var BLANK_IMG = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
var socket;
var canvas;
var g;
var events = {
    connected: function () {

    },
    screen: function (data) {
        var blob = new Blob([data], {type: 'image/jpeg'});
        var URL = window.URL || window.webkitURL;
        var img = new Image();

        img.onload = function () {
            console.log(img.width, img.height);
            canvas.width = img.width;
            canvas.height = img.height;
            g.drawImage(img, 0, 0);
            img.onload = null;
            img.src = BLANK_IMG;
            img = null;
            blob = null;
        };

        img.src = URL.createObjectURL(blob);
    }
};

$(document).ready(function () {
    socket = io.connect();

    canvas = document.getElementById('canvas');
    g = canvas.getContext('2d');

    var handler = function (e) {
        var rect = e.target.getBoundingClientRect();
        var x_coordinate = e.clientX - rect.left;
        var y_coordinate = e.clientY - rect.top;

        socket.emit('touch', {
            type: e.type,
            x: x_coordinate,
            y: y_coordinate,
            canvas_w: canvas.width,
            canvas_h: canvas.height
        });
    };

    $('#canvas').on("mousedown", handler);
    $('#canvas').on("mouseup", handler);
    $('#canvas').on("mousemove", handler);

    for (var key in events) {
        if (events.hasOwnProperty(key)) {
            socket.on(key, events[key]);
        }
    }
});