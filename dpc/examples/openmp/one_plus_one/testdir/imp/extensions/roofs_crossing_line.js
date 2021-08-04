define([
  '../events',
  '../data',
  '../value_utils',
  '../loops_utils',
  '../roofs_utils',
  './integrated_dumbbell_line',
  '../../idvcjs/utils'
], function(Events, Data, ValueUtils, LoopsUtils, RoofsUtils, IntegratedDumbbellLine, Utils) {
    var _roofline;
    var _scale = 1.0;
    var _crossingHalfLineSize = 4;
    var _defaultVerticalLineStyle = 'stroke:black;';
    var _defaultCrossingStyle = _defaultVerticalLineStyle +'stroke-width:2;';

    // with new design this is a more reliable way to detect integrated roofline
    // than configuration and uiInfo as uiInfo is not propagated to Exported HTML report
    function isIntegratedRoofline() {
      return !!Data.getExtraData('shadowData');
    }

    var roofsCrossingLine = (function(){
      var widget;
      var maxCrossing;
      var nearestCrossing;
      var vertLine;
      var maxLabel;
      var nearestLabel;

      var hideTimeout;
      var showTimeout;

      var crossingRadius = 5 * _scale;

      var labelTextHeight;
      var prevPos;

      var highlightedLoop;

      function roofsCrossing4Loop(roofs, loopMemoryLevelPrefix, loopX, loopY, isVector) {
        function getRoofsCrossingX(memRoofVal, calcRoofVal) {
          return calcRoofVal - memRoofVal;
        }
        function getMemRoofCrossing(x, memRoofVal) {
          return x + memRoofVal;
        }
        function isScalarRoof(roof) {
          return roof.name.toLowerCase().indexOf('scalar') >= 0;
        }

        function selectRoofs(roofVals, val) {
          var maxRoofVal = 0;
          var nearestRoofVal = Number.MAX_VALUE;

          roofVals.forEach(function(roofVal) {
            if (roofVal > maxRoofVal) maxRoofVal = roofVal;

            if (roofVal >= val && roofVal < nearestRoofVal) nearestRoofVal = roofVal;
          });

          var result = {};
          if (maxRoofVal > 0) result.max = maxRoofVal;
          if (nearestRoofVal < Number.MAX_VALUE) result.nearest = nearestRoofVal;

          return result;
        }

        //Returns maximum from values1 and values2, but not higher than maxLimitValue
        //This function is useful for determining highest roof for Integrated Roofline dots.
        //For example, for dot with memory level L2 highest roof should not be higher than L2 roof.
        function getMaxLimitedValue(values1, values2, maxLimitValue, propName) {

          var val1 = values1[propName];
          var val2 = values2[propName];

          if (val1 !== undefined && val2 !== undefined) {
            var comparisonResult = Math.max(val1, val2);
            if (comparisonResult > maxLimitValue) return maxLimitValue;
            else return comparisonResult;
          } else if (maxLimitValue !== undefined) {
            return maxLimitValue;
          } else if (val1 !== undefined) {
            return val1;
          }

          return val2;
        }

        function getValue(values1, values2, propName, compare) {
          var val1 = values1[propName];
          var val2 = values2[propName];
          if (val1 !== undefined && val2 !== undefined) {
            return compare(val1, val2);
          } else if (val1 !== undefined) {
            return val1;
          }

          return val2;
        }

        function getRoofMemoryLevel(roof) {
          if (roof && roof.name) {
            return RoofsUtils.getRoofMemoryLevel(roof.name);
          }

          return '';
        }

        if (!roofs) return;

        var maxMemRoofVal = 0;
        var maxScalarCalcRoofVal = 0;
        var maxVectorCalcRoofVal = 0;
        var memRoofsCrossings = [];
        var scalarCalcRoofsCrossings = [];
        var vectorCalcRoofsCrossings = [];

        roofs.forEach(function(roof) {
          if (roof.hidden) return;

          if (roof.isMem) {
            if (roof.val > maxMemRoofVal) maxMemRoofVal = roof.val;

            //For integrated roofline case add only memory roofs with the same memory level (prefix)
            if (isIntegratedRoofline()) {
              if (getRoofMemoryLevel(roof) === LoopsUtils.getLoopMemoryLevel(loopMemoryLevelPrefix)) {
                memRoofsCrossings.push(getMemRoofCrossing(loopX, roof.val));
              }
            } else {
              memRoofsCrossings.push(getMemRoofCrossing(loopX, roof.val));
            }
          } else {
            if (isScalarRoof(roof)) {
              if (roof.val > maxScalarCalcRoofVal) maxScalarCalcRoofVal = roof.val;
              scalarCalcRoofsCrossings.push(roof.val);
            } else {
              if (roof.val > maxVectorCalcRoofVal) maxVectorCalcRoofVal = roof.val;
              vectorCalcRoofsCrossings.push(roof.val);
            }
          }
        });

        var calcRoofsCrossing = isVector ? vectorCalcRoofsCrossings : vectorCalcRoofsCrossings.concat(scalarCalcRoofsCrossings);
        var maxCalcRoofVal = isVector ? maxVectorCalcRoofVal : Math.max(maxScalarCalcRoofVal, maxVectorCalcRoofVal);

        calcRoofsCrossing = calcRoofsCrossing.filter(function(roofVal) {
          return getRoofsCrossingX(maxMemRoofVal, roofVal) < loopX && roofVal >= loopY;
        });

        memRoofsCrossings = memRoofsCrossings.filter(function(roofVal) {
          return roofVal < maxCalcRoofVal && roofVal >= loopY;
        });

        var memValues = selectRoofs(memRoofsCrossings, loopY);
        var calcValues = selectRoofs(calcRoofsCrossing, loopY);

        var result = {};
        var maxRoof;

        if (isIntegratedRoofline()) {
          maxRoof = getMaxLimitedValue(memValues, calcValues, memValues['max'], 'max');
        } else {
          maxRoof = getValue(memValues, calcValues, 'max', Math.max);
        }

        if (maxRoof !== undefined) result.max = maxRoof;

        var nearestRoof = getValue(memValues, calcValues, 'nearest', Math.min);
        if (nearestRoof !== undefined) result.nearest = nearestRoof;

        return result;
      }

      function setCrossingPos(crossing, x, y) {
        if (!crossing) return;

        if (x === undefined || y === undefined) {
          hideCrossing(crossing);
        } else {
          crossing
            .setX(x)
            .setY(y)
            .front();
        }
      }

      function setLabelInfo(label, x, y, text) {
        if (!label) return;

        if (x === undefined || y === undefined || !text) {
          hideLabel(label);
        } else {
          if (!labelTextHeight) labelTextHeight = _roofline.centralPart.canvas.getTextHeight({className: 'roof_crossing_label'});

          if (prevPos !== undefined &&
              y - prevPos < labelTextHeight) {
            y = prevPos + labelTextHeight;
          } else {
            prevPos = y;
          }

          label.value.setText(text.value);
          label.gain.setText(text.gain);

          var xPos = x - 2 * crossingRadius;

          label.el
            .setX(xPos)
            .setY(y)
            .front();

          var labelRect = label.el.getBoundingRect();

          if (xPos - labelRect.width <= 0) {
            label.el
             .setX(xPos + 4 * crossingRadius)
             .setStyle('text-anchor:start; dominant-baseline: middle;');
          } else {
            label.el.setStyle('text-anchor:end; dominant-baseline: middle;');
          }
        }
      }

      function setLinePos(x, y1, y2) {
        if (!vertLine) return;

        if (y2 === undefined) {
          hideLine();
        } else {
          vertLine
            .setX1(x)
            .setX2(x)
            .setY1(y1)
            .setY2(y2)
            .front();
        }
      }

      function hideCrossing(crossing) {
        setCrossingPos(crossing, -100, -100);
      }

      function hideLabel(label) {
        if (!label) return;

        label.el
          .setX(-100)
          .setY(-100);
      }

      function hideLine() {
        setLinePos(-100, 0, 0);
      }

      result = {
        create: function() {
          function createLabel() {
            var textEl = _roofline.centralPart.graphicsRoot.createText()
              .setClass('roof_crossing_label')
              .setX(-100)
              .setY(0)
              .setFilter('TextBackground')
              .setStyle('text-anchor:end; dominant-baseline: middle;');

              var value = textEl.addSpan()
                .setClass('roof_crossing_label_value');

              textEl.addSpan(' ' + Data.getProp('measureY') + ' ')
                .setClass('roof_crossing_label_measure');

              textEl.addSpan('(')
                .setClass('roof_crossing_label_gain_x');

              var gain = textEl.addSpan()
                .setClass('roof_crossing_label_gain');

              textEl.addSpan('x)')
                .setClass('roof_crossing_label_gain_x');

              return {
                el: textEl,
                value: value,
                gain: gain
              }
          }

          widget = _roofline.centralPart.graphicsRoot.createDefs()
            .createLine('crossingTemplate')
              .setX1(0 - _crossingHalfLineSize)
              .setY1(0 - _crossingHalfLineSize)
              .setX2(0 + _crossingHalfLineSize)
              .setY2(0 + _crossingHalfLineSize)
              .setClass('roof_crossing');

          vertLine = _roofline.centralPart.graphicsRoot.addLine(-100, 0, -100, 0, 'roof_crossing_line');

          maxCrossing = _roofline.centralPart.graphicsRoot.createUse()
            .setRef(widget.localRef('crossingTemplate'));

          nearestCrossing = _roofline.centralPart.graphicsRoot.createUse()
            .setRef(widget.localRef('crossingTemplate'));

          maxLabel = createLabel();
          nearestLabel = createLabel();
        },
        isValid: function() {
          return !!widget;
        },
        setPos: function(x, y, y1, y2, delay, colorStyle) {
          function getLabelText(loopY, crossY) {
            if (crossY === undefined) return undefined;

            return {
              value: ValueUtils.formatVal(crossY),
              gain: ValueUtils.simpleFormat(Math.pow(10, crossY) / Math.pow(10, loopY), 1)
            }
          }

          if (delay === undefined) delay = 800;

          if (y1 === y2) y2 = undefined;

          this.hide();

          showTimeout = setTimeout(function() {
            var tr = _roofline.tr;
            var crossX = tr.L2PX(x);
            var crossY = tr.L2PY(y);

            var crossY1;
            var crossY2;
            if (y1) crossY1 = tr.L2PY(y1);
            if (y2) crossY2 = tr.L2PY(y2);

            prevPos = undefined;

            setLinePos(crossX, crossY, crossY1 || crossY2);

            setCrossingPos(maxCrossing, crossX, crossY1);
            setCrossingPos(nearestCrossing, crossX, crossY2);

            if (colorStyle) {
              if (widget) widget.setStyle(colorStyle);
              if (vertLine) vertLine.setStyle(colorStyle);
            }

            setLabelInfo(maxLabel, crossX, crossY1, getLabelText(y, y1));
            setLabelInfo(nearestLabel, crossX, crossY2, getLabelText(y, y2));

            hideTimeout = setTimeout(function() {
              this.hide();
              hideTimeout = undefined;
            }.bind(this), 9000);
          }.bind(this), delay);
        },
        hide: function() {
          if (hideTimeout) clearTimeout(hideTimeout);
          if (showTimeout) clearTimeout(showTimeout);

          if (isIntegratedRoofline()) {
            if (widget) widget.setStyle(_defaultCrossingStyle);
            if (vertLine) vertLine.setStyle(_defaultVerticalLineStyle);
          }

          hideCrossing(maxCrossing);
          hideCrossing(nearestCrossing);
          hideLabel(maxLabel);
          hideLabel(nearestLabel);
          hideLine();
        },
        clear: function() {
          widget = maxCrossing = nearestCrossing = maxLabel = nearestLabel = vertLine = undefined;
        }
      };

      function showRoofsCrossingLine(loop, delay) {
        if (!loop) return;

        var loopPosition = Data.getLoopPosition(loop);

        var loopMemLevelPrefix = Data.getMemoryLevelPrefix(loop);

        var crossedRoofs = roofsCrossing4Loop(Data.getRoofs(), loopMemLevelPrefix, loopPosition.x, loopPosition.y, loop.vec);

        if (!result.isValid()) result.create();

        var crossingLineColorStyle;

        if (isIntegratedRoofline() && IntegratedDumbbellLine.areShadowLoopsShown()) {
           crossingLineColorStyle = IntegratedDumbbellLine.getLoopIntegratedColorStyleString(loop);
        }

        result.setPos(loopPosition.x, loopPosition.y, crossedRoofs.max, crossedRoofs.nearest, delay, crossingLineColorStyle);
      }

      Events.recv('rooflineCleared', result.clear, result);
      Events.recv('rooflineResized', result.hide, result);
      Events.recv('zoomFrameMoved', function(started) {
        if (highlightedLoop) {
          if (started) {
            result.hide();
          } else {
            showRoofsCrossingLine(highlightedLoop);
          }
        }
      });

      Events.recv('loopEntered', function(loop) {
        highlightedLoop = loop;
        showRoofsCrossingLine(loop);
      });

      Events.recv('loopLeaved', function() {
        highlightedLoop = undefined;
        result.hide()
      });

      Events.recv('zoomFrameChanged', function() {
        if (highlightedLoop) showRoofsCrossingLine(highlightedLoop, 0);
      });

      return result;
    })();

    return {
      setRoofline: function(roofline) {
        _roofline = roofline;
      },
      setScale: function(scale) {
        _scale = scale;
      },
    };
});
