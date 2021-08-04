require.config({
  waitSeconds: 0
});

require([
  'imp/zooming',
  'imp/state_manager',
  'imp/representation',
  'imp/value_utils',
  'imp/request',
  'imp/data',
  'imp/ui_utils',
  'imp/stack_view',
  'imp/i18n',
  'imp/error_handling',
  'imp/context_menu',
  'imp/events',
  'imp/roofs_utils',
  'idvcjs/utils',
  'idvcjs/roofline'
],
function(Zooming, StateManager, Representation, ValueUtils, Request, Data, UiUtils, StackView, I18n, Errors, ContextMenu, Events, RoofsUtils, Utils, Roofline) {

var defaultRooflineType;
var defaultRooflineHrType;

var viewModeDefValue = 'fittoview';
var fileExtensionsForCompare = ['advixeexp', 'advixeexpz'];

var stateManager = StateManager.get();

var contentLoadedSender = {
  stateLoaded: false,
  initialized: false,
  initStateManager: function() {
    this.stateLoaded = true;
    this._send();
  },
  setInitialized: function() {
    this.initialized = true;
    this._send();
  },
  _send: function() {
    if (this.stateLoaded && this.initialized) sendNotification('contentLoaded');
  }
}

function isClassContained(name) {
  return document.body.classList.contains(name);
}

function isDataLoading() {
  return isClassContained('data_loading');
}

function isNoData() {
  return isClassContained('no_data');
}

function isAliveResult(path) {
  if (!path) return false;

  return fileExtensionsForCompare.some(ext => path.endsWith(ext));
}

var isReport = (function() {
  var isReportMode;

  return function() {
    if (isReportMode === undefined) {
      isReportMode = document.body.classList.contains('report');
    }

    return isReportMode;
  }
})();

stateManager.init(contentLoadedSender.initStateManager.bind(contentLoadedSender), sendNotification);

var zoomer;

function onChangeZoomer(param) {
  if (param && param.stopMoving) return;

  updateZoomButtons();
  updateMouseMode();
  Events.send('rooflineDataUpdated', {isOldData: true, changingZoomFrame: true});
  Events.send('zoomFrameChanged');
}

function flashFoldedSplitter() {
  if (!splitter) return;

  UiUtils.flashElement(function() {
    splitter.splitterDiv.classList.add('roofline_flash');
  }, function() {
    splitter.splitterDiv.classList.remove('roofline_flash');

    //update splitter content to improve animation behavour in xulrunner
    splitter.removeSash();
    splitter.addSash();

    splitter.splitterDiv.setAttribute(UiUtils.tooltipAttr, getSplitterTooltip());
    splitter.sashDiv.setAttribute(UiUtils.tooltipAttr, getSplitterTooltip());
  }, 2000);
}

Request.addConsumer('refreshRooflineView', {
  process: function(priority) {
    priority = priority || 1;
    var data = Data.getRooflineData();
    if (data &&
        (!data.updatedView || priority > 100)) {
      data.updatedView = true;
      setTimeout(function() {
        Events.send('rooflineDataUpdated', {isOldData: true});

        if (Data.isHierarchical() &&
            priority <= 100 &&
            splitter && splitter.isSecondaryFolded()) {
          flashFoldedSplitter();
        }
      }, 100);
    }
  }
});

function processChangeUndoList() {
  updateZoomButtons();
  StackView.refresh();
}

var getSplitterTooltip = (function() {
  var splitterTooltip;

  return function() {
    if (!splitterTooltip) splitterTooltip = I18n.getMessage('roofline_show_callstack_tooltip');

    return splitterTooltip;
  }
})();

Request.addConsumer('threadsInfo', {
  process: function (data) {
    function getValidNumber(number) {
      return number > 0 ? number : 1;
    }
    function getCoreCount4Roofs(numberOfThreads, coreCount) {
      if (numberOfThreads > 1) numberOfThreads += numberOfThreads % 2;

      return numberOfThreads < coreCount ? numberOfThreads : coreCount;
    }

    if (!data) return;

    var coreCountPhysical = getValidNumber(data.physicalCoreCount);
    var numberOfThreads = getValidNumber(data.usedNumberOfThreads);
    var processorPackageCount = getValidNumber(data.processorPackageCount);
    var coreCount4Roofs = getCoreCount4Roofs(numberOfThreads, coreCountPhysical);

    // update status bar:
    var coresValue = document.getElementById('cores_value');
    coresValue.innerHTML = coreCountPhysical;
    var threadsValue = document.getElementById('threads_value');
    threadsValue.innerHTML = numberOfThreads;
    summaryExpansion.refreshSize();

    rooflineCoreCountSelector.init(coreCount4Roofs, coreCountPhysical, processorPackageCount);
  }
});

Request.addConsumer('rooflineData', {
  //TODO: these messages should be moved to message catalog some day.
  showNoDataToCompare: function(caption) {
    UiUtils.toast('No data to compare' + (caption ? ' in ' + caption : ''));
  },
  showNoDataToCompareBadFileType: function(filePath) {
    var errMsg = '.<br/>Suggestion: Use a ' + fileExtensionsForCompare.map(el => '*.' + el).join(' or ') + ' file type.';

    //discclient part has already processed back slashes to forward slashes
    //so we have only forward slashes here
    var fileName = filePath.split('/').pop();
    fileName = fileName ? fileName : filePath;

    UiUtils.toast('This file type cannot be loaded for comparison: ' + fileName + errMsg);
  },
  noStackErrors: 0,
  process: function(data) {
    var isDataFiltered = Data.isFiltered();
    var isNewData = false;

    var state = stateManager.getState();
    var useSTRoofsStrategy = !!state.useSTRoofsStrategy;

    var roofsConfig = RoofsUtils.getRoofsConfiguration(Data.getThreadCount(), useSTRoofsStrategy, Data.getPackageCount());

    var isFirstDataSetting = isDataLoading() || isNoData();
    var isEmptyData = true;

    if (data) {
      isEmptyData = !data.loops || !data.loops.length;

      if (isDataFiltered && !data.isFiltered) data.isFiltered = true;

      if (data.resultInfo) {
        var caption = compareSelector.getCaption(data.resultInfo.path);
        if (caption) data.resultInfo.caption = caption;

        if (data.loading) {
          data.resultInfo.loading = true;
          delete data.loading;
        } else if (data.comparing) {
          data.resultInfo.comparing = true;
          delete data.comparing;
        }
      }

      isNewData = Data.isNewData(data);
      roofsConfig.isNewData = Number(isNewData);
      var isGoodAdvisorResult = true;

      if (data.resultInfo && data.resultInfo.path) isGoodAdvisorResult = isAliveResult(data.resultInfo.path);

      if (!isNewData &&
          isEmptyData &&
          !isGoodAdvisorResult) {

        this.showNoDataToCompareBadFileType(data.resultInfo.path);
        return;
      }

      Data.setRooflineData(data, roofsConfig.threadCount,
                           RoofsUtils.getRoofsStrategyId(useSTRoofsStrategy), roofsConfig.packageCount);

      if (isNewData) Data.setWholeView(state.viewMode && state.viewMode !== viewModeDefValue);
    }

    zoomer = Zooming.get(Data.isHierarchical());
    zoomer.zoomChanged.subscribe(undefined, onChangeZoomer);
    zoomer.undoListChanged.subscribe(undefined, processChangeUndoList);
    zoomer.clearDataUndo();
    updateZoomButtons();

    StackView.fill(null);
    ContextMenu.clear();

    var flashSplitter;
    if (splitter) {
      splitter.splitterDiv.classList.remove('roofline_flash');

      if (!Data.isHierarchical()) {
        if (!splitter.isSecondaryFolded() || !splitter.isSplitterHidden()) splitter.foldSecondary(true);
      } else {
        if (stackViewVisibleSetting.get()) {
          if (splitter.isSecondaryFolded()) splitter.unfold();
        } else {
          if (!splitter.isSecondaryFolded() || splitter.isSplitterHidden()) splitter.foldSecondary();

          flashSplitter = splitter.isSecondaryFolded();
        }
      }
    }

    compareSelector.init();

    if (!isNewData || Data.getRoofs().length !== 0 || data.noDataMessage) {
      Events.send('rooflineDataUpdated', { isOldData: !isNewData, isNewRoofs: true });

      var resultCount = Data.getResultCount();

      if (data && !data.noDataMessage) {
        if (isNewData) {
          if (isFirstDataSetting) toolbar.refreshSize();
          if (splitter && flashSplitter) flashFoldedSplitter();
        }

        if (isReport() && resultCount <= 1) {
          compareSelector.hide();
        }
      }

      if (!isNewData ||
          resultCount > 1) {
        compareSelector.update();
      }
    } else {
      if (flashSplitter && splitter) splitter.flashSplitter = true;
      sendChangeRoofsNotification(roofsConfig.str());
    }

    this.noStackErrors = 0;
  },
  onerror: function(e, rawData) {
    if (rawData.indexOf('resultInfo') > 0) {
      this.showNoDataToCompare();
    } else if (e.stack ||
        this.noStackErrors) {
      this.noStackErrors = 0;
      Errors.showMessage(Errors.getMessage(e));
    } else {
      this.noStackErrors = 1;
      setTimeout(Events.send.bind(Events, 'rooflineDataUpdated'), 100);
    }
  }
});

Request.addConsumer('comparisonInfo', {
  process: function(data) {
    if (!data || !data.comparison || !data.comparison.length) {
      UiUtils.toast('No matched loops/functions found');
    }

    if (Data.updateComparisonResults(data)) {
      compareSelector.update();
    }
  }
});

Request.addConsumer('changedRoofs', {
  process: function (data) {
    if (!data) return;

    var isFirstRoofsSetting = isDataLoading();

    Data.addRoofs(data.roofs);
    Events.send('rooflineDataUpdated', { isOldData: !data.isNewData, isNewRoofs: true });

    if (isFirstRoofsSetting) toolbar.refreshSize();

    if (data.isNewData && splitter && splitter.flashSplitter) {
      flashFoldedSplitter();
      delete splitter.flashSplitter;
    }

    var resultCount = Data.getResultCount();
    for (var i = 1; i < resultCount; i++) {
      var resultInfo = Data.getResultInfo(i);
      if (resultInfo &&
          isAliveResult(resultInfo.path)) {
        sendLoadCompareNotification(resultInfo.path);
      }
    }
  }
});

Request.addConsumer('clearRoofline', {
  process: function() {
    Events.send('rooflineCleared');
  }
});

Request.addConsumer('endRooflineCopy', {
  process: function() {
    var hiddenItems = document.querySelectorAll('.hidden4copy');
    [].forEach.call(hiddenItems, function(child) {
      child.style.display = 'block';
    });

    if (legendArea) {
      legendArea.style.display = 'block';
    }
  }
});

Request.addConsumer('uiInfo', {
  process: function(info) {
    if (!info) return;

    if (info.fontSize) {
      document.body.style.fontSize = info.fontSize;
    }

    if (info.scale) {
      var scale = info.scale;
      if (typeof scale === 'string') Representation.setScale(parseFloat(scale));
      else if (typeof scale === 'number') Representation.setScale(scale);
    }

    if (info.configuration) {
      Representation.setConfiguration(info.configuration);
    }

    if (Array.isArray(info.i18n) &&
        info.i18n.length) {
      Request.receiveData('i18n', info.i18n);
    }

    var rooflineTypeBar = Utils.getElementById('roofline_type_bar');

    if (info.defaultRooflineType) defaultRooflineType = info.defaultRooflineType;
    if (info.defaultRooflineHrType) defaultRooflineHrType = info.defaultRooflineHrType;

    if (info.dataOptions || info.enableIntRoofline) {
      rooflineTypeBar.style.display = '';

      rooflineDataSelector.init(info.dataOptions);

      //If options have more than 2 elements, then we have integrated roofline memory level choices.
      Representation.setConfiguration({loops: {
        integratedRooflineType: info.dataOptions.groups.length > 2
      }});

      if (info.useHierarchicalData !== undefined) {
        rooflineDataSelector.setOption('0', !!info.useHierarchicalData);
      }
    } else {
      rooflineTypeBar.style.display = 'none';

      if (info.useHierarchicalData !== undefined) {
        stateManager.getState().rooflineType = info.useHierarchicalData ? defaultRooflineHrType : defaultRooflineType;
      }
    }

    sendReady4Data();
  }
});

Request.addConsumer('simpleRooflineView', {
  process: function() {
    document.body.classList.add('simple_view');
    pointBtn.click();
  }
});

Request.addConsumer('hierarchy', {
  process: function(data) {
    Data.setHierarchicalData(data);
  }
});

Request.addConsumer('loopsths', {
  process: function(data) {
    var state = stateManager.getState();

    if (state && !state.loopsThs) {
      state.loopsThs = data;
      stateManager.apply(undefined, 'loopsThs');
    }
  }
});

Request.addConsumer('rooflineState', {
  process: function(data) {
    stateManager.apply(data);
  }
});

Request.addConsumer('onClose', {
  process: function() {
    stateManager.onClose();
  }
});

Request.addConsumer('useHierarchicalData', {
  process: function(data) {
    var newChecked = !!data;

    if (rooflineDataSelector.setOption('0', newChecked)) {
      sendReady4Data();
    }
  }
});

function sendNotification(message) {
  Request.sendNotification(message);
}

function sendLoadCompareNotification(path) {
  sendNotification('loadcompare-' + (path ? path : ''));
}

function sendChangeRoofsNotification(config) {
  sendNotification('changeRoofs-' + config);
}

var toolbar = (function() {
  var expansion = UiUtils.addExpansion({
    expansionClassName: 'toolbar_expansion roofline_popup_shadow',
    bodyId: 'roofline_zoom_toolbar',
    expandBtnId: 'expand_toolbar_content'
  }, function() {
    return !isNoData();
  });

  function closeSelect(e) {
    if (!window.rooflineActiveSelect) return;

    if (e && e.target && e.target.classList.contains('no_close_popup')) return;

    if (e && Request.isRequestClick(e.target)) return;

    var btn = window.rooflineActiveSelect;
    delete window.rooflineActiveSelect;

    var popupList = btn.firstElementChild;
    if (popupList) {
      if (popupList.style.left) {
        popupList.style.left = '';
        popupList.style.right = '';
      }

      if (popupList.style.minWidth) {
        popupList.style.minWidth = '';
      }
    }

    btn.classList.remove('pressed');

    window.removeEventListener('click', arguments.callee, false);
  }

  function addSelectSpan(btn, popupList) {
    if (!btn || !popupList) return;

    if (!btn.idvcBtnSpan) {
      btn.idvcBtnSpan = Utils.createElement('', 'idvcjs_span', undefined, btn, 'div');
    }

    if (!btn.idvcBtnSpan.style.top) {
      btn.idvcBtnSpan.style.top = (popupList.offsetTop - 1) + 'px';
    }
  }

  function setActiveSelect(elem) {
    if (window.rooflineActiveSelect) closeSelect();

    window.rooflineActiveSelect = elem;
    window.addEventListener('click', closeSelect, false);
  }

  return {
    refreshSize: function() {
      expansion.refreshSize();
    },
    connect: function(elem, onclick, animation) {
      var item = Utils.getDomElement(elem);

      if (!item) return;

      onclick = onclick || item.onclick;

      if (!onclick) return;

      item.onclick = '';

      if (animation) {
        UiUtils.setAnimatedClick(item, onclick, animation);
      } else {
        item.classList.add('simple_click');
        item.onclick = onclick;
      }
    },
    defSelectBtnProc: function(e) {
      var btn = e.currentTarget;

      if (e && e.target && e.target.classList.contains('no_close_popup')) return;

      if (btn) {
        btn.classList.toggle('pressed');
        e.stopPropagation();
        e.preventDefault();

        if (btn.classList.contains('pressed')) {
          setActiveSelect(btn);

          var popupList = btn.firstElementChild;
          var popupPos = Utils.getElementPos(popupList);
          if (popupPos.x < 0) {
            var btnPos = Utils.getElementPos(btn);
            popupList.style.left = '-' + btnPos.x + 'px';
            popupList.style.right = 'auto';
          }

          addSelectSpan(btn, popupList);
        } else {
          closeSelect();
        }
      }
    },
    popupProc: function(e) {
      var control = e.currentTarget;

      if (control && control.classList.contains('disabled')) return;

      if (control && !control.classList.contains('pressed')) {
        control.classList.add('pressed');

        e.stopPropagation();
        e.preventDefault();

        setActiveSelect(control);

        var popupList = control.firstElementChild;

        UiUtils.updatePopupWidth(control, popupList);
        UiUtils.updatePopupPos(control, popupList);

        addSelectSpan(control, popupList);
      }
    }
  }
})();

var pointBtn = document.getElementById('select_point');
var zoomBtn = document.getElementById('select_zoom');
var moveBtn = document.getElementById('select_hand');
var undoBtn = document.getElementById('undo_zoom');
var redoBtn = document.getElementById('redo_zoom');
var cancelBtn = document.getElementById('cancel_zoom');
var copyBtn = document.getElementById('copy_content');
var selectBtn = document.getElementById('copy_content_select');

var summary = document.getElementById('roofline_summary');
var selfCaption = document.getElementById('self_caption');
var selfValue = document.getElementById('self_value');
var selfMeasure = document.getElementById('self_measure');
var totalCaption = document.getElementById('total_caption');
var totalValue = document.getElementById('total_value');
var totalMeasure = document.getElementById('total_measure');

var summaryExpansion = UiUtils.addExpansion({
  expansionClassName: 'summary_expansion roofline_popup_shadow',
  bodyId: 'roofline_summary',
  expandBtnId: 'expand_summary_content'
});

function setBtnEnabled(btn, enabled) {
  if (enabled) Utils.removeClass(btn, 'disabled');
  else Utils.addClass(btn, 'disabled');
}

function updateZoomButtons() {
  var state = {undo: false, redo: false, cancel: false};
  if (Data.getRooflineData()) {
    state = zoomer.getZoomState();
  }

  setBtnEnabled(undoBtn, state.undo);
  setBtnEnabled(redoBtn, state.redo);
  setBtnEnabled(cancelBtn, state.cancel);
}

function updateSummary(quiet) {
  if (!Data.getRooflineData()) return;

  var selectedPoints = roofline.selectedPoints;

  if (!selectedPoints.length) {
    summary.classList.add('no_selection');
  } else {
    summary.classList.remove('no_selection');
  }

  var loopsSelfTime = 0;
  var loopsTotalTime = 0;
  selectedPoints.forEach(function(point) {
    var loop = point.loopData;
    loopsSelfTime += loop.selfElapsedTime || loop.selfTime;
    loopsTotalTime += loop.totalElapsedTime || loop.totalTime;
  });

  if (!quiet) summary.classList.remove('summary_updated');

  var data = Data.getRooflineData();
  var selfTimeAttr = data.attrs.selfElapsedTime || data.attrs.selfTime;
  var totalTimeAttr = data.attrs.totalElapsedTime || data.attrs.totalTime;

  selfCaption.innerHTML = selfTimeAttr.name + ':';
  totalCaption.innerHTML = totalTimeAttr.name + ':';
  selfMeasure.innerHTML = selfTimeAttr.measure;
  totalMeasure.innerHTML = totalTimeAttr.measure;
  selfValue.innerHTML = ValueUtils.formatTime(loopsSelfTime);
  totalValue.innerHTML = ValueUtils.formatTime(loopsTotalTime);

  summaryExpansion.refreshSize();

  if (!quiet) {
    setTimeout(function() {
      summary.classList.add('summary_updated');

      setTimeout(function() {
        summary.classList.remove('summary_updated');
      }, 1500);
    }, 50);
  }
}

var MouseModes = {
  zoom: 'zoom',
  point: 'point',
  move: 'move'
}

var mouseMode = MouseModes.zoom;

var moveDragProcessor = {
  x: undefined,
  y: undefined,
  processing: false,
  lastFrame: undefined,
  centralPartPos: undefined,
  startDragging: function(posX, posY) {
    this.x = posX;
    this.y = posY;
    this.lastFrame = undefined;
    this.processing = true;

    this.centralPartPos = roofline.centralPart.body.getBoundingClientRect();

    roofline.centralPart.body.style.cursor = Utils.Consts.browserPrefix + 'grabbing';
    roofline.centralPart.enableTooltip(false);

    Events.send('zoomFrameMoved', true);
  },
  stopDragging: function(posX, posY) {
    if (this.processing && this.lastFrame) {
      zoomer.setZoom(this.lastFrame, {stopMoving: true});
      this.processing = false;
    }

    roofline.centralPart.body.style.cursor = Utils.Consts.browserPrefix + 'grab';
    roofline.centralPart.enableTooltip(true);

    Events.send('zoomFrameMoved', false);
  },
  dragging: function(posX, posY) {
    if (!this.processing || !this._isIn(posX, posY)) return;

    var oldX = roofline.centralPart.screenP2LX(this.x);
    var oldY = roofline.centralPart.screenP2LY(this.y);

    var newX = roofline.centralPart.screenP2LX(posX);
    var newY = roofline.centralPart.screenP2LY(posY);

    var newFrame = zoomer.moveCurrentZoomFrame(oldX - newX, oldY - newY);

    if (newFrame &&
        !newFrame.isWrongZoom &&
        this._isNewFrame(newFrame)) {
      this.lastFrame = newFrame;

      Events.send('rooflineDataUpdated', {isOldData: true, movingZoomFrame: newFrame});
    }
  },
  _isNewFrame: function(frame) {
    return !this.lastFrame ||
           this.lastFrame.minX !== frame.minX ||
           this.lastFrame.maxX !== frame.maxX ||
           this.lastFrame.minY !== frame.minY ||
           this.lastFrame.maxY !== frame.minX;
  },
  _isIn: function(posX, posY) {
    return posX >= this.centralPartPos.left &&
           posX <= this.centralPartPos.right &&
           posY >= this.centralPartPos.top &&
           posY <= this.centralPartPos.bottom;
  }
}

var mouseModes = [
  {
    type: MouseModes.point,
    btn: pointBtn
  },
  {
    type: MouseModes.zoom,
    btn: zoomBtn
  },
  {
    type: MouseModes.move,
    btn: moveBtn,
    cursor: Utils.Consts.browserPrefix + 'grab',
    on: function() {
      roofline.centralPart.setDragProcessor(moveDragProcessor);
    },
    off: function() {
      roofline.centralPart.createFreeSelection();
    }
  }
];

function updateMouseMode(newMode) {
  function setPressed(btn, pressed) {
    if (pressed) Utils.addClass(btn, 'pressed');
    else Utils.removeClass(btn, 'pressed');
  }

  if (this.classList && this.classList.contains('disabled')) return;

  if (!newMode) {
    var state = {undo: false, redo: false, cancel: false};
    if (Data.getRooflineData()) {
      state = zoomer.getZoomState();
    }

    if (mouseMode ===  MouseModes.move && !state.cancel) {
      newMode = MouseModes.zoom;
    }

    setBtnEnabled(moveBtn, state.cancel);
  }

  var oldMode;
  var changing = newMode && newMode !== mouseMode;
  if (changing) {
    oldMode = mouseMode;
    mouseMode = newMode;
  }

  mouseModes.forEach(function(mode) {
    setPressed(mode.btn, mouseMode === mode.type);

    if (changing && oldMode === mode.type && mode.off) {
      mode.off();
    }

    if (mouseMode === mode.type) {
      if (changing && mode.on) mode.on();

      roofline.centralPart.body.style.cursor = mode.cursor || 'default';
    }
  });
}

toolbar.connect(pointBtn, updateMouseMode.bind(pointBtn, MouseModes.point));
toolbar.connect(zoomBtn, updateMouseMode.bind(zoomBtn, MouseModes.zoom));
toolbar.connect(moveBtn, updateMouseMode.bind(moveBtn, MouseModes.move));

function changeZoom(prop) {
  if (this.classList && this.classList.contains('disabled')) return;

  if (Data.getRooflineData() &&
      zoomer) {
    var state = zoomer.getZoomState();
    if (state[prop]) {
      zoomer[prop + 'Zoom']();
    }
  }
}

var clickAnimationClass = 'pressing';
toolbar.connect(undoBtn, changeZoom.bind(undoBtn, 'undo'), clickAnimationClass);
toolbar.connect(redoBtn, changeZoom.bind(redoBtn, 'redo'), clickAnimationClass);
toolbar.connect(cancelBtn, changeZoom.bind(cancelBtn, 'cancel'), clickAnimationClass);

toolbar.connect(copyBtn, function() {
  var message = copyContent.getMessage();
  setTimeout(sendNotification.bind(window, message), 100);
}, clickAnimationClass);

toolbar.connect(selectBtn, toolbar.defSelectBtnProc);

function copyRooflineData() {
  var toObj = {};
  var fromObj = Data.getRooflineData();
  Utils.copyObject(fromObj, toObj, function(value, name) {
    return !((typeof value === 'object') && value.el ||
              name.indexOf('rooflineConnected') === 0 ||
              name.indexOf('matchingLoops') === 0 ||
              name === 'resultInfo');
  });
  return toObj;
}

const defSvgWidth = 1485;
const defSvgHeight = 1050;

function export2svg(size) {
  var width = size && size.width || defSvgWidth;
  var height = size && size.height || defSvgHeight;

  var rooflineContent = document.getElementById('roofline_content');
  if (rooflineContent) {
    var splitterWidth = splitter.splitterDiv.offsetWidth + splitter.secondaryDiv.offsetWidth - 1;
    if (splitterWidth < 0) splitterWidth = 0;

    rooflineContent.style.width = (width + splitterWidth) + 'px';
    rooflineContent.style.height = height + 'px';

    Utils.refreshSize(rooflineContent);

    var svgTemplate =
'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 %whole_width% %whole_height%">\n\
<style>\n\
  svg { font : caption; }\n\
    .idvcchart_axis { fill: none; stroke: gray; stroke-width: 1; vector-effect: non-scaling-stroke; shape-rendering: crispEdges; }\n\
    .idvcchart_axis_text { fill: #333; font-size: 95%25; stroke: none; stroke-width: 1; vector-effect: non-scaling-stroke; }\n\
    .idvcchart_roofline_text { fill: gray; font-size: 90%25; }\n\
    .idvcchart_roofline_text.selected { fill: #000; }\n\
    .idvcchart_roofline_text.hidden { fill: none; }\n\
    .idvcchart_roofline_explanation { fill: none; }\n\
    .idvcchart_roofline_center_marker { stroke: #000; stroke-width: 1 }\n\
    .roofline_child_line { stroke: none; fill: none; }\n\
    .roofline_parent_line { stroke: none; fill: none; }\n\
    .roofline_child_arrow { stroke: none; fill: none; }\n\
    .roofline_parent_arrow { stroke: none; fill: none; }\n\
    .roofline_loop { stroke: #000; stroke-width: 1; vector-effect: non-scaling-stroke; shape-rendering: geometricPrecision; fill: lightgray; }\n\
    .roofline_loop.no_loop_position { stroke: darkgray; fill: #eee; }\n\
    .roofline_loop.loop_inactive_result { opacity: 0.4; }\n\
    .idvcroofline_line { stroke: #999; stroke-dasharray: 4,4; fill: none; stroke-width: 1; vector-effect: non-scaling-stroke; shape-rendering: crispEdges; }\n\
    .idvcroofline_grid_line { stroke: #ddd; fill: none; stroke-width: 1; vector-effect: non-scaling-stroke; shape-rendering: crispEdges; }\n\
    .idvcroofline_line.selected { stroke: #000; shape-rendering: auto; stroke-dasharray: none; }\n\
    .line_hotarea { stroke: none; fill: none; }\n\
    .roofline_roofs_cross { stroke: none; fill: none; }\n\
    .roofline_coord_line { stroke: none; fill: none; stroke-width: 1; vector-effect: non-scaling-stroke; shape-rendering: crispEdges; }\n\
    .roofline_coord_line.selected { stroke: gray; stroke-dasharray: none !important; }\n\
    .roofline_expander { stroke: none; fill: none; }\n\
    .roofline_expander_vert_line { stroke: none; fill: none; }\n\
    .roofline_expander_horz_line { stroke: none; fill: none; }\n\
    .roof_crossing { stroke: none; fill: none; }\n\
    .roof_crossing_line { stroke: none; fill: none; }\n\
    .roof_crossing_label { stroke: none; fill: none; }\n\
    .loops_matching_line { stroke: none; fill: none; }\n\
    .loops_matching_label { stroke: none; fill: none; }\n\
    .loops_matching_arrow { stroke: none; fill: none; }\n\
    .total_value_tick_active { stroke: none; fill: none; }\n\
    .total_value_tick { stroke: none; fill: none; }\n\
    .idvc_hidden { stroke: none !important; fill: none !important; }\n\
</style>\n\
<g>\n\
  <svg id="vert_axis" viewBox="0 0 %vert_axis_width% %content_height%" width="%vert_axis_width%" height="%content_height%">\n\
    %vert_axis_content%\n\
  </svg>\n\
</g>\n\
<g transform="translate(%vert_axis_width%, %content_height%)">\n\
  <svg id="horz_axis" viewBox="0 0 %content_width% %horz_axis_height%" width="%content_width%" height="%horz_axis_height%">\n\
    %horz_axis_content%\n\
  </svg>\n\
</g>\n\
<g transform="translate(%vert_axis_width%, 0)">\n\
  <svg id="roofline_content" viewBox="0 0 %content_width% %content_height%" width="%content_width%" height="%content_height%">\n\
    %roofline_content%\n\
  </svg>\n\
</g>\n\
</svg>';

    var rooflineBody = rooflineContent.children[0];
    var content = rooflineBody.children[0];
    var vertAxis = rooflineBody.children[1];
    var horzAxis = rooflineBody.children[2];

    var data = Data.getRooflineData();

    var vertCaption = '<text x="2" y="2" style="font-size: 90%25; writing-mode: tb; dominant-baseline: text-after-edge">' + data.measureY + '</text>';
    var horzCaption = '<text x="' + (content.offsetWidth - 4) + '" y="' + (content.offsetHeight - 2) +
                      '" style="font-size: 90%25; text-anchor: end; dominant-baseline: text-after-edge"><tspan>' + data.measureX +
                      '</tspan><tspan style="font-size: 90%25;"> (' + data.nameX + ')</tspan></text>';

    var getDataAttr = /data-\w+\s*=\s*"[^"]*"/ig;

    var rooflineContentStr = content.children[0].innerHTML;
    rooflineContentStr = rooflineContentStr
      .replace(getDataAttr,  '')
      .replace(/<(tspan)[^<>]*>\?<\/\1>/ig, '')
      .replace(/<(\w+)[^<>]*idvc_hidden[^<>]*>[^<>]*<\/\1>/ig, '');

    function getAxisStr(axis) {
      var axisStr = axis.children[0].innerHTML;
      return axisStr.replace(getDataAttr, '');
    }

    var vertAxisStr = getAxisStr(vertAxis);
    var horzAxisStr = getAxisStr(horzAxis);

    var props = {};
    props['%vert_axis_width%'] = vertAxis.offsetWidth;
    props['%horz_axis_height%'] = horzAxis.offsetHeight;
    props['%content_width%'] = content.offsetWidth;
    props['%content_height%'] = content.offsetHeight;
    props['%whole_width%'] = content.offsetWidth + vertAxis.offsetWidth;
    props['%whole_height%'] = content.offsetHeight + horzAxis.offsetHeight;
    props['%vert_axis_content%'] = vertAxisStr;
    props['%horz_axis_content%'] = horzAxisStr;
    props['%roofline_content%'] = rooflineContentStr + vertCaption + horzCaption;

    var exportSvg = svgTemplate.replace(/%\w+%/g, function(prop) {
      return props[prop];
    });

    rooflineContent.style.width = '';
    rooflineContent.style.height = '';

    Utils.refreshSize(rooflineContent);
    return exportSvg;
  }
}

var copyContent = (function() {
  function hide4Copy() {
    UiUtils.hideStdTooltip();

    var hiddenItems = document.querySelectorAll('.hidden4copy');
    [].forEach.call(hiddenItems, function(child) {
      child.style.display = 'none';
    });

    if (legendArea && legendArea.classList.contains('collapsed')) {
      legendArea.style.display = 'none';
    }
  }

  function stdMessage(message) {
    hide4Copy();
    return message;
  }

  return {
    items: [{
      name: 'htmlexport',
      id: 'export_as_html',
      getMessage: function(prefix) {
        var result = prefix;

        var data = copyRooflineData();
        data.allRoofs = "%allRoofs%";

        var compareData = Data.getCompareData();
        if (compareData && compareData.length) data.compareData = compareData;

        result += '-' + JSON.stringify({
          rooflineData: data,
          rooflineState: stateManager.getState({}),
          threadsInfo: "%threadsInfo%",
          summaryInfo: "%summaryInfo%",
          currentZoom: zoomer ? zoomer.getCurrentZoom() : null,
        }).replace(/\"%(\w+)%\"/g, '$$$1$'); // "%word%" -> $word$
        return result;
      }
    }, {
      name: 'svgexport',
      id: 'export_as_svg',
      getMessage: function(prefix) {
        this._initInputs();
        if (!this.widthEdit || !this.heightEdit) return;

        this._checkInputValues();

        return prefix + '-' + export2svg({width: parseInt(this.widthEdit.value), height: parseInt(this.heightEdit.value)});
      },
      apply: function(state) {
        this._initInputs();
        if (!this.widthEdit || !this.heightEdit) return;

        if (state) {
          this.widthEdit.value = state.svgWidth || defSvgWidth;
          this.heightEdit.value = state.svgHeight || defSvgHeight;
        }
      },
      saveState: function(state) {
        function saveValue(value, propName, defValue) {
          var savedValue = parseInt(value);
          if (savedValue && savedValue !== defValue) state[propName] = savedValue;
          else delete state[propName];
        }

        this._initInputs();
        if (!this.widthEdit || !this.heightEdit) return;

        if (state) {
          saveValue(this.widthEdit.value, 'svgWidth', defSvgWidth);
          saveValue(this.heightEdit.value, 'svgHeight', defSvgHeight);
        }
      },
      _initInputs: function() {
        function checkInput(input) {
          if (input) {
            if (input.hasAttribute('width')) {
              this.widthEdit = input;
            } else {
              this.heightEdit = input;
            }

            input.onkeypress = UiUtils.filterNumberInput;
          }
        }

        if (!this.widthEdit || !this.heightEdit) {
          var parent = document.getElementById(this.id);
          if (parent) {
            var inputs = parent.querySelectorAll('input');

            [].forEach.call(inputs, checkInput, this);
          }
        }
      },
      _checkInputValues: function() {
        function checkInputValue(inout, defValue) {
          var value = parseInt(inout.value);
          if (!value) inout.value = defValue;
        }

        checkInputValue(this.widthEdit, defSvgWidth);
        checkInputValue(this.heightEdit, defSvgHeight);
      }
    }],
    index: 0,
    apply: function(state) {
      if (state) {
        if (state.copyContentIndex > 0) {
          var item = this.items[state.copyContentIndex];
          if (item) {
            updateCopyCommand(Utils.getElementById(item.id));
            this.index = state.copyContentIndex;
          } else {
            state.copyContentIndex = this.index;
          }
        }

        this.items.forEach(function(item) {
          if (item && item.apply) {
            item.apply(state);
          }
        });
      }
    },
    saveState: function(state) {
      if (state) {
        state.copyContentIndex = this.index;

        this.items.forEach(function(item) {
          if (item && item.saveState) {
            item.saveState(state);
          }
        });
      }
    },
    getMessage: function() {
      var item = this.items[this.index];
      if (item) return item.getMessage(item.name);
    }
  };
})();

var copyContentId = 'copyContent';

stateManager.addProcessor(copyContentId, copyContent);

function updateCopyCommand(target) {
  if (!target || target.classList.contains('selected')) return false;

  target.classList.add('selected');

  var tooltipText = '';
  if (target.childNodes.length) {
    tooltipText = target.childNodes[0].textContent;
  } else {
    tooltipText = target.innerHTML;
  }

  copyBtn.setAttribute(UiUtils.tooltipAttr, tooltipText);

  var sibling = target;
  var newIndex = 0;
  do {
    sibling = sibling.previousElementSibling;
    if (sibling) {
      sibling.classList.remove('selected');
      newIndex++;
    }
  } while (sibling);

  copyContent.index = newIndex;

  sibling = target;
  do {
    sibling = sibling.nextElementSibling;
    if (sibling) sibling.classList.remove('selected');
  } while (sibling);

  return true;
}

var copyContentList = document.getElementById('copy_content_items');
copyContentList.addEventListener('click', function(e) {
  if (!e.target ||
      (e.target.nodeName.toLowerCase() !== 'li')) {
    return;
  }

  if (updateCopyCommand(e.target)) {
    stateManager.save(copyContentId);
  }

  setTimeout(copyBtn.click.bind(copyBtn), 0);
});

window.addEventListener('keydown', function(e) {
  function isEditor(target) {
    return target.nodeName.toLowerCase() === 'input' &&
      target.type === 'number' || target.type === 'text';
  }

  if (e.ctrlKey) {
    switch (e.keyCode) {
      case 65: {
        if (isEditor(e.target)) {
          e.target.select();
        } else {
          e.preventDefault();
        }
      }; break;
      case 67: copyBtn.click(); break;
      case 107:
      case 187: e.preventDefault(); zoomer.zoomIn(); break;
      case 109:
      case 189: e.preventDefault(); zoomer.zoomOut(); break;
    }
  } else if (e.keyCode === 39 &&
             !isEditor(e.target)) {
    e.preventDefault();
  }
}, false);

StateManager.addRadioGroupSetting('roofline_view_mode', 'viewMode', function(value) {
  Data.setWholeView(value !== viewModeDefValue);
  Events.send('rooflineDataUpdated', {isOldData: true});
}, viewModeDefValue);

var stackViewVisibleSetting = StateManager.addBoolSetting('stackViewVisible');

var splitter = Utils.createHorzSplitter('roofline_content', 40, {splitterSize: 0.4});
splitter.setSize('80%');
splitter.addSash();
splitter.afterUnfold = function() {
  var currentLoop;
  if (roofline && roofline.currentPoint) currentLoop = roofline.currentPoint.loopData;
  StackView.fill(currentLoop);
  stackViewVisibleSetting.set(true);

  splitter.splitterDiv.removeAttribute(UiUtils.tooltipAttr);
  splitter.sashDiv.removeAttribute(UiUtils.tooltipAttr);
};
splitter.afterFoldSecondary = function() {
  var needSaveState = Data.isHierarchical();
  if (needSaveState && stackViewVisibleSetting.get()) stackViewVisibleSetting.set(false);
};
splitter.secondaryDiv.setAttribute('data-caption', '%roofline_callstack_caption%');
splitter.secondaryDiv.classList.add('roofline_stack_view');

Events.recv('loopsSelectionChanged', function (data) {
  if (!data) return;

  var quiet = !!data.quiet;
  var points = data.points;

  updateSummary(quiet);

  if (!quiet &&
      points &&
      points.length) {
    sendNotification(points.join(';'));
  }
});

var roofline = Representation.createRoofline(splitter.primaryDiv);

var legendArea = Utils.createElement('', 'legend_area', 'roofline_legend', splitter.primaryDiv);
legendArea.addEventListener('click', function(e) {
  if (e.target.id === 'roofline_legend') {
    legendArea.classList.toggle('collapsed');
    legendArea.classList.add('user_activity');
  }
}, false);

Utils.createElement('', 'axis_caption vert vert_text', 'roofline_vert_axis_caption', splitter.primaryDiv);
Utils.createElement('', 'axis_caption horz', 'roofline_horz_axis_caption', splitter.primaryDiv);

var stackView = StackView.create(splitter.secondaryDiv,
  Events.send.bind(Events, 'loopHighlighted'),
  undefined,
  Events.send.bind(Events, 'loopStateChanged'));

roofline.centralPart.onselectionchanged = function(startX, startY, endX, endY) {
  if (mouseMode === MouseModes.zoom) {
    var zoomFrame = {
      minX: startX,
      maxX: endX,
      minY: startY,
      maxY: endY
    };

    zoomer.setZoom(zoomFrame);
  } else if (mouseMode === MouseModes.point) {
    roofline.selectPoints(startX, startY, endX, endY);
  }

  roofline.centralPart.hideSelection();
};

roofline.onCurrentPointChanged.subscribe(null, function(point) {
  if (!splitter.isSecondaryFolded()) {
    StackView.fill(point ? point.loopData : undefined);
  }
});

updateMouseMode();

function sendReady4Data() {
  sendNotification('ready4data-' + (stateManager.getState().rooflineType || defaultRooflineType));
}

window.saveLocalProperty = function(name, data) {
  data = data || '';
  if (name) {
    sendNotification(name + '-' + JSON.stringify(data));
  }
}

ContextMenu.addProcessor({
  process: function(menuData) {
    if (!Data.isHierarchical()) return;

    if (!menuData) return;

    if (menuData.length) menuData.push({caption: '-'});

    menuData.push({
      caption: splitter.isSecondaryFolded() ? I18n.getMessage('roofline_menu_show_callstack') : I18n.getMessage('roofline_menu_hide_callstack'),
      id: 10,
      command: function() {
        if (splitter.isSecondaryFolded()) splitter.unfold();
        else splitter.foldSecondary();
      }
    });
  }
});

function isListItem(target) {
  return !!(target && target.nodeName.toLowerCase() === 'li');
}

function getItemIndex(target) {
  if (target) {
    var index = parseInt(target.getAttribute('data-index'));
    if (index >= 0) return index;
  }

  return -1;
}

var compareSelector = (function() {
  const loadingClass = 'loading';
  const comparingClass = 'comparing';
  const emptyClass = 'empty';
  const loopInactiveClass = 'loop_inactive_result';

  var control = document.getElementById('roofline_compare_control');

  var deleteBtn = document.getElementById('delete_compare');
  var loadBtn = document.getElementById('load_compare');

  var loadedCompareItems = document.getElementById('loaded_compare_items');
  var readyCompareItems = document.getElementById('ready_compare_items');

  var compareCaption = document.getElementById('roofline_compare_content');

  var init = (function() {
    var initialized = false;

    var noItemsAttr = 'data-noitems';

    return function() {
      if (initialized) return;

      var caption = I18n.getMessage('roofline_compare_noitems_label');
      loadedCompareItems.setAttribute(noItemsAttr, caption);
      readyCompareItems.setAttribute(noItemsAttr, caption);
    }
  })();

  toolbar.connect(control, toolbar.popupProc);

  toolbar.connect(loadBtn, function() {
    sendLoadCompareNotification();
  }, clickAnimationClass);

  toolbar.connect(deleteBtn, function() {
    Data.clearCompareData();
    Events.send('rooflineDataUpdated', {isOldData: true});
    imp.update();
  });

  function updateCaption(count) {
    var newCaption;

    if (count > 0) newCaption = Utils.format(I18n.getMessage('roofline_compare_data_label'), count.toString());
    else newCaption = I18n.getMessage('roofline_compare_nodata_label');

    if (newCaption) compareCaption.innerHTML = newCaption;
  }

  readyCompareItems.addEventListener('click', function(e) {
    if (!isListItem(e.target)) return;

    var index = getItemIndex(e.target);
    if (index >= 0) {
      sendLoadCompareNotification(compareItems.items[index].path);
    }
  });

  loadedCompareItems.addEventListener('click', function(e) {
    var target = e.target;

    if (!target) return;

    var index;

    if (target.parentElement &&
        isListItem(target.parentElement)) {
      index = getItemIndex(target.parentElement);
      if (index >= 1) {
        var deletedResultInfo = Data.getResultInfo(index);
        if (deletedResultInfo) {
          if (deletedResultInfo.compareItem) {
            delete deletedResultInfo.compareItem.added;
            delete deletedResultInfo.compareItem;
          }

          if (deletedResultInfo.added) {
            delete deletedResultInfo.added;
          }

          const parentClassList = target.parentElement.classList;
          if (parentClassList.contains(loadingClass) ||
              parentClassList.contains(comparingClass)) {
            sendNotification('cancelcompareloading-' + deletedResultInfo.path);
          }
        }

        Data.removeResult(index);

        Events.send('rooflineDataUpdated', {isOldData: true});
        imp.update();
      }
    }
  });

  function addScale(point) {
    const increase = 1.5;

    point.origR = point.getR();
    point.setR(point.origR + increase);
  }

  function remScale(point) {
    if (point.origR) {
      point.setR(point.origR);

      delete point.origR;
    }
  }

  function setLoopTransparency(resIndex) {
    Data.forEachLoops(Data.getLoops(), function (loop) {
      if (Data.isFiltered() && loop.filtered) return;

      var point = loop.rooflinePoint;
      if (point) {
        var loopResIndex = loop.resIndex || 0;

        if (loopResIndex === resIndex) {
          point.remClass(loopInactiveClass);
          addScale(point);
        } else {
          point.addClass(loopInactiveClass);
          remScale(point);
        }
      }
    });
  }

  function clearLoopTransparency() {
    Data.forEachLoops(Data.getLoops(), function (loop) {
      if (Data.isFiltered() && loop.filtered) return;

      var point = loop.rooflinePoint;
      if (point) {
        point.remClass(loopInactiveClass);
        remScale(point);
      }
    });
  }

  function getCompareItemIndex(elem) {
    var result = -1;

    if (elem) {
      if (!isListItem(elem)) elem = elem.parentElement;

      if (elem && elem.classList && !elem.classList.contains(loadingClass)) {
        result = getItemIndex(elem);
      }
    }

    return result;
  }

  loadedCompareItems.addEventListener('mouseover', function(e) {
    var target = e.target;

    if (!target) return;

    var index = getCompareItemIndex(target);

    if (index >= 0) setLoopTransparency(index);
  }, false);

  loadedCompareItems.addEventListener('mouseout', function(e) {
    var target = e.target;

    if (!target) return;

    var index = getCompareItemIndex(target);

    if (index >= 0) clearLoopTransparency();
  }, false);

  function copyItem(item) {
    var result;

    if (item &&
        (item.caption || item.path)) {
      result = {caption: item.caption};
      if (item.path) result.path = item.path;

      if (item.unsaved) result = undefined;
    }

    return result;
  }

  function isItemDefined(item) {
    return !!item;
  }

  var itemsMaxCount = 40;

  var compareItems = {
    items: [],
    addItem: function(resInfo, onlyList) {
      var existItem = this.items.find(function(item) {
        var exist = resInfo.path && item.path === resInfo.path;
        if (exist &&
            !onlyList &&
            resInfo !== item) {
          resInfo.compareItem = item;
        }
        return exist;
      });

      if (existItem) {
        if (!onlyList) existItem.added = true;
      } else {
        if (!onlyList) resInfo.added = true;
        this.items.unshift(resInfo);

        if (!resInfo.unsaved && this.items.length > itemsMaxCount) {
          this.items.pop();
        }

        return true;
      }

      return false;
    },
    clearAdded: function() {
      this.items.forEach(function(item) {
        if (item.added) delete item.added;
      });
    },
    getCaption: function(path) {
      var existItem = this.items.find(function(item) {
        return path && item.path === path;
      });

      if (existItem) return existItem.caption;

      return undefined;
    },
    apply: function(state) {
      if (state && state.compareItems) {
        var oldSize = this.items.length;

        var savedItems = state.compareItems.map(copyItem).filter(isItemDefined);

        this.items = this.items.filter(function(item) {
          return !!(item && item.unsaved);
        });

        this.items = this.items.concat(savedItems);

        if (oldSize !== this.items.length && imp) {
          imp.update();
        }
      }
    },
    saveState: function(state) {
      if (state) {
        state.compareItems = this.items.map(copyItem).filter(isItemDefined);
      }
    }
  };

  Request.addConsumer('addCompare', {
    process: function(data) {
      function addItem(item) {
        if (!item) return;

        item.unsaved = true;
        compareItems.addItem(item, true);
      }

      if (Array.isArray(data)) {
        data.forEach(addItem);
      } else {
        addItem(data);
      }

      imp.update();
    }
  });

  var compareItemsId = 'compareItems';

  stateManager.addProcessor(compareItemsId, compareItems);

  var imp = {
    update: function() {
      function buildClass(classes) {
        var result = '';

        classes.forEach(function(item) {
          if (item.fl) {
            result += item.cl + ' ';
          }
        });

        return ' class="' + result + 'no_close_popup"';
      }
      var resultCount = Data.getResultCount();
      if (resultCount > 1) {
        setBtnEnabled(deleteBtn, true);

        var innerHTML = '';
        var i;
        for (i = 0; i < resultCount; i++) {
          var empty = Data.isResultEmpty(i);

          var resultInfo = Data.getResultInfo(i);
          var loading = resultInfo.loading;
          var comparing = resultInfo.comparing;

          const loadingStr = `"Loading: ${resultInfo.path}"`;
          const comparingStr = `"Comparing ${resultInfo.path} with loaded results"`;
          const pathStr = `"${resultInfo.path}"`;

          innerHTML += '<li' + buildClass([
            {fl: empty, cl: emptyClass},
            {fl: loading, cl: loadingClass},
            {fl: comparing, cl: comparingClass}]) +
            ' data-index="' + i + '" ' +
            (resultInfo.path ? UiUtils.tooltipAttr + '=' + (loading ? loadingStr : (comparing ? comparingStr : pathStr)) : '') +
            ' style="background-image:' + Roofline.getPointIcon(resultInfo.pointConstructor || Roofline.CirclePoint) + '"' +
            '>' + Data.getResultCaption(i) +
            ((i > 0 && !isReport()) ? '<span class="zoom_button icon cross no_close_popup clear_compare"></span>' : '') +
            '</li>';
        }

        loadedCompareItems.innerHTML = innerHTML;

        var needSave = false;
        for (i = 1; i < resultCount; i++) {
          needSave = compareItems.addItem(Data.getResultInfo(i)) || needSave;
        }

        if (needSave) {
          stateManager.save(compareItemsId);
        }
      } else {
        setBtnEnabled(deleteBtn, false);

        Utils.removeAllChildren(loadedCompareItems);

        compareItems.clearAdded();
      }

      innerHTML = '';
      compareItems.items.forEach(function(item, index) {
       if (!item.added) {
          innerHTML += '<li class="no_close_popup" data-index="' + index + '" ' +
          UiUtils.tooltipAttr + '="' + item.path + '">' + item.caption + '</li>';
        }
      });

      readyCompareItems.innerHTML = innerHTML;

      updateCaption(loadedCompareItems.childElementCount);

      var popupList = readyCompareItems.offsetParent;
      UiUtils.updatePopupWidth(control, popupList);
      UiUtils.updatePopupPos(control, popupList);

      toolbar.refreshSize();
    },
    getCaption: function(path) {
      return compareItems.getCaption(path);
    },
    init: init,
    hide: function() {
      control.parentElement.style.display = 'none';
    }
  };

  return imp;
})();

var rooflineCoreCountSelector = (function() {
  var control = document.getElementById('roofline_cores_control');
  var coreItems = document.getElementById('core_number_items');
  var coresContent = document.getElementById('roofline_cores_content');
  var coresBody = document.getElementById('roofline_cores_select_items');

  var threadCount4RoofIdx, coreCountPerPackage, packageCount, selectedPackageCount;
  const defaultThreadCount = 1;
  const bindOptionValue = 'bind';
  const spreadOptionValue = 'spread';

  function getThreadCount(index) {
    if (!coreItems) return defaultThreadCount;

    var child = coreItems.children[index];
    if (child) return parseInt(child.innerHTML, 10);

    return defaultThreadCount;
  }

  function updateContentAndOption(value, packageOption) {

    if (!coresContent || !coresBody) return;
    Data.setThreadCount(value);
    var inputs = coresBody.querySelectorAll('input');
    if (!inputs) return;

    var bindOption = coresBody.querySelector('input[value="' + bindOptionValue + '"]');
    var spreadOption = coresBody.querySelector('input[value="' + spreadOptionValue + '"]');

    if (!spreadOption || !bindOption) {
      coresContent.innerHTML = value;
      return;
    }

    // update option based on current thread choice
    if (value > coreCountPerPackage) {
      bindOption.disabled = true;
      bindOption.parentElement.style.color = '#ccc';
      packageOption = packageCount;
    }
    else {
      bindOption.disabled = false;
      bindOption.parentElement.style.color = 'black';
    }

    // set package option based on current option choice
    if (packageOption === undefined) {
      packageOption = !!bindOption.checked ? 1 : packageCount;
    }

    selectedPackageCount = packageOption;
    bindOption.checked = !(selectedPackageCount == packageCount);
    spreadOption.checked = (selectedPackageCount == packageCount);

    coresContent.innerHTML = Utils.format(I18n.getMessage('roofline_N_threaded_per_socket_roofs'), value, selectedPackageCount);
    Data.setPackageCount(selectedPackageCount);
  }

  function sendChangeNotification() {
     if (!Data.getRoofs().length) {
       sendChangeRoofsNotification(RoofsUtils.getRoofsConfiguration(Data.getThreadCount(),
         stateManager.getState().useSTRoofsStrategy, Data.getPackageCount()).str());
      } else {
        Events.send('rooflineDataUpdated', {isOldData: true, isNewRoofs: true});
      }
  }
  function processThreadCountChange(threadCount) {
    updateContentAndOption(threadCount);
    sendChangeNotification();
  }

  function processOptionChange() {
    updateContentAndOption(Data.getThreadCount());
    stateManager.save(settingNamePackageCount);
    sendChangeNotification();
  }

  coreItems.addEventListener('click', function(e) {
    var target = e.target;

    if (!target) return;

    var index;

    if (isListItem(target)) {
      index = getItemIndex(target);
      if (index >= 0) {
        threadCount4RoofIdx = index;
        stateManager.save(settingNameThreadCount);

        processThreadCountChange(parseInt(target.innerHTML, 10));
        stateManager.save(settingNamePackageCount);
      }
    }
  });

  var paddingLeft = 0;

  function popup(e) {
    if (!paddingLeft) {
      var controlPos = control.getBoundingClientRect();
      var contentlPos = coresContent.getBoundingClientRect();

      paddingLeft = contentlPos.left - controlPos.left;

      [].forEach.call(coreItems.children, function(item) {
        item.style.paddingLeft = paddingLeft + 'px';
      })
    }

    toolbar.popupProc(e);
  }

  toolbar.connect(control, popup);

  var settingNameThreadCount = 'threadCount4RoofIdx';

  stateManager.addProcessor(settingNameThreadCount, {
    apply: function(state) {
      if (state && state[settingNameThreadCount] !== undefined) {
        threadCount4RoofIdx = state[settingNameThreadCount];
      } else {
        threadCount4RoofIdx = 0;
      }

      updateContentAndOption(getThreadCount(threadCount4RoofIdx));
    },
    saveState: function(state) {
      state[settingNameThreadCount] = threadCount4RoofIdx;
    }
  });

  var settingNamePackageCount = 'packageCount';

  stateManager.addProcessor(settingNamePackageCount, {
    apply: function (state) {
      if (state && state[settingNamePackageCount] !== undefined) {
        selectedPackageCount = state[settingNamePackageCount];
      } else {
        selectedPackageCount = undefined;
      }

      updateContentAndOption(getThreadCount(threadCount4RoofIdx), selectedPackageCount);
    },
    saveState: function (state) {
      state[settingNamePackageCount] = selectedPackageCount;
    }
  });

  return {
    init: function(coreCount4Roofs, coreCountPhysical, processorPackageCount) {
      function getItem(value, isDefault, index) {
        function getItemStyle() {
          var result = '';

          var styles = [];

          if (isDefault) {
            styles.push('font-weight:bold;background-color:#eee;color:black');
          }

          if (paddingLeft) {
            styles.push('padding-left:' + paddingLeft + 'px');
          }

          if (styles.length) {
            result = 'style="' + styles.join(';') + '"';
          }

          return result;
        }

        return '<li data-index="' + index + '" ' + getItemStyle() + '>' + value + '</li>';
      }
      function removeAllItems() {
        if (!coreItems || !coresBody) return;
        Utils.removeAllChildren(coreItems);
        coreItems.classList.remove('scrolled');
        coreItems.classList.remove('splitter');
        var nextChild;
        if (coresBody && coresBody.childElementCount > 1) {
          nextChild = coresBody.firstElementChild.nextElementSibling;
          while (nextChild && nextChild.id != 'core_number_items') {
            var deletedChild = nextChild;
            nextChild = nextChild.nextElementSibling;
            coresBody.removeChild(deletedChild);
          }
        }
      }
      function addDynamicItems() {
        coreItems.classList.add('scrolled');
        coreItems.classList.add('splitter');
        function addRadioOption(value, text, tooltip, disabled) {
          disabled = !!disabled;
          var input = document.createElement('input');
          input.type = 'radio';
          input.name = 'cores_radio_group';
          input.className = 'toolbar_item_input';
          input.onchange = processOptionChange;
          input.value = value

          var label = document.createElement('label');
          label.className = 'radio_settings_item no_close_popup';
          label.style.padding = '0.3em';

          if (disabled) {
            input.disabled = true;
            label.style.display = 'none';
          }
          label.appendChild(input);
          label.appendChild(document.createTextNode(text));

          if (tooltip) {
            var expl = Utils.createElement('?', 'explanation_symbol hierarchy_item_caption', undefined, label, 'label');
            expl.setAttribute(UiUtils.tooltipAttr, tooltip);
          }
          coresBody.appendChild(label);
        }
        addRadioOption('', '', '', true); // To avoid additional events propagation!
        addRadioOption(bindOptionValue, I18n.getMessage('roofline_N_threaded_per_socket_bind_option'), I18n.getMessage('roofline_N_threaded_per_socket_bind_option_expl'));
        addRadioOption(spreadOptionValue, Utils.format(I18n.getMessage('roofline_N_threaded_per_socket_spread_option'), processorPackageCount.toString()), I18n.getMessage('roofline_N_threaded_per_socket_bind_option_expl'));
      }

      if (!control || !coresBody) return;

      removeAllItems();

      innerHTML = getItem(1, 1 === coreCount4Roofs, 0);
      for (var i = 2, index = 1; i <= coreCountPhysical; i += 2, index++) {
        innerHTML += getItem(i, i === coreCount4Roofs, index);
      }

      coreItems.innerHTML = innerHTML;

      coreCountPerPackage = coreCountPhysical / processorPackageCount;
      packageCount = processorPackageCount;

      threadCount4RoofIdx = stateManager.getState().threadCount4RoofIdx;

      // If the thread count (the value of the selected option) is not defined
      // we must use the number of threads used in the application as the value of the selected option
      // If the number of threads is greater then the core count
      // we must use the core count as the value of the selected option
      if (threadCount4RoofIdx === undefined || threadCount4RoofIdx > (coreCountPhysical / 2)) {
        threadCount4RoofIdx = Math.floor(coreCount4Roofs / 2);
        stateManager.save(settingNameThreadCount);
      }

      if (processorPackageCount > 1) {
        addDynamicItems();
        coresContent.style.fontWeight = 'normal';

        selectedPackageCount = stateManager.getState().packageCount;
        if (!selectedPackageCount) selectedPackageCount = 1; // by default
        stateManager.save(settingNamePackageCount);
      } else selectedPackageCount = undefined;

      updateContentAndOption(getThreadCount(threadCount4RoofIdx), selectedPackageCount);
      toolbar.refreshSize();
    }
  };
})();

var rooflineDataSelector = (function() {
  var control = document.getElementById('roofline_type_control');
  var popup = control.firstElementChild;
  var content = popup.nextElementSibling;
  var popupBody = popup.firstElementChild;
  var defaultBtn = popupBody.nextElementSibling.firstElementChild;
  var applyBtn = defaultBtn.nextElementSibling;
  var cancelBtn = applyBtn.nextElementSibling;

  var groupIndex = 0;

  var inputs;
  var certainGroups = [];

  var value;
  var defaultCaption;

  var settingName = 'rooflineType';
  var noValueAttr = 'data-noValue';
  var noValueCaptionAttr = 'data-noValueCaption';

  toolbar.connect(control, toolbar.popupProc);

  defaultBtn.disabled = true;
  applyBtn.disabled = true;

  function setValueAndContent(newVal, textContent) {
    value = newVal;

    if (value === defaultRooflineType &&
        defaultCaption) {
      textContent = defaultCaption;
    }

    content.innerHTML = textContent;

    defaultBtn.disabled = value === defaultRooflineType;
  }

  defaultBtn.onclick = function() {
    if (!defaultBtn.disabled &&
        defaultRooflineType) {
      defaultBtn.disabled = true;
      applyValue(defaultRooflineType);
      applyBtn.onclick();
    }
  }

  applyBtn.onclick = function() {
    applyBtn.disabled = true;
    updateContent();
    sendReady4Data();
  }

  cancelBtn.onclick = function() {
    if (!applyBtn.disabled) {
      applyBtn.disabled = true;
      applyValue(value);
    }
  }

  function clearOptions() {
    var nextChild;
    if (popupBody && popupBody.childElementCount > 1) {
      nextChild = popupBody.firstElementChild.nextElementSibling;
      while(nextChild) {
        var deletedChild = nextChild;
        nextChild = nextChild.nextElementSibling;
        popupBody.removeChild(deletedChild);
      }
    }
  }

  function onChange() {
    applyBtn.disabled = false;
  }

  function checkCertainValue() {
    var groupParent = this;
    if (groupParent) {
      var checkedInputs = groupParent.querySelectorAll('input:checked');
      if (checkedInputs.length === 1) {
        checkedInputs[0].disabled = true;
      } else {
        [].forEach.call(checkedInputs, function(input) {
          input.disabled = false;
        })
      }
    }
  }

  function getContentCaption(textContent, caption) {
    return (textContent ? '; ' : '') + caption;
  }

  function updateOption(option, val) {
    var result = false;

    var input = popupBody.querySelector('input[value="' + option + '"]');
    if (input && input.checked !== val) {
      input.checked = val;
      result = true;
    }

    return result;
  }

  function applyValue(val) {
    if (!val) return;

    [].forEach.call(inputs, function(input) {
      input.checked = false;
    });

    var params = val.split('-');
    var textContent = '';
    params.forEach(function(param) {
      if (!param) return;

      var input = popupBody.querySelector('input[value="' + param + '"]');
      if (input) {
        input.checked = true;
        textContent += getContentCaption(textContent, input.rooflineCaption);
      } else {
        input = popupBody.querySelector('input[' + noValueAttr + '="' + param + '"]');
        if (input) {
          textContent += getContentCaption(textContent, input.getAttribute(noValueCaptionAttr));
        }
      }
    });

    certainGroups.forEach(function(group) {
      checkCertainValue.call(group);
    });

    setValueAndContent(val, textContent);
  }

  function updateContent() {
    var textContent = '';
    var newVal = '';
    var separator = '';
    [].forEach.call(inputs, function(input) {
      if (input && input.offsetParent) {
        if (input.checked) {
          textContent += getContentCaption(textContent, input.rooflineCaption);
          newVal += separator + input.value;
        } else if (input.type === 'checkbox' &&
                   input.hasAttribute(noValueAttr) &&
                   input.hasAttribute(noValueCaptionAttr)) {
          newVal += separator + input.getAttribute(noValueAttr);
          textContent += getContentCaption(textContent, input.getAttribute(noValueCaptionAttr));
        }
      }

      if (newVal &&
          !separator) {
        separator = '-';
      }
    });

    setValueAndContent(newVal, textContent);

    toolbar.refreshSize();

    stateManager.save(settingName);
  }

  function createItem(parent, option, groupName, noValueOption) {
    if (!parent || !option) return;

    var input = document.createElement('input');
    input.type = groupName ? 'radio' : 'checkbox';
    if (groupName) input.name = groupName;
    input.value = option.value;
    input.rooflineCaption = option.caption;
    input.className = 'toolbar_item_input no_close_popup';
    input.onchange = onChange;

    if (noValueOption) {
      input.setAttribute(noValueAttr, noValueOption.value);
      input.setAttribute(noValueCaptionAttr, noValueOption.caption);
    }

    var label = document.createElement('label');
    label.className = 'roofline_type_select_caption no_close_popup';
    label.appendChild(input);
    label.appendChild(document.createTextNode(option.caption));

    if (option.expl) {
      var expl = Utils.createElement('?', 'explanation_symbol hierarchy_item_caption no_close_popup', undefined, label, 'label');
      expl.setAttribute(UiUtils.tooltipAttr, option.expl);
    }

    parent.appendChild(label);
  }

  return {
    init: function(options) {
      if (!options || !options.groups || !Array.isArray(options.groups)) return;

      clearOptions();

      defaultCaption = options.defConfigurationCaption;

      groupIndex = 0;
      certainGroups = [];
      options.groups.forEach(function(group) {
        if (!group) return;

        var groupName;
        if (group.isRadio) {
          groupIndex++;
          groupName = 'roofline_radio_group_' + groupIndex;
        }

        var groupBody = Utils.createElement('', 'roofline_type_group no_close_popup', '', popupBody);
        if (group.caption) {
          groupBody.classList.add('with_caption');
          groupBody.setAttribute('data-caption', group.caption);
        }

        if (group.isCertainValue) {
          groupBody.addEventListener('change', checkCertainValue.bind(groupBody), false);
          certainGroups.push(groupBody);
        }

        if (Array.isArray(group.options)) {
          var optionsStep = group.isTwoStates ? 2 : 1;
          for (var i = 0, len = group.options.length; i < len; i += optionsStep) {
            createItem(groupBody, group.options[i], groupName, optionsStep === 2 ? group.options[i + 1] : undefined);
          }
        }
      });

      inputs = popupBody.querySelectorAll('input');

      stateManager.addProcessor(settingName, {
        apply: function(state) {
          if (state) {
            applyValue(state[settingName] || defaultRooflineType);
          } else {
            applyValue(defaultRooflineType);
          }
        },
        saveState: function(state) {
          state[settingName] = value;
        }
      });
    },
    setValue: function(val) {
      if (val !== value) applyValue(val);
    },
    setOption: function(option, val) {
      var result = updateOption(option, val);
      if (result) {
        updateContent();
      }

      return result;
    }
  }
})();

require(['roofline_data'],
  function() {
    window.ondblclick = sendNotification.bind(window, 'refresh');
    contentLoadedSender.setInitialized();
  },
  contentLoadedSender.setInitialized.bind(contentLoadedSender)
);

});
