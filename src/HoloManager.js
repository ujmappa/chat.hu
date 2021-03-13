HoloChat.manager = {
    __actions: {
        userLogin: 'onUserLogin',
        userLogout: 'onUserLogout',
        login: 'onLogin',
        changeUserStatus: 'onChangeUserStatus',
        newRoom: 'onNewRoom',
        enterRoom: 'onEnterRoom',
        userEnterRoom: 'onUserEnterRoom',
        changePublicRoomUserCount: 'onChangePublicRoomUserCount',
        leaveRoom: 'onLeaveRoom',
        userLeaveRoom: 'onUserLeaveRoom',
        alterUser: 'onAlterUser',
        newMessage: 'onNewMessage',
        updateMessage: 'onUpdateMessage',
        typingMessage: 'onTypingMessage',
        readMessage: 'onReadMessage',
        addIgnore: 'onAddIgnore',
        removeIgnore: 'onRemoveIgnore',
        addIgnored: 'onAddIgnored',
        removeIgnored: 'onRemoveIgnored',
        addContact: 'onAddContact',
        removeContact: 'onRemoveContact',
        changeUserData: 'onChangeUserData',
        changePrivateData: 'onChangePrivateData',
        loadMessages: 'onLoadMessages',
        deleteRoom: 'onDeleteRoom',
        newBan: 'onNewBan',
        addCustomRoom: 'onAddCustomRoom',
        removeCustomRoom: 'onRemoveCustomRoom',
        stop: 'onStop'
    },
    __init: function() {
        HoloChat.events.on('room:enter', this.enterRoom, this);
        HoloChat.events.on('room:leave', this.leaveRoom, this);
        HoloChat.events.on('room:new', this.createRoom, this);
        HoloChat.events.on('message:load', this.loadMessages, this);
        HoloChat.events.on('message:send', this.newMessage, this);
        HoloChat.events.on('message:read', this.readMessage, this);
        HoloChat.events.on('message:typing', this.typingMessage, this);
        HoloChat.events.on('user:ignore:add', this.addIgnore, this);
        HoloChat.events.on('user:ignore:remove', this.removeIgnore, this);
        HoloChat.events.on('user:alter:show', this.showAlterUser, this);
        HoloChat.events.on('user:alter:send', this.sendAlterUser, this);
        HoloChat.events.on('user:alter', this.alterUser, this);
        HoloChat.events.on('user:ban:show', this.showBanUser, this);
        HoloChat.events.on('user:ban:send', this.sendBanUser, this);
        HoloChat.events.on('user:ban', this.banUser, this);
        HoloChat.events.on('user:invite:show', this.showInviteUser, this);
        HoloChat.events.on('user:invite:send', this.sendInviteUser, this);
        HoloChat.events.on('user:invite', this.inviteUser, this);
        HoloChat.events.on('user:add:show', this.showAddUser, this);
        HoloChat.events.on('user:add:send', this.sendAddUser, this);
        HoloChat.events.on('user:add', this.addUser, this);
        HoloChat.events.on('user:kick', this.kickUser, this);
        HoloChat.events.on('user:changeStatus', this.changeUserStatus, this);
        HoloChat.events.on('user:changePrivateData', this.changePrivateData, this);
        HoloChat.events.on('room:delete', this.deleteRoom, this);
    },
    onAddCustomRoom: function(room) {
        HoloChat.customRooms.add(HoloChat.addRoom(new HoloChat.models.ChatRoom(room)));
    },
    onRemoveCustomRoom: function(roomId) {
        this.onDeleteRoom(roomId);
    },
    onStop: function() {
        HoloChat.server.socket = null;
        HoloChat.events.trigger('chat:stop');
    },
    onUserLogin: function(user) {
        if (!HoloChat.users.get(user.id)) {
            HoloChat.users.add(HoloChat.container.users.add(user.id == HoloChat.user.id ? HoloChat.user : new HoloChat.models.ChatUser(user), {
                merge: true
            }));
        }
        HoloChat.events.trigger('user:enter', user.id);
    },
    onUserLogout: function(userId) {
        HoloChat.events.trigger('user:leave:before', userId);
        HoloChat.users.remove(userId);
        HoloChat.container.users.remove(userId);
        HoloChat.events.trigger('user:leave', userId);
    },
    onNewBan: function(ban) {
        var bans = HoloChat.user.get('bans');
        bans.push(ban);
        HoloChat.user.unset('bans', {
            silent: true
        });
        HoloChat.user.set('bans', bans);
    },
    deleteRoom: function(roomId) {
        HoloChat.server.send('deleteRoom', {
            roomId: roomId
        });
    },
    onDeleteRoom: function(roomId) {
        HoloChat.events.trigger('room:destroy:before', roomId);
        HoloChat.customRooms.remove(roomId);
        HoloChat.container.rooms.remove(roomId);
        HoloChat.rooms.remove(roomId);
        HoloChat.events.trigger('room:destroy:after', roomId);
    },
    loadMessages: function(roomId, minMessageId) {
        HoloChat.server.send('loadMessages', {
            roomId: roomId,
            minMessageId: minMessageId
        });
    },
    onLoadMessages: function(roomId, messages) {
        var room = HoloChat.rooms.get(roomId);
        if (room) {
            if (messages.length == 0) {
                room.set('allMessagesLoaded', true);
            } else {
                var collection = room.get('messages');
                for (var i = messages.length - 1; i >= 0; i--) {
                    var message = messages[i];
                    if (!collection.get(message.id)) {
                        collection.add(new HoloChat.models.ChatRoomMessage(message));
                    }
                }
                HoloChat.events.trigger('message:loaded', roomId);
            }
        }
    },
    onChangePrivateData: function(data) {
        HoloChat.user.set('customPrivate', data);
    },
    onChangeUserData: function(userId, field, data) {
        var user = HoloChat.container.users.get(userId);
        if (user) {
            if (typeof data === 'object' && !!data) {
                user.unset(field, { silent: true });
            }
            user.set(field, data);
        }
    },
    changePrivateData: function(field, data) {
        HoloChat.server.send('changeUserCustomPrivateData', {
            field: field,
            data: data
        });
    },
    changeUserSetting: function() {
		Cookies.set('HoloChatSetting-' + HoloChat.user.id, JSON.stringify(HoloChat.user.get('setting')), { expires: 30, path: '/' });
    },
    getUserSetting: function() {
        return JSON.parse(Cookies.get('HoloChatSetting-' + HoloChat.user.id) || null);
    },
    readMessage: function(roomId, messageId) {
        HoloChat.user.resetRoomUnread(roomId, messageId);
        HoloChat.events.trigger('room:changeUnread', roomId);
        HoloChat.server.send('readMessage', {
            roomId: roomId,
            messageId: messageId
        });
    },
    createRoom: function(type, userIds) {
        HoloChat.server.send('createRoom', {
            type: type,
            userIds: userIds
        });
    },
    login: function(userId, sessionId) {
        HoloChat.server.send('login', {
            userId: userId,
            sessionId: sessionId
        });
    },
    onLogin: function(user, rooms, customRooms, publicRooms, publicTrees, contacts, users) {
        for (var i = 0; i < contacts.length; i++) {
            HoloChat.contacts.add(HoloChat.container.users.add(new HoloChat.models.ChatUser(contacts[i]), {
                merge: true
            }));
        }
        for (var i = 0; i < users.length; i++) {
            HoloChat.users.add(HoloChat.container.users.add(new HoloChat.models.ChatUser(users[i]), {
                merge: true
            }));
        }
        // New Folder - first custom rooms (tree, users, settings)
        for (var i = 0; i < customRooms.length; i++) {
            HoloChat.customRooms.add(HoloChat.addRoom(new HoloChat.models.ChatRoom(customRooms[i])));
        }
        // New Folder - then the user itself (to provide data for settings)
        HoloChat.user = HoloChat.container.users.add(new HoloChat.models.ChatUser(user), {
            merge: true
        });
        HoloChat.user.on('change:setting', this.changeUserSetting, this);
        HoloChat.user.set('setting', this.getUserSetting());
        // New Folder - then every other room (with messages referring to user)
        for (var i = 0; i < publicRooms.length; i++) {
            HoloChat.publicRooms.add(HoloChat.addRoom(new HoloChat.models.ChatRoom(publicRooms[i])));
        }
        for (var i = 0; i < rooms.length; i++) {
            HoloChat.rooms.add(HoloChat.addRoom(new HoloChat.models.ChatRoom(rooms[i])));
        }
        for (var i = 0; i < publicTrees.length; i++) {
            HoloChat.publicTrees.add(new HoloChat.models.ChatRoomTree(publicTrees[i]));
        }
        HoloChat.events.trigger('chat:start');
    },
    changeUserStatus: function(status) {
        HoloChat.server.send('changeUserStatus', {
            status: status
        });
    },
    onChangeUserStatus: function(userId, status) {
        var user = HoloChat.container.users.get(userId);
        if (user) {
            user.set('status', status);
        }
    },
    addUser: function(userId, roomId) {
        HoloChat.server.send('addUser', {
            userId: userId,
            roomId: roomId
        });
    },
    inviteUser: function(userId, roomId) {
        HoloChat.server.send('inviteUser', {
            userId: userId,
            roomId: roomId
        });
    },
    kickUser: function(roomId, userId) {
        HoloChat.server.send('kickUser', {
            userId: userId,
            roomId: roomId
        });
    },
    addIgnore: function(userId) {
        HoloChat.server.send('addIgnore', {
            userId: userId
        });
    },
    removeIgnore: function(userId) {
        HoloChat.server.send('removeIgnore', {
            userId: userId
        });
    },
    onAddIgnore: function(userId) {
        HoloChat.user.addIgnore(userId);
        HoloChat.events.trigger('ignore:add', userId);
    },
    onRemoveIgnore: function(userId) {
        HoloChat.user.removeIgnore(userId);
        HoloChat.events.trigger('ignore:remove', userId);
    },
    onAddIgnored: function(userId) {
        HoloChat.user.addIgnored(userId);
        HoloChat.events.trigger('ignored:add', userId);
    },
    onRemoveIgnored: function(userId) {
        HoloChat.user.removeIgnored(userId);
        HoloChat.events.trigger('ignored:remove', userId);
    },
    onAddContact: function(user) {
        HoloChat.contacts.add(HoloChat.container.users.add(new HoloChat.models.ChatUser(user), {
            merge: true
        }));
        HoloChat.events.trigger('contact:add', user.id);
    },
    onRemoveContact: function(userId, type) {
        HoloChat.contacts.remove(userId);
        HoloChat.events.trigger('contact:remove', userId);
    },
    newMessage: function(roomId, text) {
        if (text != '') {
            HoloChat.server.send('newMessage', {
                roomId: roomId,
                text: text
            });
        }
    },
    typingMessage: function(roomId) {
        HoloChat.server.send('typingMessage', {
            roomId: roomId
        });
    },
    banUser: function(roomId, userId, type, expiration, reason) {
        HoloChat.server.send('banUser', {
            roomId: roomId,
            userId: userId,
            type: type,
            expiration: expiration,
            reason: reason
        });
    },
    alterUser: function(roomId, userId, role) {
        HoloChat.server.send('alterUser', {
            roomId: roomId,
            userId: userId,
            role: role
        });
    },
    onAlterUser: function(roomId, userId, role) {
        var room = HoloChat.rooms.get(roomId);
        if (room) {
            var user = room.get('users').get(userId);
            if (user) {
                user.setRoomRole(roomId, role);
                HoloChat.events.trigger('user:changeRole', roomId, userId);
            }
        }
    },
    enterRoom: function(roomId) {
        if (HoloChat.rooms.get(roomId)) {
            HoloChat.events.trigger('user:enterRoom', roomId, HoloChat.user.id);
        } else {
            HoloChat.server.send('enterRoom', { roomId: roomId });
        }
    },
    onEnterRoom: function(room, params) {
        HoloChat.user.setRoomParams(room.id, params);
        HoloChat.rooms.add(HoloChat.addRoom(new HoloChat.models.ChatRoom(room)));
        HoloChat.events.trigger('room:create', room.id);
        HoloChat.events.trigger('user:enterRoom', room.id, HoloChat.user.id);
    },
    onUserEnterRoom: function(roomId, user) {
        var room = HoloChat.rooms.get(roomId);
        if (room) {
            room.get('users').add(HoloChat.container.users.add(new HoloChat.models.ChatUser(user), {
                merge: true
            }));
            HoloChat.events.trigger('user:enterRoom', roomId, user.id);
        }
    },
    onChangePublicRoomUserCount: function(roomId, userCount) {
        var room = HoloChat.publicRooms.get(roomId);
        room.set('userCount', userCount);
    },
    leaveRoom: function(roomId) {
        if (HoloChat.rooms.get(roomId)) {
            HoloChat.server.send('leaveRoom', {
                roomId: roomId
            });
        }
    },
    onLeaveRoom: function(roomId) {
        HoloChat.events.trigger('user:leaveRoom:before', roomId, HoloChat.user.id);
        HoloChat.rooms.remove(roomId);
        HoloChat.events.trigger('user:leaveRoom:after', roomId, HoloChat.user.id);
    },
    onUserLeaveRoom: function(roomId, userId) {
        var room = HoloChat.rooms.get(roomId);
        if (room) {
            HoloChat.events.trigger('user:leaveRoom:before', roomId, userId);
            room.get('users').remove(userId);
            HoloChat.events.trigger('user:leaveRoom:after', roomId, userId);
        }
    },
    onNewRoom: function(room, params) {
        HoloChat.user.setRoomParams(room.id, params);
        HoloChat.rooms.add(HoloChat.addRoom(new HoloChat.models.ChatRoom(room)));
        HoloChat.events.trigger('room:create', room.id);
    },
    onNewMessage: function(roomId, message) {
        var room = HoloChat.rooms.get(roomId);
        if (room) {
            message = new HoloChat.models.ChatRoomMessage(message);
            if (message.get('user').id != HoloChat.user.id) {
                HoloChat.user.incRoomUnread(roomId);
                HoloChat.events.trigger('room:changeUnread', roomId);
            } else if (message.get('type') == 'autotext') {} else {
                HoloChat.user.resetRoomUnread(roomId, message.id);
            }
            room.set('lastMessage', message);
            room.get('messages').add(message);
            HoloChat.events.trigger('message:create', roomId, message.id);
        }
    },
    onUpdateMessage: function(roomId, message) {
        var room = HoloChat.rooms.get(roomId);
        if (room) {
            var oldMessage = room.get('messages').get(message.id);
            if (oldMessage) {
                oldMessage.set('data', message.data);
                oldMessage.set('user', message.user);
                oldMessage.set('time', message.time);
                oldMessage.set('type', message.type);
            }
        }
    },
    onTypingMessage: function(roomId, userId) {
        HoloChat.events.trigger('user:typing', roomId, userId);
    },
    onReadMessage: function(roomId, userId, messageId) {
        HoloChat.events.trigger('user:read', roomId, userId, messageId);
    }
};
