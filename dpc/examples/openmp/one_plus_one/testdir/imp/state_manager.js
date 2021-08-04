define(['../idvcjs/utils', '../idvcjs/signal'], function(Utils, Signal) {

var stateManager = (function(){
  var processors = {};
  var saveCall;
  var saveTimeout = 2000;
  var savingDisabled = false;
  var saveCallback;

  var rooflineState = {};

  function saveCurrentState() {
    if (saveCallback) saveCallback('rooflineState-' + JSON.stringify(rooflineState));
  }


  function forEachProcessors(process) {
    Object.getOwnPropertyNames(processors).forEach(function(prop) {
      var processor = processors[prop];
      if (processor && process) {
        process(processor);
      }
    });
  }

  return {
    init: function(callback1, callback2) {
      saveCallback = callback2;

      require(['./roofline_state'],
        function() {
          if (window.rooflineState) {
            rooflineState = window.rooflineState;
            delete window.rooflineState;
          }
          callback1();
        },
        callback1
      );
    },
    disableSaving: function() {
      savingDisabled = true;
    },
    enableSaving: function() {
      savingDisabled = false;
    },
    apply: function(state, id) {
      if (state) Utils.applyObjectProperties(rooflineState, state);

      if (!rooflineState) return;

      var args = [].slice.call(arguments, 2);

      var processorApply = function(processor) {
        if (processor && processor.apply) {
          this._callProcessor(processor, processor.apply, rooflineState, args);
        }
      }.bind(this);

      if (id) {
        processorApply(processors[id]);
      } else {
        forEachProcessors(processorApply);
      }
    },
    save: function(id) {
      if (savingDisabled) return;

      if (id) {
        var processor = processors[id];
        if (processor && processor.saveState) {
          var args = [].slice.call(arguments, 1);
          this._callProcessor(processor, processor.saveState, this.getState(), args);
        }
      }

      moduleInstance.onChangeSettings.raise(id);

      if (!saveCall) saveCall = Utils.createAsyncCall(saveCurrentState, undefined, saveTimeout);

      saveCall.call();
    },
    changeSetting: function(id, value, doProcessing) {
      var state = this.getState();
      state[id] = value;

      this.apply(undefined, id, doProcessing ? {doProcessing: true} : undefined);
    },
    onClose: function() {
      if (saveCall &&
          saveCall.isCalled()) {
        saveCall.cancel();
        saveCurrentState();
      }
    },
    getState: function(state) {
      var saveAll = !!state;
      state = state || rooflineState || {};

      if (saveAll) {
        Utils.copyObject(rooflineState, state);

        var args = [].slice.call(arguments, 1);
        forEachProcessors(function(processor) {
          if (processor && processor.saveState) {
            this._callProcessor(processor, processor.saveState, state, args);
          }
        }.bind(this));
      }

      return state;
    },
    addProcessor: function(id, processor) {
      if (processor) processors[id] = processor;

      return processor;
    },
    _callProcessor: function(processor, method, state, args) {
      if (!method || !processor) return;

      args = args || [];
      method.apply(processor, [state].concat(args));
    }
  };
})();

function addBoolSetting(settingName, isNecessary) {
  var boolSetting = {
    get: function() {
      var state = stateManager.getState();
      return isNecessary ? !!state[settingName] : state[settingName] !== false;
    },
    set: function(val) {
      var state = stateManager.getState();
      if (state[settingName] !== val) {
        state[settingName] = val;
        stateManager.save(settingName);
      }
    }
  };

  return boolSetting;
}

function processApplyParam(param, process, value) {
  if (!param || !param.doProcessing) return;

  if (process) process(value);
}

function addCheckSetting(checkBoxId, settingName, process, isNecessary, getValueFn) {
  var checkBox = Utils.getDomElement(checkBoxId);
  if (!checkBox) return;

  getValueFn = getValueFn || (val => val);

  checkBox.onchange = function(e) {
    stateManager.save(settingName);

    if (process) process(e.target.checked);
  };

  stateManager.addProcessor(settingName, {
    apply: function(state, param) {
      if (state) {
        var checkedValue = getValueFn(true);
        var unCheckedValue = getValueFn(false);
        checkBox.checked = isNecessary ? state[settingName] === checkedValue : state[settingName] !== unCheckedValue;

        processApplyParam(param, process, checkBox.checked);
      }
    },
    saveState: function(state) {
      state[settingName] = getValueFn(checkBox.checked);
    }
  });
}

function addComboSetting(comboId, settingName, process, defIndex, getValueFn) {
  var comboBox = Utils.getDomElement(comboId);
  if (!comboBox) return;

  getValueFn = getValueFn || (val => val);

  comboBox.onchange = function(e) {
    stateManager.save(settingName);

    if (process) process(e.target.selectedIndex);
  };

  stateManager.addProcessor(settingName, {
    apply: function(state, param) {
      if (state) {
        var index = defIndex;

        var settingItem = state[settingName];
        if (settingItem !== undefined) {
          var settingValue = getValueFn(settingItem);
          if (settingItem === settingValue) {
            index = settingValue;
          } else {
            for (var i = 0, len = comboBox.length; i < len; i++) {
              if (settingItem === getValueFn(i)) {
                index = i;
                break;
              }
            }
          }
        }

        comboBox.selectedIndex = index;

        processApplyParam(param, process, comboBox.selectedIndex);
      }
    },
    saveState: function(state) {
      state[settingName] = getValueFn(comboBox.selectedIndex);
    }
  });
}

function addTextSetting(editId, settingName, validate, process, defText) {
  var editor = Utils.getDomElement(editId);
  if (!editor) return;

  editor.oninput = function(e) {
    if (validate && validate(e.target.value)) stateManager.save(settingName);

    if (process) process(e.target.value);
  };

  stateManager.addProcessor(settingName, {
    apply: function(state, param) {
      if (state) {
        var text = defText;
        var settingValue = state[settingName];
        if (settingValue !== undefined) {
          text = settingValue;
        }
        editor.value = text;

        processApplyParam(param, process, editor.value);
      }
    },
    saveState: function(state) {
      var settingValue = state[settingName];
      var newValue = editor.value;
      if (newValue !== settingValue) {
        if (newValue && newValue !== defText) state[settingName] = newValue;
        else if (settingValue) delete state[settingName];
      }
    }
  });
}

function addRadioGroupSetting(radioGroupId, settingName, process, defValue) {
  var radioGroup = Utils.getDomElement(radioGroupId);
  if (!radioGroup) return;

  var currentValue = defValue;

  function getRadioButton(value) {
    return radioGroup.querySelector('input[value="' + value + '"]');
  }

  radioGroup.onchange = function(e) {
    if (!e || !e.target) return;

    currentValue = e.target.value;
    stateManager.save(settingName);

    if (process) process(currentValue);
  };

  stateManager.addProcessor(settingName, {
    apply: function(state, param) {
      if (state) {
        var savedValue = state[settingName];
        if (savedValue) currentValue = savedValue;

        var btn = getRadioButton(currentValue);
        if (btn) btn.checked = true;

        processApplyParam(param, process, currentValue);
      }
    },
    saveState: function(state) {
      if (currentValue !== defValue)
        state[settingName] = currentValue;
      else
        delete state[settingName];
    }
  });
}

var moduleInstance = {
  onChangeSettings: Signal.create(),
  get: function() {
    return stateManager;
  },
  addBoolSetting: addBoolSetting,
  addCheckSetting: addCheckSetting,
  addComboSetting: addComboSetting,
  addTextSetting: addTextSetting,
  addRadioGroupSetting: addRadioGroupSetting
};

return moduleInstance;

});