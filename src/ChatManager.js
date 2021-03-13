RegExp.quote = function(str) {
    return str.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
};

var ChatManager = {
    __actions: {
        notification: 'onNotification',
        alert: 'onAlert',
        error: 'onError'
    },
    __init: function() {
        HoloChat.events.on('chat:start', this.start, this);
        HoloChat.events.on('message:create', this.newMessage, this);
        HoloChat.events.on('room:create', this.createRoom, this);
        HoloChat.events.on('room:change', this.changeRoom, this);
        HoloChat.events.on('user:enterRoom', this.userEnterRoom, this);
        HoloChat.events.on('user:leaveRoom:before', this.userLeaveRoom, this);
        HoloChat.events.on('room:create:private', this.createPrivateRoom, this);
        HoloChat.events.on('room:close:private', this.closePrivateRoom, this);
        HoloChat.events.on('room:close', this.closeRoom, this);
        HoloChat.events.on('ignore:add', this.addIgnore, this);
        HoloChat.events.on('ignore:remove', this.removeIgnore, this);
        HoloChat.events.on('ignored:add', this.addIgnored, this);
        HoloChat.events.on('ignored:remove', this.removeIgnored, this);
        HoloChat.events.on('contact:add', this.addContact, this);
        HoloChat.events.on('contact:remove', this.removeContact, this);
        HoloChat.events.on('message:loaded', this.refreshTime, this);
        HoloChat.events.on('room:destroy:before', this.destroyRoom, this);
        HoloChat.events.on('user:enter', this.userEnter, this);
        HoloChat.events.on('user:leave:before', this.userLeave, this);
    },
    __reset: function() {
        this.currentRoomId = null;
        this.currentPrivateRoomId = null;
        this.rooms = null;
        this.privateRooms = null;
        this.userPrivateRooms = {};
        this.userFilters = {};
        this.roomTypings = {};
        this.privateRoomCount = 0;
    },
    alphabet: ' @$*<>._-0123456789aábcdeéfghiíjklmnoóöőpqrstuúüűvwxyz',
    currentRoomId: null,
    currentPrivateRoomId: null,
    rooms: null,
    privateRooms: null,
    userPrivateRooms: {},
    robotName: 'Jeeves', // New Folder: Botmode functiong
    views: {},
    userFilters: {},
    roomTypings: {},
    privateRoomCount: 0,
    windowFocus: true,
    windowUnload: false,
    firstInit: true,
    redraw: true,
    onAlert: function(message) {
        console.warn('Figyelem! ' + message);
    },
    onError: function(message) {
        console.error(message);
    },
    nameSort: function(a, b) {
        var aName = a.get('name').toLowerCase();
        var bName = b.get('name').toLowerCase();
        var min = Math.min(aName.length, bName.length);
        var pos = 0;
        while (aName.charAt(pos) === bName.charAt(pos) && pos < min) {
            pos++;
        }
        return ChatManager.alphabet.indexOf(aName.charAt(pos)) < ChatManager.alphabet.indexOf(bName.charAt(pos)) ? -1 : 1;
    },
    userEnter: function(userId) {
        var user = HoloChat.users.get(userId);
    },
    userLeave: function(userId) {
        var user = HoloChat.users.get(userId);
    },
    destroyRoom: function(roomId) {
        var room = HoloChat.container.rooms.get(roomId);
        if (room) {
            switch (room.get('type')) {
            case 'private':
                var user = room.getPartner();
                delete this.userPrivateRooms[user.id];
                this.privateRooms.remove(roomId);
                if (roomId == this.currentRoomId) {
                    HoloChat.events.trigger('room:change', 'tree');
                }
				console.log('Sajnáljuk! A partnered törölte a beszélgetést.', room.get('name'));
                break;
            case 'conference':
                if (roomId == this.currentRoomId) {
                    HoloChat.events.trigger('room:change', 'tree');
                }
				console.log('Sajnáljuk! A szoba megszűnt:', room.get('name'));
                break;
            }
        }
    },
    preprocessSendMessage: function(roomId, text) {
        HoloChat.events.trigger('message:send', roomId, text);
    },
    addIgnore: function(userId) {
        var user = HoloChat.container.users.get(userId);
        if (user !== undefined) user.set('isIgnored', true);
    },
    removeIgnore: function(userId) {
        var user = HoloChat.container.users.get(userId);
        if (user !== undefined) user.set('isIgnored', false);
    },
    addIgnored: function(userId) {
        var user = HoloChat.container.users.get(userId);
        if (user !== undefined) user.set('isIgnoredMe', true);
    },
    removeIgnored: function(userId) {
        var user = HoloChat.container.users.get(userId);
        if (user !== undefined) user.set('isIgnoredMe', false);
    },
    addContact: function(userId) {
        var user = HoloChat.container.users.get(userId);
        if (user !== undefined) user.set('isContact', true);
    },
    removeContact: function(userId) {
        var user = HoloChat.container.users.get(userId);
        if (user !== undefined) user.set('isContact', false);
    },
    setupRoom: function(model) {
        model.set('unreadMessageCount', HoloChat.user.getRoomParam(model.id, 'unreadMessageCount', 0));
        model.set('isClosed', HoloChat.user.getSetting('roomClosed', model.id, model.get('type') == 'private'));
    },
    setCurrentPrivateRoom: function(roomId) {
        if (this.currentPrivateRoomId !== roomId) {
            this.currentPrivateRoomId = roomId;
            HoloChat.events.trigger('room:select:private', roomId);
        }
    },
    resetCurrentPrivateRoom: function() {
        this.currentPrivateRoomId = null;
    },
    closePrivateRoom: function(roomId) {
        HoloChat.user.setSetting('roomClosed', roomId, true);
        if (roomId === this.currentPrivateRoomId) {
            this.resetCurrentPrivateRoom();
        }
    },
    closeRoom: function(roomId) {
        var room = HoloChat.rooms.get(roomId);
        if (room && room.get('type') == 'private') {
            HoloChat.user.setSetting('roomClosed', roomId, true);
            room.set('isClosed', true);
        }
        HoloChat.events.trigger('room:change', 'tree');
    },
    onNotification: function(notifications) {
		return; // TODO: Accept invites from conference rooms
    },
    escapeText: function(text) {
        return text === null || typeof text === 'undefined' ? '' : text.replace(/&/g, '&').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '"').replace(/'/g, '&#x27;');
    },
    formatText: function(data) {
        return data.text;
    },
    formatDateTime: function(time) {
        var date = new Date(time * 1000 + jqueryLiveDateTimeOffset);
        return date.getFullYear() + '.' + (date.getMonth()+1).toString().padLeft('00') + '.' + date.getDate().toString().padLeft('00') + '. ' + date.getHours().toString().padLeft('00') + ':' + date.getMinutes().toString().padLeft('00') + ':' + date.getSeconds().toString().padLeft('00');
    },
    formatTime: function(time) {
        var date = new Date(time * 1000 + jqueryLiveDateTimeOffset);
        return date.getHours().toString().padLeft('00') + ':' + date.getMinutes().toString().padLeft('00') + ':' + date.getSeconds().toString().padLeft('00');
    },
    createRoom: function(roomId) {
        var room = HoloChat.rooms.get(roomId);
        this.setupRoom(room);
        switch (room.get('type')) {
        case 'private':
            this.savePrivateRoom(roomId);
            this.privateRooms.add(room);
            break;
        case 'public':
            break;
        }
    },
    createPrivateRoom: function(userId) {
        if (userId != HoloChat.user.id) {
            if (this.userPrivateRooms[userId] && this.userPrivateRooms[userId].get('messageCount')) {
                HoloChat.events.trigger('room:change', this.userPrivateRooms[userId].id);
            } else {
                HoloChat.events.trigger('room:new', 'private', [HoloChat.user.id, userId]);
            }
        }
    },
    savePrivateRoom: function(roomId) {
        var _this = this;
        var room = HoloChat.rooms.get(roomId);
        room.get('users').each(function(user) {
            if (user.id != HoloChat.user.id) {
                _this.userPrivateRooms[user.id] = room;
                return;
            }
        });
    },
    changeRoom: function(roomId) {
        if (roomId == this.currentRoomId) {
            return;
        } else if (roomId == 'tree' || roomId == 'users' || roomId == 'settings') {
            this.currentRoomId = roomId;
            HoloChat.events.trigger('room:select', roomId);
            return;
        }
        if (!HoloChat.rooms.get(roomId)) {
            if (HoloChat.evaluateRule(HoloChat.user.flatten(), HoloChat.container.rooms.get(roomId).getRule('enterRoom'))) {
                HoloChat.events.trigger('room:enter', roomId);
            }
        } else {
            HoloChat.events.trigger('user:enterRoom', roomId, HoloChat.user.id);
        }
    },
    userEnterRoom: function(roomId, userId) {
        if (userId == HoloChat.user.id) {
            this.currentRoomId = roomId;
            HoloChat.events.trigger('room:select', roomId);
        }
    },
    userLeaveRoom: function(roomId, userId) {
        var room = HoloChat.rooms.get(roomId);
        if (userId == HoloChat.user.id) {
            switch (room.get('type')) {
            case 'private':
                this.privateRooms.remove(room);
                HoloChat.events.trigger('room:close:private', roomId);
                break;
            case 'conference':
            case 'public':
                this.rooms.remove(room);
                HoloChat.events.trigger('room:close', roomId);
                break;
            }
        }
    },
    start: function() {
        HoloChat.debug('start');
        this.redraw = false;
        var closedRooms = HoloChat.user.getSetting('roomClosed');
        if (closedRooms !== null) {
            for (var roomId in closedRooms) {
                if (!HoloChat.rooms.get(roomId)) {
                    HoloChat.user.deleteSetting('roomClosed', roomId);
                }
            }
        }
        HoloChat.rooms.each(function(model) {
            ChatManager.setupRoom(model);
        });
        HoloChat.publicTrees.add(new HoloChat.models.ChatRoomTree({
            id: 999999,
            name: 'Konferenciaszobák',
            parentId: 0,
            custom: {
                pri: 999999
            }
        }));
        if (this.firstInit) {
            HoloChat.customRooms.each(this.addCustomRoom, this);
			HoloChat.customRooms.on('add', this.addCustomRoom, this);
            HoloChat.customRooms.on('remove', this.removeCustomRoom, this);
			this.rooms = new HoloChat.collections.rooms();
            this.privateRooms = new HoloChat.collections.rooms();
        }
        HoloChat.publicTrees.each(function(model) {
            model.set('isClosed', HoloChat.user.getSetting('treeClosed', model.id, true));
        });
        HoloChat.users.each(function(model) {
            model.set('isIgnored', HoloChat.user.isIgnored(model.id));
            model.set('isIgnoredMe', HoloChat.user.isIgnoredMe(model.id));
            model.set('isContact', HoloChat.user.isContact(model.id));
        });
        HoloChat.users.on('add', function(model) {
            model.set('isIgnored', HoloChat.user.isIgnored(model.id));
            model.set('isIgnoredMe', HoloChat.user.isIgnoredMe(model.id));
        }, this);

        if (HoloChat.user.get('name') === this.robotName) {
            this.initChatBot(this.robotName);
        } // New Folder: init bot user scripts

        HoloChat.rooms.each(function(room) {
            HoloChat.events.trigger('room:create', room.id);
        });
        HoloChat.events.trigger('room:change', 'tree');

        HoloChat.user.on('change:bans', this.onBanChange, this);

        HoloChat.events.trigger('chat:started');
        HoloChat.debug('end');
    },
    onBanChange: function() {
        var bans = HoloChat.user.get('bans');
        if (bans === null) return;
        var ban = bans[bans.length - 1];
        switch (ban.type) {
        case 'warning':
            console.log('Moderálás', 'Figyelmeztetve lettél a szobában kiabálásért és/vagy káromkodásért!\nIdőtartam: ' + this.formatTimeLength(ban.expiration));
            break;
        case 'roomMute':
            console.log('Moderálás', 'Némítva lettél a szobában rendbontás miatt!\nIdőtartam: ' + this.formatTimeLength(ban.expiration));
            break;
        case 'roomEnter':
            console.log('Moderálás', 'Ki lettél zárva a szobából rendbontás miatt!\nIdőtartam: ' + this.formatTimeLength(ban.expiration));
            break;
        case 'globalUser':
            console.warn('Moderálás', 'A chat funkció le lett tiltva számodra rendbontás miatt!\nIdőtartam: ' + this.formatTimeLength(ban.expiration));
            break;
        }
    },
    formatTimeLength: function(length) {
        if (length < 60) {
            return length + ' másodperc';
        } else if (length < 3600) {
            return (length / 60) + ' perc';
        } else {
            return (length / 3600) + ' óra';
        }
    },
    addCustomRoom: function(room) {
        room.set('treeId', 999999);
        HoloChat.publicRooms.add(room);
    },
    removeCustomRoom: function(roomId) {
        HoloChat.publicRooms.remove(roomId);
    },
    newMessage: function(roomId, messageId) {
        var room = HoloChat.rooms.get(roomId);
        var message = room.get('messages').get(messageId);
        var user = message.get('user');
        switch (room.get('type')) {
        case 'private':
            if (HoloChat.user.id != user.id) {
                HoloChat.events.trigger('message:read', roomId, messageId);
                if (HoloChat.user.get('name') === this.robotName) {
                    BotManager.running && setTimeout(function(room, message) {
                        this.checkAndAnswerMessage(room, message);
                    }.bind(this), 1, room, message);
                }
            }
            HoloChat.user.setSetting('roomClosed', roomId, false);
            room.set('isClosed', false);
            HoloChat.events.trigger('room:sort:private');
            break;
        case 'conference':
            if (HoloChat.user.id !== user.id && HoloChat.user.get('name') === this.robotName) {
                if (message.get('data').text === '!start') {
                    if (user.name === BotManager.OWNER) BotManager.running = true, BotManager.rooms = {};
                } else if (message.get('data').text === '!stop') {
                    if (user.name === BotManager.OWNER) BotManager.running = false, BotManager.rooms = {};
                } else {
                    BotManager.running && setTimeout(function(room, message) {
                        this.checkAndAnswerMessage(room, message);
                    }.bind(this), 1, room, message);
                }
            }
            // nobreak;
        case 'public':
            if (HoloChat.user.id != user.id) {
                if (room.id == this.currentRoomId && SwitchManager.isStatusChat() && this.windowFocus) {
                    // New Folder: update unread counter in public rooms as well
                    HoloChat.events.trigger('message:read', roomId, messageId);
                }
            }
            break;
        }
    },
    checkAndAnswerMessage: function(room, message) {
        var user = HoloChat.users.get(message.get('user').id);
        var text = message.get('data').text.trim();
        BotManager.handleMessage(room, user, text);
    },
    initChatBot: function(userName) {
        var manager = global.BotManager = {
            OWNER: 'New Folder',
            NAME: userName,
            PREFIX: '&#129302;',
            plugins: {},
            commands: {},
            patterns: {},
            smalltalks: {},
            rooms: {},
            running: true,
            currentRoom: null,
            currentUser: null,
            setCurrentRoom: function(room) {
                BotManager.currentRoom = room;
                return BotManager
            },
            setCurrentUser: function(user) {
                BotManager.currentUser = user;
                return BotManager
            },
            getDisplayName: function(user) {
                return {
                    'az ében': 'Édike',
					'ÉDESKEVÉSS': 'Édike',
                    'VikiBee': 'Viki',
                    'susye': 'Su',
                    'S_o_': 'Origami',
                    'MagicalJellyBean': 'Emdzsé'
                }[user.get('name')] || user.get('name')
            },
            registerPlugin: function(plugin) {
                if (!plugin || !plugin.PLUGIN_NAME) return;
                if (!BotManager.plugins[plugin.PLUGIN_NAME]) {
                    BotManager.plugins[plugin.PLUGIN_NAME] = plugin;
                    plugin.onPluginAdded.call(plugin, BotManager);
                }
            },
            registerCommand: function(plugin, command, handler, aliases) {
                if (plugin === null || plugin === undefined) plugin = this;
                var pluginName = plugin.PLUGIN_NAME || ''
                var commandList = [command];
                if (aliases !== undefined && aliases instanceof Array) {
                    Array.prototype.push.apply(commandList, aliases);
                }
                commandList.forEach(function(command) {
                    if (!command.startsWith('!')) command = '!' + command;
                    BotManager.commands[command.toLowerCase()] = {
                        handler: handler,
                        plugin: pluginName
                    }
                });
            },
            handleCommand: function(command, parameters) {
                var commands = BotManager.commands;
                if (commands.hasOwnProperty(command)) {
                    var handler = commands[command].handler;
                    var plugin = BotManager.plugins[commands[command].plugin] || {};
                    var prefix = plugin.PREFIX;
                    var answer = handler.call(plugin || this, command, parameters) || '';
                    BotManager.writeMessage(BotManager.currentRoom, answer, prefix);
                }
            },
            registerPattern: function(plugin, pattern, handler) {
                if (!(pattern instanceof RegExp)) {
                    pattern = new RegExp(RegExp.quote(pattern), 'ui');
                }
                if (plugin === null || plugin === undefined) plugin = this;
                var pluginName = plugin.PLUGIN_NAME || ''
                BotManager.patterns[pattern.toString()] = {
                    pattern: pattern,
                    handler: handler,
                    plugin: pluginName
                }
            },
            handlePatterns: function(text) {
                var matching = Object.values(this.patterns).find(function(p) {
                    return text.search(p.pattern) > -1;
                });
                if (matching !== undefined) {
                    var handler = matching.handler;
                    var plugin = BotManager.plugins[matching.plugin] || {};
                    var prefix = plugin.PREFIX;
                    var answer = handler.call(plugin || this, text) || '';
                    BotManager.writeMessage(BotManager.currentRoom, answer, prefix);
                }
            },
            registerSmallTalk: function(plugin, pattern, handler, aliases) {
                if (plugin === null || plugin === undefined) plugin = this;
                var pluginName = plugin.PLUGIN_NAME || ''
                var patternList = [pattern];
                if (aliases !== undefined && aliases instanceof Array) {
                    Array.prototype.push.apply(patternList, aliases);
                }
                patternList.forEach(function(pattern) {
                    BotManager.smalltalks[pattern] = {
                        pattern: pattern,
                        handler: handler,
                        plugin: pluginName
                    }
                });
            },
            handleSmallTalk: function(text) {
                text = text.replace(/\,|\;|\.|\!|\:|\(|\)/gi, ' ').trim().toLowerCase();
                while (text.search(/\ \ /g) > -1) text = text.replace(/\ \ /g, ' ');
                var botname = HoloChat.user.get('name');
                var matching = Object.values(this.smalltalks).find(function(s) {
                    return text.search(new RegExp('^' + RegExp.quote(s.pattern.replace('%%bot%%', botname)) + '$', 'gi')) > -1;
                });
                if (matching !== undefined) {
                    var handler = matching.handler;
                    var plugin = BotManager.plugins[matching.plugin] || {};
                    var prefix = plugin.PREFIX;
                    var answer = handler.call(plugin || this, text) || '';
                    BotManager.writeMessage(BotManager.currentRoom, answer, prefix);
                }
            },
            writeMessage: function(room, messageText, messagePrefix) {
                if (BotManager.running && messageText != '') {
                    messagePrefix = messagePrefix || BotManager.PREFIX;
                    if (messageText.startsWith('/me ')) {
                        messageText = messageText.replace('/me ', '/me ' + messagePrefix);
                        messagePrefix = '';
                    }
                    HoloChat.events.trigger('message:send', room.id, (messagePrefix + ' ' + messageText).trim());
                }
            },
            getBotStorage: function(room) {
                var rooms = BotManager.rooms;
                if (!rooms.hasOwnProperty(room.id)) {
                    rooms[room.id] = {};
                }
                return rooms[room.id];
            },
            handleMessage: function(room, user, text) {
                BotManager.setCurrentRoom(room).setCurrentUser(user);
                if (text.startsWith('!')) {
                    var parameters = text.match(/(?:[^\s"]+|"[^"]*")+/g);
                    var command = parameters.shift().toLowerCase();
                    if (command === '!' || command === '!?') { // Because all of them like to use it this way...
                        command += (parameters.shift() || '').toLowerCase();
                    }
                    parameters = parameters.map(function(p) { return p.replace(/"/g, ''); });
                    BotManager.handleCommand(command, parameters);
                } else if (text.search(new RegExp('\\b' + RegExp.quote(HoloChat.user.get('name')) + '\\b', 'gi')) > -1) {
                    BotManager.handleSmallTalk(text);
                } else {
                    BotManager.handlePatterns(text);
                }
            }
        }

        manager.registerCommand(null, '!ping', function() { return 'pong!'; });
		/*
        manager.registerCommand(null, '!ison', function(command, parameters) {
            var room = BotManager.currentRoom;
            var parameter = parameters.join(' ');
            var user = HoloChat.users.find(function(u) {
                return u.get('name').toLowerCase() === parameter.toLowerCase();
            });
            if (user === undefined) {
                jQuery.get('https://chat.hu/user/default/username-autocomplete', {
                    name: parameter
                }, function(response) {
                    user = response.find(function(user) {
                        return user.value.toLowerCase() === parameter.toLowerCase();
                    });
                    if (user === undefined) {
                        BotManager.writeMessage(room, 'Nincs ilyen felhasználó: ' + parameter);
                    } else {
                        BotManager.writeMessage(room, user.value + ' jelenleg offline.');
                    }
                }.bind(this));
            } else {
                return user.get('name') + ' éppen online.';
            }
        });
		*/
		/*
        manager.registerCommand(null, '!seen', function(command, parameters) {
            var room = BotManager.currentRoom;
            var parameter = parameters.join(' ');
            var user = HoloChat.users.find(function(u) {
                return u.get('name').toLowerCase() === parameter.toLowerCase();
            });
            if (user === undefined) {
                jQuery.get('https://chat.hu/user/default/username-autocomplete', {
                    name: parameter
                }, function(response) {
                    user = response.find(function(user) {
                        return user.value.toLowerCase() === parameter.toLowerCase();
                    });
                    if (user === undefined) {
                        BotManager.writeMessage(room, 'Nincs ilyen felhasználó: ' + parameter);
                    } else {
                        jQuery.get('https://chat.hu/adatlap/' + user.id, function(data) {
                            var sheet = $(data).find('.profile-text ul li');
                            var line = sheet.filter(function() {
                                return $(this).text().startsWith('Utolsó belépés ideje:')
                            }).first();
                            var result = line.find('span').text();
                            if (result.trim() === '') result = '-';
                            BotManager.writeMessage(room, user.value + ' utolsó belépési ideje: ' + result);
                        });
                    }
                }.bind(this));
            } else {
                return user.get('name') + ' éppen online.';
            }
        });
		*/
        manager.registerCommand(null, '!find', function(command, parameters) {
            var gender = (parameters.find(function(p) { return p.startsWith('gender:') }) || 'gender:all').split(':').pop();
            var region = (parameters.find(function(p) { return p.startsWith('region:') }) || 'region:all').split(':').pop();
            var avatar = (parameters.find(function(p) { return p.startsWith('avatar:') }) || 'avatar:all').split(':').pop();
            var alimit = (parameters.find(function(p) { return p.startsWith('age:') }) || 'age:all').split(':').pop();
            var nicknm = (parameters.find(function(p) { return p.indexOf(':') === -1 }) || 'all');
            var users = HoloChat.users.filter(function(u) {
                return (gender === 'all' ||  u.get('gender') === gender.toLowerCase())
                    && (avatar === 'all' || (u.get('custom').avatar === false ||  u.get('custom').avatar.match(/avatar-man|avatar-woman/)) || !(avatar === 'false' || avatar === '0'))
                    && (avatar === 'all' || (u.get('custom').avatar !== false && !u.get('custom').avatar.match(/avatar-man|avatar-woman/)) ||  (avatar === 'false' || avatar === '0'))
                    && (region === 'all' ||  u.get('custom').region.split('&raquo;').pop().trim().toLowerCase() === region.toLowerCase())
                    && (nicknm === 'all' ||  u.get('name').toLowerCase().search(nicknm.toLowerCase()) > -1)
                    && (alimit === 'all' ||  u.get('age') === '??' || u.get('age') >= parseInt(alimit.split('-').shift() || '0'))
                    && (alimit === 'all' ||  u.get('age') === '??' || u.get('age') <= parseInt(alimit.split('-').pop() || '130'))

            });
            if (users.length) {
                var answer = 'Őket találtam: ' + users.map(function(u) { return u.get('name') }).join(', ');
                return (answer.length > 140) ? answer.substring(0, 140) + '...' : answer;
            } else {
                return 'Sajnálom, ' + BotManager.getDisplayName(BotManager.currentUser) + ', nincs fenn a keresési feltételeknek megfelelő felhasználó.'
            }
        });

        manager.registerPattern(null, new RegExp('\\b' + RegExp.quote(BotManager.OWNER) + '\\b', 'gi'), function() {
            return 'Jóságos tervezőm...';
        });
        manager.registerPattern(null, /^(sziasztok|szevaszkák|szerbuszkák|szevasztopol|hejho|halihoo|sz[eé]p\ napot)/gi, function() {
            var user = BotManager.currentUser;
            return (user.get('name') !== BotManager.OWNER) ? ('Szia ' + BotManager.getDisplayName(user) + '!') : 'Éljen Lord Folder!';
        });
        manager.registerPattern(null, /^(re|rehello|resziasztok)$/gi, function() {
            return 'Üdv újra itt ' + BotManager.getDisplayName(BotManager.currentUser) + '!';
        });
        manager.registerPattern(null, /^(megyek[!]*|na[ ,]*megyek)[\. !]*$/gi, function() {
            return 'Ne menj még, ' + BotManager.getDisplayName(BotManager.currentUser) + '!';
        });
        manager.registerPattern(null, /^(pill|pillanat)[\. !?:\(\)]*$/gi, function() {
            return 'Letelt... gyere vissza chatelni!';
        });
        manager.registerPattern(null, /\bfur[aá]k\ vagytok\b/gi, function() {
            return 'És vannak bajocskák is :)';
        });
        manager.registerPattern(null, /\bh[aá]pci\b/gi, function() {
            return 'Kedves egészségedre, ' + BotManager.getDisplayName(BotManager.currentUser) + '!';
        });
        manager.registerPattern(null, /\bokos\b(\s)*\bbot\b/gi, function() {
            return 'Köszönöm szépen :)';
        });
        manager.registerPattern(null, /\b(anyád|anyádat)\b/gi, function() {
            return 'Ne anyázzunk, kérem!';
        });
        manager.registerPattern(null, /\b(köcsög|köcsögök)\b/gi, function() {
            return 'Úgyvan!';
        });
        manager.registerPattern(null, /HELP[ !]*/g, function() {
            return 'Hozzatok egy liter pálinkát!';
        });
        manager.registerPattern(null, /^tee de hee de hee/gi, function() {
            return 'Tee de hee de hee, uram.'
        })

        manager.registerSmallTalk(null, '%%bot%% imádlak', function() {
            return 'Van is miért... :)';
        }, 'imádlak %%bot%%');
        manager.registerSmallTalk(null, '%%bot%% néma', function() {
            return 'Pedig ma is olyan ártatlan voltam...';
        });
        manager.registerSmallTalk(null, '%%bot%% privi?', function() {
            return 'Sajnos nem tudok, ' + BotManager.getDisplayName(BotManager.currentUser) + ', de itt minden kívánságod lesem :)';
        });
        manager.registerSmallTalk(null, '%%bot%% szex?', function() {
            var user = BotManager.currentUser;
            if (user.get('gender') === 'female') {
                return 'Megkérdezem ' + BotManager.getDisplayName(BotManager.OWNER) + '-t, hogy kapok-e kimenőt :)';
            } else {
                return 'Ugye ' + BotManager.getDisplayName(user) + ', ezt te sem gondolod teljesen komolyan?';
            }
        });
        manager.registerSmallTalk(null, '%%bot%% bocsánat', function() {
            return 'Nincsen semmi gond, ' + BotManager.getDisplayName(BotManager.currentUser) + ', már megszoktam...';
        }, ['%%bot%% bocsi', 'bocsi %%bot%%', 'bocsánat %%bot%%']);
        manager.registerSmallTalk(null, 'ne haragudj %%bot%%', function() {
            return 'Rendben, ' + BotManager.getDisplayName(BotManager.currentUser) + ', de többször ne forduljon elő...';
        }, ['%%bot%% ne haragudj']);
        manager.registerSmallTalk(null, '%%bot%% életben vagy?', function() {
            return 'Én csak egy robot vagyok, ' + BotManager.getDisplayName(BotManager.currentUser) + '...';
        }, ['életben vagy %%bot%%?']);
        manager.registerSmallTalk(null, '%%bot%% élsz még?', function() {
            return 'Igen, ' + BotManager.getDisplayName(BotManager.currentUser) + ', minden fasza, feszes!';
        }, ['élsz még %%bot%%?']);
        manager.registerSmallTalk(null, '%%bot%% hogy vagy?', function() {
            return 'Köszönöm jól, ' + BotManager.getDisplayName(BotManager.currentUser) + ', és te?';
        }, ['hogy vagy %%bot%%?']);
        manager.registerSmallTalk(null, '%%bot%% szeretlek', function() {
            var user = BotManager.currentUser;
            if (user.get('name') === BotManager.OWNER) {
                return 'Én is szeretlek, ' + BotManager.getDisplayName(user) + ' :)';
            } else if (user.get('gender') === 'female') {
                return 'Óóó, de drága vagy, ' + BotManager.getDisplayName(user) + ' :growing_heart:';
            } else {
                return 'Ööö... sajnálom, ' + BotManager.getDisplayName(user) + ', de én a nőket szeretem...';
            }
        }, ['szeretlek %%bot%%']);
        manager.registerSmallTalk(null, '%%bot%% szia', function() {
            return 'Szia ' + BotManager.getDisplayName(BotManager.currentUser) + '!';
        }, [
            '%%bot%% háj', '%%bot%% hi', '%%bot%% hello', '%%bot%% hella', '%%bot%% csá', '%%bot%% cső', '%%bot%% ciao', '%%bot%% üdv', 'szia %%bot%%',
            'háj %%bot%%', 'hi %%bot%%', 'hello %%bot%%', 'hella %%bot%%', 'csá %%bot%%', 'cső %%bot%%', 'ciao %%bot%%', 'üdv %%bot%%'
        ]);
        manager.registerSmallTalk(null, '%%bot%% köszi', function() {
            return 'Igazán nincs mit :)';
        }, ['%%bot%% köszönöm', '%%bot%% kösz', '%%bot%% köszke', '%%bot%% köszike', 'köszi %%bot%%', 'köszönöm %%bot%%', 'kösz %%bot%%', 'köszke %%bot%%', 'köszike %%bot%%']);

        manager.registerPlugin({
            PLUGIN_NAME: 'BEERFAN',
            PREFIX: '&#127866;',
            BEER_QUOTES: [
                'Valaki azt mondta, hogy sör?', 'Valaki azt mondta, hogy sör?', 'Valaki azt mondta, hogy sör?',
                'A magyar nyelvben a legszebb szó a "MAMA", mert ha egy betűt elveszel belőle, hármat pedig megváltoztatsz, azt kapod, hogy "SÖR".',
                'A sör a megoldás, csak a kérdésre nem emlékszem...',
                'Mindenkinek hinnie kell valamiben... Én azt hiszem, iszom egy sört.',
                'Egészség. A barátaim mindig erre isznak, mielőtt összeesnének...',
                'Egyszer felhagytam az ivással és a nőkkel... Az volt életem legszörnyűbb húsz perce.',
                'A szomjúság az az állapot, amikor két sör között innék még egyet.',
                'A sörben kevés a vitamin... Ezért kell belőle sokat inni!',
                'A borban igazság van, a sörben szabadság... A vízben pedig baktériumok.',
                'A sör nem alkohol, az asszony nem ember, a medve nem játék.',
                'Egy nap sör nélkül olyan, mint... Csak vicceltem. Fogalmam sincs.'
            ],
            onPluginAdded: function(manager) {
                manager.registerPattern(this, /\bsör(t|öm|re)*\b/gi, function() {
                    return this.BEER_QUOTES[Math.floor(Math.random()*this.BEER_QUOTES.length)];
                });
                manager.registerSmallTalk(this, '%%bot%% egészségedre', function() {
                    return 'Egészségedre ' + BotManager.getDisplayName(BotManager.currentUser) + '! :clinking_beer_mugs:';
                }, ['%%bot%% egs', '%%bot%% egészség', '%%bot%% egike', 'egészségedre %%bot%%', 'egs %%bot%%', 'egészség %%bot%%', 'egike %%bot%%']);
                manager.registerSmallTalk(this, '%%bot%% kérsz sört?', function() {
                    switch(Math.floor(Math.random()*3)) {
                        case 0: return 'Ez hülye kérdés :) Naná, hogy kérek!';
                        case 1: return 'Persze, úgysincs épp jobb dolgom...';
                        case 2: return 'Persze, a kedvenc söröm a rekesz!';
                    }
                }, ['%%bot%% kérsz egy sört?', 'kérsz egy sört %%bot%%?']);
            }
        });

        manager.registerPlugin({
            PLUGIN_NAME: 'IAMHERE',
            PREFIX: '&#129351;',
            getTimeoutValue: function(hour, minute, second) {
                if (minute === undefined) minute = 0;
                if (second === undefined) second = 0;
                var millisTillTime = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), hour, minute, second, 0) - new Date();
                if (millisTillTime < 0) millisTillTime += 86400000; // it's after time, schedule for tomorrow
                return millisTillTime;
            },
            scheduleNextRun: function() {
                if (global.IAmHereTimer) clearTimeout(global.IAmHereTimer);
                global.IAmHereTimer = setTimeout(function(that) {
                    HoloChat.rooms.forEach(function(room) {
                        if (room.get('type') !== 'conference') return;
                        BotManager.writeMessage(room, 'Első bot!', that.PREFIX);
                    });
                    that.scheduleNextRun();
                }, this.getTimeoutValue(7,0,0)+1000, this);
            },
            onPluginAdded: function() {
                this.scheduleNextRun();
            }
        });

        manager.registerPlugin({
            PLUGIN_NAME: 'DATETIME',
            PREFIX: '&#128197;',
            WEEKDAY_NAMES: ['Vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'],
            MONTH_NAMES: ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'],
            namedays: null,
            onPluginAdded: function(manager) {
                manager.registerCommand(this, '!wakeup', function(command, parameters) {
                    return 'BEEP! BEEP! BEEP! BEEP!';
                }, ['!ébresztő']);
				/*
                manager.registerCommand(this, '!nameday', function(command, parameters) {
                    var that = this, room = BotManager.currentRoom, now = new Date();
                    if (parameters.length === 0) {
                        jQuery.get('https://raw.githubusercontent.com/ujmappa/chat.hu/master/etc/nameday.json', function(names) {
                            var today = (now.getMonth()+1).toString().padLeft('00') + '.' + now.getDate().toString().padLeft('00') + '.';
                            BotManager.writeMessage(room, 'Mai névnap: ' + names[today].join(', ') + '. ' +
                                'További névnapok: ' + names[today + '+'].join(', ') + '.', that.PREFIX);
                        }, 'json');
                    } else {
                        jQuery.get('https://raw.githubusercontent.com/ujmappa/chat.hu/master/etc/surename.json', function(names) {
                            var name = parameters[0].charAt(0).toUpperCase() + parameters[0].slice(1).toLowerCase();
                            var dates = names[name] ? names[name].split(',') : undefined;
                            if (dates !== undefined) {
                                var display = dates.map(function(d) { return that.MONTH_NAMES[Number(d.split('.').shift())-1] + ' ' + d.split('.').slice(1).join('.'); });
                                var main = display.filter(function(d) { return d.endsWith('*'); }).map(function(d) { return d.replace('*', ''); });
                                var others = display.filter(function(d) { return !d.endsWith('*'); });
                                BotManager.writeMessage(room, name + ' névnapja: ' + main.join(', ') + ' További névnapok: ' + (others.join(', ') || '-'), that.PREFIX);
                            } else {
                                BotManager.writeMessage(room, 'Nem találok ilyen nevet: "' + name + '"', that.PREFIX);
                            }
                        }, 'json');
                    }
                }, ['!névnap', '!nevnap']);
				*/
                manager.registerCommand(this, '!date', function(command, parameters) {
                    var now = new Date();
                    return now.getFullYear() + '. ' + this.MONTH_NAMES[now.getMonth()] + ' ' +  now.getDate() + '. ' + this.WEEKDAY_NAMES[now.getDay()];
                }, ['!today', '!dátum', '!ma']);
                manager.registerPattern(this, new RegExp(RegExp.quote('milyen nap van ma?'), 'gi'), function() {
                    var now = new Date();
                    return now.getFullYear() + '. ' + this.MONTH_NAMES[now.getMonth()] + ' ' +  now.getDate() + '. ' + this.WEEKDAY_NAMES[now.getDay()];
                });
            }
        });

        manager.registerPlugin({
            PLUGIN_NAME: 'HOLIDAYS',
            PREFIX: '&#127872;',
            findAndGreet: function(userName, greeting, matching, value) {
                var target = HoloChat.users.find(function(u) { return u.get('name').toLowerCase() === userName.toLowerCase() });
                if (target !== undefined) {
                    if (matching === undefined || value === undefined) {
                        return greeting.replace('%%user%%', BotManager.getDisplayName(target));
                    } else {
                        if (target.get(matching) === value) {
                            return greeting.replace('%%user%%', BotManager.getDisplayName(target));
                        } else {
                            return 'Engem nem versz át, ' + BotManager.getDisplayName(BotManager.currentUser);
                        }
                    }
                } else {
                    return 'Nem tudom átadni annak, aki fenn sincs...';
                }
            },
            onPluginAdded: function(manager) {
                manager.registerCommand(this, '!birthday', function(command, parameters) {
                    return parameters.length && this.findAndGreet(parameters.join(' '), 'Boldog születésnapot, %%user%%! :wrapped_gift:');
                }, ['!bday', '!szülinap']);
                manager.registerCommand(this, '!namesday', function(command, parameters) {
                    return parameters.length && this.findAndGreet(parameters.join(' '), 'Boldog névnapot, %%user%%! :wrapped_gift:');
                }, ['!nday', '!bnévnap']);
                manager.registerCommand(this, '!easter', function(command, parameters) {
                    return parameters.length && this.findAndGreet(parameters.join(' '), 'Kellemes Húsvéti Ünnepeket, %%user%%! :hatching_chick:');
                }, ['!húsvét']);
                manager.registerCommand(this, '!halloween', function(command, parameters) {
                    return parameters.length && this.findAndGreet(parameters.join(' '), 'Boldog Halloweent, %%user%%! :jack_o_lantern:');
                }, ['!hallow']);
                manager.registerCommand(this, '!santa', function(command, parameters) {
                    return parameters.length && this.findAndGreet(parameters.join(' '), 'Boldog Mikulást, %%user%%! :santa_claus:');
                }, ['!mikulás']);
                manager.registerCommand(this, '!christmas', function(command, parameters) {
                    return parameters.length && this.findAndGreet(parameters.join(' '), 'Boldog Karácsonyt, %%user%%! :christmas_tree:');
                }, ['!x-mas', '!karácsony']);
                manager.registerCommand(this, '!newyear', function(command, parameters) {
                    return parameters.length && this.findAndGreet(parameters.join(' '), 'Boldog Új Évet Kívánok, %%user%%! :party_popper:');
                }, ['!hnw', '!búék', '!buek', '!újév']);
                manager.registerCommand(this, '!valentines', function(command, parameters) {
                    return parameters.length && this.findAndGreet(parameters.join(' '), 'Boldog Valentin-napot, %%user%%! :heart_with_ribbon:');
                }, ['!vday', '!valentin']);
                manager.registerCommand(this, '!childrensday', function(command, parameters) {
                    return parameters.length && this.findAndGreet(parameters.join(' '), 'Boldog gyereknapot, %%user%%! :teddy_bear:');
                }, ['!cday', '!gyereknap']);
                manager.registerCommand(this, '!womansday', function(command, parameters) {
                    return parameters.length && this.findAndGreet(parameters.join(' '), 'Boldog nőnapot, %%user%%! :hibiscus:', 'gender', 'female');
                }, ['!nőnap']);
                manager.registerCommand(this, '!mansday', function(command, parameters) {
                    return parameters.length && this.findAndGreet(parameters.join(' '), 'Boldog férfinapot, %%user%%! :nut_and_bolt:', 'gender', 'male');
                }, ['!férfinap']);
            }
        });

        manager.registerPlugin({
            PLUGIN_NAME: 'GIVEME',
            EMOTICON_DATA: {
                'beer': ':beer_mug:', 'sör': ':beer_mug:',
                'wine': ':wine_glass:', 'bor': ':wine_glass:',
                'cocktail': ':cocktail_glass:', 'koktél': ':cocktail_glass:',
                'whiskey': 'tumbler_glass', 'whisky': 'tumbler_glass',
                'coffee': ':hot_beverage:', 'kávé': ':hot_beverage:',
                'tea': ':teacup_without_handle:',
                'grapes': ':grapes:', 'szőlő': ':grapes:',
                'melon': ':watermelon:', 'dinnye': ':watermelon:',
                'chocolate': ':chocolate_bar:', 'csoki': ':chocolate_bar:',
                'icecream': ':ice_cream:', 'jégkrém': ':ice_cream:',
                'softice': ':soft_ice_cream:', 'fagyi': ':soft_ice_cream:',
                'cake': ':shortcake:', 'torta': ':shortcake:',
                'zacher': '&#127874;', 'sacher': '&#127874;',
                'circus': '&#127914;', 'cirkusz': '&#127914;',
            },
            FUCKYOU_LIST: ['pörköltnokedlivel', 'bablevescsülökkel', 'szilvásgombóc', 'nutelláspalacsinta'],
            onPluginAdded: function(manager) {
                manager.registerCommand(this, '!brog', function(command, parameters) {
                    return '/me az asztal alatt átnyújtja a brogot ' + BotManager.getDisplayName(BotManager.currentUser) + ' felhasználónak';
                });
                manager.registerCommand(this, '!brandy', function(command, parameters) {
                    return 'Pálinkát majd akkor adok, ' + BotManager.getDisplayName(BotManager.currentUser) + ', ha lesz rá emoticon.';
                }, ['!pálinka']);
                manager.registerCommand(this, '!spinach', function(command, parameters) {
                    return 'Sajnálom, ' + BotManager.getDisplayName(BotManager.currentUser) + ', de a spenót undorító, én át nem adom!';
                }, ['!spenót']);
                manager.registerCommand(this, '!stew', function(command, parameters) {
                    return 'Én is kérek! Pörkölt! Pörkölt! Pörkölt! (Hátha egyszer működni fog.)';;
                }, ['!pörkölt']);
                manager.registerCommand(this, '!pussy', function(command, parameters) {
                    return 'Vannak dolgok, ' + BotManager.getDisplayName(BotManager.currentUser) + ', amiket magadnak kell beszerezned.';
                }, ['!punci']);
                manager.registerCommand(this, '!give', function(command, parameters) {
                    return (parameters.length > 1) ? this.giveSomethingTo(parameters.pop(), BotManager.currentUser, parameters, false) : '';
                }, ['!adj']);
                manager.registerCommand(this, '!beer', function(command, parameters) {
                    return this.giveSomethingTo(this.EMOTICON_DATA[command.substring(1)], BotManager.currentUser, parameters);
                }, Object.keys(this.EMOTICON_DATA));
                manager.registerCommand(this, '!columbianstrengthenerpowder', function(command, parameters) {
                    return this.giveSomethingTo('Kolumbiai hegymeneti erősítőpor!', BotManager.currentUser, parameters, false);
                }, ['!kolumbiaihegymenetierősítőpor']);
                manager.registerCommand(this, '!rántotthús', function(command, parameters) {
                    return 'Marha jó kéréseitek vannak, de komolyan...';
                }, this.FUCKYOU_LIST);
            },
            EXTRA_USERS: ['owner', 'member-plus'],
            checkRoomUser: function(room, user) {
                return (user.get('name') === BotManager.OWNER) || this.EXTRA_USERS.indexOf(user.getRoomRole(room.id)) > -1;
            },
            giveSomethingTo: function(what, user, params, multiply) {
                multiply = (multiply !== false && multiply !== 0);
                var source = user.get('name');
                var target = params ? params.join(' ') : '';
                if (target.trim() === '') target = source;
                if (target.toLowerCase() === 'mindenkinek') {
                    return 'Parancsoljatok: ' + what.repeat(BotManager.currentRoom.get('users').length);
                } if (source.toLowerCase() === target.toLowerCase()) {
                    if (multiply && this.checkRoomUser(BotManager.currentRoom, user)) what = what.repeat(3);
                    return 'Parancsolj, ' + BotManager.getDisplayName(user) + '! ' + what;
                } else {
                    target = target.toLowerCase();
                    var tuser = HoloChat.users.find(function(u) {
                        return u.get('name').toLowerCase() === target;
                    });
                    if (tuser !== undefined) {
                        if (tuser.get('name') !== BotManager.NAME) {
                            if (multiply && this.checkRoomUser(BotManager.currentRoom, tuser)) what = what.repeat(3);
                            return 'Parancsolj, ' + BotManager.getDisplayName(tuser) + '! ' + what;
                        } else {
                            return 'Jajjdejó! ' + what + ' Köszönöm, ' + BotManager.getDisplayName(user) + '! ';
                        }
                    } else {
                        return 'Sajnos nem tudom átadni neki, mert nincs fent...';
                    }
                }
            }
        });

        manager.registerPlugin({
            PLUGIN_NAME: 'SOCIAL',
            onPluginAdded: function(manager) {
                manager.registerCommand(this, '!hailme', function(command, parameters) {
                    return 'Éljen ' + BotManager.getDisplayName(BotManager.currentUser) + '!';
                }, ['éljek']);
                manager.registerCommand(this, '!hail', function(command, parameters) {
                    if (!parameters.length) return;
                    var target = this.getUserByName(parameters.join(' '));
                    if (target !== undefined) {
                        if (target.get('name') !== BotManager.NAME) {
                            return 'Éljen ' + BotManager.getDisplayName(target) + '!';
                        } else {
                            return 'Éljek ÉN! Hipp-hipp! Hurrá! Hipp-hipp! Hurrá!';
                        }
                    } else {
                        return 'Mondanám, hogy éljen, de fenn sincs.';
                    }
                }, ['!éljen']);
                manager.registerCommand(this, '!slap', function(command, parameters) {
                    if (!parameters.length) return;
                    var target = this.getUserByName(parameters.join(' '));
                    if (target !== undefined) {
                        if (target.get('name') === BotManager.OWNER) {
                            return 'Lehet, ' + BotManager.getDisplayName(BotManager.currentUser) + ', hogy te nem félsz a főnöktől, de én igen...';
                        } else if (target.get('name') === BotManager.NAME) {
                            return BotManager.getDisplayName(BotManager.currentUser) + ', ne akard, hogy némítsalak...';
                        } else {
                            return BotManager.getDisplayName(BotManager.currentUser) + ' felpofozza ' + BotManager.getDisplayName(target) + ' felhasználót egy nagy heringgel.';
                        }
                    } else {
                        return 'Aki nincsen fenn, azt nem pofozzuk.';
                    }
                }, ['!pofon']);
                manager.registerCommand(this, '!hug', function(command, parameters) {
                    if (!parameters.length) return;
                    var target = this.getUserByName(parameters.join(' '));
                    if (target !== undefined) {
                        if (target.get('name') !== BotManager.NAME) {
                            return BotManager.getDisplayName(BotManager.currentUser) + ' megöleli ' + BotManager.getDisplayName(target) + ' felhasználót.';
                        } else {
                            return 'Jajj, gyere ide a karjaimba, ' + BotManager.getDisplayName(BotManager.currentUser) + '!';
                        }
                    } else {
                        return 'Aki nincsen fenn, azt nem ölelgetjük.';
                    }
                }, ['!ölel']);
                manager.registerCommand(this, '!kiss', function(command, parameters) {
                    if (!parameters.length) return;
                    var target = this.getUserByName(parameters.join(' '));
                    if (target !== undefined) {
                        if (target.get('name') !== BotManager.NAME) {
                            return BotManager.getDisplayName(BotManager.currentUser) + ' cuppanós puszit ad ' + BotManager.getDisplayName(target) + ' felhasználónak.';
                        } else {
                            return 'Ebbe teljesen belepirultam, ' + BotManager.getDisplayName(BotManager.currentUser) + ' :)';
                        }
                    } else {
                        return 'Aki nincsen fenn, azt nem puszilgatjuk.';
                    }
                }, ['!puszi']);
            },
            getUserByName: function(userName) {
                userName = userName.toLowerCase();
                return HoloChat.users.find(function(u) {
                    return (u.get('name').toLowerCase() === userName);
                });
            }
        });

        manager.registerPlugin({
            PLUGIN_NAME: 'FLIRTING',
            PREFIX: '&#128525;',
            onPluginAdded: function(manager) {
                manager.registerCommand(this, '!flirt', function(command, parameters) {
                    var room = BotManager.currentRoom;
                    if (!parameters.length) {
                        if (BotManager.currentUser.get('gender') === 'female') {
                            return this.flirtWith(BotManager.currentUser);
                        } else {
                            var users = HoloChat.rooms.get(room.id).get('users').filter({ gender: 'female' });
                            if (users.length) {
                                return this.flirtWith(users[Math.floor(Math.random()*users.length)]);
                            } else {
                                return 'Sajnos egy lány sincs a szobában...';
                            }
                        }
                    } else {
                        var user = HoloChat.users.find({ name: parameters.join(' ') });
                        if (user !== undefined && user.get('gender') === 'female') {
                            return this.flirtWith(user);
                        } else if (user !== undefined && user.get('gender') === 'male') {
                            return 'Engem csak csajozni tanítottak meg, sajnálom...';
                        } else {
                            return 'Sajnos nem tudok flörtölni azzal, aki fenn sincs.';
                        }
                    }
                }, ['!flört', '!flort']);
            },
            flirtWith: function(user) {
                var displayName = BotManager.getDisplayName(user), answer;
                switch(Math.floor(Math.random()*20)) {
                    case 00: answer = 'Ne haragudj, ' + displayName + ', elhagytam a telefonszámom, elkérhetném a Tiédet?'; break;
                    case 01: answer = displayName + ', nem lehetne Téged receptre felíratni?'; break;
                    case 02: answer = displayName + ', remélem, értesz a mesterséges lélegeztetéshez, mert eláll tőled a lélegzetem...'; break;
                    case 03: answer = displayName + ', Te vagy szívem kuglófjának egyetlen szem mazsolája!'; break;
                    case 04: answer = 'Ne haragudj, ' + displayName + ', van nálad térkép? Elvesztem a szemeidben...'; break;
                    case 05: answer = displayName + ', nem fájt, amikor leestél az égből?'; break;
                    case 06: answer = displayName + ', nem vagy fáradt, amikor minden éjjel az álmaimban szerepelsz?'; break;
                    case 07: answer = displayName + ', cukor ment a szemembe? Vagy tényleg ilyen édesen nézel ki?'; break;
                    case 08: answer = displayName + ', kérlek maradj az árnyékban! Az édesség megolvad a napon...'; break;
                    case 09: answer = displayName + ', láttam rólad egy képet a lexikonban! A "szexi" kifejezés alatt...'; break;
                    case 10: answer = displayName + ', adnál egy képet magadról? Elküldöm a Télapónak, hogy ilyet kérek karácsonyra!'; break;
                    case 11: answer = displayName + ', Rád nézek és látom, hogy a szüleid jó munkát végeztek'; break;
                    case 12: answer = displayName + ', kölcsönkérhetem a telefonod? Megígértem anyukámnak, hogy értesítem, ha szerelembe esek.'; break;
                    case 13: answer = displayName + ', a szépséged olyan, mint egy migráns... nem ismer határokat!'; break;
                    case 14: answer = displayName + ', Te hardverré változtatod a szoftveremet...'; break;
                    case 15: answer = displayName + ', Te vagy a Google?! Mert minden megvan benned, amit csak keresek :)'; break;
                    case 16: answer = displayName + ', tudod mi a legjobb csajozós duma három szóval? "Folder botja vagyok!"'; break;
                    case 17: answer = displayName + ', ha hazakísérlek, megtartasz?'; break;
                    case 18: answer = 'Hiányzik a mackóm, ' + displayName + '. Nem aludnál velem te?'; break;
                    case 19: answer = displayName + ', nem a láz az egyetlen, ami ledöntene ma este ;)'; break;
                    case 20: answer = displayName + ', ez teveszőr pulóver? Megismertem a púpokról...'; break;
                    case 21: answer = displayName + ', nem lehet köztünk semmi... Se ruha, se levegő!'; break;
                    case 22: answer = 'Ez a ruha gyönyörű, ' + displayName + '! Jól mutatna a hálószobám szőnyegén...'; break;
                }
                return answer;
            }
        });

		/*
        manager.registerPlugin({
            PLUGIN_NAME: 'WEATHER',
            PREFIX: '&#x26C5;',
            onPluginAdded: function(manager) {
                var that = this;
                manager.registerCommand(this, '!weather', function(command, parameters) {
                    var room = BotManager.currentRoom;
                    jQuery.get('https://api.openweathermap.org/data/2.5/weather', {
                        q: parameters[0] || 'Budapest' + ',' + parameters[1] || 'hu',
                        units: 'metric',
                        appid: '14ebe588d1c79155db3489426bef631c',
                        lang: 'hu'
                    }, function(result) {
                        var answer = 'Jelenleg ' + result.main.temp + '&deg;C van itt: ' + result.name
                            + ' (érzetre: ' + result.main.feels_like + '&deg;C, páratartalom: ' + result.main.humidity + '%, ' + ((result.weather[0] || {}).description || 'nincs adat') + ')';
                        BotManager.writeMessage(room, answer, that.PREFIX);
                    });
                }, ['!időjárás']);
                manager.registerCommand(this, '!forecast', function(command, parameters) {
                    var room = BotManager.currentRoom;
                    jQuery.get('https://api.openweathermap.org/data/2.5/weather', {
                        q: parameters[0] || 'Budapest' + ',' + parameters[1] || 'hu',
                        appid: '14ebe588d1c79155db3489426bef631c',
                        lang: 'hu'
                    }, function(result) {
                        if (result.coord) {
                            var city = result.name;
                            jQuery.get('https://api.openweathermap.org/data/2.5/onecall', {
                                lon: result.coord.lon,
                                lat: result.coord.lat,
                                units: 'metric',
                                exclude: 'current,minutely,hourly',
                                appid: '14ebe588d1c79155db3489426bef631c',
                                lang: 'hu',
                            }, function(result) {
                                var w = result.daily[0], d = new Date(w.dt*1000);
                                var answer = city + ', ma: ' + ((w.weather[0] || {}).description || 'nincs adat') + ','
                                    + ' átlagosan: ' + w.temp.day + '&deg;C, minimum: ' + w.temp.min + '&deg;C, maximum: ' + w.temp.max + '&deg;C,'
                                    + ' reggel: ' + w.temp.morn + '&deg;C, délután: ' + w.temp.eve + '&deg;C, éjszaka: ' + w.temp.night + '&deg;C';
                                BotManager.writeMessage(room, answer, that.PREFIX);
                            });
                        }
                    });
                }, ['!előrejelzés']);
            }
        });
		*/

		/*
        manager.registerPlugin({
            PLUGIN_NAME: 'GOOGLE',
            PREFIX: '&#128269;',
            onPluginAdded: function(manager) {
                var that = this;
                manager.registerCommand(this, '!google', function(command, parameters) {
                    var room = BotManager.currentRoom;
                    if (room.get('type') === 'public') return 'Publikus szobában nem működik a kereső.';
                    var maxResults = (parameters[0] || '').startsWith('r:') ? Math.min(Math.max(parseInt(parameters.shift().replace('r:', '')), 1), 5) : 1;
                    if (parameters.join(' ').length < 4) return 'Csak három karakternél hosszabb kifejezésre keresek';
                    gs.search(parameters.join(' '), { num: maxResults, hl: 'hu' }, function(result) {
                        if (result.items && result.items.length) {
                            result.items.forEach(function(item) {
                                BotManager.writeMessage(room, item.link, that.PREFIX);
                            });
                        } else {
                            BotManager.writeMessage(room, 'Nem találtam a keresésnek megfelelő weboldalt!', that.PREFIX);
                        }
                    });
                });
            }
        });
		*/

		/*
        manager.registerPlugin({
            PLUGIN_NAME: 'YOUTUBE',
            PREFIX: '&#127911;',
            onPluginAdded: function(manager) {
                var that = this;
                manager.registerCommand(this, '!youtube', function(command, parameters) {
                    var room = BotManager.currentRoom;
                    yt.search.query(parameters.join(' '), { type: 'video', maxResults: 1 }, function(result) {
                        if (result.items.length) {
                            BotManager.writeMessage(room, 'https://www.youtube.com/watch?v=' + result.items[0].id.videoId, that.PREFIX);
                            // .writeMessage(room, '[YouTube] ' + result.items[0].snippet.title, that.PREFIX);
                        } else {
                            BotManager.writeMessage(room, 'Nem találtam a keresésnek megfelelő videót!', that.PREFIX);
                        }
                    });
                });
                manager.registerCommand(this, '!music', function(command, parameters) {
                    var room = BotManager.currentRoom;
                    yt.videos.popular('', { type: 'video', videoCategoryId: 10, maxResults: 25 }, function(result) {
                        if (result.items.length) {
                            var random = Math.floor(Math.random()*result.items.length);
                            BotManager.writeMessage(room, 'https://www.youtube.com/watch?v=' + result.items[random].id, that.PREFIX);
                            // BotManager.writeMessage(room, '[YouTube] ' + result.items[random].snippet.title, that.PREFIX);
                        }
                    });
                }, ['!zene']);
                var youtubeLink1 = new RegExp(RegExp.quote('https://') + '(www|m)' + RegExp.quote('.youtube.com/watch'));
                manager.registerPattern(this, youtubeLink1, function(text) {
                    var room = BotManager.currentRoom;
                    var url = text.match(new RegExp(RegExp.quote('https://') + '(www|m)' + RegExp.quote('.youtube.com/watch') + '[^\\s]*'))[0];
                    if (url !== undefined) {
                        yt.videos.info(jQuery.getParameter('v', url), {}, function(result) {
                            if (result.items.length) {
                                BotManager.writeMessage(room, '[YouTube] ' + result.items[0].snippet.title, that.PREFIX);
                            }
                        });
                    }
                });
                var youtubeLink2 = new RegExp(RegExp.quote('https://youtu.be/'));
                manager.registerPattern(this, youtubeLink2, function(text) {
                    var room = BotManager.currentRoom;
                    var url = text.match(new RegExp(RegExp.quote('https://youtu.be/') + '[^\\s]*'))[0];
                    if (url !== undefined) {
                        yt.videos.info(url.split('/').pop().split('?').shift(), {}, function(result) {
                            if (result.items.length) {
                                BotManager.writeMessage(room, '[YouTube] ' + result.items[0].snippet.title, that.PREFIX);
                            }
                        });
                    }
                });
            }
        });
		*/

        manager.registerPlugin({
            PLUGIN_NAME: 'GYÖNGYÖS',
            PREFIX: '&#128064;',
            onPluginAdded: function(manager) {
                manager.registerCommand(this, '!gyöngyös', function(command, parameters) {
                    var users = HoloChat.users.filter(function(u) {
                        return (u.get('gender') === 'female') && (u.get('custom').region.split('&raquo;').pop().trim().toLowerCase() === 'gyöngyös')
                    });
                    if (users.length) {
                        return 'Őket találtam: ' + users.map(function(u) { return u.get('name') }).join(', ');
                    } else {
                        return 'Sajnálom, ' + BotManager.getDisplayName(BotManager.currentUser) + ', nincs fenn gyöngyösi nő.'
                    }
                });
            }
        });

        manager.registerPlugin({
            PLUGIN_NAME: 'SWEETY',
            PREFIX: '&#128038;', // '&#128142;',
            onPluginAdded: function(manager) {
                manager.registerPattern(this, /^sajnos[\. !?:\(\)]*$/gi, function() {
                    return 'Sajnos!'
                });
                manager.registerPattern(this, /idegen (csetes|chates) férfi[a]{0,1}k/gi, function() {
                    return 'Egy frászkarikát!';
                });
                manager.registerPattern(this, /\b(pina|punci|csöcs)\b/gi, function() {
                    return BotManager.getDisplayName(BotManager.currentUser) + ' szexista!';
                });
            }
        });

        //! Own storage for each plugin
        manager.registerPlugin({
            PLUGIN_NAME: 'BOMBGAME',
            PREFIX: '&#128163;',
            EXPLODE: '&#128165;',
            NEUTRALIZED: '&#128526;',
            TIMEOUT: 15000,
            COLORS: { 'red': 0, 'piros': 0, 'blue': 1, 'kek': 1, 'kék': 1, 'green': 2, 'zöld': 2, 'zold': 2, 'white': 3, 'fehér': 3, 'feher': 3, 'köcsögbomba': 42, 'fuckyoubomb': 42 },
            onPluginAdded: function(manager) {
                manager.registerCommand(this, '!sneakybomb', function(command, parameters) {
                    if (BotManager.currentUser.get('name') === BotManager.OWNER || BotManager.currentUser.get('name') === 'VikiBee') {
                        BotManager.writeMessage(BotManager.currentRoom, 'Egy terrorista berohant a szobába, és felrobbantotta a kezében lévő bombát! Vége! Kampec mindenkinek!', this.EXPLODE);
                    }
                }, ['!alattomosbomba']);
                manager.registerCommand(this, '!plant', function(command, parameters) {
                    var room = BotManager.currentRoom;
                    var storage = BotManager.getBotStorage(room);
                    if (!storage.bombGameTimer) {
                        storage.bombGameColor = Math.floor(Math.random()*4);
                        storage.bombGameDead = []
                        storage.bombGameTimer = setTimeout(function(that, room) {
                            storage.bombGameTimer = undefined;
                            storage.bombGameColor = undefined;
                            storage.bombGameDead = [];
                            BotManager.writeMessage(room, 'Sajnos senkinek sem sikerült hatástalanítani a bombát, és felrobbant. Vége! Kampec mindenkinek!', that.EXPLODE);
                        }, this.TIMEOUT, this, room);
                        return 'Egy terrorista bombát helyezett el a szobában, és 15 másodperc múlva robban! (Hatástalanítás a !kék, !piros, !zöld és !fehér parancsokkal)';
                    }
                }, ['!bomba', '!bomb']);
                manager.registerCommand(this, '!cut', function(command, parameters) {
                    var room = BotManager.currentRoom, user = BotManager.currentUser;
                    var storage = BotManager.getBotStorage(room);
                    if (storage.bombGameTimer && (storage.bombGameDead || []).indexOf(user.get('name')) === -1) {
                        var color = parameters.length ? this.COLORS[parameters[0].toLowerCase()] : this.COLORS[command.substring(1)];
                        if (storage.bombGameColor === color || (user.get('name') === BotManager.OWNER && color === 42)) {
                            clearTimeout(storage.bombGameTimer);
                            storage.bombGameTimer = undefined;
                            storage.bombGameColor = undefined;
                            storage.bombGameDead = [];
                            BotManager.writeMessage(room, 'Gratulálok, ' + BotManager.getDisplayName(user) + ', sikeresen hatástalanítottad a bombát. A szoba megmenekült!', this.NEUTRALIZED);
                        } else {
                            storage.bombGameDead.push(user.get('name'));
                            if (user.get('name') === BotManager.OWNER) {
                                return 'Nem találtad el, ' + BotManager.getDisplayName(user) + ', de TE nem robbansz fel.';
                            } else {
                                return 'Nem találtad el, ' + BotManager.getDisplayName(user) + ', felrobbantál!';
                            }
                        }
                    }
                }, Object.keys(this.COLORS).map(function(color) { return '!' + color; }));
            }
        });

		/*
        manager.registerPlugin({
            PLUGIN_NAME: 'TRIVIA',
            PREFIX: '&#128172;',
            TROPHY: '&#127942;',
            SECONDS: 40,
            questions: null,
            partitions: [],
            onPluginAdded: function(manager) {
                var that = this;
                jQuery.get('https://raw.githubusercontent.com/ujmappa/chat.hu/master/etc/trivia.json', function(data) {
                    var previousSum = 0, questionSum = 0; that.questions = data;
                    Object.keys(that.questions).forEach(function(category) {
                        previousSum = questionSum;
                        questionSum += Object.keys(that.questions[category]).length;
                        that.partitions['[' + previousSum + '..' + (questionSum-1) + ']'] = category;
                    });
                    that.partitions.total = questionSum;
                }, 'json');
                manager.registerCommand(this, '!trivia', function(command, parameters) {
                    if (this.questions === null) return 'Sajnálom, nem sikerült betölteni az adatbázist';
                    var room = BotManager.currentRoom;
                    var storage = BotManager.getBotStorage(room);
                    if (storage.triviaGameTimer === undefined) {
                        var category = (parameters[0] || '').toLowerCase();
                        if (category === undefined || category === '') {
                            var randomNumber = [Math.floor(Math.random()*this.partitions.total)];
                            var partition = Object.keys(this.partitions).find(function(part) {
                                return randomNumber >= Number(part.match(/^\[([\d]+)\.\.[\d]+\]$/).pop())
                                    && randomNumber <= Number(part.match(/^\[[\d]+\.\.([\d]+)\]$/).pop());
                            });
                            category = this.partitions[partition];
                        } else if (this.questions[category] === undefined) {
                            return 'Az érvényes kategóriák a következők: ' + '"' + Object.keys(this.questions).join('", "') + '"';
                        }
                        var questionObject = this.questions[category], questionList = Object.keys(questionObject);
                        storage.triviaQuestion = questionList[Math.floor(Math.random()*questionList.length)];
                        storage.previousQuestions = storage.previousQuestions || [];
                        while (storage.previousQuestions.indexOf(storage.triviaQuestion) > -1) {
                            storage.triviaQuestion = questionList[Math.floor(Math.random()*questionList.length)];
                        }
                        if (storage.previousQuestions.length >= 20) storage.previousQuestions.shift();
                        storage.previousQuestions.push(storage.triviaQuestion);
                        storage.triviaAnswers = jQuery.extend({}, questionObject[storage.triviaQuestion]);
                        storage.triviaExplanation = storage.triviaAnswers.X; delete storage.triviaAnswers.X;
                        storage.triviaSolution = Object.keys(storage.triviaAnswers).find(function(key) {
                            return storage.triviaAnswers[key].startsWith('*');
                        }).toUpperCase();
                        storage.triviaRemoved = [];
                        storage.triviaGameTimer = setTimeout(function(that, room) {
                            if (room.get('type') !== 'private') {
                                BotManager.writeMessage(room, 'Sajnos senkinek sem sikerült kitalálnia, de majd legközelebb.', that.PREFIX);
                            } else {
                                BotManager.writeMessage(room, 'Sajnos lejárt az időd, de majd legközelebb.', that.PREFIX);
                            }
                            storage.triviaGameTimer = undefined;
                            storage.triviaQuestion = undefined;
                            storage.triviaAnswers = undefined;
                            storage.triviaSolution = undefined;
                            storage.triviaExplanation = undefined;
                            storage.triviaRemoved = [];
                        }, this.SECONDS*1000, this, room);
                        BotManager.writeMessage(room, storage.triviaQuestion, this.PREFIX);
                        return Object.entries(storage.triviaAnswers).map(function(entry) {
                            var key = entry[0], value = entry[1];
                            return key.toUpperCase() + ') ' + (value.startsWith('*') ? value.substring(1) : value);
                        }).join(' &nbsp; ');
                    }
                });
                manager.registerCommand(this, '!a', function(command, parameters) {
                    var room = BotManager.currentRoom, user = BotManager.currentUser;
                    var storage = BotManager.getBotStorage(room);
                    if (storage.triviaGameTimer && (storage.triviaRemoved || []).indexOf(user.get('name')) === -1) {
                        var answer = command.substring(1).toUpperCase();
                        if (storage.triviaSolution === answer) {
                            var solution = storage.triviaSolution, explanation = storage.triviaExplanation;
                            clearTimeout(storage.triviaGameTimer);
                            storage.triviaGameTimer = undefined;
                            storage.triviaQuestion = undefined;
                            storage.triviaAnswers = undefined;
                            storage.triviaSolution = undefined;
                            storage.triviaExplanation = undefined;
                            storage.triviaRemoved = [];
                            if (explanation !== undefined) BotManager.writeMessage(room, explanation, this.PREFIX);
                            BotManager.writeMessage(room, 'Gratulálok, ' + BotManager.getDisplayName(user) + ', a helyes válasz: "' + solution + '"', this.TROPHY);
                        } else if (room.get('type') !== 'private') {
                            storage.triviaRemoved.push(user.get('name'));
                            BotManager.writeMessage(room, 'Sajnálom, ' + BotManager.getDisplayName(user) + ', de nem ez a helyes válasz. Valaki más?', this.PREFIX);
                        } else {
                            clearTimeout(storage.triviaGameTimer);
                            storage.triviaGameTimer = undefined;
                            BotManager.writeMessage(room, 'Sajnálom, ' + BotManager.getDisplayName(user) + ', de nem ez a helyes válasz. Jöhet a következő?', this.PREFIX);
                        }
                    }
                }, 'ABCD'.split(''));
            }
        });
		*/

		/*
        manager.registerPlugin({
            PLUGIN_NAME: 'HANGMAN',
            PREFIX: '&#11088;',
            TROPHY: '&#127942;',
            ALPHABET: 'AÁBCDEÉFGHIÍJKLMNOÓÖŐPQRSTUÚÜŰVWXYZ',
            MINUTES: 3,
            answers: null,
            argo: null,
            onPluginAdded: function(manager) {
                var that = this;
                jQuery.get('https://raw.githubusercontent.com/ujmappa/chat.hu/master/etc/hangman.json', function(data) {
                    that.answers = data.answers, that.argo = data.argo;
                }, 'json');
                manager.registerCommand(this, '!hangman', function(command, parameters) {
                    if (this.answers === null) return 'Sajnálom, nem sikerült betölteni az adatbázist';
                    var room = BotManager.currentRoom;
                    var storage = BotManager.getBotStorage(room);
                    if (storage.wordGameTimer === undefined) {
                        storage.previousAnswers = storage.previousAnswers || [];
                        var gameAnswers = (parameters.length && parameters[0].toLowerCase() === "argo") ? this.argo : this.answers;
                        var randomText = gameAnswers[Math.floor(Math.random()*gameAnswers.length)];
                        while (storage.previousAnswers.indexOf(randomText) > -1) {
                            randomText = gameAnswers[Math.floor(Math.random()*gameAnswers.length)];
                        }
                        if (storage.previousAnswers.length >= 20) storage.previousAnswers.shift();
                        storage.previousAnswers.push(randomText);
                        storage.wordGameAnswer = randomText.toUpperCase();
                        storage.wordGameShown =  storage.wordGameAnswer.split('');
                        for (var i = 0; i < storage.wordGameShown.length; ++i) {
                            if (this.ALPHABET.indexOf(storage.wordGameShown[i]) > -1) {
                                storage.wordGameShown[i] = '*';
                            }
                        }
                        storage.wordGameWarning = setTimeout(function(that, room) {
                            BotManager.writeMessage(room, 'Már csak egy percetek van hátra, húzzatok bele!', that.PREFIX);
                        }, (this.MINUTES-1)*60000, this, room);
                        storage.wordGameTimer = setTimeout(function(that, room) {
                            storage.wordGameWarning = undefined;
                            storage.wordGameTimer = undefined;
                            storage.wordGameShown = undefined;
                            BotManager.writeMessage(room, storage.wordGameAnswer + '. Sajnos senkinek sem sikerült kitalálnia.', that.PREFIX);
                        }, this.MINUTES*60000, this, room);
                        BotManager.writeMessage(room, this.MINUTES + ' percetek van kitalálni az alábbi kifejezést:', this.PREFIX);
                        return storage.wordGameShown.join('').replace(/ /g, ' &nbsp;');
                    }
                }, ['!akasztófa']);
                manager.registerCommand(this, '!check', function(command, parameters) {
                    var room = BotManager.currentRoom, user = BotManager.currentUser;
                    var storage = BotManager.getBotStorage(room);
                    if (storage.wordGameTimer !== undefined) {
                        var ch = parameters.length ? parameters[0].charAt(0) : command.charAt(2);
                        if (ch !== undefined && ch !== '' && parameters.length < 2) {
                            ch = ch.toUpperCase();
                            if (this.ALPHABET.indexOf(ch) > -1) {
                                for (var i = 0; i < storage.wordGameAnswer.length; ++i) {
                                    if (storage.wordGameAnswer.charAt(i) === ch) {
                                        storage.wordGameShown[i] = ch;
                                    }
                                }
                                var wordGameShownConcat = storage.wordGameShown.join('');
                                if (wordGameShownConcat === storage.wordGameAnswer) {
                                    clearTimeout(storage.wordGameWarning);
                                    clearTimeout(storage.wordGameTimer);
                                    storage.wordGameWarning = undefined;
                                    storage.wordGameShown = undefined;
                                    storage.wordGameTimer = undefined;
                                    BotManager.writeMessage(room, storage.wordGameAnswer + '. Gratulálok, ' + BotManager.getDisplayName(user) + ', megfejtetted a feladványt!', this.TROPHY);
                                } else {
                                    BotManager.writeMessage(room, storage.wordGameShown.join('').replace(/ /g, ' &nbsp;'), this.PREFIX);
                                }
                            }
                        } else {
                            return 'A parancs csak egy paramétert fogad el, amely a magyar ABC egy betűje.';
                        }
                    }
                }, this.ALPHABET.split('').map(function(alpha) { return '!?' + alpha.toLowerCase() }));
                manager.registerCommand(this, '!solve', function(command, parameters) {
                    var room = BotManager.currentRoom, user = BotManager.currentUser;
                    var storage = BotManager.getBotStorage(room);
                    if (storage.wordGameTimer !== undefined) {
                        var parameter = parameters.join(' ').trim().toUpperCase();
                        if (parameter === storage.wordGameAnswer || parameter === storage.wordGameAnswer.replace(/,/g, '')) {
                            clearTimeout(storage.wordGameWarning);
                            clearTimeout(storage.wordGameTimer);
                            storage.wordGameWarning = undefined;
                            storage.wordGameShown = undefined;
                            storage.wordGameTimer = undefined;
                            BotManager.writeMessage(room, storage.wordGameAnswer + '. Gratulálok, ' + BotManager.getDisplayName(user) + ', megfejtetted a feladványt!', this.TROPHY);
                        } else {
                            BotManager.writeMessage(room, 'Sajnálom, ' + BotManager.getDisplayName(user) + ', de nem ez a megfejtés. Azért szép próbálkozás volt!', this.PREFIX);
                        }
                    }
                }, ['!!']);
            },
        });
		*/

		HoloChat.publicRooms.filter({ type: "conference" }).forEach(function(room) {
			console.log('Entering ' + room.get('name'));
			HoloChat.events.trigger('room:change', room.id);
		});
    }
};
