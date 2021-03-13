HoloChat.models.ChatUser = Backbone.Model.extend({
    defaults: {
        id: null,
        type: null,
        originalId: null,
        name: null,
        gender: null,
        age: null,
        status: null,
        roomRoles: null,
        roomParams: null,
        bans: null,
        custom: null,
        customPrivate: null,
        ignores: null,
        ignoreds: null,
        setting: null
    },
    isContact: function(userId) {
        return !!HoloChat.contacts.get(userId);
    },
    isIgnored: function(userId) {
        var ignores = this.get('ignores');
        return ignores !== null && ignores[userId] === true;
    },
    isIgnoredMe: function(userId) {
        var ignoreds = this.get('ignoreds');
        return ignoreds !== null && ignoreds[userId] === true;
    },
    addIgnore: function(userId) {
        var ignores = this.get('ignores');
        ignores[userId] = true;
        this.unset('ignores', {
            silent: true
        });
        this.set('ignores', ignores);
    },
    removeIgnore: function(userId) {
        var ignores = this.get('ignores');
        delete ignores[userId];
        this.unset('ignores', {
            silent: true
        });
        this.set('ignores', ignores);
    },
    addIgnored: function(userId) {
        var ignoreds = this.get('ignoreds');
        ignoreds[userId] = true;
        this.unset('ignoreds', {
            silent: true
        });
        this.set('ignoreds', ignoreds);
    },
    removeIgnored: function(userId) {
        var ignoreds = this.get('ignoreds');
        delete ignoreds[userId];
        this.unset('ignoreds', {
            silent: true
        });
        this.set('ignoreds', ignoreds);
    },
    getRoomRole: function(roomId) {
        return typeof this.get('roomRoles')[roomId] != 'undefined' ? this.get('roomRoles')[roomId] : 'user';
    },
    setRoomRole: function(roomId, role) {
        var roles = this.get('roomRoles');
        if (role == 'user') {
            if (typeof roles[roomId] != 'undefined') {
                delete roles[roomId];
            }
        } else {
            roles[roomId] = role;
        }
        this.set('roomRoles', roles);
    },
    getSetting: function(group, field, defaultValue) {
        var setting = this.get('setting') || {};
        if (typeof setting[group] != 'undefined' && typeof setting[group][field] != 'undefined') {
            return setting[group][field];
        }
        return defaultValue;
    },
    setSetting: function(group, field, value) {
        if (value === this.getSetting(group, field, null)) {
            return;
        }
        var setting = this.get('setting') || {};
        if (typeof setting[group] == 'undefined') {
            setting[group] = {};
        }
        setting[group][field] = value;
        this.unset('setting', {
            silent: true
        });
        this.set('setting', setting);
    },
    deleteSetting: function(group, field) {
        var setting = this.get('setting') || {};
        if (typeof setting[group] != 'undefined' && typeof setting[group][field] != 'undefined') {
            delete setting[group][field];
        }
        this.unset('setting', {
            silent: true
        });
        this.set('setting', setting);
    },
    setCustomPrivateData: function(field, value) {
        var customPrivate = this.get('customPrivate') || {};
        if (typeof customPrivate[field] === 'undefined' || customPrivate[field] !== value) {
            customPrivate[field] = value;
            this.unset('customPrivate', {
                silent: true
            });
            this.set('customPrivate', customPrivate);
            HoloChat.events.trigger('user:changePrivateData', field, value);
        }
    },
    getRoomParam: function(roomId, param, defaultValue) {
        var roomParams = this.get('roomParams') || {};
        if (typeof roomParams[roomId] == 'undefined') {
            return defaultValue;
        }
        return roomParams[roomId][param];
    },
    setRoomParam: function(roomId, param, value) {
        var roomParams = this.get('roomParams') || {};
        if (typeof roomParams[param] === 'undefined' || roomParams[param] !== value) {
            roomParams[roomId][param] = value;
            this.unset('roomParams', {
                silent: true
            });
            this.set('roomParams', roomParams);
            HoloChat.events.trigger('user:changeRoomParam', roomId, param, value);
        }
    },
    setRoomParams: function(roomId, params) {
        var roomParams = this.get('roomParams') || {};
        roomParams[roomId] = params;
        this.set('roomParams', roomParams);
    },
    incRoomUnread: function(roomId) {
        var roomParams = this.get('roomParams') || {};
        if (typeof roomParams[roomId] == 'undefined') {
            roomParams[roomId] = {
                unreadMessageCount: 0,
                lastReadMessageId: 0
            };
        }
        roomParams[roomId].unreadMessageCount++;
        this.set('roomParams', roomParams);
        HoloChat.container.rooms.get(roomId).set('unreadMessageCount', roomParams[roomId].unreadMessageCount);
    },
    resetRoomUnread: function(roomId, messageId) {
        var roomParams = this.get('roomParams') || {};
        if (typeof roomParams[roomId] == 'undefined') {
            roomParams[roomId] = {
                unreadMessageCount: 0,
                lastReadMessageId: 0
            };
        }
        roomParams[roomId].unreadMessageCount = 0;
        roomParams[roomId].lastReadMessageId = messageId;
        this.set('roomParams', roomParams);
        HoloChat.container.rooms.get(roomId).set('unreadMessageCount', 0);
    },
    flatten: function() {
        return HoloChat.flattenObject(this.toJSON());
    }
});
