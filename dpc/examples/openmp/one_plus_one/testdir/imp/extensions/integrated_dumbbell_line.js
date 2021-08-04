define([
'../events',
'../data',
'../i18n',
'../loops_representation',
'../roofs_representation',
'../request',
'../ui_utils',
'../value_utils',
'../loops_utils',
'../roofs_utils',
'../../idvcjs/utils'
], function (Events, Data, I18n, LoopsRepresentation, RoofsRepresentation, Request, UiUtils, ValueUtils, LoopsUtils, RoofsUtils, Utils) {

  var _roofline;
  var _allIrmLines = [];
  var _currentLoopId;
  var _labelPadding = 5;
  var _labelTextHeight;
  var _integratedStylePrefix = 'integrated_';
  var _strokeWidthStyle = 'stroke-width:2;';
  var _dumbbellLineStyle = 'stroke:black;' + _strokeWidthStyle;

  // these colors are duplicated here from css style
  // as I could not make the style apply to SVG points with addClass and css-defined style
  var _integratedRooflineColors =
  {
    integrated_l1: 'rgb(149,29,29)',
    integrated_l2: 'rgb(180,129,12)',
    integrated_l3: 'rgb(93,150,150)',
    integrated_l4: 'rgb(0,172,86)',
    integrated_dram: 'rgb(70,58,132)',
  };
  
  function getLoopIntegratedColorStyle(loop) {
    var loopMemLevel = LoopsUtils.getLoopMemoryLevel(Data.getMemoryLevelPrefix(loop));
    return _integratedStylePrefix + loopMemLevel.toLowerCase();
  }
  
  function getRoofIntegratedColorStyle(roofName) {
    return _integratedStylePrefix + RoofsUtils.getRoofMemoryLevel(roofName).toLowerCase();
  }

  function setLoopColorIntegratedStyle(point) {
    if (!point || !point.loopData) return;

    var styleName = getLoopIntegratedColorStyle(point.loopData);
    point.setFillColor(_integratedRooflineColors[styleName]);
  }

  function getIntegratedColorStyleString(styleName, useStrokeWidth) {
    if (!styleName) return;

    var styleFill = 'fill:'+_integratedRooflineColors[styleName]+' !important;';
    var styleStroke = 'stroke:'+_integratedRooflineColors[styleName]+' !important;';
    var styleStrokeWidth = useStrokeWidth ? _strokeWidthStyle : '';

    return styleFill + styleStroke + styleStrokeWidth;
  }
  
  function getLoopIntegratedColorStyleString(loop) {
    if (!loop) return;

    return getIntegratedColorStyleString(getLoopIntegratedColorStyle(loop), true);
  }
  
  function getRoofIntegratedColorStyleString(roofName) {
    if (!roofName) return;

    return getIntegratedColorStyleString(getRoofIntegratedColorStyle(roofName));
  }

  function setLoopColorTransparentStyle(point) {
    if (!point) return;
    point.addClass('loop_inactive_result');
  }

  function setLoopColorNormalStyle(point) {
    if (!point) return;
    point.remClass('loop_inactive_result');
  }

  function resetLoopColorStyle(point) {
    if (!point || !point.loopData) return;
    var loopInfo = LoopsRepresentation.getLoopInfo(point.loopData);
    if (!loopInfo) return;
    point.setFillColor(loopInfo.color);
  }

  function setIntegratedRoofColors() {
    RoofsRepresentation.representations.forEach(function (representation) {
      if (!representation.roofData || !representation.roofData.isMem) return;

      representation.setStyle(getRoofIntegratedColorStyleString(representation.caption));
    });
  }

  function clearIntegratedRoofColors() {
    RoofsRepresentation.representations.forEach(function (representation) {
      if (!representation.roofData || !representation.roofData.isMem) return;

      representation.clearStyle(getRoofIntegratedColorStyleString(representation.caption));
    });
  }

  /////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////  Cross Point ///////////////////////////////////////
  /////////////////////////////////////////////////////////////////////////////////////////////

  function CrossPoint(roofline, loop, x, y, r, color, id) {
    var pos = _roofline.tr.L2P(x, y);
    this.el = this.init(roofline.centralPart.graphicsRoot, loop, pos, r, color, id);
    this.x = x;
    this.y = y;
  }

  CrossPoint.prototype.init = function (parent, loop, pos, r, color, id) {
    var delta = r;
    this.delta = delta;
    this.r = r;
    if (!color) color = 'magenta';
    this.color = color;

    var transparentRect = parent
        .createRect(id)
            .activate()
            .setX(pos.x - delta)
            .setY(pos.y - delta)
            .setWidth(2 * delta)
            .setHeight(2 * delta)
            .setAttr('fill-opacity', '0');

    this.transparentRect = transparentRect;

    var elemLine1 = parent
        .createLine(id)
            .setStyle(getLoopIntegratedColorStyleString(loop))
            .activate()
            .setX1(pos.x - delta)
            .setY1(pos.y - delta)
            .setX2(pos.x + delta)
            .setY2(pos.y + delta);

    this.line1 = elemLine1;

    var elemLine2 = parent
        .createLine(id)
            .setStyle(getLoopIntegratedColorStyleString(loop))
            .activate()
            .setX1(pos.x - delta)
            .setY1(pos.y + delta)
            .setX2(pos.x + delta)
            .setY2(pos.y - delta);

    this.line2 = elemLine2;

    return transparentRect;
  }

  CrossPoint.prototype.move = function (x, y) {

    this.x = x;
    this.y = y;

    this.transparentRect
        .setX(x - this.delta)
        .setY(y - this.delta);

    this.line1
        .setX1(x - this.delta)
        .setY1(y - this.delta)
        .setX2(x + this.delta)
        .setY2(y + this.delta);

    this.line2
        .setX1(x - this.delta)
        .setY1(y + this.delta)
        .setX2(x + this.delta)
        .setY2(y - this.delta);

    return this;
  };

  CrossPoint.prototype.hide = function () {
    this.transparentRect.hide();
    this.line1.hide();
    this.line2.hide();

    return this;
  };

  /////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////// end of Cross Point /////////////////////////////////
  /////////////////////////////////////////////////////////////////////////////////////////////

  function IntegratedDumbbellLine(loopId, peerRegularLoops, peerShadowLoops) {
    if (peerRegularLoops && peerRegularLoops.length > 0 || peerShadowLoops && peerShadowLoops.length > 0) {

      function getRightmostLoop(loops) {
        var rightmostLoop;
        var maxLoopX = -Number.MAX_VALUE;

        loops.forEach(function (loop) {
          if (loop) {
            if (loop.x > maxLoopX) {
              maxLoopX = loop.x;
              rightmostLoop = loop;
            }
          }
        });
        return rightmostLoop;
      }

      function getLeftmostLoop(loops) {
        var leftmostLoop;
        var minLoopX = Number.MAX_VALUE;

        loops.forEach(function (loop) {
          if (loop) {
            if (loop.x < minLoopX) {
              minLoopX = loop.x;
              leftmostLoop = loop;
            }
          }
        });
        return leftmostLoop;
      }

      var leftmostRegularPeer = getLeftmostLoop(peerRegularLoops);
      var leftmostShadowPeer = getLeftmostLoop(peerShadowLoops);

      var rightmostRegularPeer = getRightmostLoop(peerRegularLoops);
      var rightmostShadowPeer = getRightmostLoop(peerShadowLoops);

      if (!leftmostRegularPeer && !leftmostShadowPeer) return;
      if (!rightmostRegularPeer && !rightmostShadowPeer) return;

      // There should be always regular peer, because it was the regular loop user clicked on.	  
      var leftmostPeer = leftmostRegularPeer;
      var rightmostPeer = rightmostRegularPeer;

      if (leftmostShadowPeer && leftmostShadowPeer.x < leftmostPeer.x) leftmostPeer = leftmostShadowPeer;
      if (rightmostShadowPeer && rightmostShadowPeer.x > rightmostPeer.x) rightmostPeer = rightmostShadowPeer;

      if (rightmostPeer && leftmostPeer) {
        var leftPoint = _roofline.tr.L2P(leftmostPeer.x, leftmostPeer.y);
        var rightPoint = _roofline.tr.L2P(rightmostPeer.x, rightmostPeer.y);

        var line = _roofline.centralPart.graphicsRoot
            .createLine()
                .setStyle(_dumbbellLineStyle)
                .setX1(leftPoint.x)
                .setY1(leftPoint.y)
                .setX2(rightPoint.x)
                .setY2(rightPoint.y);

        this.irmLine = {
          'lineEl': line, 'loopId': loopId, 'leftPoint': leftPoint,
          'leftmostPeer': leftmostPeer, 'rightmostPeer': rightmostPeer,
          'peerRegularLoops': peerRegularLoops, 'peerShadowLoops': peerShadowLoops
        };

        this.createCrossPoints();
        this.createPointLabels();
      }

      // push loop points front for pretty display (line behind the loops)
      // TODO: somehow this does not draw loop point over line, need to ask Igor for help.
      Data.forEachLoops(peerRegularLoops, function (loop) {
        LoopsUtils.setLoopPointFront(loop.rooflinePoint, _roofline);
      });
    }
  }

  IntegratedDumbbellLine.prototype.createCrossPoints = function () {
    function attachLoopDataToPoint(loopData, point) {
      if (!loopData || !point) return;

      point.loopData = loopData;

      // loop default tooltip processor will show specially formatted tooltip for this point as for loop
      // if we set loopData property to the svg elements of this point
      if (point.transparentRect && point.transparentRect.el) point.transparentRect.el.loopData = loopData;
      if (point.line1 && point.line1.el) point.line1.el.loopData = loopData;
      if (point.line2 && point.line2.el) point.line2.el.loopData = loopData;
    }

    this.irmPoints = [];
    var tempPoints = [];

    if (this.irmLine && this.irmLine.peerShadowLoops) {
      this.irmLine.peerShadowLoops.forEach(function (loop) {
        if (loop) {
          var pointHalfSize = 4;
          var loopPosition = Data.getLoopPosition(loop, undefined);

          var point = new CrossPoint(_roofline, loop, loopPosition.x, loopPosition.y, pointHalfSize, undefined);
          attachLoopDataToPoint(loop, point);
          tempPoints.push(point);
        }
      });

      this.irmPoints.push.apply(this.irmPoints, tempPoints);
    }
  };

  IntegratedDumbbellLine.prototype.createPointLabels = function (isShadowLoops) {

    function createTextLabels(loops, isShadowLoops) {
      var labels = [];

      loops.forEach(function (loop) {
        if (loop) {
          var loopPosition = Data.getLoopPosition(loop, undefined);
          var memLevel = LoopsUtils.getLoopMemoryLevel(Data.getMemoryLevelPrefix(loop));
          var trafficString = loop.selfGbPerSec.toFixed(1) + ' GB/s';

          var text1 = _roofline.centralPart.graphicsRoot.createText(memLevel)
              .setStyle('text-anchor: middle;font-size: 80%;') //make text smaller as we have many texts to show
              .setX(_roofline.tr.L2PX(loopPosition.x))
              .setY(_roofline.tr.L2PY(loopPosition.y) + _labelPadding + _labelTextHeight)
              .activate();

          var text2 = _roofline.centralPart.graphicsRoot.createText(trafficString)
              .setStyle('text-anchor: middle;font-size: 80%;') //make text smaller as we have many texts to show
              .setX(_roofline.tr.L2PX(loopPosition.x))
              .setY(_roofline.tr.L2PY(loopPosition.y) + _labelPadding + 2 * _labelTextHeight)
              .activate();

          var labelsWithLoop = [text1, text2, loop];
          labels.push(labelsWithLoop);
        }
      });

      return labels;
    }

    this.irmLabels = [];

    var regularLabels = createTextLabels(this.irmLine.peerRegularLoops, false);
    var shadowLoopsLabels = createTextLabels(this.irmLine.peerShadowLoops, true);

    this.irmLabels.push.apply(this.irmLabels, regularLabels);
    this.irmLabels.push.apply(this.irmLabels, shadowLoopsLabels);

    this.fixTextOverlapping();
  };

  IntegratedDumbbellLine.prototype.fixTextOverlapping = function () {
    if (!this.irmLabels || this.irmLabels.length <= 0) return;

    //sort by ascending x position
    function comparer(a, b) {
      var ax = a[1].getBoundingRect().x;
      var bx = b[1].getBoundingRect().x;
      if (ax < bx) return -1;
      else if (ax > bx) return 1;
      else return 0;
    }

    this.irmLabels.sort(comparer);

    this.irmLabels.forEach(function (labelsWithLoop) {
      if (labelsWithLoop) labelsWithLoop[3] = false;
    });

    // At the start all labels and under dumbbell line.
    // This algorithm will put some of the labels over the line
    // and fit upper and over lines.
    if (this.irmLabels.length <= 1) return;

    var prevBottomLabel = this.irmLabels[0];
    var prevTopLabel;

    for (var i = 1; i < this.irmLabels.length; i++) {
      //this is current
      var rightTextsAndLoop = this.irmLabels[i];

      if (rightTextsAndLoop && prevBottomLabel) {
        // for each pair we try to widen the pair. And save which text was moved.
        // if left text in pair was moved, we only push right text to the right.
        var leftTextWidth = prevBottomLabel[1].getBoundingRect().width;
        var rightTextWidth = rightTextsAndLoop[1].getBoundingRect().width;

        var leftTextPos = prevBottomLabel[1].getBoundingRect().x + leftTextWidth / 2;
        var rightTextPos = rightTextsAndLoop[1].getBoundingRect().x + rightTextWidth / 2;

        var overlap = ((rightTextPos - leftTextPos) - (leftTextWidth / 2 + rightTextWidth / 2));

        // if overlap is small, move bottom elements wider
        if (overlap < 0 && overlap > rightTextWidth / (-2)) {
          var deltaToMove = (-1) * overlap;

          leftTextPos = leftTextPos - deltaToMove;
          prevBottomLabel[0].setX(leftTextPos);
          prevBottomLabel[1].setX(leftTextPos);

          rightTextPos = rightTextPos + deltaToMove;
          rightTextsAndLoop[0].setX(rightTextPos);
          rightTextsAndLoop[1].setX(rightTextPos);

          prevBottomLabel = rightTextsAndLoop;
        } else if (overlap < 0 && overlap < rightTextWidth / (-2)) {
          // if overlap is big, move to top, and align with previous top label
          if (!prevTopLabel) {
            var currentY = rightTextsAndLoop[1].getBoundingRect().y;

            rightTextsAndLoop[0].setY(currentY - 3 * _labelPadding - 2 * _labelTextHeight);
            rightTextsAndLoop[1].setY(currentY - 3 * _labelPadding - _labelTextHeight);
          } else {
            var leftTopTextWidth = prevTopLabel[1].getBoundingRect().width;
            var leftTopTextPos = prevTopLabel[1].getBoundingRect().x + leftTopTextWidth / 2;

            var overlap = ((rightTextPos - leftTopTextPos) - (leftTopTextWidth / 2 + rightTextWidth / 2));

            if (overlap < 0) {
              var deltaToMove = (-1) * overlap;

              leftTopTextPos = leftTopTextPos - deltaToMove;
              prevTopLabel[0].setX(leftTopTextPos);
              prevTopLabel[1].setX(leftTopTextPos);

              rightTextPos = rightTextPos + deltaToMove;
              rightTextsAndLoop[0].setX(rightTextPos);
              rightTextsAndLoop[1].setX(rightTextPos);
              rightTextsAndLoop[0].setY(currentY - 3 * _labelPadding - 2 * _labelTextHeight);
              rightTextsAndLoop[1].setY(currentY - 3 * _labelPadding - _labelTextHeight);

              prevTopLabel = rightTextsAndLoop;
            }
          }

          prevTopLabel = rightTextsAndLoop;
        } else prevBottomLabel = rightTextsAndLoop;
      }
    }
  };

  IntegratedDumbbellLine.prototype.updateLinePosition = function (tr) {
    if (!tr) return;

    if (this.irmLine && this.irmLine.lineEl && this.irmLine.leftmostPeer && this.irmLine.rightmostPeer) {
      var leftPoint = tr.L2P(this.irmLine.leftmostPeer.x, this.irmLine.leftmostPeer.y);
      var rightPoint = tr.L2P(this.irmLine.rightmostPeer.x, this.irmLine.rightmostPeer.y);

      this.irmLine.lineEl
          .setX1(leftPoint.x)
          .setY1(leftPoint.y)
          .setX2(rightPoint.x)
          .setY2(rightPoint.y);
    }
  }

  IntegratedDumbbellLine.prototype.updateCrossPointsPosition = function (tr) {
    if (!tr) return;

    if (this.irmPoints) {
      this.irmPoints.forEach(function (point) {
        if (point && point.loopData) {
          var loopPosition = Data.getLoopPosition(point.loopData, undefined);
          var placeToMove = tr.L2P(loopPosition.x, loopPosition.y);
          point.move(placeToMove.x, placeToMove.y);
        }
      });
    }
  }

  IntegratedDumbbellLine.prototype.updateLabels = function (tr) {
    if (!tr) return;

    if (this.irmLabels) {
      this.irmLabels.forEach(function (labelsWithLoop) {
        if (labelsWithLoop && labelsWithLoop[0] && labelsWithLoop[1] && labelsWithLoop[2]) {
          var loop = labelsWithLoop[2];
          var loopPosition = Data.getLoopPosition(loop, undefined);
          var placeToMove = tr.L2P(loopPosition.x, loopPosition.y);

          labelsWithLoop[0].setX(placeToMove.x);
          labelsWithLoop[0].setY(placeToMove.y + _labelPadding + _labelTextHeight);

          labelsWithLoop[1].setX(placeToMove.x);
          labelsWithLoop[1].setY(placeToMove.y + _labelPadding + 2 * _labelTextHeight);
        }
      });
    }

    this.fixTextOverlapping();
  }

  IntegratedDumbbellLine.prototype.updatePosition = function (tr) {
    this.updateLinePosition(tr);
    this.updateCrossPointsPosition(tr);
    this.updateLabels(tr);
  };

  IntegratedDumbbellLine.prototype.remove = function () {
    if (this.irmLine && this.irmLine.lineEl) {
      this.irmLine.lineEl.hide();
      this.irmLine.lineEl.remove();
    }

    delete this.irmLine;

    this.irmPoints.forEach(function (point) {
      if (point) {
        point.hide();
      }
    });

    if (this.irmLabels) {
      this.irmLabels.forEach(function (labelsWithLoop) {
        if (labelsWithLoop && labelsWithLoop[0] && labelsWithLoop[1]) {
          labelsWithLoop[0].hide();
          labelsWithLoop[1].hide();

          delete labelsWithLoop[0];
          delete labelsWithLoop[1];
        }
      });
    }

    this.irmLine = undefined;
    this.irmLabels = undefined;
    this.irmPoints = undefined;
  };

  function getPointLoopId(point) {
    if (Data.isFiltered() || !point || point.isHidden() || !point.loopData) return;
    return Data.getLoopId(point.loopData);
  }

  function addIntegratedDumbbellLines(point) {

    function getShadowLoops() {
      if (Data.getExtraData('shadowLoops')) return Data.getExtraData('shadowLoops');

      return [];
    }

    if (!_currentLoopId) return;

    if (!_labelTextHeight) _labelTextHeight = _roofline.centralPart.canvas.getTextHeight({ className: 'idvcchart_roofline_text' });

    function getPeerLoops(_currentLoopId, loops) {
      var peerLoops = [];
      Data.forEachLoops(loops, function (loop) {
        if (Data.isFiltered() && loop.filtered) return;
        var loopId = Data.getLoopId(loop);
        if (loopId === _currentLoopId) peerLoops.push(loop);
      });
      return peerLoops;
    }

    var forEachLoops = Data.forEachLoops;
    var peerRegularLoops = getPeerLoops(_currentLoopId, Data.getLoops());
    var peerShadowLoops = getPeerLoops(_currentLoopId, getShadowLoops());

    _allIrmLines.push(new IntegratedDumbbellLine(_currentLoopId, peerRegularLoops, peerShadowLoops));
  }

  function processResize(tr) {
    if (!tr) return;

    _allIrmLines.forEach(function (object) {
      if (object) object.updatePosition(tr);
    });
  }

  function clearShadowLoops(loopId) {
    _allIrmLines.forEach(function (object) {
      if (object && object.irmLine && object.irmLine.loopId === loopId) object.remove();
    });
  }

  function setRoofsColors(loop) {
    if (!loop) {
      clearIntegratedRoofColors();
    } else {
      setIntegratedRoofColors();
    }
  }

  function setLoopColorWithFunction(loopId, func, funcForAllOtherLoops) {
    Data.forEachLoops(Data.getLoops(), function (loop, parent, isHidden) {
      if (Data.isFiltered() && loop.filtered) return;

      if (loop.rooflinePoint) {
        if (Data.getLoopId(loop) == loopId) func(loop.rooflinePoint);
        else funcForAllOtherLoops(loop.rooflinePoint);
      }
    });
  }

  // colors loop regular points of the current loop with Integrated Roofline dumbbell color scheme
  function setLoopColorIntegrated(loopId) {
    if (loopId) {
      setLoopColorWithFunction(loopId, setLoopColorIntegratedStyle, setLoopColorTransparentStyle);
    }
  }

  // colors loop regular points back to their normal colors
  function removeLoopColorIntegrated(loopId) {
    setLoopColorWithFunction(loopId, resetLoopColorStyle, setLoopColorNormalStyle);
  }
  
  function needProcessShadowData() {
    return !!Data.getExtraData('shadowData');
  }

  Events.recv('rooflineCleared', function (_currentLoopId) {
    if (needProcessShadowData()) clearShadowLoops(_currentLoopId);
  });

  Events.recv('currentPointChanged', function (point) {
    if (needProcessShadowData()) {

      var newPointId = getPointLoopId(point);

      if (newPointId !== _currentLoopId) {
        clearShadowLoops(_currentLoopId);
        removeLoopColorIntegrated(_currentLoopId);
      }

      _currentLoopId = newPointId;

      addIntegratedDumbbellLines(point);
      setRoofsColors(_currentLoopId);
      setLoopColorIntegrated(_currentLoopId);
    }
  });

  Events.recv('zoomFrameChanged', function (tr) {
    if (needProcessShadowData()) setRoofsColors(_currentLoopId);
  });

  Events.recv('rooflineResized', function (tr) {
    if (needProcessShadowData()) {
      processResize(tr);
      setRoofsColors(_currentLoopId);
    }
  });

  Request.addConsumer('rooflineAdditionalDataLoopData', {
    noStackErrors: 0,
    process: function (data) {
      if (data && data.shadowLoops || data.shadowLoops.length > 0) {
        // Datamodels do not set up memory level for shadow loops first level,
        // but instead sets up it as a global memory level prefix for the whole shadowData.
        // So here we set memory level of data to loops that don't have it defined.
        if (data.memoryLevelPref) {
          data.shadowLoops.forEach(function (loop) {
            if (loop && !loop.memoryLevelPref) loop.memoryLevelPref = data.memoryLevelPref;
          });
        }

        Data.setExtraData('shadowLoops', data.shadowLoops);
        Data.setExtraData('shadowData', data);

        //extend view as shadow loops often positioned far on the right
        Data.setWholeView(true);
      }
    },
  });

  return {
    setRoofline: function (roofline) {
      _roofline = roofline;
    },
    getLoopIntegratedColorStyleString : function(loop) {
      return getLoopIntegratedColorStyleString(loop);
    },
    areShadowLoopsShown: function () {
      return !!_currentLoopId;
    },
  };
});