define([
  '../events',
  '../data',
  '../value_utils',
  '../ui_utils',
  '../loops_utils',
  '../i18n',
  '../../idvcjs/utils'
], function (Events, Data, ValueUtils, UiUtils, LoopsUtils, I18n, Utils) {
  var _roofline;
  var _scale = 1.0;

  var textColor = 'black';

  const LoopsMatchingArrowId = 'loops_matching_arrow';
  const LoopsMatchingArrowClass = 'loops_matching_arrow';
  const LoopsMatchingLabelClass = 'loops_matching_label';
  const LoopsMatchingLineClass = 'loops_matching_line';

  function ArrowTextLine(points, ids, caption, tooltip, classes) {
    if (points.length < 2) return;

    var x1 = points[0].x;
    var y1 = points[0].y;
    var x2 = points[1].x;
    var y2 = points[1].y;

    this.line = _roofline.centralPart.graphicsRoot.addLine(x1, y1, x2, y2, classes.line);
    this.line.setStyle('marker-end:' + this.line.localUrl(ids.arrow));

    this.text = _roofline.centralPart.graphicsRoot.createText(caption)
      .setClass(classes.caption)
      .setStyle('text-anchor: middle;')
      .activate();

    updateTextPosition(this.text, x1, y1, x2, y2);
    this.text.el.tooltip = tooltip;
  }

  ArrowTextLine.prototype.update = function(points) {
    if (points.length < 2) return;

    var x1 = points[0].x;
    var y1 = points[0].y;
    var x2 = points[1].x;
    var y2 = points[1].y;

    this.line
      .setX1(x1)
      .setY1(y1)
      .setX2(x2)
      .setY2(y2);

    updateTextPosition(this.text, x1, y1, x2, y2);
  };

  ArrowTextLine.prototype.remove = function() {
    if (this.line) this.line.remove();
    delete this.line;

    if (this.text) this.text.remove();
    delete this.text;
  };

  function updateTextPosition(text, x1, y1, x2, y2) {
    function getDegrees(angle) {
      return angle * 180 / Math.PI;
    }

    if (!text) return;

    if (x1 > x2) {
      [x1, x2] = [x2, x1];
      [y1, y2] = [y2, y1];
    }

    var angle = Math.atan2(y2 - y1, x2 - x1);

    var textOffset = 4 * _scale;

    var offsetX = textOffset * Math.sin(angle);
    var offsetY = textOffset * Math.cos(angle);

    var centerX = (x1 + x2) / 2 + offsetX;
    var centerY = (y1 + y2) / 2 - offsetY; //Direction of Y axis is top - bottom

    var ellipsisId;

    var textWidth = text.getBoundingRect().width;
    var lineSize = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    if (textWidth > lineSize) {
      addEllipsisTemplate();

      var scale = Math.floor(lineSize / textWidth * 10) / 10;
      ellipsisId = addEllipsis(scale);
    }

    text
      .setX(centerX)
      .setY(centerY)
      .setTransform('rotate(' + getDegrees(angle) + ' ' + centerX + ',' + centerY + ')');

    if (ellipsisId) {
      text.setAttr('fill', text.localUrl(ellipsisId));
    } else {
      text.setAttr('fill', textColor);
    }
  };

  var ellipsisTemplateCreated = false;

  function addEllipsisTemplate() {
    if (ellipsisTemplateCreated) return;

    _roofline.centralPart.graphicsRoot.createDefs('TextEllipsisTemplateDefs')
      .createLinearGradient('TextEllipsisTemplate')
        .setY1('0')
        .setY2('0')
        .setX1('0')
        .setX2('1')
        .addStop('0%', textColor, '0')
        .addStop('20%', textColor, '1')
        .addStop('85%', textColor, '1')
        .addStop('100%', textColor, '0');

    ellipsisTemplateCreated = true;
  }

  var ellipsisIds = new Set();

  function addEllipsis(scale) {
    if (scale < 0.1) scale = 0.1;

    var id = 'TextEllipsis_' + Math.floor(scale * 10);

    if (!ellipsisIds.has(id)) {
      var offset = (1 - scale) / 2;

      var canvas = _roofline.centralPart.graphicsRoot;

      canvas.getDefs('TextEllipsisDefs')
        .createLinearGradient(id)
          .setTransform('translate(' + offset + '),scale(' + scale + ')')
          .setRef(canvas.localRef('TextEllipsisTemplate'));

      ellipsisIds.add(id);
    }

    return id;
  }

  function getDelta(val1, val2, measure, valFormat) {
    if (val1 === undefined || val2 === undefined) return undefined;

    val1 = valFormat(val1), val2 = valFormat(val2);
    const delta = val1 - val2;
    const sign =  delta > 0 ? '+' : '';

    const percent = `${sign + ValueUtils.simpleFormat(100 * delta / Math.max(val1, val2), 2)}%`;
    const formula = `${sign + ValueUtils.simpleFormat(delta)} ${measure} = ${val1} ${measure} - ${val2} ${measure}`;
    return  {percent: percent, formula: formula }
  }

  function getMatchInfo(loop1, loop2) {
    const emptyInfo = {caption: '', tooltip: ''};

    if (!loop1 || !loop2) return emptyInfo;

    const data = Data.getRooflineData4Loop(loop1);
    if (!data) return emptyInfo;

    const useTotal = loop1.y1 !== undefined && loop2.y1 !== undefined;
    const yDelta = getDelta(useTotal ? loop2.y1 : loop2.y, useTotal ? loop1.y1 : loop1.y, data.measureY, ValueUtils.formatVal);
    const totalTimeDelta = getDelta(loop2.totalTime, loop1.totalTime, 's', ValueUtils.formatTime);

    if (!yDelta || !totalTimeDelta) return emptyInfo;

    const yPrefix = data.measureY.replace(/giga|g/i, '');
    const yDeltaCaption = Utils.format(I18n.getMessage('roofline_matching_loops_delta'),
      yPrefix, yDelta.percent, yDelta.formula);
    const timeDeltaCaption = Utils.format(I18n.getMessage('roofline_matching_loops_delta'),
      't', totalTimeDelta.percent, totalTimeDelta.formula);

    const yNamePrefix = useTotal ? data.namePref1 + ' ' : '';
    const tooltip = `${yDeltaCaption}<br/>
      ${Utils.format(I18n.getMessage('roofline_matching_loops_delta_description'), yNamePrefix + data.nameY, data.measureY)}
      <br/><br/>
      ${timeDeltaCaption}<br/>
      ${Utils.format(I18n.getMessage('roofline_matching_loops_delta_description'), 'Total Time', 'seconds')}`;

    return { caption: yDelta.percent, tooltip: tooltip };
  }

  function addComparisonLines(loop) {
    if (!loop ||
        !loop.rooflinePoint ||
        loop.rooflinePoint.isHidden() ||
        loop.rooflineConnectedMatching) return;

    Data.forEachMatchingLoops(loop, function(matching) {
      if (!matching.rooflinePoint || matching.rooflinePoint.isHidden()) return;

      if (!loop.rooflineConnectedMatching) loop.rooflineConnectedMatching = [];

      const connected = matching.rooflineConnectedMatching;
      if (connected && connected.find(m => m && m.loop == loop)) return;

      LoopsUtils.setLoopPointFront(matching.rooflinePoint, _roofline);

      const info = getMatchInfo(loop, matching);
      var line = new ArrowTextLine(LoopsUtils.getLoopPoints(loop, matching),
        {arrow: LoopsMatchingArrowId},
        info.caption,
        info.tooltip,
        {line: LoopsMatchingLineClass, caption: LoopsMatchingLabelClass});

      loop.rooflineConnectedMatching.push({loop: matching, line: line});
    }, this);
  }

  function updateComparisonLines(loop) {
    if (!loop || !loop.rooflineConnectedMatching) return;

    loop.rooflineConnectedMatching.forEach(matching =>
      matching.line.update(LoopsUtils.getLoopPoints(loop, matching.loop)));
  }

  function removeComparisonLines(loop, selectionChange) {
    if (!loop || !loop.rooflineConnectedMatching) return;

    if (selectionChange) {
      loop.rooflineConnectedMatching.forEach(matching => matching.line.remove());
    }

    delete loop.rooflineConnectedMatching;
  }

  UiUtils.addTooltipProcessor({
    accept: (target) => target && target.classList.contains(LoopsMatchingLabelClass),
    getText: (target) => target.tooltip
  });

  function clearComparisonVis(selectionChange) {
    if (!selectionChange) {
      ellipsisTemplateCreated = false;
      ellipsisIds.clear();
    }
    Data.forEachLoopsSimple(Data.getLoops(), loop => removeComparisonLines(loop, selectionChange));
  }

  Events.recv('rooflineCleared', clearComparisonVis);

  Events.recv('pointsSelectionChanged', function(loops) {
    clearComparisonVis(true);

    if (!loops) return;
    loops.reverse().forEach(loop => loop && !loop.filtered && addComparisonLines(loop));
  });

  Events.recv('rooflineResized', function(tr) {
    if (!tr) return;
    _roofline.selectedPoints.forEach(point =>
      point && point.loopData && !point.loopData.filtered && updateComparisonLines(point.loopData));
  });

  Events.recv('loopsCreating', function() {
    UiUtils.createLineArrowMarker(LoopsMatchingArrowId, LoopsMatchingArrowClass, _roofline, _scale);
  });

  return {
    setRoofline: function (roofline) {
      _roofline = roofline;
    },
    setScale: function (scale) {
      _scale = scale;
    }
  };
});