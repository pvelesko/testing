define([
  './value_utils',
  './ui_utils',
  './data',
  '../idvcjs/signal'
], function(ValueUtils, UiUtils, Data, Signal) {

function createZooming() {
  var undoList = {};
  var undoListMaxLength = 200;

  function isZoomFrame(frame) {
    return !frame ||
          frame.minX !== undefined &&
          frame.minY !== undefined &&
          frame.maxX !== undefined &&
          frame.maxY !== undefined;
  }

  function addFrame(frame, isZoomFrame) {
    if (!undoList) undoList = {};

    if (!undoList.frames) undoList.frames = [];

    if (undoList.zoomIndex === undefined) undoList.zoomIndex = -1;

    if (undoList.index === undefined) {
      undoList.index = -1;
    } else if (undoList.index < undoList.frames.length - 1) {
      undoList.frames.splice(undoList.index + 1);
    }

    undoList.frames.push(frame);
    undoList.index++;
    if (isZoomFrame) undoList.zoomIndex = undoList.index;

    if (undoList.frames.length > undoListMaxLength) {
      var removeCount = Math.round(undoListMaxLength / 2);
      undoList.frames.splice(0, removeCount);
      undoList.index -= removeCount;
      undoList.zoomIndex -= removeCount;
    }
  }

  function processZoom(coef, centerPoint, convertFn) {
    coef = coef || 2;

    convertFn = convertFn || function(val) { return val; };

    var zoomFrame = this.getMinMax();

    var deltaX = zoomFrame.maxX - zoomFrame.minX;
    var deltaY = zoomFrame.maxY - zoomFrame.minY;

    centerPoint = centerPoint || {
      x: zoomFrame.minX + deltaX / 2,
      y: zoomFrame.minY + deltaY / 2
    };

    var offset = 0.05;
    if (centerPoint.x <= zoomFrame.minX) centerPoint.x = zoomFrame.minX + deltaX * offset;
    if (centerPoint.x >= zoomFrame.maxX) centerPoint.x = zoomFrame.maxX - deltaX * offset;
    if (centerPoint.y <= zoomFrame.minY) centerPoint.y = zoomFrame.minY + deltaY * offset;
    if (centerPoint.y >= zoomFrame.maxY) centerPoint.y = zoomFrame.maxY - deltaY * offset;

    var beforeX = centerPoint.x - zoomFrame.minX;
    var afterX = zoomFrame.maxX - centerPoint.x;
    var beforeY = centerPoint.y - zoomFrame.minY;
    var afterY = zoomFrame.maxY - centerPoint.y;

    zoomFrame.minX = centerPoint.x - convertFn(beforeX, coef);
    zoomFrame.maxX = centerPoint.x + convertFn(afterX, coef);
    zoomFrame.minY = centerPoint.y - convertFn(beforeY, coef);
    zoomFrame.maxY = centerPoint.y + convertFn(afterY, coef);

    return this.setZoom(zoomFrame);
  }

  function checkZoomFrame(zoomFrame) {
    if (zoomFrame) {
      var data = Data.getRooflineData();

      var noZoomCounter = 0;
      var epsilon = 0.0000001;

      if (zoomFrame.minX - epsilon < data.minIntens) {
        zoomFrame.minX = data.minIntens;
        noZoomCounter++;
      }
      if (zoomFrame.maxX + epsilon > data.maxIntens) {
        zoomFrame.maxX = data.maxIntens;
        noZoomCounter++;
      }
      if (zoomFrame.minY - epsilon < data.minPerf) {
        zoomFrame.minY = data.minPerf;
        noZoomCounter++;
      }
      if (zoomFrame.maxY + epsilon > data.maxPerf) {
        zoomFrame.maxY = data.maxPerf;
        noZoomCounter++;
      }

      if (noZoomCounter === 4) zoomFrame.isNoZoom = true;

      if (zoomFrame.maxX <= zoomFrame.minX ||
          zoomFrame.maxY <= zoomFrame.minY) {
        zoomFrame.isWrongZoom = true;
      }
    }

    return zoomFrame;
  }

  return {
    zoomChanged: Signal.create(),
    undoListChanged: Signal.create(),
    zoomIn: function(coef, point) {
      return processZoom.call(this, coef, point, function(val, coef) {
        return val / coef;
      });
    },
    zoomOut: function(coef, point) {
      if (!this.getCurrentZoom()) return;

      return processZoom.call(this, coef, point, function(val, coef) {
        return val * coef;
      });
    },
    setZoom: function(zoomFrame, notifyParam) {
      var result = false;

      zoomFrame = checkZoomFrame(zoomFrame);

      if (zoomFrame.isWrongZoom) return;

      var currentZoom = this.getCurrentZoom()

      if (!currentZoom ||
          (currentZoom.minX != zoomFrame.minX ||
          currentZoom.maxX != zoomFrame.maxX ||
          currentZoom.minY != zoomFrame.minY ||
          currentZoom.maxY != zoomFrame.maxY)) {
        var minDelta = 0.02;

        if (Math.abs(zoomFrame.maxX - zoomFrame.minX) > minDelta &&
            Math.abs(zoomFrame.maxX - zoomFrame.minX) > minDelta) {
          addFrame(zoomFrame, true);
          this._notifyChangeZoomState(notifyParam);

          result = true;
        }
      }

      return result;
    },
    addUndoFrame: function(frame) {
      addFrame(frame);
      this._notifyChangeUndoList();
    },
    getCurrentZoom: function() {
      var result;

      if (undoList &&
          undoList.frames &&
          undoList.zoomIndex !== undefined &&
          undoList.zoomIndex >= 0) {
        result = checkZoomFrame(undoList.frames[undoList.zoomIndex]);
        if (result && result.isNoZoom) {
          result = undefined;
        }
      }

      return result;
    },
    undoZoom: function() {
      if (undoList &&
          undoList.frames &&
          undoList.index >= 0) {
        this._checkCurrentFrame();
        undoList.index--;
        this._notifyChangeUndoList();
        this._updateZoomFrame(true);
      }
    },
    redoZoom: function() {
      if (undoList &&
          undoList.frames &&
          undoList.index < undoList.frames.length - 1) {
        undoList.index++;
        this._checkCurrentFrame();
        this._notifyChangeUndoList();
        this._updateZoomFrame();
      }
    },
    cancelZoom: function() {
      if (undoList &&
          undoList.frames) {
        var data = Data.getRooflineData();

        this.setZoom({
          minX: data.minIntens,
          maxX: data.maxIntens,
          minY: data.minPerf,
          maxY: data.maxPerf,
        });
      }
    },
    getZoomState: function() {
      var undo = false;
      var redo = false;
      var cancel = false;

      if (undoList) {
        undo = undoList.index >= 0;
        if (undoList.frames) {
          redo = undoList.index < undoList.frames.length - 1;

          var currentZoom = this.getCurrentZoom();
          currentZoom = checkZoomFrame(currentZoom);
          cancel = currentZoom && !currentZoom.isNoZoom;
        }
      }

      return {undo: undo, redo: redo, cancel: cancel};
    },
    getMinMax: function(ignoreViewFramw) {
      var viewFrame = Data.getViewFrame();
      var minMax = Data.getMinMax();

      var minX = (ignoreViewFramw ? 0 : viewFrame.minIntens) || minMax.minX;
      var maxX = (ignoreViewFramw ? 0 : viewFrame.maxIntens) || minMax.maxX;
      var minY = (ignoreViewFramw ? 0 : viewFrame.minPerf) || minMax.minY;
      var maxY = (ignoreViewFramw ? 0 : viewFrame.maxPerf) || minMax.maxY;

      var zoom = this.getCurrentZoom();
      if (zoom) {
        minX = zoom.minX;
        maxX = zoom.maxX;
        minY = zoom.minY;
        maxY = zoom.maxY;
      }

      return {
        minX: minX,
        maxX: maxX,
        minY: minY,
        maxY: maxY
      };
    },
    saveMinMax: function(data) {
      data = data || Data.getRooflineData();
      if (!data ||
          data.minIntens === undefined ||
          data.maxIntens === undefined ||
          data.minPerf === undefined ||
          data.maxPerf === undefined) {
        return;
      }

      this.minMaxFrame = {
        minX: data.minIntens,
        maxX: data.maxIntens,
        minY: data.minPerf,
        maxY: data.maxPerf
      };
    },
    moveCurrentZoomFrame: function(dx, dy) {
      var result;

      var zoom = this.getCurrentZoom();
      if (zoom) {
        result = {
          minX: zoom.minX + dx,
          maxX: zoom.maxX + dx,
          minY: zoom.minY + dy,
          maxY: zoom.maxY + dy
        };

        result = checkZoomFrame(result);
      }

      return result;
    },
    clearDataUndo: function() {
      if (undoList &&
          undoList.frames) {
        for (var i = undoList.frames.length - 1; i >= 0; i--) {
          if (!isZoomFrame(undoList.frames[i])) {
            undoList.frames.splice(i, 1);

            if (undoList.zoomIndex !== undefined &&
                undoList.zoomIndex >= i) {
              undoList.zoomIndex--;
            }

            if (undoList.index !== undefined &&
                undoList.index >= i) {
              undoList.index--;
            }
          }
        }
      }
    },
    _checkCurrentFrame: function() {
      if (undoList) {
        var currentFrame = undoList.frames[undoList.index];
        if (currentFrame &&
            currentFrame.process) {
          currentFrame.process();
        }
      }
    },
    _updateZoomFrame: function(isUndo) {
      if (undoList) {
        var currentFrame = undoList.frames[undoList.index];
        var newZoomIndex;
        if (isZoomFrame(currentFrame)) {
          newZoomIndex = undoList.index;
        } else if (isUndo &&
          undoList.zoomIndex > undoList.index) {
          newZoomIndex = undoList.index - 1;
          currentFrame = undoList.frames[newZoomIndex];
          while (!isZoomFrame(currentFrame)) {
            newZoomIndex--;
            currentFrame = undoList.frames[newZoomIndex];
          }
        }

        if (newZoomIndex !== undefined &&
            undoList.zoomIndex !== newZoomIndex) {
          undoList.zoomIndex = newZoomIndex;
          this._notifyChangeZoomState();
        }
      }
    },
    _notifyChangeZoomState: function(param) {
      this.zoomChanged.raise(param);
    },
    _notifyChangeUndoList: function() {
      this.undoListChanged.raise();
    }
  };
}

var currentZooming;

var zoomFrameSettings = {
  init: function() {
    if (!this.maxPerfEdit) {
      this.maxPerfEdit = document.getElementById('frame_max_perf');
      this.maxPerfEdit.onblur = this._checkValue.bind(this, 'maxY');
      this.minPerfEdit = document.getElementById('frame_min_perf');
      this.minPerfEdit.onblur = this._checkValue.bind(this, 'minY');
      this.maxIntensEdit = document.getElementById('frame_max_intens');
      this.maxIntensEdit.onblur = this._checkValue.bind(this, 'maxX');
      this.minIntensEdit = document.getElementById('frame_min_intens');
      this.minIntensEdit.onblur = this._checkValue.bind(this, 'minX');

      this.maxPerfEdit.onkeypress = this.minPerfEdit.onkeypress = this.maxIntensEdit.onkeypress = this.minIntensEdit.onkeypress = UiUtils.filterNumberInput;

      var applyBtn = document.getElementById('frame_apply_btn');
      applyBtn.onclick = this.apply.bind(this);
      var cancelBtn = document.getElementById('frame_cancel_btn');
      cancelBtn.onclick = this.close.bind(this);
    }

    var frame = this._getEditableFrame();
    this.maxPerfEdit.value = frame.maxY;
    this.minPerfEdit.value = frame.minY;
    this.maxIntensEdit.value = frame.maxX;
    this.minIntensEdit.value = frame.minX;
  },
  apply: function() {
    var frame = this._getEditableFrame();

    if (frame.minX.toString() !== this.minIntensEdit.value ||
        frame.maxX.toString() !== this.maxIntensEdit.value ||
        frame.minY.toString() !== this.minPerfEdit.value ||
        frame.maxY.toString() !== this.maxPerfEdit.value) {
      currentZooming.setZoom({
        maxY: ValueUtils.log10(this.maxPerfEdit.value),
        minY: ValueUtils.log10(this.minPerfEdit.value),
        maxX: ValueUtils.log10(this.maxIntensEdit.value),
        minX: ValueUtils.log10(this.minIntensEdit.value)
      });
    }

    this.close();
  },
  close: function() {
    frameBtn.classList.remove('expanded');
  },
  _checkValue: function(prop, e) {
    var editor = e.target;

    var newVal = editor.value;
    if (isNaN(newVal) || !newVal) {
      var frame = currentZooming.getMinMax();
      editor.value = ValueUtils.formatVal(frame[prop], 4, true);
    }
  },
  _getEditableFrame: function() {
    var frame = currentZooming.getMinMax();

    return {
      maxY: ValueUtils.formatVal(frame.maxY, 4, true),
      minY: ValueUtils.formatVal(frame.minY, 4, true),
      maxX: ValueUtils.formatVal(frame.maxX, 4, true),
      minX: ValueUtils.formatVal(frame.minX, 4, true)
    };
  }
};

var frameBtn = document.getElementById('roofline_frame_settings');
frameBtn.onclick = function() {
  if (!frameBtn.classList.contains('expanded') &&
      currentZooming) {
    zoomFrameSettings.init();
    frameBtn.classList.add('expanded');
  }
};

return {
  get: function() {
    if (!currentZooming) currentZooming = createZooming();

    return currentZooming;
  }
};

});
