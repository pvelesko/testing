define(['../idvcjs/signal',], function(Signal) {

var communicationTube = function() {
  var events = {};
  return {
    send: function(eventName, data) {
      var event = events[eventName];
      if (event) event.raise(data);
    },
    recv: function(eventName, handler, obj) {
      var event = events[eventName];
      if (!event) {
          event = Signal.create();
          events[eventName] = event;
      }
      event.subscribe(obj, handler);
    }
  }
}();

return communicationTube;

});
