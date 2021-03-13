HoloChat.models.ChatRoomTree = Backbone.Model.extend({
    defaults: {
        id: null,
        name: null,
        parentId: null,
        custom: null,
        rules: null
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
    }
});
