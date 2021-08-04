define(['../idvcjs/utils', './request'], function(Utils, Request) {

var ids = new Map();
var requests = new Map();
var responces = new Map();

function enumTextAndAttrNodes(attrNames, callbackAttr, callbackText, parent) {
  attrNames = attrNames || [];
  parent = parent || document.body;
  callbackAttr = callbackAttr || function(){};
  callbackText = callbackText || function(){};

  var childNodes = parent.childNodes;
  if (!childNodes) return;

  [].forEach.call(childNodes, function(node) {
    if (node.nodeName === 'svg') return;

    switch (node.nodeType) {
    case 1:
      attrNames.forEach(function(attrName) {
        callbackAttr(node, attrName);
      });
      enumTextAndAttrNodes(attrNames, callbackAttr, callbackText, node);
      break;
    case 3:
      callbackText(node);
      break;
    }
  });
}

function processElement(attrNames, elem) {
  elem = Utils.getDomElement(elem) || document.body;
  enumTextAndAttrNodes(attrNames, processAttr, processTextNode, elem);
  sendRequests();
}

var idTempl = /^%(\w+)%/;

function testContent(content) {
  var res = idTempl.exec(content);
  if (res && res.length > 1) {
    return res[1];
  }

  return undefined;
}

function processAttr(node, attrName) {
  var id = testContent(node.getAttribute(attrName));
  if (id) {
    var message = ids.get(id);
    if (message) updateAttr(node, attrName, message);
    else requests.set(id, updateAttr.bind(window, node, attrName));
  }
}

function processTextNode(node) {
  var id = testContent(node.nodeValue);
  if (id) {
    var message = ids.get(id);
    if (message) updateTextNode(node, message);
    else requests.set(id, updateTextNode.bind(window, node));
  }
}

function updateAttr(node, attrName, value) {
  node.setAttribute(attrName, value);
}

function updateTextNode(node, value) {
  node.nodeValue = value;
}

function applyI18nValues(values) {
  if (!values) return;

  if (!Array.isArray(values)) {
    values = [values];
  }

  values.forEach(function(value) {
    if (!value || !value.id) return;

    var apply = responces.get(value.id);
    if (apply) {
      apply(value.message);
      responces.delete(value.id);
    }

    ids.set(value.id, value.message);
  });
}

function sendRequests() {
  var message = 'i18n-';
  requests.forEach(function(apply, id) {
    message += id + ',';
    responces.set(id, apply);
  });

  requests.clear();

  Request.sendNotification(message);
}

function sendRequest(id) {
  Request.sendNotification('i18n-' + id);
}

Request.addConsumer('i18n', {
  process: applyI18nValues
});

return {
  processElement: processElement,
  processId: function(id, applyFn) {
    var message = ids.get(id);
    if (message) {
      applyFn(message)
    } else {
      responces.set(id, applyFn);
      sendRequest(id);
    }
  },
  addMessage: function(id, message) {
    ids.set(id, message);
  },
  getMessage: function(id) {
    return ids.get(id) || '';
  }
};

});
