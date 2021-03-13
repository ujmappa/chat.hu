HoloChat.models.ChatRoom = Backbone.Model.extend({
    defaults: {
        id: null,
        name: null,
        type: null,
        users: null,
        messages: null,
        rules: null,
        userCount: null,
        treeId: null,
        unreadMessageCount: null,
        custom: null,
        lastMessage: null
    },
    initialize: function() {
        var users = this.get('users');
        var collection = new HoloChat.collections.users();
        if (users) {
            if (Array.isArray(users)) {
                for (var i = 0; i < users.length; i++) {
                    collection.add(HoloChat.container.users.add(users[i]), {
                        merge: true
                    });
                }
            } else {
                collection = users;
            }
        }
        this.set('users', collection);
        var messages = this.get('messages');
        var collection = new HoloChat.collections.roomMessages();
        if (messages) {
            var lastMessage = null;
            for (var i = 0; i < messages.length; i++) {
                var message = new HoloChat.models.ChatRoomMessage(messages[i]);
                collection.add(message);
                // New Folder: Big no-no.. this will raise change, use variable and set after loop
                /*
                // if (this.get('lastMessage') === null || this.get('lastMessage').id < message.id) {
                //     this.set('lastMessage', message);
                // }
                */
                if (lastMessage === null || lastMessage.id < message.id) {
                    lastMessage = message;
                }
            }
            this.set('lastMessage', lastMessage);
        }
        this.set('messages', collection);
    },
    hasRule: function(rule) {
        var rules = this.get('rules');
        return rules !== null && typeof rules[rule] != 'undefined';
    },
    getRule: function(rule) {
        return this.hasRule(rule) ? this.get('rules')[rule] : null;
    },
    getUserRule: function(rule, user) {
        rule = this.getRule(rule);
        if (rule) {
            if (typeof rule[user.getRoomRole(this.id)] != 'undefined') {
                return rule[user.getRoomRole(this.id)];
            } else if (typeof rule['*'] != 'undefined') {
                return rule['*'];
            }
        }
        return null;
    },
    getMultiUserRule: function(rule, user1, user2) {
        var user1Rule = this.getUserRule(rule, user1);
        if (user1Rule) {
            if (typeof user1Rule[user2.getRoomRole(this.id)] != 'undefined') {
                return user1Rule[user2.getRoomRole(this.id)];
            } else if (typeof user1Rule['*'] != 'undefined') {
                return user1Rule['*'];
            }
        }
        return null;
    },
    getPartner: function() {
        var partner;
        this.get('users').each(function(model) {
            if (model.id !== HoloChat.user.id) {
                partner = model;
            }
        });
        return partner;
    }
});
