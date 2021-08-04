define([
  './state_manager',
  './value_utils',
  './request',
  './data',
  './stack_view',
  './ui_utils',
  './i18n',
  './context_menu',
  './events',
  '../idvcjs/utils',
  '../idvcjs/data_utils',
  '../idvcjs/chart',
  '../idvcjs/roofline',
  './loops_utils'
], function(StateManager, ValueUtils, Request, Data, StackView, UiUtils, I18n, ContextMenu, Events, Utils, DataUtils, Chart, Roofline, LoopsUtils) {

var roofline;
var zoomer;

var cancelLoopSettingsBtn,
    revertLoopSettingsBtn;

var _scale = 1.0;
var _configuration = {};
var loopsTableBodyId = 'loops_table_body';

var stateManager = StateManager.get();

var progTimeId = 'progTime';
var progTime = (function() {
  function getMaxHistogramRatioAll() {
    var resCount = Data.getResultCount() || 1;
    var res = 0;

    for (var i = 0; i < resCount; i++) {
      var maxSelfTime = Data.getMaxSelfTime(i);
      var totalTime = Data.getTotalTime(i);
      if (totalTime) res = Math.max(res, maxSelfTime / totalTime);
    }

    return res;
  }

  function getMaxHistogramRatioMax() {
    var res = 0;

    var maxSelfTime = Data.getMaxMaxSelfTime();
    var totalTime = Data.getMaxTotalTime();
    if (totalTime) res = maxSelfTime / totalTime;

    return res;
  }

  function _useMaxProgramTotalTime(use) {
    var curUse = getMaxHistogramRatio === getMaxHistogramRatioMax;

    if (curUse === !!use) return;

    if (use) {
      this.getTotalTime = Data.getMaxTotalTime.bind(Data);
      getMaxHistogramRatio = getMaxHistogramRatioMax;
    } else {
      this.getTotalTime = Data.getTotalTime.bind(Data);
      getMaxHistogramRatio = getMaxHistogramRatioAll;
    }

    updateRooflineLoops();
  }

  var getMaxHistogramRatio = getMaxHistogramRatioAll;

  var result = {
    getTotalTime: Data.getTotalTime.bind(Data),
    getMaxHistogramPercent: function() {
      var res = Math.ceil(getMaxHistogramRatio() * 100);
      if (res > 100) res = 100;

      return res;
    },
    useMaxProgramTotalTime: function(use) {
      _useMaxProgramTotalTime.call(this, use);

      stateManager.save(progTimeId);
    },
    apply: function(state) {
      if (state.useMaxProgramTotalTime) {
        _useMaxProgramTotalTime.call(this, true);
      }
    },
    saveState: function(state) {
      if (state) {
        if (getMaxHistogramRatio === getMaxHistogramRatioMax) {
          state.useMaxProgramTotalTime = true;
        } else {
          delete state.useMaxProgramTotalTime;
        }
      }
    }
  };

  return result;
})();

stateManager.addProcessor(progTimeId, progTime);

var defaultColorMode = 1;
function getColorMode(mode) {
  if (mode === undefined) return defaultColorMode;

  return mode;
}

function validateColor(colorText, sampleDiv) {
  var result = {
    isValid: false,
    isNew: true
  };

  if (!colorText || !sampleDiv) return result;

  var oldColor = sampleDiv.style.backgroundColor.toLowerCase();
  sampleDiv.style.backgroundColor = '';
  sampleDiv.style.backgroundColor = colorText;
  var newColor = sampleDiv.style.backgroundColor.toLowerCase();
  if (oldColor === newColor) {
    result.isValid = true;
    result.isNew = false;
  } else {
    result.isValid = !!newColor;
  }

  if (!result.isValid) sampleDiv.style.backgroundColor = oldColor;

  return result;
}

var loopsThsId = 'loopsThs';

var loopsRepresentation = (function(){
  var defThs;

  var copyThs;

  var histogram;
  var histogramLoopsCount;
  var maxHistogramPercent = 0;
  var histogramStep = 0;
  var histogramPrecision = 0;

  function fixHistogramValue(val) {
    return Utils.round(val, histogramPrecision);
  }

  function getHistogramViewSize() {
    return Math.max(maxHistogramPercent, 1);
  }

  function calcHistogramSize() {
    if (!maxHistogramPercent) {
      maxHistogramPercent = progTime.getMaxHistogramPercent();
      if (maxHistogramPercent) {
        histogramStep = Utils.round(2 * maxHistogramPercent / Utils.em2px(23), 2) || 0.01;
        var testStep = 0.1;
        histogramPrecision = 0;
        while (true) {
          if (histogramStep > testStep) {
            histogramStep = testStep * 10;
            break;
          }

          testStep /= 10;
          histogramPrecision++;
        }
      } else {
        maxHistogramPercent = 100;
        histogramStep = 1;
        histogramPrecision = 0;
      }
    }
  }

  function getLoopSelfTime(loop) {
    var time = (loop.selfElapsedTime !== undefined) ? loop.selfElapsedTime : loop.selfTime;
    if (time === undefined) time = 0.;

    return time;
  }

  function getLoopPercent(loop) {
    var percent = Utils.round(getLoopSelfTime(loop) / progTime.getTotalTime(loop.resIndex) * 100, histogramPrecision);
    if (percent < histogramStep) percent = histogramStep;
    else if (percent > 100) percent = 100;

    return percent;
  }

  function addLoopToHistogram(loop) {
    if (!loop) return;

    var percent = getLoopPercent(loop);

    var index = fixHistogramValue(percent - histogramStep);
    if (histogram[index] === undefined) histogram[index] = 0;
    histogram[index]++;

    histogramLoopsCount++;
  }

  function removeLoopFromHistogram(loop) {
    if (!loop) return;

    var percent = getLoopPercent(loop);

    var index = fixHistogramValue(percent - histogramStep);
    histogram[index]--;

    histogramLoopsCount--;
  }

  function createDefThs() {
    function calcBorder(val, resIndex) {
      return Math.ceil(val / progTime.getTotalTime(resIndex) * 100);
    }

    var loops = [];

    Data.forEachLoops(Data.getLoops(), function(loop) {
      loops.push({selfTime: getLoopSelfTime(loop)});
    }, false);

    loops.sort(function(a, b) {
      return b.selfTime - a.selfTime;
    });

    var loopCount = histogramLoopsCount;
    var redCount = Math.floor(loopCount * 0.03) || 1;
    if (redCount > 5) redCount = 5;
    var yellowCount = Math.floor(loopCount * 0.25) || 1;

    defThs = [];

    var redBorder = 20;
    if (redBorder >= maxHistogramPercent) redBorder = maxHistogramPercent - 10 * histogramStep;

    var yellowBorder = 1;
    if (yellowBorder >= redBorder) yellowBorder = redBorder / 2;

    if (loopCount > 3 &&
        Data.getMaxSelfTime()) {
      var lastRedLoop = loops[redCount];
      redBorder = calcBorder(lastRedLoop.selfTime, lastRedLoop.resIndex) || 0.5;
      var lastYellowLoop = loops[redCount + yellowCount];
      yellowBorder = calcBorder(lastYellowLoop.selfTime, lastYellowLoop.resIndex) || 0.1;

      if (yellowBorder > redBorder) yellowBorder = redBorder / 2;
    }

    defThs.push({th: yellowBorder, radius: Math.round(4 * _scale), color: 'green'});
    defThs.push({th: redBorder, radius: Math.round(6 * _scale), color: 'yellow'});
    defThs.push({radius: Math.round(8 * _scale), color: 'red'});
  }

  function getThs(copy) {
    var state = stateManager.getState();

    if (copy && !copyThs) {
      if (state.loopsThs) {
        copyThs = JSON.parse(JSON.stringify(state.loopsThs));
      } else {
        copyThs = [];
      }
    }

    if (copy && !state.loopsThs) {
      state.loopsThs = JSON.parse(JSON.stringify(defThs));
    }

    if (copy) {
      cancelLoopSettingsBtn.disabled = false;
      revertLoopSettingsBtn.disabled = false;
    }

    if (!defThs) createDefThs();

    return state.loopsThs || defThs;
  }

  var expander = (function(){
    var widget;
    var expanderEl;
    var ignoreExpander = false;

    function getExpanderSize() {
      return 10 * _scale + 1;
    }

    return {
      create: function(onMouseDown) {
        if (expanderEl) return;

        var expanderSize = getExpanderSize();
        var offset = 2 * _scale;

        onMouseDown = onMouseDown || function(){};

        widget = roofline.centralPart.graphicsRoot.createDefs()
            .createG('expanderTemplate')
              .addRect(0, 0, expanderSize, expanderSize, 'roofline_expander').getParent()
              .addLine(offset, expanderSize / 2, expanderSize - offset, expanderSize / 2, 'roofline_expander_horz_line').getParent()
              .addLine(expanderSize / 2, offset, expanderSize / 2, expanderSize - offset, 'roofline_expander_vert_line').getParent();

        expanderEl = roofline.centralPart.graphicsRoot.createUse()
          .setRef(widget.localRef('expanderTemplate'))
          .activate()
          .on('mousedown', onMouseDown);

        this.hide();
      },
      isValid: function() {
        return !!expanderEl;
      },
      hide: function(keepConnection) {
        if (expanderEl) {
          expanderEl
            .setX(-100)
            .setY(-100);

          if (!keepConnection) delete expanderEl.rooflineLoop;
        }
      },
      refreshState: function(loop) {
        if (!loop) return;

        if (loop.state === '-') {
          widget.addClass('expanded');
        } else if (loop.state === '+') {
          widget.remClass('expanded');
        }
      },
      connect: function(loop) {
        if (expanderEl) expanderEl.rooflineLoop = loop;
      },
      isConnected: function() {
        return expanderEl && expanderEl.rooflineLoop;
      },
      isConnectedTo: function(loop) {
        return expanderEl && expanderEl.rooflineLoop === loop;
      },
      getConnectedLoop: function() {
        if (expanderEl) return expanderEl.rooflineLoop;

        return undefined;
      },
      setPos: function(x, y, r) {
        if (!expanderEl) return;

        var halfExpanderSize = getExpanderSize() / 2;

        expanderEl
          .setX(x - 1.5 * halfExpanderSize - r)
          .setY(y - halfExpanderSize);
      },
      clear: function() {
        expanderEl = widget = undefined;
        ignoreExpander = false;
      },
      front: function() {
        if (expanderEl) expanderEl.front();
      },
      setIgnored: function(ignored) {
        ignoreExpander = ignored;
      },
      isIgnored: function() {
        return ignoreExpander;
      }
    };
  })();

  function changeLoopState(loop, ignoreUndo) {
    if (Data.isFiltered()) return;

    function updateChildren(parentLoop, show) {
      show = show || false;

      if (!parentLoop) return;

      Data.forEachChildrenEx(parentLoop, function(loop) {
        if (!loop || !loop.rooflinePoint) return;

        if (show) {
          loop.rooflinePoint.show();

          addLoopToHistogram(loop);
        } else {
          loop.rooflinePoint.hide();

          if (expander.isConnectedTo(loop)) {
            removeChildrenLines(loop);
            removeParentLine(loop);
            expander.hide();
          }

          removeLoopFromHistogram(loop);
        }
      });
    }

    function setFinalLoopVisualisation(loopPoint, loopState) {
      if (!loopPoint) return;

      this.fillLoop(loopPoint, loopState);

      if (expander.isConnectedTo(loopPoint.loopData)) {
        this.highlightPoint(loopPoint);
      }
    }

    if (!loop || !loop.rooflinePoint) return;

    LoopsUtils.setLoopPointFront(loop.rooflinePoint, roofline);

    var oldLoopInfo = this.getLoopInfo(loop);

    if (loop.state === '+') {
      loop.state = '-';
      updateChildren(loop, true);
    } else if (loop.state === '-') {
      updateChildren(loop, false);
      loop.state = '+';
    }

    if (loop.state) {
      this.fillHistogramChart();
      Data.saveHierarchy();
      StackView.refresh(loop);
    }

    var newLoopInfo = this.getLoopInfo(loop);

    var x = oldLoopInfo.getX();
    var x1 = newLoopInfo.getX();

    var y = oldLoopInfo.getY();
    var y1 = newLoopInfo.getY();

    var r = oldLoopInfo.getRadius();
    var r1 = newLoopInfo.getRadius();

    if (x !== x1 ||
        y !== y1) {

      removeChildrenLines(loop);
      removeParentLine(loop);

      expander.setIgnored(true);
      expander.hide(true);

      var maxProgress = 700;
      Utils.animate(function(progress) {
        var delta = progress / maxProgress;
        if (delta > 1) delta = 1;

        var newX = x + (x1 - x) * delta;
        var newY = y + (y1 - y) * delta;
        var newR = r + (r1 - r) * delta;

        var loopPoint = roofline.tr.L2P(newX, newY);
        loop.rooflinePoint
          .move(loopPoint.x, loopPoint.y)
          .setR(newR);

        return delta < 1;
      },
      function() {
        expander.setIgnored(false);

        setFinalLoopVisualisation.call(this, loop.rooflinePoint, newLoopInfo);
      }.bind(this));
    } else {
      setFinalLoopVisualisation.call(this, loop.rooflinePoint, newLoopInfo);
    }

    if (!ignoreUndo) {
      zoomer.addUndoFrame({
        process: changeLoopState.bind(this, loop, true)
      });
    }
  }

  function createExpander() {
    expander.create(function(e) {
      var loop = e.target.owner.rooflineLoop;
      if (!loop) return;

      changeLoopState.call(this, loop);
    }.bind(this));
  }

  function getMinDistance() {
    var pixelMinDistance = 10 * _scale / (window.devicePixelRatio || 1);
    var distanceX = Math.abs(roofline.tr.getMaxIntens() - roofline.tr.getMinIntens()) * pixelMinDistance / roofline.tr._getClientWidth();
    var distanceY = Math.abs(roofline.tr.getMaxPerf() - roofline.tr.getMinPerf()) * pixelMinDistance / roofline.tr._getClientHeight();

    return {
      x: distanceX,
      y: distanceY
    }
  }

  var childArrowId = 'ChildArrow';
  var parentArrowId = 'ParentArrow';

  function ArrowLine(points, arrow, lineClass) {
    this.line = roofline.centralPart.graphicsRoot.addLine(
      points[0].x,
      points[0].y,
      points[1].x,
      points[1].y,
      lineClass);
    this.line.setStyle(arrow.head + ':' + this.line.localUrl(arrow.id));
  }

  ArrowLine.prototype.update = function(points){
    this.line
      .setX1(points[0].x)
      .setY1(points[0].y)
      .setX2(points[1].x)
      .setY2(points[1].y);
  };

  ArrowLine.prototype.remove = function() {
    if (this.line) this.line.remove();
    delete this.line;
  };

  function addChildrenLines(loop) {
    if (!loop) return;

    Data.forEachChildren(loop, function(child) {
      if (!loop.rooflineConnectedChildren) loop.rooflineConnectedChildren = [];

      LoopsUtils.setLoopPointFront(child.rooflinePoint, roofline);

      var line = new ArrowLine(LoopsUtils.getLoopPoints(loop, child), {id: childArrowId, head: 'marker-end'}, 'roofline_child_line');
      loop.rooflineConnectedChildren.push({'loop': child, 'line': line});

    }, getMinDistance());
  }

  function addParentLine(loop) {
    if (!loop) return;

    var loopParent = Data.getParent(loop, getMinDistance());
    if (loopParent) {

      LoopsUtils.setLoopPointFront(loopParent.rooflinePoint, roofline);

      var line = new ArrowLine(LoopsUtils.getLoopPoints(loop, loopParent, true), {id: parentArrowId, head: 'marker-start'}, 'roofline_parent_line');
      loop.rooflineConnectedParent = {'loop': loopParent, 'line': line};
    }
  }

  function removeChildrenLines(loop) {
    if (!loop || !loop.rooflineConnectedChildren) return;

    loop.rooflineConnectedChildren.forEach(child => child.line.remove());
    delete loop.rooflineConnectedChildren;
  }

  function removeParentLine(loop) {
    if (!loop || !loop.rooflineConnectedParent) return;

    loop.rooflineConnectedParent.line.remove();
    delete loop.rooflineConnectedParent;
  }

  function updateExpanderAndLines(tr) {
    if (Data.isFiltered() || !expander.isConnected() || !tr) return;

    var mainLoop = expander.getConnectedLoop();
    var point = mainLoop.rooflinePoint;

    if (!point) return;

    var x = point.getX();
    var y = point.getY();
    var r = point.getR();

    if (mainLoop.state &&
      mainLoop.state !== ' ') {
      expander.setPos(x, y, r);
    }

    if (mainLoop.rooflineConnectedChildren) {
      mainLoop
        .rooflineConnectedChildren.forEach(child => child.line.update(LoopsUtils.getLoopPoints(mainLoop, child.loop)));
    }

    var connectedParent = mainLoop.rooflineConnectedParent;
    if (connectedParent) {
      connectedParent.line.update(LoopsUtils.getLoopPoints(mainLoop, connectedParent.loop, true));
    }
  }

  function getPatternId(maxRadius, curRadius, vec) {
    var result = 'loopFill-' + maxRadius + '-' + curRadius;
    if (vec) {
      result += '-' + vec;
    }

    return result;
  }

  function getLoopColorDefault(thsColor, mode, vec, fixedColor) {
    var result = undefined;

    if (mode === 0) result = fixedColor;
    else if (mode === 1) result = thsColor;
    else if (mode === 2) result = (vec !== undefined) ? '#ffa500' : '#3473d4';

    return result;
  }

  function filterSelectedPoints(filterOperation, useMatchedLoops) {
    var ids = [];

    function addLoopId(loop) {
      if (loop) {
        if (loop.filtered) console.error('Filtering of already filtered loop');

        ids.push(Data.getLoopId(loop));
      }
    }

    roofline.selectedPoints.forEach(function(point) {
      if (!point) return;

      addLoopId(point.loopData)
      if (useMatchedLoops) {
        Data.forEachMatchingLoops(point.loopData, addLoopId);
      }
    });

    var result = {};
    result[filterOperation] = ids;

    return result;
  }

  function filterPoints(processing) {
    var filterInfo = processing();
    Data.addFilterInfo(filterInfo);

    Events.send('rooflineDataUpdated', {isOldData: true});

    this.unHighlightPoint();

    addFilteringUndo.call(this, [filterInfo], false);
  }

  function addFilteringUndo(filterInfo, state) {
    if (!filterInfo) return;

    zoomer.addUndoFrame({
      process: function() {
        if (state) Data.addFilterInfo(filterInfo);
        else Data.remFilterInfo(filterInfo);

        Events.send('rooflineDataUpdated', {isOldData: true});

        state = !state;
      }.bind(this)
    });
  }

  function isSelectionPresented() {
    var selectedPoints = roofline.selectedPoints;
    return selectedPoints && selectedPoints.length;
  }


  function HistogramValueRepresentation() {
    Chart.DefValueRepresentation.call(this);
  }

  HistogramValueRepresentation.prototype = Object.create(Chart.DefValueRepresentation.prototype);

  function setLineStyle(line, sliderId) {
    line.setStyle('cursor: pointer; stroke: transparent; stroke-width:' + sliderWidth + '; marker-start:' + line.localUrl(sliderId));
  }

  const sliderWidth = 19;
  const sliderHeight = 10;

  const sliderActive = 'SliderActive';
  const sliderInactive = 'Slider';

  HistogramValueRepresentation.prototype.create = function(value, canvas, formatValue, valueLayout, className) {
    valueLayout.textY = sliderHeight + 2;
    valueLayout.tickStartY = sliderHeight;

    Chart.DefValueRepresentation.prototype.create.call(this, value, canvas, formatValue, valueLayout, className);

    setLineStyle(this.line, sliderInactive);
    this.line.activate();
    this.line.el.isMovableItem = true;
    this.line.on('mouseenter', setLineStyle.bind(this, this.line, sliderActive));
    this.line.on('mouseleave', setLineStyle.bind(this, this.line, sliderInactive));
    this.text.activate();
    this.text.el.isMovableItem = true;
    this.text.on('mouseenter', setLineStyle.bind(this, this.line, sliderActive));
    this.text.on('mouseleave', setLineStyle.bind(this, this.line, sliderInactive));
  };

  return {
    setRoofline: function(val) {
      roofline = val;

      roofline.centralPart.body.addEventListener('mousewheel', processMouseWheel.bind(window, 'wheelDelta', -1), false);
      roofline.centralPart.body.addEventListener('DOMMouseScroll', processMouseWheel.bind(window, 'detail', 1), false);

      roofline.centralPart.body.addEventListener('contextmenu', function(e) {
        var menuItems = [];

        var currentLoop;

        if (!Data.isFiltered()) {
          if (Data.isHierarchical()) {
            menuItems = [{
                caption:I18n.getMessage('roofline_menu_collapse_root'),
                id: 3,
                disabled: this.IsRootCollapsed(),
                command: function() {
                  this.collapseRoot();
                }.bind(this)
              }, {
                caption: I18n.getMessage('roofline_menu_expand_all'),
                id: 4,
                disabled: !this.canExpandAll(),
                command: function() {
                  this.expandAll();
                }.bind(this)
              }
            ];
          }

          currentLoop = this.getLoopByElement(e.target);
          if (currentLoop && currentLoop.state) {
            menuItems.unshift({
              caption: currentLoop.state === '-' ? I18n.getMessage('roofline_menu_collapse') : I18n.getMessage('roofline_menu_expand'),
              id: 1,
              command: function() {
                this.changeLoopState(currentLoop);
              }.bind(this)
            }, {
              caption: '-'
            });
          }
        }

        if (menuItems.length) menuItems.push({caption: '-'});

        menuItems.push({
          caption: I18n.getMessage('roofline_filter_in_label'),
          id: 5,
          disabled: !isSelectionPresented(),
          command: filterPoints.bind(this, filterSelectedPoints.bind(this, Data.FilterOperation.in, true))
        });

        menuItems.push({
          caption: I18n.getMessage('roofline_filter_out_label'),
          id: 6,
          disabled: !isSelectionPresented(),
          command: function() {
            filterPoints.call(this, filterSelectedPoints.bind(this, Data.FilterOperation.out));
            roofline.onCurrentPointChanged.raise(roofline.currentPoint);
          }.bind(this)
        });

        menuItems.push({
          caption: I18n.getMessage('roofline_filter_clear_label'),
          id: 7,
          disabled: !Data.isFiltered(),
          command: function() {
            this.cancelFiltering();
          }.bind(this)
        });

        if (currentLoop) {
          if (menuItems.length) menuItems.push({caption: '-'});
          menuItems.push({
            caption: I18n.getMessage('roofline_toolbar_copy_clipboard'),
            id: 8,
            command: function() {
              var copyText = loopTooltipProcessor.getText.call({accepted: currentLoop});
              copyText = DataUtils.unEscapeHTML(copyText
                                                  .replace(/<br>/gi, '%0A')
                                                  .replace(/<[^>]*>/g, '')
                                                );
              Request.sendNotification('copy-' + copyText);
            }.bind(this)
          });
        }

        ContextMenu.show(menuItems, e.pageX, e.pageY);
        ContextMenu.defProcessing(e);
      }.bind(this), false);
    },
    setZoomer: function(val) {
      zoomer = val;
    },
    setScale: function(scale) {
      _scale = scale;
    },
    setConfiguration: function(configuration) {
      if (configuration) Utils.applyObjectProperties(_configuration, configuration);
    },
    clear: function() {
      this.unHighlightPoint();

      expander.clear();

      highlightedPoint = undefined;
    },
    getLoopByElement: function (elem) {
      if (!elem) return;

      var loop;

      if (elem.roofLinePoint) {
        loop = elem.roofLinePoint.loopData;
      } else if (elem.owner && elem.owner.rooflineLoop) {
        loop = elem.owner.rooflineLoop;
      }

      return loop;
    },
    getLoopInfo: function(loop) {
      function getTh(th) {
        if (th !== undefined) return th;

        return 100;
      }

      function getLoopValue(loopTime, resIndex) {
        var value = loopTime / progTime.getTotalTime(resIndex) * 100;
        if (value > 100) value = 100;

        return value;
      }

      var getLoopColor = this.getLoopColor || getLoopColorDefault;

      if (!loop) return;

      var rooflineState = stateManager.getState();

      var noLoopPosition = Data.isNoLoopPosition(loop);

      var loopTime = getLoopSelfTime(loop);

      if (loop.state === '+') {
        loopTime = loop.totalTime;
      }

      var resIndex = loop.resIndex || 0;

      var value = getLoopValue(loopTime, resIndex);

      var totalValue;
      if (loop.state === '-') {
        totalValue = getLoopValue(loop.totalTime, resIndex);
      }

      var loopPosition = Data.getLoopPosition(loop, noLoopPosition);

      var colorMode = getColorMode(rooflineState.colorMode);

      var result;
      var totalRadius;
      var ths = getThs();
      for (var i = 0, len = ths.length; i < len; i++) {
        if (totalValue &&
            !totalRadius &&
            totalValue > value &&
            totalValue <= getTh(ths[i].th)) {
          totalRadius = ths[i].radius;
        }

        if (!result &&
            value <= getTh(ths[i].th)) {
          result = {
            radius: Math.round(4 * _scale),
            _x: loopPosition.x,
            _y: loopPosition.y,
            getRadius: function() {
              return this.totalRadius ? this.totalRadius : this.radius;
            },
            getX: function() {
              return this._x;
            },
            getY: function() {
              return this._y;
            }
          };

          if (rooflineState.useSizes !== false) result.radius = ths[i].radius;
          result.color = getLoopColor(ths[i].color, colorMode, loop.vec, rooflineState.defLoopColor);
        }
      }

      if (rooflineState.useSizes !== false &&
          totalRadius &&
          totalRadius > result.radius) {
        result.patternId = getPatternId(totalRadius, result.radius, colorMode === 2 ? loop.vec : 0);
        result.totalRadius = totalRadius;
      }

      if (noLoopPosition && !rooflineState.ignoreNoLoopPosition ||
          !Data.isHierarchical() && loop.state === '-') {
        result.noLoopPosition = true;
        result.color = rooflineState.nstLoopColor;
      }

      if (resIndex) result.resIndex = resIndex;

      return result;
    },
    createLinesArrows: function() {
      UiUtils.createLineArrowMarker(childArrowId, 'roofline_child_arrow', roofline, _scale);
      UiUtils.createLineArrowMarker(parentArrowId, 'roofline_parent_arrow', roofline, _scale, 0);
    },
    fillPatterns: function(isNew) {
      if (!roofline) return;

      var sectionId = 'fill_patterns';
      var section;

      if (isNew) {
        section = roofline.centralPart.graphicsRoot.createDefs(sectionId);
      } else {
        section = roofline.centralPart.graphicsRoot.getElementById(sectionId);
        if (section) section.clear();
      }

      if (!section) return;

      var ths = getThs();
      if (!ths || !ths.length) return;

      var rooflineState = stateManager.getState();
      var colorMode = getColorMode(rooflineState.colorMode);

      var defLoopColor = rooflineState.defLoopColor || 'lightgray';

      var loopConstructors = [Roofline.CirclePoint];
      for (var i = 1, len = Data.getResultCount(); i < len; i++) {
        var constr = Data.getPointConstructor(i);
        if (loopConstructors.indexOf(constr) < 0) {
          loopConstructors.push(constr);
        } else {
          break;
        }
      }

      loopConstructors.forEach(function(loopConstructor) {
        if (loopConstructor) {
          for (var i = 1, len = ths.length; i < len; i++) {
            var maxRadius = ths[i].radius;
            for (var j = 0; j < i; j++) {
              var curRadius = ths[j].radius;

              if (colorMode !== 2) {
                loopConstructor.createFillPattern(section, maxRadius, curRadius, colorMode !== 0 ? ths[j].color : defLoopColor, getPatternId(maxRadius, curRadius));
              } else {
                loopConstructor.createFillPattern(section, maxRadius, curRadius, getLoopColorDefault(ths[j].color, colorMode, 1), getPatternId(maxRadius, curRadius, 1));
                loopConstructor.createFillPattern(section, maxRadius, curRadius, getLoopColorDefault(ths[j].color, colorMode), getPatternId(maxRadius, curRadius));
              }
            }
          }
        }
      });
    },
    fillLoop: function(point, loopInfo) {
      if (!point ||
          !loopInfo) {
        return;
      }

      if (loopInfo.noLoopPosition) {
        point.addClass('no_loop_position');

        point.setFillColor(loopInfo.color);
      } else {
        point.remClass('no_loop_position');

        if (loopInfo.patternId) {
          point.setPatternId(loopInfo.patternId);
        } else {
          point.setFillColor(loopInfo.color);
        }
      }

      if (loopInfo.color) point.el.setAttr('data-color', loopInfo.color);
      else point.el.remAttr('data-color');
    },
    fillLoops: function() {
      var isFiltered = Data.isFiltered();
      var forEachLoops = isFiltered ? Data.forEachLoopsSimple : Data.forEachLoops;

      function processHistogramLoops(loops) {
        forEachLoops(loops, function(loop) {
          if (isFiltered && loop.filtered) return;

          addLoopToHistogram(loop);
        }.bind(this), false);
      }

      function processRooflineLoops(loops) {
        if (!loops) return;

        forEachLoops(loops, function(loop, parent, isHidden) {
          if (Data.isFiltered() && loop.filtered) return;

          var loopInfo = this.getLoopInfo(loop);

          var point = roofline.addPoint(loopInfo.getX(), loopInfo.getY(), loopInfo.getRadius(), 'roofline_loop', undefined,
                                        Data.getPointConstructor(loopInfo.resIndex) || Roofline.CirclePoint);
          point.loopData = loop;
          loop.rooflinePoint = point;

          this.fillLoop(point, loopInfo);

          if (isHidden) point.hide();
        }.bind(this), true);
      }

      Events.send('loopsCreating');

      this.createLinesArrows();

      histogram = [];
      histogramLoopsCount = 0;
      maxHistogramPercent = 0;

      checkLoopsRepresentation();

      calcHistogramSize();

      processHistogramLoops.call(this, Data.getLoops());
      this.fillPatterns(true);

      processRooflineLoops.call(this, Data.getLoops());
    },
    highlightPoint: function(point) {
      if (Data.isFiltered() || !point || expander.isIgnored() || point.isHidden()) return;

      if (expander.isConnected()) {
        removeChildrenLines(expander.getConnectedLoop());
        removeParentLine(expander.getConnectedLoop());
      }

      if (!expander.isValid()) createExpander.call(this);

      if (!point.loopData.state ||
          point.loopData.state === ' ') {
        // leaf point
        this.unHighlightPoint();
        expander.connect(point.loopData);
        addParentLine(point.loopData);
        expander.setPos(-100, -100, 10);
        LoopsUtils.setLoopPointFront(point, roofline);
      } else {
        var x = point.getX();
        var y = point.getY();
        var r = point.getR();

        expander.setPos(x, y, r);

        expander.connect(point.loopData);
        expander.refreshState(point.loopData);

        if (point.loopData.state === '-') {
          addChildrenLines(point.loopData);
        }
        addParentLine(point.loopData);
        LoopsUtils.setLoopPointFront(point, roofline);
        expander.front();
      }
    },
    unHighlightPoint: function() {
      if (!expander.isConnected()) return;

      removeChildrenLines(expander.getConnectedLoop());
      removeParentLine(expander.getConnectedLoop());

      expander.hide();
    },
    changeLoopState: changeLoopState,
    collapseThisPosition: function(loop) {
      var resultLoop = loop;
      var parentLoop = Data.getParent(resultLoop);

      while (parentLoop &&
             parentLoop.x1 === resultLoop.x1 &&
             parentLoop.y1 === resultLoop.y1) {
        resultLoop = parentLoop;
        parentLoop = Data.getParent(resultLoop);
      }

      if (resultLoop.state === '-') this.changeLoopState(resultLoop);
    },
    collapseRoot: function() {
      var result = Data.getLoops()[0];

      if (result && result.state === '-') this.changeLoopState(result);
    },
    IsRootCollapsed: function() {
      var root = Data.getLoops()[0];

      return !!root && root.state === '+';
    },
    expandAll: function() {
      function setLoopState(loop, state) {
        loop.state = state;
      }

      var expandedLoops = [];

      Data.forEachLoopsSimple(Data.getLoops(), function(loop) {
        if (loop.state === '+') {
          setLoopState(loop, '-');
          expandedLoops.push(loop);
        }
      }, true);

      if (expandedLoops.length > 1) {
        zoomer.addUndoFrame({
          process: function() {
            expandedLoops.forEach(function(loop) {
              if (loop && loop.state) {
                setLoopState(loop, loop.state === '+' ? '-' : '+');
              }
            });

            Events.send('rooflineDataUpdated');
            Data.saveHierarchy();
          }
        });

        Events.send('rooflineDataUpdated');
        Data.saveHierarchy();
      } else if (expandedLoops.length) {
        var loop = expandedLoops[0];
        setLoopState(loop, '+');
        this.changeLoopState(loop);
      }
    },
    canExpandAll: function() {
      var result = false;

      Data.forEachLoopsSimple(Data.getLoops(), function(loop) {
        if (loop.state === '+') {
          result = true;
        }
      });

      return result;
    },
    fillSettings: function() {
      var loopsTableBody = Utils.getElementById(loopsTableBodyId);
      Utils.removeAllChildren(loopsTableBody);

      var ths = getThs();
      ths.forEach(function(th, index) {
        var maxTH = th.th || 100;
        var minTH = 0;
        if (index - 1 >= 0) minTH = ths[index - 1].th;

        this._fillLoopRow(loopsTableBody.insertRow(-1), th, maxTH - minTH > 0);

        if (th.th) {
          this._fillThRow(loopsTableBody.insertRow(-1), th.th);
        }
      }.bind(this));

      this._updateBtnsState(stateManager.getState());
    },
    fillHistogramChart: function(parent) {
      function fillGradient(gradient, ths) {
        gradient.addStop('0%', ths[0].color);

        for (var i = 0, len = ths.length; i < len; i++) {
          var th = ths[i].th ? ths[i].th / getHistogramViewSize() * 100 : 0;
          if (th) {
            gradient.addStop(th + '%', ths[i].color);
            gradient.addStop(th + '%', ths[i + 1].color);
          } else {
            gradient.addStop('100%', ths[i].color);
          }
        }
      }

      function createTotalLine(val, width) {
        function transformItem(item) {
          if (!item || !item.el) return;

          if (item.el.getCTM()) {
            var xForm = item.createTransform();
            xForm.setMatrix(item.el.getCTM().inverse());
          }
        }

        var line = this.centralPart.graphicsRoot
          .createLine()
            .setClass('legend_total_line')
            .setX1(1)
            .setY1(1)
            .setX2(width)
            .setY2(1);

        transformItem(line);

        var textOffset = 3;
        var text = this.centralPart.canvas
          .createText(getLoopsCaption(val))
            .setClass('legend_total_text')
            .setX(width - textOffset)
            .setY(textOffset)
            .setStyle('text-anchor: end; dominant-baseline: text-before-edge;');

        transformItem(text);
      }

      function getLoopsCaption(loopCount) {
        return Utils.format(loopCount !== 1 ? I18n.getMessage('roofline_histogram_loops') : I18n.getMessage('roofline_histogram_loop'), loopCount.toString());
      }

      function getLoopsTooltip(percent, loopCount) {
        return Utils.format(loopCount !== 1 ? I18n.getMessage('roofline_histogram_tooltip_loops') : I18n.getMessage('roofline_histogram_tooltip_loop'),
          percent.toString(), loopCount.toString());
      }

      function createSlider(section, id, style) {
        section
         .createMarker(id)
          .setMarkerWidth(sliderWidth)
          .setMarkerHeight(sliderHeight)
          .setRefX(sliderMiddle)
          .setRefY(sliderHeight - 1)
          .setOrient('0')
          .setMarkerUnits('userSpaceOnUse')
          .createPath()
            .moveToAbs(0, sliderHeight - 1)
            .lineToAbs(sliderMiddle, 0)
            .lineToAbs(sliderWidth, sliderHeight - 1)
            .lineToAbs(0, sliderHeight - 1)
            .setD()
            .setClass(style);
      }

      this._parent = this._parent || Utils.getDomElement(parent);
      Utils.removeAllChildren(this._parent);

      if (!histogramLoopsCount) {
        this._parent.style.display = 'none';
        return;
      } else {
        this._parent.style.display = 'block';
      }

      this.horzAxis = Chart.createHorzAxis(this._parent, true);
      this.centralPart = Chart.createCentralPart(this._parent, true);

      var sliderMiddle = sliderWidth / 2;
      var sliderDefs = this.horzAxis.canvas.createDefs();

      createSlider(sliderDefs, sliderInactive, 'histogram_slider');
      createSlider(sliderDefs, sliderActive, 'histogram_slider_active');

      this.axisCaption = Utils.createElement(Data.getRooflineData().legendCaption, 'legend_axis_caption', '', this._parent);
      this.centralPart.setViewbox(0, 0, getHistogramViewSize(), histogramLoopsCount);
      this.horzAxis.setCentralPart(this.centralPart);

      this.centralPart.ontooltiptext = function(target, x, y) {
        var index = Utils.floor(x, histogramPrecision);
        var percent = fixHistogramValue(index + histogramStep);
        var loopCount = histogram[index] || 0;
        return getLoopsTooltip(percent, loopCount);
      };

      var ths = getThs();
      var gradient = this.centralPart.canvas.createDefs()
        .createLinearGradient('FillGradient')
          .setLeftRight();

      fillGradient(gradient, ths);

      for (var i = 0, len = ths.length; i < len; i++) {
        var value = ths[i].th;
        if (value) {
          this.horzAxis.addValue(fixHistogramValue(value), undefined, HistogramValueRepresentation);
        }
      }

      var path = this.centralPart.graphicsRoot.createPath();
      path
        .setClass('histogramLine')
        .setAttr('fill', path.localUrl('FillGradient'))
        .moveToAbs(0, 0);
      for (i = 0, len = getHistogramViewSize(); i < len; i += histogramStep) {
        i = fixHistogramValue(i);
        path
          .lineToVerticalAbs(histogram[i] || 0)
          .lineToHorizontalRel(histogramStep);
      }
      path
        .lineToVerticalAbs(0)
        .closePath()
        .setD();

      createTotalLine.call(this, histogramLoopsCount, this.centralPart.body.offsetWidth);

      if (!this._parent.classList.contains('user_activity')) {
        this._parent.classList.add('collapsed');
      }

      var axisPos;
      var movableIndex = -1;
      var rangeTh;
      var thEditor;

      var horzAxis = this.horzAxis;
      this.thMoving = Utils.createResizeProcess(horzAxis.body, {
        accepted: function(target) {
          function getThEditor(index) {
            var loopsTableBody = Utils.getElementById(loopsTableBodyId);
            var row = loopsTableBody.children[index * 2 + 1];
            if (row) return row.querySelector('.threshold_input');
          }

          var isMovable = target.isMovableItem;

          if (isMovable) {
            horzAxis.values.some(function(value, index) {
              if (value.representation.text.el === target ||
                  value.representation.line.el === target) {
                movableIndex = index;
                return true;
              }

              return false;
            });

            if (movableIndex >= 0) {
              axisPos = Utils.getElementPos(horzAxis.body);

              var ths = getThs();
              rangeTh = {
                min: 0,
                max: 100
              };

              var th = ths[movableIndex - 1];
              if (th) rangeTh.min = th.th;
              th = ths[movableIndex + 1];
              if (th) rangeTh.max = th.th || getHistogramViewSize();

              thEditor = getThEditor(movableIndex);
            }
          }

          return isMovable;
        },
        getDeltaThreshold: function() {
          return 0;
        },
        getDelta: function(newPos, oldPos, startPos) {
          return newPos.x - axisPos.x;
        },
        getCursor: function() {
          return 'pointer';
        },
        onProcess: function(delta) {
          var value = fixHistogramValue(delta / horzAxis.body.clientWidth * getHistogramViewSize());
          if (value > rangeTh.min && value < rangeTh.max) {
            var ths = getThs(true);

            if (ths[movableIndex].th === value) return;

            horzAxis.changeValue(movableIndex, value);
            horzAxis.layoutValues();
            ths[movableIndex].th = value;

            gradient.clear();
            fillGradient(gradient, ths);

            this._applyChanges(true);
            if (thEditor) thEditor.value = value;
          }
        },
        onEnd: function() {
          axisPos = undefined;
          movableIndex = undefined;
          thEditor = undefined;
        }
      }, this);
    },
    processResize: function(tr) {
      if (!tr) return;

      updateExpanderAndLines(tr);
    },
    cancelFiltering: function() {
      if (!Data.isFiltered()) return;

      var filterInfos = Data.clearFiltering();

      Events.send('rooflineDataUpdated', {isOldData: true});
      this.highlightPoint(roofline.currentPoint);

      addFilteringUndo.call(this, filterInfos, true);
    },
    _insertThSettings: function(index) {
      var ths = getThs(true);
      var th = ths[index];

      var maxTH = th.th || 100;
      var minTH = 0;
      if (index - 1 >= 0) minTH = ths[index - 1].th;

      var newTh = {
        radius: th.radius,
        color: th.color,
        th: minTH + (maxTH - minTH) / 2
      };

      if (newTh.th > minTH && newTh.th < maxTH) {
        ths.splice(index, 0, newTh);

        var loopsTableBody = Utils.getElementById(loopsTableBodyId);

        this._fillLoopRow(loopsTableBody.insertRow(index * 2), newTh, newTh.th - minTH > 0);
        this._fillThRow(loopsTableBody.insertRow(index * 2 + 1), newTh.th);

        this._applyChanges();
      }
    },
    _removeThSettings: function(index) {
      var ths = getThs(true);
      ths.splice(index, 1);

      var loopsTableBody = Utils.getElementById(loopsTableBodyId);

      loopsTableBody.deleteRow(index * 2);
      loopsTableBody.deleteRow(index * 2);

      this._applyChanges();
    },
    _fillLoopRow: function(loopRow, th, isEnabled) {
      if (!loopRow || !th) return;

      loopRow.className = 'loop_row';

      var buttonCell = loopRow.insertCell(0);
      Utils.createElement('', 'icon plus', '', buttonCell, 'button', function(btn) {
        btn.onclick = this._insertTh.bind(this);
        btn.disabled = !isEnabled;
      }.bind(this));

      var sampleCell = loopRow.insertCell(1);
      sampleCell.className = 'loop_sample_cell';
      var sampleDiv = Utils.createElement('', 'loop_sample', '', sampleCell, 'div', function(div) {
        div.style.backgroundColor = th.color;
        div.style.width = div.style.height = (th.radius * 2) + 'px';
      });

      var sizeCell = loopRow.insertCell(2);
      Utils.createElement('', 'size_input', '', sizeCell, 'input', function(edit) {
        edit.setAttribute('value', th.radius);
        edit.oninput = this._changeSize.bind(this, sampleDiv);
        edit.onblur = this._processBlur.bind(this, 'radius');
        edit.onkeypress = UiUtils.filterNumberInput;
      }.bind(this));

      var colorCell = loopRow.insertCell(3);
      Utils.createElement('', 'color_input', '', colorCell, 'input', function(edit) {
        edit.setAttribute('type', 'text');
        edit.setAttribute('value', th.color);
        edit.oninput = this._changeColor.bind(this, sampleDiv);
        UiUtils.addColorPicker(edit);
        edit.onblur = this._processBlur.bind(this, 'color');
      }.bind(this));

      var visCell = loopRow.insertCell(4);
      visCell.className = 'roof_settings_input visibility_input';
      Utils.createElement('', '', '', visCell, 'input', function(cb) {
        cb.type = 'checkbox';
        cb.checked = true;
      }.bind(this));
    },
    _fillThRow: function(thRow, th) {
      if (!thRow) return;

      thRow.className = 'threshold_row';

      var buttonCell = thRow.insertCell(0);
      Utils.createElement('', 'icon minus', '', buttonCell, 'button', function(btn) {
        btn.onclick = this._removeTh.bind(this);
      }.bind(this));

      var thCell = thRow.insertCell(1);
      thCell.setAttribute('colspan', '4');

      Utils.createElement('Threshold Value', 'threshold_label', '', thCell, 'label', function(lbl) {
        lbl.setAttribute(UiUtils.tooltipAttr, Data.getRooflineData().legendCaption);
      });

      Utils.createElement('', 'threshold_input', '', thCell, 'input', function(edit) {
        edit.setAttribute('value', th);
        edit.oninput = this._changeTh.bind(this);
        edit.onblur = this._processBlur.bind(this, 'th');
        edit.onkeypress = UiUtils.filterNumberInput;
      }.bind(this));

      Utils.createElement('%', 'threshold_label', '', thCell, 'label');
    },
    _getIndex: function(elem) {
      var row = elem.parentNode.parentNode;
      var body = row.parentNode;

      var index = [].indexOf.call(body.children, row);
      return Math.floor(index / 2);
    },
    _insertTh: function(e) {
      var btn  = e.target;
      if (!btn) return;

      var index = this._getIndex(btn);
      this._insertThSettings(index);
    },
    _removeTh: function(e) {
      var btn  = e.target;
      if (!btn) return;

      var index = this._getIndex(btn);
      this._removeThSettings(index);
    },
    _changeColor: function(sampleDiv, e) {
      var colorEd = e.target;
      if (!colorEd) return;

      var newColor = colorEd.value;

      var res = validateColor(newColor, sampleDiv);
      if (res.isValid) {
        if (res.isNew) {
          var index = this._getIndex(colorEd);
          var ths = getThs(true);
          ths[index].color = newColor;

          this._applyChanges();
        }
        UiUtils.markNormal(colorEd);
      } else {
        UiUtils.markWrong(colorEd, 'The value should be a valid CSS color');
      }
    },
    _changeSize: function(sampleDiv, e) {
      var sizeEd = e.target;
      if (!sizeEd) return;

      var newSize = parseFloat(sizeEd.value);
      var maxSize = Math.round(12 * _scale);
      if (!isNaN(newSize) &&
          newSize <= maxSize &&
          newSize > 0) {
        sampleDiv.style.width = sampleDiv.style.height = (newSize * 2) + 'px';
        var index = this._getIndex(sizeEd);
        var ths = getThs(true);
        ths[index].radius = newSize;

        this._applyChanges();
        UiUtils.markNormal(sizeEd);
      } else {
        UiUtils.markWrong(sizeEd, 'The value should be between 0 and ' + maxSize);
      }
    },
    _changeTh: function(e) {
      function getAddBtn(ed) {
        var row = ed.parentNode.parentNode.previousSibling;
        return row.firstChild.firstChild;
      }

      var thEd = e.target;
      if (!thEd) return;

      var newTh = parseFloat(thEd.value);
      if (!isNaN(newTh)) {
        var index = this._getIndex(thEd);
        var ths = getThs(true);

        var maxTH = 100;
        if (index + 1 < ths.length - 1) maxTH = ths[index + 1].th;
        var minTH = 0;
        if (index - 1 >= 0) minTH = ths[index - 1].th;

        if (newTh < maxTH &&
            newTh >= minTH) {
          ths[index].th = newTh;
          var addBtn = getAddBtn(thEd);
          if (addBtn) addBtn.disabled = (newTh - minTH <= 1);

          this._applyChanges();
          UiUtils.markNormal(thEd);
        } else {
          UiUtils.markWrong(thEd, 'The value should be between ' + minTH + ' and ' + maxTH);
        }
      }
    },
    _processBlur: function(prop, e) {
      var editor = e.target;
      if (!editor) return;

      var index = this._getIndex(editor);
      var ths = getThs(true);

      var value = ths[index][prop].toString();

      if (editor.value !== value) {
        editor.value = value;
        UiUtils.markNormal(editor);
      }
    },
    _processEnter: function(e) {
      var editor = e.target;
      if (!editor) return;

      if (e.which === 13 && editor.oninput) {
        editor.oninput(e);
      }
    },
    _applyChanges: function(skipHistogram) {
      stateManager.save(loopsThsId);

      updateRooflineLoops();
      if (!skipHistogram) this.fillHistogramChart();
    },
    _updateBtnsState: function(state) {
      state  = state || {};

      cancelLoopSettingsBtn.disabled = !copyThs;
      revertLoopSettingsBtn.disabled = !state.loopsThs;
    },
    revertDefault: function() {
      var state  = stateManager.getState();

      if (state.loopsThs) delete state.loopsThs;
      copyThs = undefined;

      this.fillSettings();
      this._applyChanges();
    },
    cancelChanges: function() {
      if (copyThs.length) {
        var state  = stateManager.getState();

        state.loopsThs = copyThs;
        copyThs = undefined;

        this.fillSettings();
        this._applyChanges();
      } else {
        this.revertDefault();
      }
    },
    apply: function(state) {
      this._updateBtnsState(state);
    },
    saveState: function(state) {
      this._updateBtnsState(state);

      if (state && !state.loopThs) {
        state.loopThs = getThs();
      }
    },
    getLoopsThs: function() {
      return getThs();
    }
  };
})();

stateManager.addProcessor(loopsThsId, loopsRepresentation);

Events.recv('rooflineCleared', loopsRepresentation.clear, loopsRepresentation);
Events.recv('rooflineResized', loopsRepresentation.processResize, loopsRepresentation);
Events.recv('currentPointChanged', function(point) {
  loopsRepresentation.highlightPoint(point);

  if (point && point.loopData) {
    Events.send('currentLoopChanged', point.loopData);
  }
});
Events.recv('loopStateChanged', loopsRepresentation.changeLoopState, loopsRepresentation);

Events.recv('loopHighlighted', function(loop) {
  if (!loop) return;

  var point = loop.rooflinePoint;
  if (point) {
    LoopsUtils.setLoopPointFront(point, roofline);
  }
});

function checkLoopsRepresentation() {
  var rooflineParent = Utils.getElementById('roofline_content');
  var loopsTableBody = Utils.getElementById(loopsTableBodyId);
  var settingsContent = Utils.getElementById('roofline_settings');

  var colorMode = getColorMode(stateManager.getState().colorMode);

  if (colorMode !== 0) {
    rooflineParent.classList.add('use_loops_colors');
    settingsContent.classList.add('use_loops_colors');
  } else {
    rooflineParent.classList.remove('use_loops_colors');
    settingsContent.classList.remove('use_loops_colors');
  }

  if (colorMode === 1) {
    loopsTableBody.classList.add('set_weight_colors');
  } else {
    loopsTableBody.classList.remove('set_weight_colors');
  }
}

function updateRooflineLoops() {
  if (!roofline) return;

  checkLoopsRepresentation();

  loopsRepresentation.fillPatterns();

  roofline.points.forEach(function(point) {
    var loop = point.loopData;
    if (!loop) return;

    var loopInfo = loopsRepresentation.getLoopInfo(loop);

    var radius = loopInfo.getRadius();
    point.setR(radius);

    loopsRepresentation.fillLoop(point, loopInfo);
  });
}

var centralPartPos;
var highlightedPoint;

function getLocalMousePos(e) {
  if (!centralPartPos) centralPartPos = Utils.getElementPos(roofline.centralPart.body);

  return {
    x: e.pageX - centralPartPos.x,
    y: e.pageY - centralPartPos.y
  };
}

function processMouseWheel(prop, coef, e) {
  var currentMousePos = getLocalMousePos(e);

  var point;

  if (highlightedPoint) {
    point = {
      x: highlightedPoint.x,
      y: highlightedPoint.y
    };
  } else {
    point = roofline.tr.P2L(currentMousePos.x, currentMousePos.y);
  }

  if (e[prop] * coef < 0) zoomer.zoomIn(2, point);
  else zoomer.zoomOut(2, point);
}



var beginBold = '<span style="font-weight: bold">';
var endBold = '</span><br>';

function getResultDesc(loop) {
  var result = '';

  if (loop && Data.getResultCount() > 1) {
    result = I18n.getMessage('roofline_compare_tooltip_result_label') + ' ' + beginBold +
      Data.getResultCaption(loop.resIndex || 0) + endBold;
  }

  return result;
}

function getLoopDesc(loop) {
  var result = loop.desc;

  if (!result) {
    result = DataUtils.escapeHTML(loop.name);
    if (result && result.charAt(0) !== '[') {
      result += ' ' + (loop.locat || '');
    }
  }

  if (!result) {
    result = loop.locat;
  }

  return beginBold + result + endBold;
}

function getLoopValueStr(data, value, desc) {
  function format(val, formatFn) {
    if (formatFn) return formatFn(val);

    return val;
  }

  if (isNaN(value) || !data) return '';

  return data[desc.name] + ValueUtils.pref + format(value, desc.format) + ValueUtils.post + data[desc.measure];
}

function getNameXText(loop, data) {
  var result = '';

  if (loop && loop.x !== undefined) {
    if (data && data.namePref) {
      result += data.namePref;
    }

    result += Data.getMemoryLevelPrefix(loop, data) +
              getLoopValueStr(data, loop.x, {name: 'nameX', measure: 'measureX', format: ValueUtils.formatVal}) +
              '<br>';
  }

  return result;
}

function getNameYText(loop, data) {
  var result = '';

  if (loop && loop.y !== undefined) {
    if (data && data.namePref) {
      result += data.namePref;
    }

    result += getLoopValueStr(data, loop.y, {name: 'nameY', measure: 'measureY', format: ValueUtils.formatVal}) +
              '<br>';
  }

  return result;
}

function getNameX1Text(loop, data) {
  var result = '';

  if (loop && loop.x1 !== undefined) {
    if (data && data.namePref1) {
      result += data.namePref1;
    }

    result += Data.getMemoryLevelPrefix(loop, data) +
              getLoopValueStr(data, loop.x1, {name: 'nameX', measure: 'measureX', format: ValueUtils.formatVal}) +
              '<br>';
  }

  return result;
}

function getNameY1Text(loop, data) {
   var result = '';

  if (loop && loop.y1 !== undefined) {
    if (data && data.namePref1) {
      result += data.namePref1;
    }

    result += getLoopValueStr(data, loop.y1, {name: 'nameY', measure: 'measureY', format: ValueUtils.formatVal}) +
              '<br>';
  }

  return result;
}

function getLoopType(loop, data) {
   if (data &&
       data.loopTypes &&
       loop &&
       loop.type) {
     var typeStr = data.loopTypes[loop.type];
     if (typeStr) return typeStr + '<br>';
   }

   return '';
}

// use the following format functions
// ValueUtils.simpleFormat for numeric values
// ValueUtils.formatVal for logarithm values
// ValueUtils.formatTime for time intervals; undefined for others
var tooltipAttrs = [
  {
    name: 'selfTime',
    format: ValueUtils.formatTime
  },
  {
    name: 'selfElapsedTime',
    format: ValueUtils.formatTime
  },
  {
    name: 'totalTime',
    format: ValueUtils.formatTime
  },
  {
    name: 'selfGbPerSec',
    format: ValueUtils.simpleFormat
  },
  {
    name: 'totalGbPerSec',
    format: ValueUtils.simpleFormat
  },
];

var loopTooltipProcessor = UiUtils.addTooltipProcessor({
  accepted: undefined,
  accept: function(target) {
    if (!target) return false;

    var accepted = loopsRepresentation.getLoopByElement(target) || target.loopData;

    if (accepted) {
      if (this.accepted !== accepted) {
        this.accepted = accepted;
        highlightedPoint = this.accepted.rooflinePoint;

        Events.send('loopEntered', this.accepted);
      }
    } else {
      var wasAccepted = !!this.accepted;

      this.accepted = undefined;
      highlightedPoint = undefined;

      if (wasAccepted) Events.send('loopLeaved');
    }

    return !!this.accepted;
  },
  getText: function(target) {
    var loop = this.accepted;
    if (!loop) return;

    var data = Data.getRooflineData4Loop(loop);
    if (!data) return;

    var result = getResultDesc(loop, data) + getLoopDesc(loop) + getLoopType(loop, data) +
            getNameYText(loop, data) + getNameXText(loop, data) + getNameY1Text(loop, data) + getNameX1Text(loop, data);

    tooltipAttrs.forEach(function(attr, index) {
      var valueStr = getLoopValueStr(data.attrs[attr.name], loop[attr.name], {name: 'name', measure: 'measure', format: attr.format})
      if (valueStr && index) valueStr = '<br>' + valueStr;

      result += valueStr;
    });

    return result;
  }
});

cancelLoopSettingsBtn = document.getElementById('cancel_loops_settings_button');
cancelLoopSettingsBtn.onclick = loopsRepresentation.cancelChanges.bind(loopsRepresentation);

revertLoopSettingsBtn = document.getElementById('revert_loops_settings_button');
revertLoopSettingsBtn.onclick = loopsRepresentation.revertDefault.bind(loopsRepresentation);

StateManager.addCheckSetting(document.querySelector('input[value="size"][type="checkbox"]'), 'useSizes', updateRooflineLoops);
StateManager.addComboSetting('color_mode_combo', 'colorMode', updateRooflineLoops, defaultColorMode);

function addColorSetting(editId, sampleId, settingName, defColor) {
  var editor = Utils.getDomElement(editId);
  var sample = Utils.getDomElement(sampleId);
  if (!editor || !sample) return;

  sample.style.backgroundColor = defColor;

  editor.oninput = function(e) {
    var newColor = e.target.value;

    var res = validateColor(newColor, sample);

    if (!newColor || res.isValid) {
      if (res.isNew) {
        stateManager.save(settingName);
        sample.style.backgroundColor = newColor || defColor;
        updateRooflineLoops();
      }
      UiUtils.markNormal(editor);
    } else {
      UiUtils.markWrong(editor, 'The value should be empty or a valid CSS color');
    }
  };

  editor.onblur = function(e) {
    var curColor = e.target.value;

    var res = validateColor(curColor, sample);
    if (!curColor || !res.isValid) {
      editor.value = defColor;
      UiUtils.markNormal(editor);
    }
  };

  UiUtils.addColorPicker(editor, function(text, items) {
    return !!text;
  });

  return stateManager.addProcessor(settingName, {
    apply: function(state) {
      if (state) {
        var value = defColor;
        var settingValue = state[settingName];
        if (settingValue !== undefined) {
          value = settingValue;
        }
        editor.value = value;
        sample.style.backgroundColor = value;
      }
    },
    saveState: function(state) {
      var settingValue = state[settingName];
      var newValue = editor.value;
      if (newValue !== settingValue) {
        if (newValue && newValue !== defColor) state[settingName] = newValue;
        else if (settingValue) delete state[settingName];
      }
    }
  });
}

var defLoopColorId = 'defLoopColor';
var nstLoopColorId = 'nstLoopColor';

addColorSetting('roofline_def_loop_color_edit', 'roofline_def_loop_color_sample', defLoopColorId, 'lightgray');
addColorSetting('roofline_nst_loop_color_edit', 'roofline_nst_loop_color_sample', nstLoopColorId, '#eee');

var loadLoopsColorsBtn = document.getElementById('load_loops_settings_button');
loadLoopsColorsBtn.onclick = function() {
  Request.sendNotification('loadLoopsColors');
};

Request.addConsumer('loadedLoopsColors', {
  process: function(data) {
    var state = stateManager.getState();

    if (data.loopsThs) {
      state.loopsThs = data.loopsThs;
      stateManager.apply(undefined, loopsThsId);
    }

    if (data.defLoopColor) {
      state.defLoopColor = data.defLoopColor;
      stateManager.apply(undefined, defLoopColorId);
    }

    if (data.nstLoopColor) {
      state.nstLoopColor = data.nstLoopColor;
      stateManager.apply(undefined, nstLoopColorId);
    }

    Events.send('rooflineDataUpdated', {isOldData: true});
    stateManager.save(loopsThsId);
    stateManager.save(defLoopColorId);
    stateManager.save(nstLoopColorId);
  },
  onerror: function(e) {
    if (e.message) UiUtils.toast(e.message);
  }
});

var saveLoopsColorsBtn = document.getElementById('save_loops_settings_button');
saveLoopsColorsBtn.onclick = function() {
  var data = {};
  var state = stateManager.getState();

  data.loopsThs = loopsRepresentation.getLoopsThs();
  if (state.defLoopColor) data.defLoopColor = state.defLoopColor;
  if (state.nstLoopColor) data.nstLoopColor = state.nstLoopColor;

  window.saveLocalProperty('saveLoopsColors', data);
};

return loopsRepresentation;
});
