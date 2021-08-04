define(['../idvcjs/utils', '../idvcjs/data_utils', './i18n', './request'], function(Utils, DataUtils, I18n, Request) {

function getErrorMessage(e, prefix, lineBr) {
  if (!e) return undefined;

  if (prefix === undefined) prefix = 'Data Loading Error: ';
  lineBr = lineBr || '<br>';

  var result;
  if (e.message) {
      var messageText = prefix + DataUtils.escapeHTML(e.message);
      if (e.stack) {
      messageText +=
          DataUtils.escapeHTML(e.stack)
          .split('\n')
          .map(function(item) {
              if (item) return lineBr + '<span class="stack_item">' + item + '</span>';

              return item;
          })
          .join('');
      }
      messageText += '<span class="message_btn close_btn button icon"></span>';
      messageText += '<span class="message_btn copy_btn button icon"></span>';
      result = messageText;
  }

  return result;
}

function showErrorMessage(messageText) {
  if (loadingMessage &&
      messageText) {
    document.body.classList.remove('no_data');
    document.body.classList.add('data_loading');

    loadingMessage.innerHTML = messageText;
  }
}

function logError(msg, url, lineNo, columnNo, e) {
  var messageText;

  if (e && e.message) {
    messageText = (e.name ? e.name + ': ' : '') + e.message + (e.stack ? '\n' + e.stack : '');
  } else {
    messageText = [
      'Message: ' + msg,
      'URL: ' + url,
      'Line: ' + lineNo,
      'Column: ' + columnNo
    ].join(' - ');
  }

  Request.sendNotification('error-' + messageText);

  return false;
}

var loadingMessage = document.getElementById('roofline_data_loading_message');
loadingMessage.onmousedown = function(e) {
  if (e.target &&
      e.target.classList) {
    if (e.target.classList.contains('close_btn')) {
      loadingMessage.innerHTML = I18n.getMessage('roofline_loading');
      setTimeout(Request.receiveData.bind(Request, 'refreshRooflineView', '1000'), 100);

      Request.clearLastError();
    } else if (e.target.classList.contains('copy_btn')) {
      Request.sendNotification('errorcopy-' + Request.getLastErrorMessage().replace(/\n/g, ' - '));
    }
  }
}

window.onerror = logError;

return {
  getMessage: getErrorMessage,
  showMessage: showErrorMessage,
  handleException: function(e) {
    logError('', '', 0, 0, e);
  }
}

});
