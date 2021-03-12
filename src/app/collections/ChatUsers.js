HoloChat.collections.users = Backbone.Collection.extend({
    model: HoloChat.models.ChatUser,
    comparator: function (model) {
        return model.get('name').toLowerCase();
    }
});