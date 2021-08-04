define([], function() {

var consumers = {};
var lastError = null;

function processRequest(id, data) {
  function parse(data) {
    if (typeof data === 'string') {
      return (new Function('return ' + data))();
    } else {
      return data;
    }
  }

  var consumer = consumers[id];
  if (consumer && consumer.process) {
    try {
      consumer.process(parse(data));
    }
    catch(e) {
      lastError = {
        message: e.message,
        stack: e.stack,
        data: data
      }

      if (consumer.onerror) {
        consumer.onerror(e, data);
      }

      console.error(e);
    }
  } else if (id === 'executeScript') {
    (new Function(data))();
  }
}

var idAttribute = 'data-consumer-id';
var dataAttribute = 'data-consumer-data';

var notificationLink;
var requestId = 'idvc_global_request';

(function create(){
  var requestDiv = document.createElement('div');
  requestDiv.style.display = 'none';
  requestDiv.id = requestId;
  requestDiv.onclick = function() {
    var id = requestDiv.getAttribute(idAttribute);
    if (id) {
      processRequest(id, requestDiv.getAttribute(dataAttribute));
    }

    requestDiv.setAttribute(idAttribute, '');
    requestDiv.setAttribute(dataAttribute, '');
  };

  document.body.appendChild(requestDiv);

  notificationLink = document.createElement('a');
  notificationLink.style.display = 'none';

  document.body.appendChild(notificationLink);
})();

var result = {
  addConsumer: function(id, consumer) {
    consumers[id] = consumer;
  },
  receiveData: processRequest,
  sendNotification: function(message) {
    if (!notificationLink || !message) return;

    if (!window.idvcGlobalSender) {
      notificationLink.setAttribute("href", 'callbackdata:' + message);
      notificationLink.click();
    } else {
      window.idvcGlobalSender.sendNotification(message);
    }
  },
  getLastError: function() {
    return lastError;
  },
  clearLastError: function() {
    lastError = null;
  },
  getLastErrorMessage: function() {
    function addMessageItem(item) {
      return item ? item + '\n' : '';
    }

    if (lastError) {
      return addMessageItem(lastError.message) + addMessageItem(lastError.stack) + addMessageItem(lastError.data);
    }

    return '';
  },
  isRequestClick: function(target) {
    return target && (target === notificationLink ||
                      target.id === requestId);
  }
};

window.idvcGlobalRequest = result;

return result;

});