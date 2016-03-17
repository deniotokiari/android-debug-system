var socket;
var minicap;
var minitouch;

var max_height;
var max_width;
var isPressed;

var events = {
    touch: function (data) {
        if (minitouch == null) {
            return;
        }

        var type = data.type;
        var x = convert_x(data.x, data.canvas_w);
        var y = convert_y(data.y, data.canvas_h);

        if ("mousedown" == type) {
            isPressed = true;
            minitouch.write("d 0 " + x + " " + y + " 50\nc\n");
        } else if ("mouseup" == type) {
            isPressed = false;
            minitouch.write("u 0\nc\n");
        } else if ("mousemove" == type && isPressed) {
            minitouch.write("m 0 " + x + " " + y + " 50\nc\n");
        }
    }
};

function convert_x(x, canvas_w) {
    var _x = Math.round(x * (max_width / canvas_w));

    if (_x > max_width) {
        return max_width;
    } else {
        return _x;
    }
}

function convert_y(y, canvas_h) {
    var _y = Math.round(y * (max_height / canvas_h));

    if (_y > max_height) {
        return max_height;
    } else {
        return _y;
    }
}

function handleMiniTouchData(data) {
    var screen_specs = String(data).split("\n")[1];
    max_width = screen_specs.split(" ")[2];
    max_height = screen_specs.split(" ")[3];
}

exports.init = function (net, out, s) {
    s.emit('connected');
    socket = out;

    minicap = net.connect({
        port: 1717
    });

    var readBannerBytes = 0;
    var bannerLength = 2;
    var readFrameBytes = 0;
    var frameBodyLength = 0;
    var frameBody = new Buffer(0);
    var banner = {
        version: 0
        , length: 0
        , pid: 0
        , realWidth: 0
        , realHeight: 0
        , virtualWidth: 0
        , virtualHeight: 0
        , orientation: 0
        , quirks: 0
    };

    function handleMiniCap() {
        for (var chunk; (chunk = minicap.read());) {
            //console.info('chunk(length=%d)', chunk.length);
            for (var cursor = 0, len = chunk.length; cursor < len;) {
                if (readBannerBytes < bannerLength) {
                    switch (readBannerBytes) {
                        case 0:
                            // version
                            banner.version = chunk[cursor];
                            break;
                        case 1:
                            // length
                            banner.length = bannerLength = chunk[cursor];
                            break;
                        case 2:
                        case 3:
                        case 4:
                        case 5:
                            // pid
                            banner.pid +=
                                (chunk[cursor] << ((readBannerBytes - 2) * 8)) >>> 0;
                            break;
                        case 6:
                        case 7:
                        case 8:
                        case 9:
                            // real width
                            banner.realWidth +=
                                (chunk[cursor] << ((readBannerBytes - 6) * 8)) >>> 0;
                            break;
                        case 10:
                        case 11:
                        case 12:
                        case 13:
                            // real height
                            banner.realHeight +=
                                (chunk[cursor] << ((readBannerBytes - 10) * 8)) >>> 0;
                            break;
                        case 14:
                        case 15:
                        case 16:
                        case 17:
                            // virtual width
                            banner.virtualWidth +=
                                (chunk[cursor] << ((readBannerBytes - 14) * 8)) >>> 0;
                            break;
                        case 18:
                        case 19:
                        case 20:
                        case 21:
                            // virtual height
                            banner.virtualHeight +=
                                (chunk[cursor] << ((readBannerBytes - 18) * 8)) >>> 0;
                            break;
                        case 22:
                            // orientation
                            banner.orientation += chunk[cursor] * 90;
                            break;
                        case 23:
                            // quirks
                            banner.quirks = chunk[cursor];
                            break
                    }

                    cursor += 1;
                    readBannerBytes += 1;

                    if (readBannerBytes === bannerLength) {
                        //console.log('banner', banner)
                    }
                }
                else if (readFrameBytes < 4) {
                    frameBodyLength += (chunk[cursor] << (readFrameBytes * 8)) >>> 0;
                    cursor += 1;
                    readFrameBytes += 1;
                    //console.info('headerbyte%d(val=%d)', readFrameBytes, frameBodyLength)
                }
                else {
                    if (len - cursor >= frameBodyLength) {
                        //console.info('bodyfin(len=%d,cursor=%d)', frameBodyLength, cursor);

                        frameBody = Buffer.concat([
                            frameBody
                            , chunk.slice(cursor, cursor + frameBodyLength)
                        ]);

                        // Sanity check for JPG header, only here for debugging purposes.
                        if (frameBody[0] !== 0xFF || frameBody[1] !== 0xD8) {
                            console.error(
                                'Frame body does not start with JPG header', frameBody);
                            process.exit(1)
                        }

                        socket.emit('screen', frameBody);

                        cursor += frameBodyLength;
                        frameBodyLength = readFrameBytes = 0;
                        frameBody = new Buffer(0)
                    }
                    else {
                        //console.info('body(len=%d)', len - cursor);

                        frameBody = Buffer.concat([
                            frameBody
                            , chunk.slice(cursor, len)
                        ]);

                        frameBodyLength -= len - cursor;
                        readFrameBytes += len - cursor;
                        cursor = len
                    }
                }
            }
        }
    }

    minicap.on('readable', handleMiniCap);

    minitouch = net.connect({
        port: 1111
    });
    minitouch.on('data', handleMiniTouchData);

    for (var key in events) {
        if (events.hasOwnProperty(key)) {
            s.on(key, events[key]);
        }
    }

    s.on('disconnect', function () {
        if (minicap != null) {
            minicap.end();
        }

        if (minitouch != null) {
            minitouch.end();
        }
    });
};

