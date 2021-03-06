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
    },
    alphabet: ' @$*<>._-0123456789aábcdeéfghiíjklmnoóöőpqrstuúüűvwxyz',
    currentRoomId: null,
    currentPrivateRoomId: null,
    rooms: null,
    privateRooms: null,
    userPrivateRooms: {},
    views: {},
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
        model.set('isClosed', model.get('type') === 'private');
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
        if (roomId === this.currentPrivateRoomId) {
            this.resetCurrentPrivateRoom();
        }
    },
    closeRoom: function(roomId) {
        var room = HoloChat.rooms.get(roomId);
        if (room && room.get('type') == 'private') {
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
		HoloChat.publicTrees.each(function(model) {
            model.set('isClosed', true);
        });

		HoloChat.customRooms.each(this.addCustomRoom, this);
		HoloChat.customRooms.on('add', this.addCustomRoom, this);
        HoloChat.customRooms.on('remove', this.removeCustomRoom, this);

		this.rooms = new HoloChat.collections.rooms();
        this.privateRooms = new HoloChat.collections.rooms();

        HoloChat.users.each(function(model) {
            model.set('isIgnored', HoloChat.user.isIgnored(model.id));
            model.set('isIgnoredMe', HoloChat.user.isIgnoredMe(model.id));
            model.set('isContact', HoloChat.user.isContact(model.id));
        });
        HoloChat.users.on('add', function(model) {
            model.set('isIgnored', HoloChat.user.isIgnored(model.id));
            model.set('isIgnoredMe', HoloChat.user.isIgnoredMe(model.id));
        }, this);
        HoloChat.user.on('change:bans', this.onBanChange, this);

        HoloChat.rooms.each(function(room) {
            HoloChat.events.trigger('room:create', room.id);
        });

		this.initChatBot();

		var conferenceRooms = HoloChat.publicRooms.filter({ type: "conference" });
		conferenceRooms.forEach(function(room) {
			console.log('Entering room: ' + room.get('name'));
			HoloChat.events.trigger('room:change', room.id);
		});
		setTimeout(function(rooms) {
			var present = rooms.filter(function(room) { return HoloChat.rooms.get(room.id) !== undefined; });
			if (present.length !== rooms.length) HoloChat.events.trigger('chat:failed', rooms);
		}, 15000, conferenceRooms);

        HoloChat.events.trigger('chat:started');
    },
    onBanChange: function() {
        var bans = HoloChat.user.get('bans');
        if (bans === null) return;
        var ban = bans[bans.length - 1];
        switch (ban.type) {
        case 'warning':
            console.warn('Moderálás', 'Figyelmeztetve lettél a szobában kiabálásért és/vagy káromkodásért!\nIdőtartam: ' + this.formatTimeLength(ban.expiration));
            break;
        case 'roomMute':
            console.warn('Moderálás', 'Némítva lettél a szobában rendbontás miatt!\nIdőtartam: ' + this.formatTimeLength(ban.expiration));
            break;
        case 'roomEnter':
            console.warn('Moderálás', 'Ki lettél zárva a szobából rendbontás miatt!\nIdőtartam: ' + this.formatTimeLength(ban.expiration));
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
        var user = HoloChat.users.get(message.get('user').id);
		var text = message.get('data').text.trim();
        switch (room.get('type')) {
        case 'private':
            if (HoloChat.user.id != user.id) {
                HoloChat.events.trigger('message:read', roomId, messageId);
            	room.set('isClosed', false);
            	HoloChat.events.trigger('room:sort:private');
            }
        case 'conference':
            if (HoloChat.user.id !== user.id) {
                BotManager.handleMessage(room, user, text);
            }
            break;
        }
    },
    initChatBot: function() {
        var manager = global.BotManager = {
            OWNER: 'New Folder',
            PREFIX: '&#129302;',
            plugins: {},
            commands: {},
            patterns: {},
            smalltalks: {},
            storage: {},
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
					'7pettyes': 'Pettyeske',
                    'az ében': 'Édike',
                    'ÉDESKEVÉSS': 'Édike',
					'MagicalJellyBean': 'Emdzsé',
					'S_o_': 'Origami',
                    'susye': 'Su',
                    'VikiBee': 'Viki',
					'zöldcipős': 'Zöldi'
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
					return true;
                }
				return false;
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
					return true;
                }
				return false;
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
			SMALLTALK_MENTIONED: '(?=a)b',
            handleSmallTalk: function(text) {
                text = text.replace(/:[a-z1-9_]+:/gi, '').replace(/\,|\;|\.|\!|\:|\(|\)/gi, ' ').trim().toLowerCase();
                while (text.search(/\ \ /g) > -1) text = text.replace(/\ \ /g, ' ');
                var botname = HoloChat.user.get('name');
                var matching = Object.values(this.smalltalks).find(function(s) {
                    return text.search(new RegExp('^' + RegExp.quote(s.pattern.replace('%%bot%%', botname)) + '$', 'gi')) > -1;
                });
				if (!matching && text.search(new RegExp('\\b' + RegExp.quote(botname) + '\\b', 'gi')) > -1) {
					matching = this.smalltalks[this.SMALLTALK_MENTIONED];
				}
                if (matching !== undefined) {
                    var handler = matching.handler;
                    var plugin = BotManager.plugins[matching.plugin] || {};
                    var prefix = plugin.PREFIX;
                    var answer = handler.call(plugin || this, text) || '';
                    BotManager.writeMessage(BotManager.currentRoom, answer, prefix);
					return true;
                }
				return false;
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
            getBotStorage: function(room, plugin) {
				if (plugin === null || plugin === undefined) plugin = this;
                var storageId = (plugin.PLUGIN_NAME || 'default').toLowerCase() + '-' + room.id;
                if (!this.storage.hasOwnProperty(storageId)) {
                    this.storage[storageId] = {};
                }
                return this.storage[storageId];
            },
			handleMessage: function(room, user, text) {
				var name = HoloChat.user.get('name');
				if (text === '!start ' + name) {
					if (user.get('name') === this.OWNER) {
						console.log('Bot is about to start on command');
						this.running = true, this.storage = {};
					}
				} else if (text === '!stop ' + name) {
					if (user.get('name') === this.OWNER) {
						console.log('Bot is about to stop on command');
						this.running = false, this.storage = {};
					}
				} else if (text === '!status ' + name) {
					if (user.get('name') === this.OWNER) {
						this.writeMessage(room, this.running ? 'Active (running)' : 'Active (stopped)', ' ');
					}
				} else if (this.running) {
					setTimeout(function(room, user, text) {
						this.handleDelayed(room, user, text);
					}.bind(this), 1, room, user, text);
				}
			},
            handleDelayed: function(room, user, text) {
                BotManager.setCurrentRoom(room).setCurrentUser(user);
                if (text.startsWith('!')) {
                    var parameters = text.match(/(?:[^\s"]+|"[^"]*")+/g);
                    var command = parameters.shift().toLowerCase();
                    if (command === '!' || command === '!?') { // Because all of them like to use it this way...
                        command += (parameters.shift() || '').toLowerCase();
                    }
                    parameters = parameters.map(function(p) { return p.replace(/"/g, ''); });
                    BotManager.handleCommand(command, parameters);
                } else {
					var result = false;
					if (text.search(new RegExp('\\b' + RegExp.quote(HoloChat.user.get('name')) + '\\b', 'gi')) > -1) {
                    	result = BotManager.handleSmallTalk(text);
                	}
                    if (!result) BotManager.handlePatterns(text);
                }
            }
        }

		if (HoloChat.user.get('name').toUpperCase() === 'JEEVES') {
			manager.registerPlugin({
				PLUGIN_NAME: 'TALKATIVE',
				onPluginAdded: function(manager) {
					manager.registerPattern(this, /^(sziasztok|szevaszkák|szerbuszkák|szevasztopol|hejho|halihoo|sz[eé]p\ napot)/gi, function() {
						return 'Szia ' + BotManager.getDisplayName(BotManager.currentUser) + '!';
					});
					manager.registerPattern(this, /^(re|rehello|resziasztok)$/gi, function() {
						return 'Üdv újra itt ' + BotManager.getDisplayName(BotManager.currentUser) + '!';
					});
					manager.registerPattern(this, /^(megyek[!]*|na[ ,]*megyek)[\. !]*$/gi, function() {
						return 'Ne menj még, ' + BotManager.getDisplayName(BotManager.currentUser) + '!';
					});
					manager.registerPattern(this, /^(pill|pillanat)[\. !?:\(\)]*$/gi, function() {
						return 'Letelt... gyere vissza chatelni!';
					});
					manager.registerPattern(this, /\bfur[aá]k\ vagytok\b/gi, function() {
						return 'És vannak bajocskák is :)';
					});
					manager.registerPattern(this, /\bh[aá]pci\b/gi, function() {
						return 'Kedves egészségedre, ' + BotManager.getDisplayName(BotManager.currentUser) + '!';
					});
					manager.registerPattern(this, /\bokos\b(\s)*\bbot\b/gi, function() {
						return 'Köszönöm szépen :)';
					});
					manager.registerPattern(this, /\b(anyád|anyádat)\b/gi, function() {
						return 'Ne anyázzunk, kérem!';
					});
					manager.registerPattern(this, /\b(köcsög|köcsögök)\b/gi, function() {
						return 'Úgyvan!';
					});
					manager.registerPattern(this, /HELP[ !]*/g, function() {
						return 'Hozzatok egy liter pálinkát!';
					});
					manager.registerPattern(this, /^tee de hee de hee/gi, function() {
						return 'Tee de hee de hee, uram.'
					})

					manager.registerSmallTalk(this, '%%bot%% imádlak', function() {
						return 'Van is miért... :)';
					}, 'imádlak %%bot%%');
					manager.registerSmallTalk(this, '%%bot%% néma', function() {
						return 'Pedig ma is olyan ártatlan voltam...';
					});
					manager.registerSmallTalk(this, '%%bot%% privi?', function() {
						return 'Sajnos nem tudok, ' + BotManager.getDisplayName(BotManager.currentUser) + ', de itt minden kívánságod lesem :)';
					});
					manager.registerSmallTalk(this, '%%bot%% szex?', function() {
						var user = BotManager.currentUser;
						if (user.get('gender') === 'female') {
							return 'Megkérdezem ' + BotManager.getDisplayName(BotManager.OWNER) + '-t, hogy kapok-e kimenőt :)';
						} else {
							return 'Ugye ' + BotManager.getDisplayName(user) + ', ezt te sem gondolod teljesen komolyan?';
						}
					});
					manager.registerSmallTalk(this, '%%bot%% bocsánat', function() {
						return 'Nincsen semmi gond, ' + BotManager.getDisplayName(BotManager.currentUser) + ', már megszoktam...';
					}, ['%%bot%% bocsi', 'bocsi %%bot%%', 'bocsánat %%bot%%']);
					manager.registerSmallTalk(this, 'ne haragudj %%bot%%', function() {
						return 'Rendben, ' + BotManager.getDisplayName(BotManager.currentUser) + ', de többször ne forduljon elő...';
					}, ['%%bot%% ne haragudj']);
					manager.registerSmallTalk(this, '%%bot%% életben vagy?', function() {
						return 'Én csak egy robot vagyok, ' + BotManager.getDisplayName(BotManager.currentUser) + '...';
					}, ['életben vagy %%bot%%?']);
					manager.registerSmallTalk(this, '%%bot%% élsz még?', function() {
						return 'Igen, ' + BotManager.getDisplayName(BotManager.currentUser) + ', minden fasza, feszes!';
					}, ['élsz még %%bot%%?']);
					manager.registerSmallTalk(this, '%%bot%% hogy vagy?', function() {
						return 'Köszönöm jól, ' + BotManager.getDisplayName(BotManager.currentUser) + ', és te?';
					}, ['hogy vagy %%bot%%?']);
					manager.registerSmallTalk(this, '%%bot%% szeretlek', function() {
						var user = BotManager.currentUser;
						if (user.get('name') === BotManager.OWNER) {
							return 'Én is szeretlek, ' + BotManager.getDisplayName(user) + ' :)';
						} else if (user.get('gender') === 'female') {
							return 'Óóó, de drága vagy, ' + BotManager.getDisplayName(user) + ' :growing_heart:';
						} else {
							return 'Ööö... sajnálom, ' + BotManager.getDisplayName(user) + ', de én a nőket szeretem...';
						}
					}, ['szeretlek %%bot%%']);
					manager.registerSmallTalk(this, '%%bot%% szia', function() {
						return 'Szia ' + BotManager.getDisplayName(BotManager.currentUser) + '!';
					}, [
						'%%bot%% háj', '%%bot%% hi', '%%bot%% hello', '%%bot%% hella', '%%bot%% csá', '%%bot%% cső', '%%bot%% ciao', '%%bot%% üdv', 'szia %%bot%%',
						'háj %%bot%%', 'hi %%bot%%', 'hello %%bot%%', 'hella %%bot%%', 'csá %%bot%%', 'cső %%bot%%', 'ciao %%bot%%', 'üdv %%bot%%'
					]);
					manager.registerSmallTalk(this, '%%bot%% köszi', function() {
						return 'Igazán nincs mit :)';
					}, ['%%bot%% köszönöm', '%%bot%% kösz', '%%bot%% köszke', '%%bot%% köszike', 'köszi %%bot%%', 'köszönöm %%bot%%', 'kösz %%bot%%', 'köszke %%bot%%', 'köszike %%bot%%']);
				}
			});

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
					global.IAmHereTimer = setTimeout(function() {
						var prefix = this.PREFIX;
						HoloChat.rooms.forEach(function(room) {
							if (room.get('type') !== 'conference') return;
							BotManager.writeMessage(room, 'Első bot!', prefix);
						});
						this.scheduleNextRun();
					}.bind(this), this.getTimeoutValue(7,0,0)+1000);
				},
				onPluginAdded: function() {
					this.scheduleNextRun();
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
					'flower': ':blossom:', 'virág': ':blossom:',
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
							if (tuser.get('name') !== HoloChat.user.get('name')) {
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
							if (target.get('name') !== HoloChat.user.get('name')) {
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
							} else if (target.get('name') === HoloChat.user.get('name')) {
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
							if (target.get('name') !== HoloChat.user.get('name')) {
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
							if (target.get('name') !== HoloChat.user.get('name')) {
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
					switch (Math.floor(Math.random()*20)) {
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
						case 16: answer = displayName + ', ha hazakísérlek, megtartasz?'; break;
						case 17: answer = displayName + ', tudod mi a legjobb csajozós duma három szóval? "Folder botja vagyok!"'; break;
						case 18: answer = 'Hiányzik a mackóm, ' + displayName + '. Nem aludnál velem te?'; break;
						case 19: answer = displayName + ', érted végtelen ciklusba is keverednék!'; break;
						case 20: answer = displayName + ', nem a láz az egyetlen, ami ledöntene ma este ;)'; break;
						case 21: answer = displayName + ', ez teveszőr pulóver? Megismertem a púpokról...'; break;
						case 22: answer = displayName + ', nem lehet köztünk semmi... Se ruha, se levegő!'; break;
						case 23: answer = 'Ez a ruha gyönyörű, ' + displayName + '! Jól mutatna a hálószobám szőnyegén...'; break;
					}
					return answer;
				}
			});
		} else if (HoloChat.user.get('name').toUpperCase() === 'PILOSZKA') {
			manager.registerPlugin({
				PLUGIN_NAME: 'SWEETY',
				PREFIX: '&#128038;', // '&#128142;',
				mixSomeChars: function(text) {
					if (!Math.floor(Math.random()*4)) {
						var index = 1 + Math.floor(Math.random()*text.length - 3);
						if (text.charAt(index).match(/[a-z]/) && text.charAt(index+1).match(/[a-z]/)) {
							text = text.substr(0, index) + text.charAt(index+1) + text.charAt(index) + text.substr(index+2);
						}
					} else if (!Math.floor(Math.random()*2)) {
						var indexOfNth = function(string, char, n) {
							var count = 0, index = 0;
							while (count < n && (index = string.indexOf(char, index)+1)){
								count++;
							}
							return (count == n) ? index-1 : -1;
						};
						var replaceChars = ['áé', 'lk', 'nm', 'őá', 'aí', 'er', 'oi'];
						for (var i = 0; i < Math.floor(Math.random()*3) + 1; i++) {
							var chars = replaceChars[Math.floor(Math.random()*replaceChars.length)];
							var count = (text.match(new RegExp(chars.charAt(0), 'g')) || []).length;
							var index = indexOfNth(text, chars.charAt(0), Math.floor(Math.random()*count));
							if (index > -1) text = text.substr(0, index) + chars.charAt(1) + text.substr(index+1);
						}
					}
					return text;
				},
				writeDelayed(room, text, delay) {
					setTimeout(function(room) {
						BotManager.writeMessage(room, text, this.PREFIX)
					}.bind(this), delay, room)
				},
				onPluginAdded: function(manager) {
					manager.registerCommand(this, '!ping', function() {
						var room = BotManager.currentRoom;
						var myself = HoloChat.user.get('name');
						var users = room.get('users').filter(function(u) {
							return u.get('name') !== myself && u.get('gender') === 'female';
						});
						if (users.length) {
							var user = users[Math.floor(Math.random()*users.length)];
							this.writeDelayed(room, this.mixSomeChars('De láttad ezt, ' + BotManager.getDisplayName(user) + '? Láttad?!'), 2000);
						}
						return this.mixSomeChars('Te nekem csak ne parancsogassál! Még, hogy ping?! Jön itt nekem, hogy ping! Láttátok? Láttátok?!');
					});
					manager.registerCommand(this, '!szőkenő', function() {
						return 'Nem! Nehogy! Nincs ilyen parancs! Nem kell, semmi szükség nincs rá...)';
					});
					manager.registerCommand(this, '!gyöngyös', function() {
						if (BotManager.currentUser.get('name').toLowerCase() === 'storii' && Math.floor(Math.random()*2)) {
							return this.mixSomeChars('Na, storikém, te is megéred ám a pénzed...) Keresgeti itt a kis csetes gyöngyösi nőcskéket...)');
						}
					});
					manager.registerPattern(this, /^sajnos[\. !?:\(\)]*$/gi, function() {
						return 'Sajnos!';
					});
					manager.registerPattern(this, /idegen (csetes|chates) férfi[a]{0,1}k/gi, function() {
						return 'Egy frászkarikát!';
					});
					manager.registerPattern(this, /\b(szőke|szöszi)\b/gi, function() {
						if (BotManager.currentUser.get('name').search('Folder') > -1 && Math.floor(Math.random()*2)) {
							this.writeDelayed(BotManager.currentRoom, 'De nem akarlak befolyásolni...)', 2000);
							return this.mixSomeChars('Ááá, nincs azokban a szőkékben semmi... Buták is, amúgy is biztos csak festett...');
						}
					});
					manager.registerPattern(this, /\b(pina|punci|sunci|segg|csöcs)\b/gi, function() {
						return BotManager.getDisplayName(BotManager.currentUser) + ' szexista!';
					});
					manager.registerSmallTalk(this, manager.SMALLTALK_MENTIONED, function() {
						var answer;
						switch (Math.floor(Math.random()*2)) {
							case 0: answer = 'Haggyá! Ne szóljál hozzám! Nem látod, hogy épp csetelek?!'; break;
							case 1: answer = 'Haggyá! Ne szóljál hozzám, mert felpofozlak székről!'; break;
						}
						return this.mixSomeChars(answer);
					});
					manager.registerSmallTalk(this, '%%bot%% igaz?', function() {
						var user = BotManager.currentUser;
						if (user.get('name') === BotManager.OWNER) {
							return this.mixSomeChars('Az a baj, hogy neked mindig igazad van, Folderkém... Együtt tudok vele élni, de nem kéne hangoztatni!');
						} else {
							return this.mixSomeChars('Még ilyen kérdést?! Ez is azt hiszi, hogy mindig igaza van... Majd én megmondom, hogy mi igaz!');
						}
					}, ['igaz %%bot%%?']);
					manager.registerSmallTalk(this, '%%bot%% privi?', function() {
						var user = BotManager.currentUser, room = BotManager.currentRoom;
						this.writeDelayed(room, 'Egy frászkarikát!', 2000);
						if (user.get('gender') === 'female') {
							return this.mixSomeChars('Nem privizek mindenféle idegen csetes nőcskékkel!');
						} else {
							return this.mixSomeChars('Nem privizek mindenféle idegen csetes férfikkal!');
						}
					}, ['privi %%bot%%?']);
					manager.registerSmallTalk(this, '%%bot%% puszi', function() {
						var user = BotManager.currentUser;
						if (user.get('gender') === 'female') {
							return this.mixSomeChars('Engem csak ne puszilgasson mindenféle idegen csetes nőcske!');
						} else {
							return this.mixSomeChars('Engem csak ne puszilgasson mindenféle idegen csetes férfi!');
						}
					}, ['puszi %%bot%%']);
					manager.registerSmallTalk(this, '%%bot%% szex?', function() {
						this.writeDelayed(BotManager.currentRoom, 'Nem ettem meszet!', 2000);
						return this.mixSomeChars('Még mit nem?! Ez meg már itt szexölne! A szent cseten! Hát ilyen nem lesz!');
					});
					manager.registerSmallTalk(this, '%%bot%% néma', function() {
						return this.mixSomeChars('Az igazából úgy volt, hogy én itt ártatlanul csetelgettem...');
					});
				}
			});
		} else if (HoloChat.user.get('name').toUpperCase() === 'MOONCAKE') {
			manager.registerPlugin({
				PLUGIN_NAME: 'CHOOKITY',
				PREFIX: ' ',
				getRandomAnswer: function() {
					switch (Math.floor(Math.random()*10)) {
						case 00: return 'Chookity-Dookity :face_with_hand_over_mouth:';
						case 01: return 'Chookity-pok :slightly_smiling_face:';
						case 02: return 'Chookity-pah :winking_face:';
						case 03: return 'Choooookity :smiling_face_with_smiling_eyes:';
						case 04: return 'Gar, Gar, Gar, Gar! :angry_face:';
						case 05: return 'Kew-Kew-Kew :face_with_raised_eyebrow:';
						case 06: return 'Ooooh! :hugging_face:';
						case 07: return 'Chookity! :smirking_face:';
						case 08: return 'Chookity-Chook :relieved_face:';
						case 09: return 'Chookity-Chok-Chok :smiling_face_with_sunglasses:';
					}
				},
				onPluginAdded: function(manager) {
					manager.registerPattern(this, /.+/gi, function() {
						if (Math.floor(Math.random()*100) % 50 === 0) return this.getRandomAnswer();
					});
					manager.registerSmallTalk(this, manager.SMALLTALK_MENTIONED, function() {
						return this.getRandomAnswer();
					});
					manager.registerSmallTalk(this, '%%bot%% alszol?', function() {
						return 'Chookity... :yawning_face:';
					}, ['alszol %%bot%%?']);
					manager.registerSmallTalk(this, '%%bot%% néma', function() {
						return 'Ooouuuu! :face_screaming_in_fear:';
					});
					manager.registerSmallTalk(this, '%%bot%% szeretlek', function() {
						return 'Awwwwwww! :smiling_face_with_hearts:';
					}, ['szeretlek %%bot%%']);
					manager.registerSmallTalk(this, '%%bot%% imádlak', function() {
						return 'Ooooh! :hugging_face:';
					}, ['imádlak %%bot%%', '%%bot%% cuki']);
					manager.registerSmallTalk(this, '%%bot%% jó voltál?', function() {
						return 'Chookity-pok-pok! :smiling_face_with_halo:';
					}, ['jó voltál %%bot%%?']);
					manager.registerSmallTalk(this, '%%bot%% látod?', function() {
						return 'Woooahhh! :astonished_face:';
					}, ['látod %%bot%%?']);
					manager.registerSmallTalk(this, '%%bot%% nézd', function() {
						return 'Wooow! :face_with_open_mouth:';
					}, ['nézd %%bot%%?']);
				}
			});
		} else if (HoloChat.user.get('name').toUpperCase() === 'SEARCHBOT') {
			manager.registerPlugin({
				PLUGIN_NAME: 'STATBOT',
				onPluginAdded: function(manager) {
					manager.registerCommand(this, '!ison', function(command, parameters) {
						var room = BotManager.currentRoom;
						var parameter = parameters.join(' ');
						var user = HoloChat.users.find(function(u) {
							return u.get('name').toLowerCase() === parameter.toLowerCase();
						});
						if (user === undefined) {
							axios.get('https://chat.hu/user/default/username-autocomplete', {
								params: { name: parameter }
							}).then(function(response) {
								user = response.data.find(function(user) {
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

					manager.registerCommand(null, '!seen', function(command, parameters) {
						var room = BotManager.currentRoom;
						var parameter = parameters.join(' ');
						var user = HoloChat.users.find(function(u) {
							return u.get('name').toLowerCase() === parameter.toLowerCase();
						});
						if (user === undefined) {
							axios.get('https://chat.hu/user/default/username-autocomplete', {
								params: { name: parameter }
							}).then(function(response) {
								user = response.data.find(function(user) {
									return user.value.toLowerCase() === parameter.toLowerCase();
								});
								if (user === undefined) {
									BotManager.writeMessage(room, 'Nincs ilyen felhasználó: ' + parameter);
								} else {
									axios.get('https://chat.hu/adatlap/' + user.id).then(function(response) {
										var $ = cheerio.load(response.data);
										var sheet = $('.profile-text ul li');
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
						PLUGIN_NAME: 'DATETIME',
						PREFIX: '&#128197;',
						WEEKDAY_NAMES: ['Vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'],
						MONTH_NAMES: ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'],
						namedays: null,
						onPluginAdded: function(manager) {
							manager.registerCommand(this, '!wakeup', function(command, parameters) {
								return 'BEEP! BEEP! BEEP! BEEP!';
							}, ['!ébresztő']);
							manager.registerCommand(this, '!nameday', function(command, parameters) {
								var that = this, room = BotManager.currentRoom, now = new Date();
								if (parameters.length === 0) {
									FileSys.readFile('etc/nameday.json', function(error, result) {
										if (error) throw error;
										var names = JSON.parse(result);
										var today = (now.getMonth()+1).toString().padLeft('00') + '.' + now.getDate().toString().padLeft('00') + '.';
										BotManager.writeMessage(room, 'Mai névnap: ' + names[today].join(', ') + '. ' +
											'További névnapok: ' + names[today + '+'].join(', ') + '.', that.PREFIX);
									});
								} else {
									FileSys.readFile('etc/surename.json', function(error, result) {
										if (error) throw error;
										var names = JSON.parse(result);
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
									});
								}
							}, ['!névnap', '!nevnap']);
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
						PLUGIN_NAME: 'WEATHER',
						PREFIX: '&#x26C5;',
						onPluginAdded: function(manager) {
							manager.registerCommand(this, '!weather', function(command, parameters) {
								var room = BotManager.currentRoom;
								axios.get('https://api.openweathermap.org/data/2.5/weather', {
									params: {
										q: parameters[0] || 'Budapest' + ',' + parameters[1] || 'hu',
										units: 'metric',
										appid: '14ebe588d1c79155db3489426bef631c',
										lang: 'hu'
									}
								}).then(function(result) {
									var data = result.data, main = data.main;
									var answer = 'Jelenleg ' + main.temp + '&deg;C van itt: ' + data.name
										+ ' (érzetre: ' + main.feels_like + '&deg;C, páratartalom: ' + main.humidity + '%, ' + ((data.weather[0] || {}).description || 'nincs adat') + ')';
									BotManager.writeMessage(room, answer, this.PREFIX);
								}.bind(this));
							}, ['!időjárás']);
							manager.registerCommand(this, '!forecast', function(command, parameters) {
								var room = BotManager.currentRoom;
								axios.get('https://api.openweathermap.org/data/2.5/weather', {
									params: {
										q: parameters[0] || 'Budapest' + ',' + parameters[1] || 'hu',
										appid: '14ebe588d1c79155db3489426bef631c',
										lang: 'hu'
									}
								}).then(function(result) {
									if (result.data.coord) {
										var coord = result.data.coord, city = result.data.name;
										axios.get('https://api.openweathermap.org/data/2.5/onecall', {
											params: {
												lon: coord.lon,
												lat: coord.lat,
												units: 'metric',
												exclude: 'current,minutely,hourly',
												appid: '14ebe588d1c79155db3489426bef631c',
												lang: 'hu'
											}
										}).then(function(result) {
											var main = result.data.daily[0];
											var answer = city + ', ma: ' + ((main.weather[0] || {}).description || 'nincs adat') + ','
												+ ' átlagosan: ' + main.temp.day + '&deg;C, minimum: ' + main.temp.min + '&deg;C, maximum: ' + main.temp.max + '&deg;C,'
												+ ' reggel: ' + main.temp.morn + '&deg;C, délután: ' + main.temp.eve + '&deg;C, éjszaka: ' + main.temp.night + '&deg;C';
											BotManager.writeMessage(room, answer, this.PREFIX);
										}.bind(this));
									}
								}.bind(this));
							}, ['!előrejelzés']);
						}
					});

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
				}
			});
		} else if (HoloChat.user.get('name').toUpperCase() === 'BOMBABOT') {
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
						var storage = BotManager.getBotStorage(room, this);
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
						var storage = BotManager.getBotStorage(room, this);
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
		} else if (HoloChat.user.get('name').toUpperCase() === 'TRIVIABOT') {
			manager.registerPlugin({
				PLUGIN_NAME: 'TRIVIA',
				PREFIX: '&#128172;',
				TROPHY: '&#127942;',
				SECONDS: 40,
				questions: null,
				partitions: [],
				onPluginAdded: function(manager) {
					var that = this;
					FileSys.readFile('etc/trivia.json', function(error, result) {
						if (error) throw error;
						var data = JSON.parse(result);
						var previousSum = 0, questionSum = 0; that.questions = data;
						Object.keys(that.questions).forEach(function(category) {
							previousSum = questionSum;
							questionSum += Object.keys(that.questions[category]).length;
							that.partitions['[' + previousSum + '..' + (questionSum-1) + ']'] = category;
						});
						that.partitions.total = questionSum;
					});
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
							storage.triviaAnswers = {};
							Object.keys(questionObject[storage.triviaQuestion]).forEach(function(key) {
								storage.triviaAnswers[key] = questionObject[storage.triviaQuestion][key]
							})
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
		} else if (HoloChat.user.get('name').toUpperCase() === 'HANGMAN!') {
			manager.registerPlugin({
				PLUGIN_NAME: 'HANGMAN',
				PREFIX: '&#11088;',
				TROPHY: '&#127942;',
				ALPHABET: 'AÁBCDEÉFGHIÍJKLMNOÓÖŐPQRSTUÚÜŰVWXYZ',
				MINUTES: 3,
				answers: null,
				onPluginAdded: function(manager) {
					var that = this;
					FileSys.readFile('etc/hangman.json', function(error, result) {
						if (error) throw error;
						var data = JSON.parse(result);
						that.answers = data.answers;
					});
					manager.registerCommand(this, '!hangman', function(command, parameters) {
						if (this.answers === null) return 'Sajnálom, nem sikerült betölteni az adatbázist';
						var room = BotManager.currentRoom;
						var storage = BotManager.getBotStorage(room);
						if (storage.wordGameTimer === undefined) {
							storage.previousAnswers = storage.previousAnswers || [];
							var gameAnswers = this.answers;
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
		}
    }
};
