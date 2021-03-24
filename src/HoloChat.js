var HoloChat = {
    collections: {},
    models: {},
    container: { rooms: null, users: null },
    rooms: null,
    users: null,
    customRooms: null,
    publicRooms: null,
    publicTrees: null,
    server: null,
    user: null,
    contacts: null,
    manager: null,
    actionHandlers: {},
    userId: null,
    sessionId: null,
    url: null,
    events: null,
    processingMessage: false,
    debugMode: false,
    templates: {},
    init: function () {
        var target = this.events = {};
        [Backbone.Events].forEach(function(source) {
            Object.getOwnPropertyNames(source).forEach(function(propName) {
                Object.defineProperty(target, propName, Object.getOwnPropertyDescriptor(source, propName));
            });
        });
        this.reset();
        this.addManager(this.manager);
    },
    reset: function () {
        this.user = new HoloChat.models.ChatUser();
        if (this.rooms === null) {
            this.rooms = new this.collections.rooms();
            this.customRooms = new this.collections.rooms();
            this.publicRooms = new this.collections.rooms();
            this.publicTrees = new this.collections.trees();
            this.users = new this.collections.users();
            this.contacts = new this.collections.users();
            this.container.users = new this.collections.users();
            this.container.rooms = new this.collections.rooms();
        } else {
            this.rooms.remove(this.rooms.models);
            this.customRooms.remove(this.customRooms.models);
            this.publicRooms.remove(this.publicRooms.models);
            this.publicTrees.remove(this.publicTrees.models);
            this.users.remove(this.users.models);
            this.contacts.remove(this.contacts.models);
        }
    },
    start: function (params) {
        this.userId = params.userId;
        this.sessionId = params.sessionId;
        this.debugMode = params.debug;
        this.url = params.url;
        this.connect();
    },
	stop: function() {
		this.server.stop();
	},
    connect: function () {
        this.server.start(this.url);
    },
    debug: function (title, value) {
        if (this.debugMode) {
            var date = new Date();
            console.log(date.getHours().toString().padLeft('00') + ':' + date.getMinutes().toString().padLeft('00') + ':' + date.getSeconds().toString().padLeft('00') + '.' + date.getMilliseconds().toString().padLeft('000') + ' *** ' + title + ' ***');
            if (arguments.length == 2) {
                console.log(value);
            }
        }
    },
    addManager: function (manager) {
        for (var action in manager.__actions) {
            this.registerActionHandler(action, manager, manager[manager.__actions[action]]);
        }
        manager.__init();
    },
    registerActionHandler: function (action, manager, callback) {
        this.actionHandlers[action] = {
            handler: callback,
            manager: manager,
            params: callback.toString().match(/^function\s*[^\(]*\(([^\)]*)\)/m)[1].replace(/ /g, '').split(',')
        };
    },
    flattenObject: function (obj) {
        var result = {};
        for (var field in obj) {
            if (!obj.hasOwnProperty(field)) {
                continue;
            }
            if (typeof obj[field] === 'function' || typeof obj[field] === 'object' && !!obj[field]) {
                var flatObject = this.flattenObject(obj[field]);
                for (var flatField in flatObject) {
                    if (!flatObject.hasOwnProperty(flatField)) {
                        continue;
                    }
                    result[field + '.' + flatField] = flatObject[flatField];
                }
            } else {
                result[field] = obj[field];
            }
        }
        return result;
    },
    evaluateRule: function (obj, rule) {
        if (rule === true || rule === false || ['[object Boolean]', '[object Number]', '[object String]'].indexOf(toString.call(rule)) > -1) {
            return rule;
        } else if (Array.isArray(rule) && rule.length >= 3) {
            var field = rule[1];
            switch (rule[0]) {
                default:
                    return false;
                case '<':
                    return typeof obj[field] != 'undefined' && obj[field] < this.evaluateRule(obj, rule[2]);
                case '<=':
                    return typeof obj[field] != 'undefined' && obj[field] <= this.evaluateRule(obj, rule[2]);
                case '>':
                    return typeof obj[field] != 'undefined' && obj[field] > this.evaluateRule(obj, rule[2]);
                case '>=':
                    return typeof obj[field] != 'undefined' && obj[field] >= this.evaluateRule(obj, rule[2]);
                case 'between':
                    return rule.length == 4 && typeof obj[field] != 'undefined' && obj[field] >= this.evaluateRule(obj, rule[2]) && obj[field] <= this.evaluateRule(obj, rule[3]);
                case 'not':
                    return typeof obj[field] != 'undefined' && obj[field] != this.evaluateRule(obj, rule[2]);
                case 'in':
                    return typeof obj[field] != 'undefined' && Array.isArray(rule[2]) && rule[2].indexOf(obj[field]) != -1;
                case 'or':
                    var result = false;
                    for (var i = 1; i < rule.length; i++) {
                        result = result || this.evaluateRule(obj, rule[i]);
                    }
                    return result;
                case 'and':
                    var result = true;
                    for (var i = 1; i < rule.length; i++) {
                        result = result && this.evaluateRule(obj, rule[i]);
                    }
                    return result;
            }
        } else if (typeof rule === 'function' || typeof rule === 'object' && !!rule) {
            var result = true;
            for (var field in rule) {
                result = result && typeof obj[field] != 'undefined' && obj[field] == this.evaluateRule(obj, rule[field]);
            }
            return result;
        } else {
            return false;
        }
    },
    addRoom: function (room) {
        var oldRoom = HoloChat.container.rooms.get(room.id);
        if (oldRoom) {
            oldRoom.set({
                name: room.get('name'),
                userCount: room.get('userCount'),
                type: room.get('type'),
                custom: room.get('custom'),
                treeId: room.get('treeId')
            });
            oldRoom.get('messages').set(room.get('messages').models);
            room.get('users').each(function (model) {
                var user = HoloChat.container.users.get(model.id);
                if (!user) {
                    user = HoloChat.container.users.add(new HoloChat.models.ChatUser(model));
                }
                oldRoom.get('users').add(user);
            });
            return oldRoom;
        } else {
            return HoloChat.container.rooms.add(room);
        }
    },
    onOpen: function () {
        this.debug('HoloChat.onOpen');
        this.manager.login(this.userId, this.sessionId);
    },
    onError: function (error) {
        this.debug('HoloChat.onError', error);
        HoloChat.events.trigger('chat:error', error);
    },
    onClose: function (e) {
        this.debug('HoloChat.onClose');
        HoloChat.events.trigger('chat:close');
    },
    onMessage: function () {
        if (this.processingMessage) return;
        this.processingMessage = true;
        var actionHandler, message, buffer = this.server.buffer; // New Folder: small tweak
        while (buffer.length) {
            message = buffer.shift();
            actionHandler = this.actionHandlers[message.action];
            if (actionHandler !== undefined) {
                var params = [], param;
                for (var i = 0; i < actionHandler.params.length; i++) {
                    param = actionHandler.params[i];
                    params.push(typeof message.data[param] != 'undefined' ? message.data[param] : null);
                }
                actionHandler.handler.apply(actionHandler.manager, params);
            }
        }
        this.processingMessage = false;
    }
};
