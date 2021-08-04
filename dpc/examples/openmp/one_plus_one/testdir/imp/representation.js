define([
  './state_manager',
  './zooming',
  './value_utils',
  './request',
  './data',
  './loops_representation',
  './roofs_representation',
  './extensions',
  './ui_utils',
  './events',
  '../idvcjs/utils',
  '../idvcjs/roofline',
  '../idvcjs/chart'
], function(StateManager, Zooming, ValueUtils, Request, Data, LoopsRepresentation, RoofsRepresentation, Extensions, UiUtils, Events, Utils, Roofline, Chart) {

var roofline;

var _scale = 1.0;

var zoomer;
var stateManager = StateManager.get();

const chartAreaPadding = UiUtils.getChartAreaPadding();

Events.recv('rooflineCleared', function() {
  if (roofline) roofline.clear();

  document.body.classList.remove('no_data');
  document.body.classList.add('data_loading');
});

Events.recv('rooflineDataUpdated', processRooflineData);

Events.recv('loopHighlighted', function(loop) {
  if (!loop) return;

  var point = loop.rooflinePoint;
  if (point) {
    setTimeout(flashPoints, 50, [point]);
  }
});

function createTotalTick(section, id, style) {
  var totalMiddle = totalValueWidth / 2;

  section
    .createMarker(id)
      .setMarkerWidth(totalValueHeight)
      .setMarkerHeight(totalValueWidth)
      .setRefX(1)
      .setRefY(totalMiddle)
      .setOrient('auto')
      .setMarkerUnits('userSpaceOnUse')
      .createPath()
        .moveToAbs(0, 0)
        .lineToAbs(0, totalValueWidth)
        .lineToAbs(totalValueHeight, totalMiddle)
        .lineToAbs(0, 0)
        .setD()
        .setClass(style);
}

function TotalValueRepresentation() {
  Chart.DefValueRepresentation.call(this);
}

TotalValueRepresentation.prototype = Object.create(Chart.DefValueRepresentation.prototype);

function setLineStyle(line, arrowId, active) {
  line.setStyle('stroke: transparent; stroke-width:' + totalValueWidth + '; marker-start:' + line.localUrl(arrowId));

  if (roofline && roofline.centerMarker) {
    if (active) roofline.centerMarker.activate();
    else roofline.centerMarker.deactivate();
  }
}

const totalValueWidth = 10;
const totalValueHeight = 6;

const totalValueActive = 'TotalValueActive';
const totalValueInactive = 'TotalValue';

TotalValueRepresentation.prototype.create = function(value, canvas, formatValue, valueLayout, className) {
  Chart.DefValueRepresentation.prototype.create.call(this, value, canvas, formatValue, valueLayout, className);

  setLineStyle(this.line, totalValueInactive);
  this.line.activate();
  this.line.on('mouseenter', setLineStyle.bind(this, this.line, totalValueActive, true));
  this.line.on('mouseleave', setLineStyle.bind(this, this.line, totalValueInactive, false));

  this.text
    .setClass('')
    .setAttr('fill', 'none');
};

var flashPoints = (function(){
  var flashingPoints = [];
  var stepSize = 100;
  var stepCount = 10;
  var lastProgress = 0;
  var step = 0;
  var visible = true;

  function restartFlashing() {
    lastProgress = 0;
    step = 0;
    visible = true;
  }

  function endFlashing() {
    processPoints(flashingPoints, true, true);
    flashingPoints = [];
  }

  function processPoints(points, visible, isFinal) {
    points.forEach(function(point) {
      if (point.hasClass('no_loop_position')) {
        if (!isFinal) {
          point.addClass('flashed');
        } else {
          point.remClass('flashed');
        }
      }

      if (visible) point.remAttr('opacity');
      else point.setAttr('opacity', '0');
    });
  }

  return function(points) {
    var processingPoints = points
      .map(function(point) {
        var result = point;

        while (result &&
              result.el &&
              result.el.isHidden()) {
          var loop = result.loopData;
          if (loop && Data.getParent(loop)) {
            result = Data.getParent(loop).rooflinePoint;
          } else {
            break;
          }
        }

        return result;
      })
      .filter(function(point, pos, array) {
        return point && array.indexOf(point) == pos;
      })
      .map(function(point) {
        return point.el;
      });

    var isProcessingAnimation = flashingPoints.length > 0;

    if (isProcessingAnimation) endFlashing();

    if (processingPoints.length) {
      restartFlashing();
      flashingPoints = processingPoints;

      if (!isProcessingAnimation) {
        Utils.animate(
          function(progress) {
            if (step >= stepCount) return false;

            if (progress - lastProgress >= stepSize) {
              step++;
              lastProgress = progress;

              visible = !visible;

              processPoints(flashingPoints, visible);
            }

            return step < stepCount;
          },
          endFlashing
        );
      }
    } else {
      step = stepCount;
    }
  };
})();

function selectPointsByLoops(loops) {
  if (!roofline || !loops.length) return;

  roofline.onSelectionChanged.unsubscribe(null, processSelectionChange);

  roofline.clearSelectedPoints();

  var currentLoop = loops.shift();
  if (currentLoop) {
    roofline.currentPoint = currentLoop.rooflinePoint;
  }

  loops.forEach(function(loop) {
    if (loop) roofline.addSelectedPoint(loop.rooflinePoint);
  });

  processSelectionChange(undefined, undefined, true);

  roofline.onSelectionChanged.subscribe(null, processSelectionChange);
}

function selectPointsByLoopIds(loopIds) {
  if (!roofline) return;

  var selectType = loopIds.shift();

  function getCompare(type) {
    var result = 'id';

    if (type === 'rvas') {
      result = 'rva';
    } else if (type === 'locations') {
      result = function(loop, id) {
        return loop.locat + loop.name === id;
      };
    }

    return result;
  }

  function processId(loopId, method, prop, callback) {
    function compare(loop) {
      if (typeof prop === 'string') {
        return loop[prop] === loopId;
      } else if (typeof prop === 'function') {
        return prop(loop, loopId);
      }

      return false;
    }

    if (loopId &&
        method &&
        prop &&
        callback) {
      roofline.points[method](function(point) {
        if (compare(point.loopData)) {
          callback(point);
          return true;
        }

        return false;
      });
    }
  }

  roofline.onSelectionChanged.unsubscribe(null, processSelectionChange);

  roofline.clearSelectedPoints();
  roofline.currentPoint = undefined;

  if (!loopIds.length) return;

  var currentPointId = loopIds.shift();
  processId(currentPointId, 'some', getCompare(selectType), function(point) {
    roofline.currentPoint = point;
  });

  var flashedPoints = [];
  var clearFlashed = false;

  loopIds.forEach(function(loopId) {
    if (loopId !== undefined) {
      if (clearFlashed) {
        flashedPoints = [];
        clearFlashed = false;
      }

      processId(loopId, selectType !== 'ids' ? 'forEach' : 'some', getCompare(selectType), function(point) {
        roofline.addSelectedPoint(point);
        flashedPoints.push(point);
      });
    } else {
      clearFlashed = true;
    }
  });

  processSelectionChange(undefined, undefined, true);

  roofline.onSelectionChanged.subscribe(null, processSelectionChange);

  flashPoints(flashedPoints);
}

Request.addConsumer('selectedLoops', {
  process: selectPointsByLoopIds
});

function rooflineSelectionToArray(points, getVal, defVal) {
  getVal = getVal || (val => val);

  points.push((roofline.currentPoint && !roofline.currentPoint.loopData.filtered) ?
                  getVal(roofline.currentPoint.loopData) :
                  defVal);

  roofline.selectedPoints.forEach(function(point) {
    if (point && point.loopData && !point.loopData.filtered) {
      points.push(getVal(point.loopData));
    }
  });
}

function processRooflineData(param) {
  function updateAxisCaption(data) {
    function buildCaption(mainProp, explProp) {
      function getText(prop) {
        if (prop && data && data[prop]) return data[prop];

        return '';
      }

      var main = getText(mainProp);
      var expl = getText(explProp);

      return main + (expl ? ' (<span class="axis_caption_expl">' + expl + '</span>)' : '');
    }

    var vertAxis = Utils.getElementById('roofline_vert_axis_caption');
    if (vertAxis) vertAxis.innerHTML = buildCaption('measureY');

    var horzAxis = Utils.getElementById('roofline_horz_axis_caption');
    if (horzAxis) horzAxis.innerHTML = buildCaption('measureX', 'nameX');
  }

  var isOldData = !!(param && param.isOldData);
  var isNewRoofs = !!(param && param.isNewRoofs);
  var isMovingZoomFrame = !!(param && param.movingZoomFrame);
  var isChangingZoomFrame = !!(param && param.changingZoomFrame);
  var isChangingRoofs = !!(param && param.changingRoofs);
  var needSelectionCreation = !isOldData || !!roofline.centralPart.selection;

  var keepCurrentRepresentation = isMovingZoomFrame || isChangingZoomFrame || isChangingRoofs;
  var keepSelection = (isOldData || !!(param && param.keepSelection)) && !keepCurrentRepresentation;

  var data = Data.getRooflineData();
  if (!data) return;

  var processing = Utils.disableElement(document.body, 'Processing...', function() {
    var loops = Data.getLoops();
    return (loops &&
            loops.length > 250) ||
            !isOldData;
  });

  isOldData = isOldData && !isNewRoofs;

  try {
    var selectedLoops = [];
    if (keepSelection) rooflineSelectionToArray(selectedLoops);

    if (!keepCurrentRepresentation) {
      Events.send('rooflineCleared');
    } else if (!isMovingZoomFrame) {
      roofline.horzAxis.clear();
      roofline.vertAxis.clear();
    }

    zoomer = Zooming.get(Data.isHierarchical());
    LoopsRepresentation.setZoomer(zoomer);

    if (!isOldData) stateManager.apply();
    stateManager.disableSaving();

    var roofs = Data.getRoofs() || [];
    data.loops = data.loops || [];

    if (!isOldData) {
      updateAxisCaption(data);
    }

    document.body.classList.remove('data_loading');

    if (data.noDataMessage) {
      var noDataMessageList = document.getElementsByClassName('no_data_message');
      if (noDataMessageList.length) {
        UiUtils.hideStdTooltip();
        roofline.centralPart.hideTooltip();

        document.body.classList.add('no_data');
        var noDataMessage = noDataMessageList[0];
        noDataMessage.firstElementChild.innerHTML = data.noDataMessage.title;
        noDataMessage.lastElementChild.innerHTML = data.noDataMessage.descr;
        //Encoding of &lt; &gt; and similar messages was done here.
        //Currently not needed as it is done by message catalog translation.
        //var encodedText = noDataMessage.lastElementChild.textContent;
        //noDataMessage.lastElementChild.innerHTML = encodedText;
        return;
      }
    } else {
      document.body.classList.remove('no_data');
      if (!Data.isHierarchical()) document.body.classList.add('plain_data');
      else document.body.classList.remove('plain_data');
    }

    Data.applySavedHierarchy(data.loops);

    if (!roofs.length) {
      document.body.classList.add('no_roofs');
    } else {
      document.body.classList.remove('no_roofs');
    }

    var minMax = isMovingZoomFrame ? param.movingZoomFrame : zoomer.getMinMax(true);

    var minX = minMax.minX;
    var maxX = minMax.maxX;
    var minY = minMax.minY;
    var maxY = minMax.maxY;

    var maxCalcRoof = -Number.MAX_VALUE;
    var minCalcRoof = Number.MAX_VALUE;
    var minMemRoof = Number.MAX_VALUE;
    var maxMemRoof = -Number.MAX_VALUE;

    var visibleMemRoofsCount = 0;
    var visibleCalcRoofsCount = 0;

    roofs.forEach(function(roof) {
      if (roof.hidden) return;

      if (!roof.isMem) {
        maxCalcRoof = Math.max(maxCalcRoof, roof.val);
        minCalcRoof = Math.min(minCalcRoof, roof.val);

        visibleCalcRoofsCount++;
      } else {
        minMemRoof = Math.min(minMemRoof, roof.val);
        maxMemRoof = Math.max(maxMemRoof, roof.val);

        visibleMemRoofsCount++;
      }
    });

    var needMinMaxRecalc = isNewRoofs ||
                           isChangingRoofs ||
                           data.minIntens === undefined ||
                           data.maxIntens === undefined ||
                           data.minPerf === undefined ||
                           data.maxPerf === undefined;

    var zoom = isMovingZoomFrame ? param.movingZoomFrame : zoomer.getCurrentZoom();

    if ((needMinMaxRecalc || !zoom) &&
        visibleCalcRoofsCount &&
        visibleMemRoofsCount) {
      var roofsCross = maxCalcRoof - minMemRoof;
      maxX = Math.max(maxX, roofsCross);
      minX = Math.min(minX, roofsCross);

      roofsCross = minCalcRoof - maxMemRoof;
      minX = Math.min(minX, roofsCross);
    }

    var intens = maxX - minX;
    if (maxX === minX) {
      intens = Math.abs(minX);
    }

    var minIntens = minX - chartAreaPadding * intens;
    var maxIntens = maxX + chartAreaPadding * intens;

    if (needMinMaxRecalc || !zoom) {
      if (visibleCalcRoofsCount) {
        minY = Math.min(minY, minCalcRoof);
        maxY = Math.max(maxY, maxCalcRoof);
      }

      if (visibleMemRoofsCount) {
        minY = Math.min(minY, minMemRoof + minIntens);
        maxY = Math.max(maxY, maxMemRoof + minIntens);

        if (maxY === maxMemRoof + minIntens) {
          maxY = maxMemRoof + (minIntens + maxIntens) / 2;
        }
      }
    }

    var perf = maxY - minY;
    if (maxY === minY) {
      perf = Math.abs(minY);
    }

    if (needMinMaxRecalc || !zoom) {
      data.minIntens = minX;
      data.maxIntens = maxX;
      data.minPerf = minY;
      data.maxPerf = maxY;

      zoomer.saveMinMax(data);
    }

    if (needMinMaxRecalc && zoom) {
      minX = minMax.minX;
      maxX = minMax.maxX;
      minY = minMax.minY;
      maxY = minMax.maxY;

      intens = maxX - minX;
      perf = maxY - minY;

      minIntens = minX - chartAreaPadding * intens;
      maxIntens = maxX + chartAreaPadding * intens;
    }

    var minPerf = minY - chartAreaPadding * perf;
    var maxPerf = maxY + chartAreaPadding * perf;

    var minClientSize = 100 * _scale;
    roofline.setViewbox(minIntens, minPerf, maxIntens, maxPerf, minClientSize, minClientSize);

    function addAxisValues(val, beginVal, endVal, axis) {
      var result = 0;
      var startValue = Math.floor(val);
      if (startValue < beginVal) startValue = Math.ceil(val);
      for (var i = startValue; i < endVal; i++) {
        axis.addValue(i);
        result++;
      }

      return result;
    }

    function addAxisMinMaxValues(min, max, axis) {
      axis.addValue(min);
      if (min !== max) axis.addValue(max);
    }

    function changeAxisMinMaxValues(min, max, axis) {
      axis.changeValue(0, min);
      if (min !== max) axis.changeValue(1, max);
    }

    function calcRoofCoord(roof) {
      var startY = roof.val;

      var result;

      if (roof.isMem) {
        startY = roof.val + minIntens;
        var coordY = visibleCalcRoofsCount ? maxCalcRoof : maxPerf;
        if (coordY <= startY) coordY = maxPerf;
        var endX = coordY - roof.val;
        result = [startY, endX, coordY];
      } else {
        var startX;
        if (!visibleMemRoofsCount) startX = minIntens;
        else startX = roof.val - maxMemRoof;
        result = [startX, startY];
      }

      return result;
    }

    if (!isMovingZoomFrame) {
      if (!zoom) {
        if (!addAxisValues(minX, minIntens, maxIntens, roofline.horzAxis)) addAxisMinMaxValues(minX, maxX, roofline.horzAxis);
        if (!addAxisValues(minY, minPerf, maxPerf, roofline.vertAxis)) addAxisMinMaxValues(minY, maxY, roofline.vertAxis);
      } else {
        addAxisMinMaxValues(minX, maxX, roofline.horzAxis);
        addAxisMinMaxValues(minY, maxY, roofline.vertAxis);
      }

      function createAxisTotalTick(axis) {
        var defs = axis.canvas.createDefs();

        createTotalTick(defs, totalValueInactive, 'total_value_tick');
        createTotalTick(defs, totalValueActive, 'total_value_tick_active');
      }

      if (data.programTotal) {
        createAxisTotalTick(roofline.vertAxis);
        createAxisTotalTick(roofline.horzAxis);

        roofline.vertAxis.addValue(data.programTotal.y, undefined, TotalValueRepresentation);
        roofline.horzAxis.addValue(data.programTotal.x, undefined, TotalValueRepresentation);

        setTotalValueTooltip(roofline.vertAxis, data.programTotal.x, data.programTotal.y);
        setTotalValueTooltip(roofline.horzAxis, data.programTotal.x, data.programTotal.y);
      }

      roofline.addGridLines();

      roofline.vertAxis.layoutValues();
      roofline.horzAxis.layoutValues();
    } else {
      changeAxisMinMaxValues(minX, maxX, roofline.horzAxis);
      changeAxisMinMaxValues(minY, maxY, roofline.vertAxis);

      if (data.programTotal) {
        roofline.vertAxis.changeValue(2, data.programTotal.y);
        roofline.horzAxis.changeValue(2, data.programTotal.x);
      }
    }

    if (!keepCurrentRepresentation) {
      if (needSelectionCreation) roofline.centralPart.createFreeSelection();

      RoofsRepresentation.fillRoofsPatterns();
      LoopsRepresentation.fillLoops(data.loops);

      LoopsRepresentation.fillSettings();
      LoopsRepresentation.fillHistogramChart('roofline_legend');

      RoofsRepresentation.fillRoofs(roofs, calcRoofCoord);

      if (data.programTotal) roofline.setCenterMarker(data.programTotal.x, data.programTotal.y, _scale);
    } else {
      RoofsRepresentation.recalculateRoofs(roofs, calcRoofCoord);

      Utils.refreshSize(roofline.centralPart.body, {movingZoomFrame: true});
    }

    if (keepSelection) {
      selectPointsByLoops(selectedLoops);
    }
  } finally {
    stateManager.enableSaving();
    processing.end();
  }
}

function setTotalValueTooltip(axis, x, y) {
  if (!axis || !axis.values || !axis.values.length) return;

  var lastValue = axis.values[axis.values.length - 1];
  var line = lastValue.representation.line;
  if (line) {
    line.setAttr(UiUtils.tooltipAttr, '<b>Program Total</b><br>' + getDefTooltipText(x, y));
  }
}

function getDefTooltipText(x, y) {
  var result;

  var data = Data.getRooflineData();
  if (roofline &&
      roofline.tr &&
      data) {
    result = data.nameY + ValueUtils.pref + ValueUtils.formatVal(y) + ValueUtils.post + data.measureY + '<br>' +
             data.nameX + ValueUtils.pref + ValueUtils.formatVal(x) + ValueUtils.post + data.measureX;
  }

  return result;
}

UiUtils.addDefTooltipProcessor({
  accept: function() {
    return true;
  },
  getText: function(_, x, y) {
    return getDefTooltipText(x, y);
  }
});

var selectionEndWaiting;
function processSelectionChange(_, __, quiet) {
  const noId = '-1';

  if (!selectionEndWaiting) {
    selectionEndWaiting = setTimeout(function() {
      selectionEndWaiting = undefined;

      var points = [];
      rooflineSelectionToArray(points);
       // remove the first point because this point is the current point which does not belong to selection
      points.shift();
      Events.send('pointsSelectionChanged', points);

      points = [];
      rooflineSelectionToArray(points, function(loop) {
        if (!loop.resIndex) return loop.id;

        return noId;
      }, noId);
      Events.send('loopsSelectionChanged', {points: points, quiet: quiet});
    }, 50);
  }
}

return {
  createRoofline: function(rooflineParent) {
    Data.setPointConstructors([Roofline.SquarePoint, Roofline.TrianglePoint, Roofline.DiamondPoint]);

    roofline = Roofline.create(rooflineParent, '0');
    roofline.onResize.subscribe(undefined, Events.send.bind(Events, 'rooflineResized'));

    roofline.centralPart.ontooltiptext = UiUtils.getTooltipText;
    roofline.centralPart.ontooltipattrs = function(el, tooltipText, x, y) {
      return {
        autoHideDelay: tooltipText.length > 100 ? 10000 : 5000
      }
    };

    LoopsRepresentation.setRoofline(roofline);
    RoofsRepresentation.setRoofline(roofline);
    Extensions.setRoofline(roofline);

    roofline.onSelectionChanged.subscribe(null, processSelectionChange);
    roofline.onCurrentPointChanged.subscribe(null, Events.send.bind(Events, 'currentPointChanged'));

    roofline.horzAxis.onformat = ValueUtils.formatVal;
    roofline.vertAxis.onformat = ValueUtils.formatVal;

    return roofline;
  },
  setScale: function(scale) {
    _scale = scale;
    LoopsRepresentation.setScale(_scale);
    RoofsRepresentation.setScale(_scale);
    Extensions.setScale(_scale);
  },
  setConfiguration: function(configuration) {
    if (configuration) {
      LoopsRepresentation.setConfiguration(configuration.loops);
      RoofsRepresentation.setConfiguration(configuration.roofs);
      Extensions.setConfiguration(configuration);
    }
  }
};

});
