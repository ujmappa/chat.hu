HoloChat.server = {
    socket: null,
    buffer: [],
    connected: false,
    urls: null,
    currentUrl: 0,
    start: function (urls) {
        this.urls = Array.isArray(urls) ? urls : [urls];
        this.currentUrl = 0;
        this.connect();
    },
    connect: function () {
        try {
            var _this = this;
            this.socket = new WebSocket(this.urls[this.currentUrl]);
            this.socket.onopen = function (e) {
                _this.connected = true;
                HoloChat.onOpen(e);
            };
            this.socket.onclose = function (e) {
                HoloChat.onClose(e);
                if (!_this.connected) {
                    _this.currentUrl++;
                    if (_this.currentUrl < _this.urls.length) {
                        _this.connect();
                    }
                }
            };
            this.socket.onerror = function (e) {
                HoloChat.onError(e);
            };
            this.socket.onmessage = function (e) {
                var messages = JSON.parse(e.data);
                for (var i = 0; i < messages.length; i++) {
                    HoloChat.debug('HoloChat.server.receive', messages[i]);
                    HoloChat.server.buffer.push(messages[i]);
                }
                HoloChat.onMessage();
            }
        } catch (e) {
            console.log('ChatServer.connect:exception', e)
        }
    },
    send: function (action, data) {
        HoloChat.debug('HoloChat.server.send', { action: action, data: data });
        this.socket.send(JSON.stringify({ action: action, data: data }));
    }
};
