define([
    '../events',
    '../data',
    '../roofs_utils',
    '../ui_utils',
    '../i18n',
    '../state_manager',
    '../request'
  ], function(Events, Data, RoofsUtils, UiUtils, I18n, StateManager, Request) {
  var _roofline;
  var _scale = 1.0;

  var stateManager = StateManager.get();

  var zonesRepresentation = (function() {

    var zoneTextColor = 'rgb(160, 0, 0)';
    var zoneTextOpacity = 0.6;

    var getNum = (function() {
      var count = 1;
      return function() {
        var result = count;

        if (count < Number.MAX_SAFE_INTEGER) count++;
        else count = 1;

        return result;
      };
    })();

    var PerspectiveTypes = {
      scalar: 'scalar',
      vector: 'vector',
      none:   'none'
    }

    var currentPerspectiveType = PerspectiveTypes.none;

    ////////////////////////////////////////////////////////////
    //////////////////   ZoneRepresentation   //////////////////
    //This object represents zone with its data and svg elements
    ////////////////////////////////////////////////////////////

    function ZoneRepresentation(topText, bottomText, descrText, fillColor, opacity, calcPoints, calcRect) {
      this.textTop = topText;
      this.textBottom = bottomText;
      this.textDescription = descrText;

      this.textRect = undefined;
      this.points = undefined;
      this.fillColor = fillColor;
      this.opacity = opacity;

      //SVG elements
      this.textLineElemTop = undefined;
      this.textLineElemBottom = undefined;
      this.poly = undefined;
      this.textGradient = undefined;

      this.textGradientId = 'EllipsisGradient' + getNum();

      this.calcPoints = calcPoints;
      this.calcRect = calcRect;
    };

    ZoneRepresentation.prototype.calculate = function() {
      if (!this.calcPoints || !this.calcRect) return;

      this.points = this.calcPoints();
      this.textRect = this.calcRect(this.points);
    };

    ZoneRepresentation.prototype.setTopText = function(text) {
      if (this.textTop === undefined) return;

      this.textTop = text;
      if(this.textLineElemTop) this.textLineElemTop.setText(text);
    }

    function drawZoneCaption(zoneTextPoints, line1Text, line2Text) {
      if (!zoneTextPoints || zoneTextPoints.length !== 2) return;

      function createTextElement(text, addExplanationSymbol) {
        var elem = _roofline.centralPart.graphicsRoot.createText(text);
        if (elem && addExplanationSymbol) {
          elem.addSpan('?')
            .addClass('idvcchart_roofline_explanation')
            .setStyle('font-size: 80%') //make ? smaller for looking better in 2-lines zone caption
            .setAttr('dy', '-7')
            .activate();
        }
        return elem;
      }

      function setElementPos(elem, vertOffset) {
        function createTextGradient(id) {
          var defsSection = RoofsUtils.roofDefs.get(_roofline);

          return defsSection
            .createLinearGradient(id)
              .useAbsoluteCoords()
              .setY1('0')
              .setY2('0')
              .addStop('70%', zoneTextColor, zoneTextOpacity)
              .addStop('100%', zoneTextColor, '0');
        }

        function setElementPosFitZone(elem, vertOffset) {
          elem
            .setStyle('text-anchor: middle;opacity:' + zoneTextOpacity)
            .setAttr('fill', zoneTextColor)
            .setX(zoneTextX + zoneWidth / 2)
            .setY(zoneTextBottom - vertOffset)
            .back();
        }

        function setElementPosNotFitZone(elem, vertOffset, gradientId) {
          elem
            .setStyle('text-anchor: start;')
            .setAttr('fill', elem.localUrl(gradientId))
            .setX(zoneTextX)
            .setY(zoneTextBottom - vertOffset)
            .back();
        }

        var lineWidth = elem.getBoundingRect().width;
        var lineFitsInZone = lineWidth < zoneWidth;

        if (lineFitsInZone) {
          setElementPosFitZone(elem, vertOffset);
        } else {
          if (!this.textGradient) this.textGradient = createTextGradient(this.textGradientId);

          setElementPosNotFitZone(elem, vertOffset, this.textGradientId);
        }
      }

      var zoneWidth = zoneTextPoints[1][0] - zoneTextPoints[0][0];

      if (zoneWidth <= Number.EPSILON) return false;

      if (zoneWidth > 10 * _scale) {
        if (!this.textLineElemTop) this.textLineElemTop = createTextElement(line1Text);
        else this.textLineElemTop.show();

        if (!this.textLineElemBottom) {
          this.textLineElemBottom = createTextElement(line2Text, true);
          this.textLineElemBottom.isZoneCaption = true;
          this.textLineElemBottom.textDescription = this.textDescription;
        } else this.textLineElemBottom.show();

        if (!this.textLineElemTop || !this.textLineElemBottom) return;

        var zoneCaptionMargin = 4 * _scale;

        var zoneTextX = zoneTextPoints[0][0] + zoneCaptionMargin;
        var zoneTextBottom = zoneTextPoints[1][1] - zoneCaptionMargin;

        if (!this._captionTextHeight) this._captionTextHeight = _roofline.centralPart.canvas.getTextHeight({className: 'idvcchart_roofline_text'});

        setElementPos.call(this, this.textLineElemTop, 2 * this._captionTextHeight);
        setElementPos.call(this, this.textLineElemBottom, this._captionTextHeight);

        if (this.textGradient) this.textGradient
                                .setX1(zoneTextX)
                                .setX2(zoneTextX + zoneWidth);
      } else {
        if (this.textLineElemTop) this.textLineElemTop.hide();
        if (this.textLineElemBottom) this.textLineElemBottom.hide();
      }

      return true;
    };

    function drawPoly(screenCoordPoints) {
      if (!this.poly) this.poly = _roofline.centralPart.graphicsRoot.createPolygon()
                                    .setAttr('fill', this.fillColor)
                                    .setStyle('opacity:' + this.opacity);


      this.poly
        .setPoints(screenCoordPoints)
        .back();
    };

    ZoneRepresentation.prototype.draw = function() {
      function getScreenCoords(points) {
        if (!points) return undefined;

        return points
          .map(function(point) {
            if (point && point.length === 2) return [_roofline.tr.L2PX(point[0]), _roofline.tr.L2PY(point[1])];
          })
          .filter(function(point) {
            return !!point;
          });
      }

      if (!this.points || this.points.length < 3 || !_roofline || !_roofline.tr) {
        //no drawing, but need to clear some zones that may disappear from previous state
        this.clear(true);
        return;
      }

      if (drawZoneCaption.call(this, getScreenCoords(this.textRect), this.textTop, this.textBottom)) {
        drawPoly.call(this, getScreenCoords(this.points));
      } else {
        this.clear(true);
      }
    };

    ZoneRepresentation.prototype.clear = function(removeObjects) {
      if (removeObjects) {
        if (this.poly) this.poly.remove();
        if (this.textLineElemTop) this.textLineElemTop.remove();
        if (this.textLineElemBottom) this.textLineElemBottom.remove();
        if (this.textGradient) this.textGradient.remove();
      }

      this.textLineElemTop = undefined;
      this.textLineElemBottom = undefined;
      this.poly = undefined;
      this.textGradient = undefined;
    };

    var zones = [];

    function canDrawZones() {
      if (!stateManager.getState().useZoneColoring) return false;

      var roofs = Data.getRoofs();

      var memRoofsCount = 0;
      var calcRoofsCount = 0;

      return roofs.some(function(roof) {
        if (roof && !roof.hidden) {
          if (roof.isMem) memRoofsCount++;
          else calcRoofsCount++;

          return memRoofsCount > 0 && calcRoofsCount > 0;
        }

        return false;
      });
    }

    const chartAreaPadding = UiUtils.getChartAreaPadding();

    function getRooflineFrame() {
      var minIntens;
      var maxIntens;

      var minPerf;
      var maxPerf;

      var data = Data.getRooflineData();
      if (data) {
        var minX = data.minIntens;
        var maxX = data.maxIntens;
        var minY = data.minPerf;
        var maxY = data.maxPerf;

        intens = maxX - minX;
        perf = maxY - minY;

        minIntens = minX - chartAreaPadding * intens;
        maxIntens = maxX + chartAreaPadding * intens;

        minPerf = minY - chartAreaPadding * perf;
        maxPerf = maxY + chartAreaPadding * perf;
      }

      return {
        minIntens: minIntens,
        maxIntens: maxIntens,
        minPerf: minPerf,
        maxPerf: maxPerf
      };
    }

    // Given a list of roof svg lines finds the highest memory roof position
    function getMemoryZoneLeftTopPoint(roofs) {
      if (!roofs) return;

      var frame = getRooflineFrame();
      var minY = frame.minPerf;
      var minX = frame.minIntens;

      roofs.forEach(function(roof) {
        if (roof && !roof.hidden && roof.isMem) {
          var startY = roof.val + minX;
          if (startY > minY) minY = startY;
        }
      });

      return minY;
    }

    function compareFindLeftmostCrossing(crossingX, x) {
      return crossingX < x;
    }

    function compareFindRightmostCrossing(crossingX, x) {
      return crossingX > x;
    }

    function findLastCrossingOnRoof(roofY, compareFunc, startX) {
      var foundCrossing;
      var x = startX;

      RoofsUtils.forEachRoofsCrossings(Data.getRoofs(), function(crossing) {
        if (crossing) {
          if ((Math.abs(crossing.y - roofY)) < 0.01 && compareFunc(crossing.x, x)) {
            foundCrossing = crossing;
            x = crossing.x;
          }
        }
      });

      return foundCrossing;
    }

    // Finds the leftmost top crossing of roofs
    function getLeftTopRoofCrossing() {
      var foundCrossing;

      var frame = getRooflineFrame();
      var topComputeRoof = RoofsUtils.getTopSelectedRoof(Data.getRoofs(), false);

      if (!topComputeRoof || !frame) return foundCrossing;

      return findLastCrossingOnRoof(topComputeRoof.val, compareFindLeftmostCrossing, frame.maxIntens);
    }

    // Finds the crossing of lowest vector roof with top memory roof
    function getRightBottomScalarRoofCrossing() {
      var foundCrossing;

      var frame = getRooflineFrame();
      var bottomScalarRoof = RoofsUtils.getBottomComputeRoof(Data.getRoofs(), false);

      if (!bottomScalarRoof || !frame) return foundCrossing;

      return findLastCrossingOnRoof(bottomScalarRoof.val, compareFindRightmostCrossing, frame.minIntens);
    }

    // Finds the crossing of lowest vector roof with top memory roof
    function getLeftBottomVectorRoofCrossing() {
      var foundCrossing;

      var frame = getRooflineFrame();
      var bottomVectorRoof = RoofsUtils.getBottomComputeRoof(Data.getRoofs(), true);

      if (!bottomVectorRoof || !frame) return foundCrossing;

      return findLastCrossingOnRoof(bottomVectorRoof.val, compareFindLeftmostCrossing, frame.maxIntens);
    }

    function getLeftTopVectorRoofCrossing() {
      var foundCrossing;

      var frame = getRooflineFrame();
      var topComputeRoof = RoofsUtils.getTopSelectedRoof(Data.getRoofs(), false /*compute*/, true /*vector*/);

      if (!topComputeRoof || !frame) return foundCrossing;

      return findLastCrossingOnRoof(topComputeRoof.val, compareFindLeftmostCrossing, frame.maxIntens);
    }

    function getRightTopVectorRoofCrossing() {
      var foundCrossing;

      var frame = getRooflineFrame();
      var topComputeRoof = RoofsUtils.getTopSelectedRoof(Data.getRoofs(), false /*compute*/, true /*vector*/);

      if (!topComputeRoof || !frame) return foundCrossing;

      return findLastCrossingOnRoof(topComputeRoof.val, compareFindRightmostCrossing, frame.minIntens);
    }

    // Finds the leftmost crossing of memory and compute roofs on screen
    // which is one of the points of memory-bound zone
    function getRightTopRoofCrossing() {
      var foundCrossing;

      var frame = getRooflineFrame();
      var topComputeRoof = RoofsUtils.getTopSelectedRoof(Data.getRoofs(), false);

      if (!topComputeRoof || !frame) return foundCrossing;

      return findLastCrossingOnRoof(topComputeRoof.val, compareFindRightmostCrossing, frame.minIntens);
    }

    // Finds the leftmost and lowest crossing of memory and compute roofs on screen.
    // It will be one of the points of memory-bound zone.
    function getLeftBottomRoofCrossing() {
      var foundCrossing;

      var frame = getRooflineFrame();
      var leftX = frame.maxIntens;
      var bottomY = frame.maxPerf;

      RoofsUtils.forEachRoofsCrossings(Data.getRoofs(), function(crossing) {
        if (crossing) {
          if (crossing.x <= leftX && crossing.y <= bottomY) {
            foundCrossing = crossing;
            leftX = crossing.x;
            bottomY = crossing.y;
          }
        }
      });

      return foundCrossing;
    }

    // Calculate polygon for memory zone
    function calculateMemoryZonePoints() {
      var leftMostCrossing = getLeftBottomRoofCrossing();
      var leftTopMemoryRoofPoint = getMemoryZoneLeftTopPoint(Data.getRoofs());

      if (!leftMostCrossing || !leftTopMemoryRoofPoint) return;

      var frame = getRooflineFrame();

      var leftCrossPoint = [leftMostCrossing.x, leftMostCrossing.y];
      var minRooflinePoint = [frame.minIntens, frame.minPerf];
      var leftMemPoint = [frame.minIntens, leftTopMemoryRoofPoint];

      if (currentPerspectiveType === PerspectiveTypes.vector) {
        var vectorRoofHighestMemoryCrossing = getLeftBottomVectorRoofCrossing();
        if (!vectorRoofHighestMemoryCrossing) return;
        leftCrossPoint = [vectorRoofHighestMemoryCrossing.x, vectorRoofHighestMemoryCrossing.y];
      }

      var memTopRoofPoint = [minRooflinePoint[0], leftMemPoint[1]];
      var zeroPoint = [minRooflinePoint[0], minRooflinePoint[1]];
      var crossPoint = [leftCrossPoint[0], leftCrossPoint[1]];
      var endPoint = [leftCrossPoint[0], minRooflinePoint[1]];

      return [zeroPoint, memTopRoofPoint, crossPoint, endPoint];
    }

    // Calculate polygon for mixed zone
    function calculateMixedZonePoints() {
      var leftMostCrossing = getLeftBottomRoofCrossing();
      var topLeftComputeCrossing = getLeftTopRoofCrossing();
      var topRightComputeCrossing = getRightTopRoofCrossing();

      // Showing vectorized picture with vector-memory sub-zone and Compute + Mixed zones moved to right
      // The border for vectorized zone is bottom Vector Roof. This may be improved to dominating vector roof for this kernel.
      if (currentPerspectiveType === PerspectiveTypes.vector) {
        leftMostCrossing = getLeftBottomVectorRoofCrossing();
        topLeftComputeCrossing = getLeftTopVectorRoofCrossing();
        topRightComputeCrossing = getRightTopVectorRoofCrossing();
      }
      else if (currentPerspectiveType === PerspectiveTypes.scalar) {
        var updatedCrossing = getRightBottomScalarRoofCrossing();

        if (updatedCrossing) {
          topRightComputeCrossing = updatedCrossing;
          topLeftComputeCrossing = updatedCrossing;
        }
      }
      else {
        // If only scalar roofs selected, the generic perspective should find not selected roofs,
        // but top vector roofs in order to be more wider than vector perspective zoning for this case.
        topLeftComputeCrossing = getLeftTopVectorRoofCrossing();
        topRightComputeCrossing = getRightTopVectorRoofCrossing();
      }

      if (!leftMostCrossing || !topLeftComputeCrossing || !topRightComputeCrossing) return;

      var frame = getRooflineFrame();
      var bottomY = frame.minPerf;

      var leftBottomPoint = [leftMostCrossing.x, bottomY];
      var leftTopPoint = [leftMostCrossing.x, leftMostCrossing.y];
      var topSecondPoint = [topLeftComputeCrossing.x, topLeftComputeCrossing.y];
      var topRightPoint = [topRightComputeCrossing.x, topRightComputeCrossing.y];
      var bottomRightPoint = [topRightComputeCrossing.x, bottomY];

      return [leftBottomPoint, leftTopPoint, topSecondPoint, topRightPoint, bottomRightPoint];
    }

    // Calculate polygon for compute zone
    function calculateComputeZonePoints() {
      var topComputeCrossing = getRightTopRoofCrossing();

      var bottomScalarRoof;
      if (currentPerspectiveType === PerspectiveTypes.scalar) bottomScalarRoof = RoofsUtils.getBottomComputeRoof(Data.getRoofs(), false);
      else topComputeCrossing = getRightTopVectorRoofCrossing();

      if (!topComputeCrossing) return;

      var topY = topComputeCrossing.y;
      if (bottomScalarRoof) topY = bottomScalarRoof.val;

      var frame = getRooflineFrame();

      var crossPoint = [topComputeCrossing.x, topY];

      if (currentPerspectiveType === PerspectiveTypes.scalar) {
        var rightmostCrossing = getRightBottomScalarRoofCrossing();
        topComputeCrossing = getRightTopRoofCrossing();

        if (rightmostCrossing && topComputeCrossing) {

          var toUseY = topComputeCrossing.y;
          if (rightmostCrossing) toUseY = rightmostCrossing.y;

          crossPoint = [rightmostCrossing.x, toUseY];
        }
      }

      var leftBottomPoint = [crossPoint[0], frame.minPerf];
      var rightTopPoint = [frame.maxIntens, topY];
      var rightBottomPoint = [frame.maxIntens, frame.minPerf];

      return [leftBottomPoint, crossPoint, rightTopPoint, rightBottomPoint];
    }

    function calculateMemoryZoneRect(memZonePoints) {
      if (!memZonePoints || memZonePoints.length < 4) return;

      return [[memZonePoints[0][0],memZonePoints[2][1]], [memZonePoints[2][0], memZonePoints[0][1]]];
    }

    function calculateMixedZoneRect(mixedZonePoints) {
      if (!mixedZonePoints || mixedZonePoints.length < 5) return;

      return [[mixedZonePoints[1][0],mixedZonePoints[1][1]], [mixedZonePoints[4][0], mixedZonePoints[4][1]]];
    }

    function calculateComputeZoneRect(computeZonePoints) {
      if (!computeZonePoints || computeZonePoints.length < 4) return;

      return [[computeZonePoints[1][0],computeZonePoints[1][1]], [computeZonePoints[3][0], computeZonePoints[3][1]]];
    }

    function clearZones(removeObjects) {
      zones.forEach(function(zone) {
        if (zone) zone.clear(removeObjects);
      });
    }

    function calculateZones() {
      // At this point I18n should be initialized and we can set up text titles for zones
      // these should be zones in order: memory, [optional vectorizedMemory,] mixed, [optional scalarCompute] and compute
      if (!zones.length) {
        zones = [
          new ZoneRepresentation(I18n.getMessage('roofline_zone_theoretically'), I18n.getMessage('roofline_zone_memory_bound'),
              I18n.getMessage('roofline_zone_memory_description'), 'rgb(240, 50, 50)', 0.06, calculateMemoryZonePoints, calculateMemoryZoneRect),

          new ZoneRepresentation(I18n.getMessage('roofline_zone_mixed_line1'), I18n.getMessage('roofline_zone_mixed_line2'), I18n.getMessage('roofline_zone_mixed_description'),
              'rgb(200, 40, 40)', 0.1, calculateMixedZonePoints, calculateMixedZoneRect),

          new ZoneRepresentation(I18n.getMessage('roofline_zone_theoretically'), I18n.getMessage('roofline_zone_compute_bound'),
              I18n.getMessage('roofline_zone_compute_description'), 'rgb(160, 30, 30)', 0.14, calculateComputeZonePoints, calculateComputeZoneRect)
        ];
      }

      zones.forEach(function(zone) {
        if (zone) zone.calculate();
      });
    }

    function drawZones(skipCheck) {
      if (skipCheck ||
          canDrawZones()) {
        zones.forEach(function(zone) {
          if (zone) zone.draw();
        });
      }
    }

    function updateZoneCaptions() {
      if(!zones || zones.length != 3) return;

      if (currentPerspectiveType === PerspectiveTypes.vector) {
        zones[0].setTopText(I18n.getMessage('roofline_zone_vector_memory_line1'));
        zones[2].setTopText('');
      }
      else if (currentPerspectiveType === PerspectiveTypes.scalar) {
        zones[0].setTopText('');
        zones[2].setTopText(I18n.getMessage('roofline_zone_scalar_compute_line1'));
      }
      else {
        zones[0].setTopText('');
        zones[2].setTopText('');
      }
    }

    function processResize() {
      drawZones(false);
    }

    var result = {
      refresh: function() {
        if (canDrawZones()) {
          calculateZones();
          updateZoneCaptions();
          drawZones(true);
        } else {
          clearZones(true);
        }
      },
      clear: clearZones
    };

    function updatePerspective(perspectiveType) {
      if (perspectiveType == '1') currentPerspectiveType = PerspectiveTypes.vector;
      else if (perspectiveType == '2') currentPerspectiveType = PerspectiveTypes.scalar;
      else currentPerspectiveType = PerspectiveTypes.none;

      updateZoneCaptions();

      result.refresh();
    }

    Events.recv('rooflineCleared', result.clear, result);
    Events.recv('rooflineResized', processResize, result);
    Events.recv('roofsCreated', result.refresh, result);
    Events.recv('roofsUpdated', result.refresh, result);
    Events.recv('roofVisibilityChanged', result.refresh, result);
    Events.recv('roofSelectionChanged', result.refresh, result);

    Request.addConsumer('changePerspective', {
      process: updatePerspective
    });

    return result;
  })();

  function isZoneExplanation(target) {
    return target && target.parentNode && target.parentNode.owner && target.parentNode.owner.isZoneCaption;
  }

  function getZoneExplanationText(target) {
    if (isZoneExplanation(target)) {
      return target.parentNode.owner.textDescription;
    }
  }

  UiUtils.addTooltipProcessor({
    accept: isZoneExplanation,
    getText: getZoneExplanationText
  });

  StateManager.addCheckSetting('use_zone_coloring', 'useZoneColoring', function(isOn) {
    zonesRepresentation.refresh();
    if (isOn) stateManager.changeSetting('colorMode', 2, true);
  }, true);

  return {
    setRoofline: function(roofline) {
      _roofline = roofline;
    },
    setScale: function(scale) {
      _scale = scale;
    }
  };
});
