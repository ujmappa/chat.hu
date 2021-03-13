HoloChat.collections.roomMessages = Backbone.Collection.extend({
    model: HoloChat.models.ChatRoomMessage,
    comparator: 'id'
});