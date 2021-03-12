HoloChat.models.ChatRoomMessage = Backbone.Model.extend({
    defaults: {
        id: null,
        type: null,
        time: null,
        user: null,
        data: null
    },
    initialize: function() {}
});
