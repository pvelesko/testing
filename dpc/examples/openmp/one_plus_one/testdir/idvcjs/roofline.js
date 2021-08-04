/**
 * @license Copyright 2013 - 2014 Intel Corporation All Rights Reserved.
 *
 * The source code, information and material ("Material") contained herein is owned by Intel Corporation or its
 * suppliers or licensors, and title to such Material remains with Intel Corporation or its suppliers or
 * licensors. The Material contains proprietary information of Intel or its suppliers and licensors. The
 * Material is protected by worldwide copyright laws and treaty provisions. No part of the Material may be used,
 * copied, reproduced, modified, published, uploaded, posted, transmitted, distributed or disclosed in any way
 * without Intel's prior express written permission. No license under any patent, copyright or other intellectual
 * property rights in the Material is granted to or conferred upon you, either expressly, by implication,
 * inducement, estoppel or otherwise. Any license under such intellectual property rights must be express and
 * approved by Intel in writing.
 *
 * Unless otherwise agreed by Intel in writing, you may not remove or alter this notice or any other notice
 * embedded in Materials by Intel or Intel's suppliers or licensors in any way.
 */

define(['./signal', './utils', './chart', './svgcanvas'],
  function(Signal, Utils, Chart, Canvas) {

  var SelectionOperations = {
    set: 'set',
    add: 'add',
    remove: 'remove'
  };

  function isRooflinePoint(point) {
    return !!(point && point.el && point.el.el && point.el.el.ownerSVGElement);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////          Points        ///////////////////////////////////////////////////
  /////////////////////////////////////////////////////////////////////////////////////////////////////

  function BasePoint(roofline, x, y, r, className, id) {
    var pos = roofline.tr.L2P(x, y);

    this.el = this.init(roofline.centralPart.graphicsRoot, pos, r, className, id);

    this.x = x;
    this.y = y;

    this.el.el.roofLinePoint = this;
  }

  BasePoint.prototype.show = function() {
    this.el.show();

    return this;
  };

  BasePoint.prototype.hide = function() {
    this.el.hide();

    return this;
  };

  BasePoint.prototype.isHidden = function() {
    return this.el.isHidden();
  };

  BasePoint.prototype.front = function() {
    this.el.front();

    return this;
  };

  BasePoint.prototype.addClass = function(className) {
    this.el.addClass(className);

    return this;
  };

  BasePoint.prototype.remClass = function(className) {
    this.el.remClass(className);

    return this;
  };

  BasePoint.prototype.setFillColor = function(color) {
    if (color) {
      this.el.setAttr('style', 'fill:' + color);
    } else {
      this.el.remAttr('style');
    }

    return this;
  };

  BasePoint.prototype.setPatternId = function(id) {
    this.el.setStyle('stroke:darkgray; fill:' + this.el.localUrl(id + this.getFillPatternPostfix()));

    return this;
  };

  function CirclePoint(roofline, x, y, r, className, id) {
    BasePoint.call(this, roofline, x, y, r, className, id);
  }

  CirclePoint.prototype = Object.create(BasePoint.prototype);

  CirclePoint.createFillPattern = function(defSection, maxRadius, curRadius, color, id) {
    if (!CirclePoint.fillPattermPostfix) CirclePoint.fillPattermPostfix = '-cl';

    var radius = curRadius / maxRadius / 2;

    defSection.createPattern(id + CirclePoint.fillPattermPostfix)
      .useParentContentCoords()
      .setWidth('100%')
      .setHeight('100%')
      .createCircle()
        .setCX('.5')
        .setCY('.5')
        .setR('.5')
        .setAttr('fill', 'white')
        .getParent()
      .createCircle()
        .setCX('.5')
        .setCY('.5')
        .setR(radius)
        .setAttr('fill', color)
        .setAttr('stroke', 'black')
        .setAttr('stroke-width', '0.05');
  };

  CirclePoint.prototype.getFillPatternPostfix = function() {
    if (CirclePoint.fillPattermPostfix) return CirclePoint.fillPattermPostfix;

    return '';
  }

  CirclePoint.prototype.init = function(parent, pos, r, className, id) {
    return parent
      .createCircle(id)
        .setClass(className)
        .activate()
        .setCX(pos.x)
        .setCY(pos.y)
        .setR(r);
  }

  CirclePoint.prototype.move = function(x, y) {
    this.el
      .setCX(x)
      .setCY(y);

    return this;
  };

  CirclePoint.prototype.setR = function(newR) {
    this.el
      .setR(newR);

    return this;
  };

  CirclePoint.prototype.getR = function() {
    return parseFloat(this.el.getR());
  };

  CirclePoint.prototype.getX = function() {
    return parseFloat(this.el.getCX());
  };

  CirclePoint.prototype.getY = function() {
    return parseFloat(this.el.getCY());
  };

  CirclePoint.prototype.calcLineEndPoint = function(startX, startY) {
    var endX = this.getX();
    var endY = this.getY();
    var r = this.getR();

    var sin = 0;
    var cos = 0;

    var distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
    if (distance > 0) {
      sin = (startY - endY) / distance;
      cos = (startX - endX) / distance;
    }

    return {
      x: endX + r * cos,
      y: endY + r * sin
    };
  };

  function SquarePoint(roofline, x, y, r, className, id) {
    BasePoint.call(this, roofline, x, y, r, className, id);
  }

  SquarePoint.prototype = Object.create(BasePoint.prototype);

  SquarePoint.createFillPattern = function(defSection, maxRadius, curRadius, color, id) {
    if (!SquarePoint.fillPattermPostfix) SquarePoint.fillPattermPostfix = '-sr';

    var size = curRadius / maxRadius;
    var delta = size / 2;

    defSection.createPattern(id + SquarePoint.fillPattermPostfix)
      .useParentContentCoords()
      .setWidth('100%')
      .setHeight('100%')
      .createRect()
        .setX('0')
        .setY('0')
        .setWidth('1')
        .setHeight('1')
        .setAttr('fill', 'white')
        .getParent()
      .createRect()
        .setX(0.5 - delta)
        .setY(0.5 - delta)
        .setWidth(size)
        .setHeight(size)
        .setAttr('fill', color)
        .setAttr('stroke', 'black')
        .setAttr('stroke-width', '0.05');
  };

  SquarePoint.prototype.getFillPatternPostfix = function() {
    if (SquarePoint.fillPattermPostfix) return SquarePoint.fillPattermPostfix;

    return '';
  }


  function calcDelta(r) {
    return Math.round(r * Math.sqrt(Math.PI) / 2);
  }

  SquarePoint.prototype.init = function(parent, pos, r, className, id) {
    var delta = calcDelta(r);
    this.delta = delta;

    this.r = r;

    return parent
      .createRect(id)
        .setClass(className)
        .activate()
        .setX(pos.x - delta)
        .setY(pos.y - delta)
        .setWidth(2 * delta)
        .setHeight(2 * delta);
  }

  SquarePoint.prototype.move = function(x, y) {
    this.el
      .setX(x - this.delta)
      .setY(y - this.delta);

    return this;
  };

  SquarePoint.prototype.setR = function(newR) {
    var x = this.getX();
    var y = this.getY();

    var delta = calcDelta(newR);
    this.delta = delta;

    this.r = newR;

    this.el
      .setX(x - delta)
      .setY(y - delta)
      .setWidth(2 * delta)
      .setHeight(2 * delta);

    return this;
  };

  SquarePoint.prototype.getR = function() {
    return this.r;
  };

  SquarePoint.prototype.getX = function() {
    return parseFloat(this.el.getX()) + this.delta;
  };

  SquarePoint.prototype.getY = function() {
    return parseFloat(this.el.getY()) + this.delta;
  };

  SquarePoint.prototype.calcLineEndPoint = function(startX, startY) {
    function calcX(y) {
      return (y - startY) / coef + startX;
    }

    function calcY(x) {
      return (x - startX) * coef + startY;
    }

    var resX = startX;
    var resY = startY;

    var endX = this.getX();
    var endY = this.getY();
    var delta = this.delta;

    var coef = 0;
    var dX = endX - startX;
    var dY = endY - startY;
    if (dX) coef = dY / dX;

    if (Math.abs(dX) + Math.abs(dY) > 0) {
      if (dX === 0 || dY === 0 || dX === dY) {
        resY = endY - Math.sign(dY) * delta;
        resX = endX - Math.sign(dX) * delta;
      } else if (coef > 1 || coef < -1) {
        resY = endY - Math.sign(dY) * delta;
        resX = calcX(resY);
      } else {
        resX = endX - Math.sign(dX) * delta;
        resY = calcY(resX);
      }
    }

    return {x: resX, y: resY};
  };

  ////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////        PolygonPoint       ///////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////

  function PolygonPoint(roofline, x, y, r, className, id) {
    BasePoint.call(this, roofline, x, y, r, className, id);
  }

  PolygonPoint.prototype = Object.create(BasePoint.prototype);

  PolygonPoint.createFillPattern = function(defSection, maxRadius, curRadius, color, id) {
    if (!this.fillPattermPostfix) this.fillPattermPostfix = this.fillPatternPostfixName;

    var mainPoints = this.getPoints(1);
    var minPoints = this.getPoints(curRadius / maxRadius);

    defSection.createPattern(id + this.fillPattermPostfix)
      .useParentContentCoords()
      .setWidth('100%')
      .setHeight('100%')
      .createPolygon()
        .setPoints(mainPoints)
        .setAttr('fill', 'white')
        .getParent()
      .createPolygon()
        .setPoints(minPoints)
        .setAttr('fill', color)
        .setAttr('stroke', 'black')
        .setAttr('stroke-width', '0.05');
  };

  PolygonPoint.prototype.init = function(parent, pos, r, className, id) {
    var points = this.getPoints(pos.x, pos.y, r);
    this.r = r;

    this.xP = pos.x;
    this.yP = pos.y;

    return parent
      .createPolygon(id)
        .setClass(className)
        .activate()
        .setPoints(points);
  };

  PolygonPoint.prototype.move = function(x, y) {
    this.xP = x;
    this.yP = y;

    var points = this.getPoints(x, y, this.r);
    this.el
      .setPoints(points);

    return this;
  };

  PolygonPoint.prototype.setR = function(newR) {
    var x = this.getX();
    var y = this.getY();

    this.r = newR;

    var points = this.getPoints(x, y, newR);

    this.el
      .setPoints(points);

    return this;
  };

  PolygonPoint.prototype.getR = function() {
    return this.r;
  };

  PolygonPoint.prototype.getX = function() {
    return this.xP;
  };

  PolygonPoint.prototype.getY = function() {
    return this.yP;
  };

  PolygonPoint.prototype.calcLineEndPoint = function(startX, startY) {
    function getCross(xL1, yL1, xL2, yL2, xP1, yP1, xP2, yP2) {
      function outOfSegment(v, v1, v2) {
        return v < Math.min(v1, v2) || v > Math.max(v1, v2);
      }

      var result;

      var resX, resY;

      var kxL, kyL, kxP, kyP;

      if (xL1 !== xL2) kyL = (yL2 - yL1) / (xL2 - xL1);
      if (yL1 !== yL2) kxL = (xL2 - xL1) / (yL2 - yL1);

      if (xP1 !== xP2) kyP = (yP2 - yP1) / (xP2 - xP1);
      if (yP1 !== yP2) kxP = (xP2 - xP1) / (yP2 - yP1);

      if (xL1 === xL2) {
        resX = xL1;
        if (xP1 !== xP2) resY = kyP * resX + yP2 - kyP * xP2;
      } else if (xP1 === xP2) {
        resX = xP1;
        if (xL1 !== xL2) resY = kyL * resX + yL2 - kyL * xL2;
      }

      if (resX === undefined && resY === undefined) {
        if (yL1 === yL2) {
          resY = yL1;
          if (yP1 !== yP2) resX = kxP * resY + xP2 - kxP * yP2;
        } else if (yP1 === yP2) {
          resY = yP1;
          if (yL1 !== yL2) resX = kxL * resY + xL2 - kxL * yL2;
        }
      }

      if (resX === undefined && resY === undefined) {
        resX = (yP2 - yL2 + kyL * xL2 - kyP * xP2) / (kyL - kyP);
        resY = (xP2 - xL2 + kxL * yL2 - kxP * yP2) / (kxL - kxP);
      }

      if (resX !== undefined &&
          resY !== undefined &&
          (outOfSegment(resX, xL1, xL2) ||
           outOfSegment(resX, xP1, xP2) ||
           outOfSegment(resY, yL1, yL2) ||
           outOfSegment(resY, yP1, yP2))) {
        resX = resY = undefined;
      }

      if (resX !== undefined && resY !== undefined) {
        result = {x: resX, y: resY};
      }

      return result;
    }

    var cross;

    if (startX === this.xP && startY === this.yP) {
      cross = {x: startX, y: startY};
    } else {
      var points = this.el.getPoints();
      for (var i = 0, len = points.length; i < len; i++) {
        var nextI = i + 1;
        if (nextI >= len) nextI = 0;

        var x1 = points[i][0];
        var y1 = points[i][1];

        var x2 = points[nextI][0];
        var y2 = points[nextI][1];

        cross = getCross(startX, startY, this.xP, this.yP, x1, y1, x2, y2);
        if (cross) break;
      }
    }

    if (!cross) cross = {x: startX, y: startY};

    return cross;
  };

  function createPolygonPoint(getPoints, getPointsPattern, postfix) {
    function PolygonPointDesc(roofline, x, y, r, className, id) {
      PolygonPoint.call(this, roofline, x, y, r, className, id);
    }

    PolygonPointDesc.prototype = Object.create(PolygonPoint.prototype);

    PolygonPointDesc.fillPatternPostfixName = postfix;

    PolygonPointDesc.createFillPattern = function(defSection, maxRadius, curRadius, color, id) {
      PolygonPoint.createFillPattern.call(PolygonPointDesc, defSection, maxRadius, curRadius, color, id);
    };

    PolygonPointDesc.prototype.getFillPatternPostfix = function() {
      if (PolygonPointDesc.fillPattermPostfix) return PolygonPointDesc.fillPattermPostfix;

      return '';
    }

    PolygonPointDesc.getPoints = getPointsPattern;
    PolygonPointDesc.prototype.getPoints = getPoints;

    return PolygonPointDesc;
  }

  function trianglePoints(x, y, r) {
    var a = 2 * r * Math.sqrt(Math.PI) / Math.pow(3, 1 / 4);
    var rIn = a * Math.sqrt(3) / 6;

    return [[x - a / 2, y + rIn], [x, y - 2 * rIn], [x + a / 2, y + rIn]];
  }

  function trianglePointsPattern(ratio) {
    var x = 0.5;
    var y = 0.667;

    return [[x - ratio / 2, y + ratio / 3],
            [x, y - 2 * ratio / 3],
            [x + ratio / 2, y + ratio / 3]];
  }

  var TrianglePoint = createPolygonPoint(trianglePoints, trianglePointsPattern, '-tr');

  function diamondPoints(x, y, r) {
    var ratio = 1.618;
    var a = r * Math.sqrt(Math.PI / ratio * 2);

    return [[x - a / 2, y],
            [x, y - ratio * a / 2],
            [x + a / 2, y],
            [x, y + ratio * a / 2]];
  }

  function diamondPointsPattern(ratio) {
    var x = 0.5;
    var y = 0.5;
    ratio /= 2;

    return [[x - ratio, y],
            [x, y - ratio],
            [x + ratio, y],
            [x, y + ratio]];
  }

  var DiamondPoint = createPolygonPoint(diamondPoints, diamondPointsPattern, '-dm');

  function getPointIcon(PointConstructor, fillColor) {
    if (!PointConstructor) return;

    fillColor = fillColor || 'Gainsboro';

    if (!PointConstructor.icon) PointConstructor.icon = {};

    if (!PointConstructor.icon[fillColor]) {
      var canvas = Canvas.create(undefined, true)
                    .setViewSize(0, 0, 20, 20);

      var roofline = {
        tr: {
          L2P: function(x, y) {
            return {x: x, y: y};
          }
        },
        centralPart: {
          graphicsRoot: canvas
        }
      };

      var point = new PointConstructor(roofline, 10, 11, 7);
      point.remClass('idvc_active');

      PointConstructor.icon[fillColor] =
        'url(\'data:image/svg+xml;base64,' +
          btoa('<svg xmlns="http://www.w3.org/2000/svg" viewbox="0 0 20 20" stroke="black" fill="' + fillColor + '">' +
                canvas.el.innerHTML + '</svg>') +
        '\')';
    }

    return PointConstructor.icon[fillColor];
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////           Roof         ///////////////////////////////////////////////////
  /////////////////////////////////////////////////////////////////////////////////////////////////////

  const defAcrossOffset = 1;
  const defAlongOffset = 10;

  function getTextBaseline(offset) {
    return 'dominant-baseline:' + ((offset < 0) ? 'text-before-edge;' :
                                                  'text-after-edge;');
  }

  function getTextAncor(offset) {
    return (offset < 0) ? 'text-anchor: end; ' :
                          '';
  }

  function createText(roofline, contentStr, alongOffset, acrossOffset, showExpl) {
    var el = roofline.centralPart.canvas.createText(contentStr)
        .setClass('idvcchart_roofline_text')
        .setX(0)
        .setY(0)
        .setStyle(getTextAncor(alongOffset) + getTextBaseline(acrossOffset))
        .after(roofline.getLastGridLine())
        .deactivate();

    if (showExpl) {
      el
        .addSpan('?')
          .addClass('idvcchart_roofline_explanation')
          .setAttr('dy', '-10')
          .activate();
    }

    return  {
      svgText: el,
      alongOffset: alongOffset,
      acrossOffset: acrossOffset
    }
  }

  function updateTextOffsets(text, alongOffset, acrossOffset) {
    if (!text ||
        !text.svgText ||
        (text.alongOffset === alongOffset && text.acrossOffset === acrossOffset)) {
      return false;
    }

    text.svgText.setStyle(getTextAncor(alongOffset) + getTextBaseline(acrossOffset));

    text.alongOffset = alongOffset;
    text.acrossOffset = acrossOffset;

    return true;
  }

  function calcRoofPoints(points, tr) {
    var startY, endY, startX, endX;

    if (Array.isArray(points)) {
      if (points.length === 1) {
        startY = points[0];
      } else if (points.length === 2) {
        startX = points[0];
        startY = points[1];
      } else if (points.length === 3) {
        startY = points[0];
        endX = points[1];
        endY = points[2];
      } else if (points.length >= 4) {
        startX = points[0];
        startY = points[1];
        endX = points[2];
        endY = points[3];
      }
    } else {
      startY = points;
    }

    if (endY === undefined) endY = startY;
    if (endX === undefined) endX = tr.getMaxIntens();
    if (startX === undefined) startX = tr.getMinIntens();

    return {
      startX: startX,
      startY: startY,
      endX: endX,
      endY: endY
    };
  }

  function Roof(points, className, id, roofline) {
    className = className || 'idvcroofline_line';

    var startY, endY, startX, endX;

    var roofPoints = calcRoofPoints(points, roofline.tr);

    startX = roofPoints.startX;
    startY = roofPoints.startY;
    endX = roofPoints.endX;
    endY = roofPoints.endY;

    var line = createLine(roofline, startX, startY, endX, endY, className, id);

    this.el = line,
    this.startX = startX;
    this.startY = startY;
    this.endX = endX;
    this.endY = endY;

    this.roofline = roofline;

    line.el.roof = this;
  }

  Roof.prototype.setBeginText =function(text, alongOffset, acrossOffset, showExpl) {
    alongOffset = alongOffset || defAlongOffset;
    acrossOffset = acrossOffset || defAcrossOffset;

    if (this.startText &&
        this.startText.svgText) {
      this.startText.svgText.remove();
    }

    this.startText = createText(this.roofline, text, alongOffset, acrossOffset, showExpl);

    updateText(this.roofline, this.startText,
      this.startX, this.startY,
      this.endX, this.endY);

    this.startText.svgText.el.parentRoof = this.el;

    return this;
  };

  Roof.prototype.updateBeginOffsets =function(alongOffset, acrossOffset) {
    alongOffset = alongOffset || defAlongOffset;
    acrossOffset = acrossOffset || defAcrossOffset;

    if (updateTextOffsets(this.startText, alongOffset, acrossOffset)) {
      updateText(this.roofline, this.startText,
        this.startX, this.startY,
        this.endX, this.endY);
    }
  }

  Roof.prototype.setEndText =function(text, alongOffset, acrossOffset, showExpl) {
    alongOffset = alongOffset || -defAlongOffset;
    acrossOffset = acrossOffset || defAcrossOffset;

    if (this.endText &&
        this.endText.svgText) {
      this.endText.svgText.remove();
    }

    this.endText = createText(this.roofline, text, alongOffset, acrossOffset, showExpl);

    updateText(this.roofline, this.endText,
      this.startX, this.startY,
      this.endX, this.endY);

    this.endText.svgText.el.parentRoof = this.el;

    return this;
  };

  Roof.prototype.updateEndOffsets = function(alongOffset, acrossOffset) {
    alongOffset = alongOffset || -defAlongOffset;
    acrossOffset = acrossOffset || defAcrossOffset;

    if (updateTextOffsets(this.endText, alongOffset, acrossOffset)) {
      updateText(this.roofline, this.endText,
        this.startX, this.startY,
        this.endX, this.endY);
    }
  }

  Roof.prototype.show = function() {
    this.el.show();
    if (this.startText) this.startText.svgText.show();
    if (this.endText) this.endText.svgText.show();
  };

  Roof.prototype.hide = function() {
    this.el.hide();
    if (this.startText) this.startText.svgText.hide();
    if (this.endText) this.endText.svgText.hide();
  };

  Roof.prototype.isHidden = function() {
    return this.el.isHidden();
  };

  Roof.prototype.remove = function() {
    this.el.remove();
    if (this.startText) this.startText.svgText.remove();
    if (this.endText) this.endText.svgText.remove();

    removeRoofs.call(this.roofline, this);
  }

  Roof.prototype.change = function(points) {
    var startY, endY, startX, endX;

    var roofPoints = calcRoofPoints(points, this.roofline.tr);

    startX = roofPoints.startX;
    startY = roofPoints.startY;
    endX = roofPoints.endX;
    endY = roofPoints.endY;

    this.startX = startX;
    this.startY = startY;
    this.endX = endX;
    this.endY = endY;

    this.update();

    return this;
  };

  Roof.prototype.update = function() {
    var startPos = this.roofline.tr.L2P(this.startX, this.startY);
    var endPos = this.roofline.tr.L2P(this.endX, this.endY);
    this.el
      .setX1(startPos.x)
      .setY1(startPos.y)
      .setX2(endPos.x)
      .setY2(endPos.y);

    updateText(this.roofline, this.startText, this.startX, this.startY,
      this.endX, this.endY);

    updateText(this.roofline, this.endText, this.startX, this.startY,
      this.endX, this.endY);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////        Roofline        ///////////////////////////////////////////////////
  /////////////////////////////////////////////////////////////////////////////////////////////////////

  const selectedPointClass = 'idvcroofline_point_selected';
  const currentPointClass = 'idvcroofline_point_current';

  function RoofLine(parent, tabIndex) {
    this._parent = Utils.getDomElement(parent);
    Utils.removeAllChildren(this._parent);

    this.onDblClick = Signal.create();
    this.onContextMenu = Signal.create();
    this.onSelectionChanged = Signal.create();
    this.onCurrentPointChanged = Signal.create();
    this.beforeResize = Signal.create();
    this.onResize = Signal.create();

    this.centralPart = Chart.createCentralPart(parent);
    this.vertAxis = Chart.createVertAxis(parent);
    this.horzAxis = Chart.createHorzAxis(parent);

    this._selectedPoints = [];
    Object.defineProperty(this, 'selectedPoint', {
      get: function () {
        return this._selectedPoints[0];
      },
      set: function(point) {
        if (!isRooflinePoint(point)) return;

        var currentSelectedPoint = this._selectedPoints[0];
        if (currentSelectedPoint !== point ||
            this._selectedPoints.length > 1) {
          this._selectedPoints.forEach(function(point) {
            point.el.el.classList.remove(selectedPointClass);
          });

          this._selectedPoints.length = 0;
          this._selectedPoints.push(point);
          currentSelectedPoint = this._selectedPoints[0];
          currentSelectedPoint.el.el.classList.add(selectedPointClass);
          this.setPointFront(currentSelectedPoint);
          this.onSelectionChanged.raise(currentSelectedPoint, SelectionOperations.set);
        }
      }
    });

    Object.defineProperty(this, 'selectedPoints', {
      get: function () {
        return this._selectedPoints;
      }
    });

    this._currentPoint;
    Object.defineProperty(this, 'currentPoint', {
      get: function () {
        return this._currentPoint;
      },
      set: function(point) {
        if (point && !isRooflinePoint(point)) return;

        if (this._currentPoint !== point) {
          if (this._currentPoint) {
            this._currentPoint.el.el.classList.remove(currentPointClass);
          }

          this._currentPoint = point;

          if (this._currentPoint) {
            this._currentPoint.el.el.classList.add(currentPointClass);
            this.setPointFront(this._currentPoint);
          }
          this.onCurrentPointChanged.raise(this._currentPoint);
        }
      }
    });

    this.points = [];
    this.roofs = [];

    if (tabIndex !== undefined) {
      this._parent.setAttribute('tabindex', tabIndex);
    }

    this.centralPart.body.refreshSize = function(size) {
      if (!size || !size.movingZoomFrame) {
        if (this.tr) this.tr._clear();
      }

      this.beforeResize.raise(this.tr);

      this.points.forEach(function(point) {
        var pos = this.tr.L2P(point.x, point.y)
        point.move(pos.x, pos.y);
      }.bind(this));

      this.roofs.forEach(function(roof) {
        roof.update();
      });

      if (this.gridLines) this.addGridLines();

      if (this.centerMarker) this.centerMarker.move(this.tr);

      this.onResize.raise(this.tr);

      return true;
    }.bind(this);

    this.centralPart.body.addEventListener('mousedown', (function(e) {
      e = e || event;

      if (e.button !== 0) return;

      if (e.target &&
          e.target.roofLinePoint) {
        if (!e.ctrlKey) {
          this.selectedPoint = e.target.roofLinePoint;
        } else {
          this.addSelectedPoint(e.target.roofLinePoint);
        }

        this.currentPoint = e.target.roofLinePoint;
      }
    }).bind(this), false);

    this.centralPart.ondblclick = (function(x, y) {
      this.onDblClick.raise(x, y);
    }).bind(this);

    this.windowResizeListener = Utils.addWindowResizeListener(this._parent);
  }

  RoofLine.prototype.destroy = function() {
    this.windowResizeListener.remove();
    delete this.windowResizeListener;
  };

  RoofLine.prototype.addSelectedPoint = function(point) {
    if (!isRooflinePoint(point)) return;

    point.el.el.classList.toggle(selectedPointClass);
    if (point.el.el.classList.contains(selectedPointClass)) {
      this._selectedPoints.push(point);
      this.onSelectionChanged.raise(point, SelectionOperations.add);
    } else {
      var index = this._selectedPoints.indexOf(point);
      if (index >= 0) this._selectedPoints.splice(index, 1);
      this.onSelectionChanged.raise(point, SelectionOperations.remove);
    }
  }

  RoofLine.prototype.selectPoints = function(minIntens, minPerf, maxIntens, maxPerf) {
    this.clearSelectedPoints();

    var changeCurrent = true;
    var nothingAddedInSelection = true;

    this.points.forEach(function(point) {
      if (point.x > minIntens &&
          point.x < maxIntens &&
          point.y > minPerf &&
          point.y < maxPerf) {
        this.addSelectedPoint(point);
        nothingAddedInSelection = false;
        if (point === this.currentPoint) changeCurrent = false;
      }
    }.bind(this));

    if (nothingAddedInSelection) this.onSelectionChanged.raise(undefined, SelectionOperations.remove);

    if (changeCurrent) this.currentPoint = this._selectedPoints[0];
  }

  RoofLine.prototype.isPointSelected = function(point) {
    return point && point.el.el.classList.contains(selectedPointClass);
  }

  RoofLine.prototype.clearSelectedPoints = function() {
    this._selectedPoints.forEach(function(point) {
      point.el.el.classList.remove(selectedPointClass);
    });

    this._selectedPoints.length = 0;
  }

  RoofLine.prototype.clear = function() {
    this.points = [];
    this.roofs = [];
    this._selectedPoints = [];
    this._currentPoint = undefined;

    delete this.gridLines;
    delete this.centerMarker;
    delete this.firstFrontEl;

    this.centralPart.clear();
    this.horzAxis.clear();
    this.vertAxis.clear();
  }

  RoofLine.prototype.clearRoofs = function() {
    this.roofs.forEach(function(roof) {
      if (roof) roof.remove();
    });

    this.roofs = [];
  }

  RoofLine.prototype.setViewbox = function(minIntens, minPerf, maxIntens, maxPerf, minWidth, minHeight) {
    minWidth = minWidth || 100;
    minHeight = minHeight || 100;

    var sizes = {};
    if (this.tr) sizes = this.tr._sizes;

    this.tr = {
      _getClientWidth: function() {
        return Math.max(this._getBoundingWidth(), minWidth);
      },
       _getClientHeight: function() {
        return Math.max(this._getBoundingHeight(), minHeight);
      },
      canvas: this.centralPart.getCanvas(),
      body: this.centralPart.body,
      _sizes: {},
      getMinIntens: function() {
        return minIntens;
      },
      getMaxIntens: function() {
        return maxIntens;
      },
      getMinPerf: function() {
        return minPerf;
      },
      getMaxPerf: function() {
        return maxPerf;
      },
      getMinX: function() {
        return this.L2PX(minIntens);
      },
      getMaxX: function() {
        return this.L2PX(maxIntens);
      },
      getMinY: function() {
        return this.L2PY(minPerf);
      },
      getMaxY: function() {
        return this.L2PY(maxPerf);
      },
      getCanvas: function() {
        return this.canvas;
      },
      L2P: function(x, y) {
        return {x: this.L2PX(x), y: this.L2PY(y)};
      },
      L2PX: function(x) {
        return (x - minIntens) *
          this._getClientWidth() / (maxIntens - minIntens);
      },
      L2PY: function(y) {
        var height = this._getClientHeight();
        return height * (1 - (y - minPerf)  / (maxPerf - minPerf));
      },
      P2L: function(x, y) {
        return {x: this.P2LX(x), y: this.P2LY(y)};
      },
      P2LX: function(x) {
        return minIntens + x * (maxIntens - minIntens) /
          this._getClientWidth();
      },
      P2LY: function(y) {
        var height = maxPerf - minPerf;
        return minPerf + height * (1 - y /
          this._getClientHeight());
      },
      screenP2L: function(x, y) {
        return {x: this.screenP2LX(x), y: this.screenP2LY(y)};
      },
      screenP2LX: function(x) {
        var pos = Utils.getElementPos(this.body);
        x -= pos.x;
        return this.P2LX(x);
      },
      screenP2LY: function(y) {
        var pos = Utils.getElementPos(this.body);
        y -= pos.y;
        return this.P2LY(y);
      },
      _clear: function() {
        this._sizes = {};
      },
      _getBoundingWidth: function() {
        if (!this._sizes.width) {
          this._sizes.width = this.body.getBoundingClientRect().width;
        }

        return this._sizes.width;
      },
      _getBoundingHeight: function() {
        if (!this._sizes.height) {
          this._sizes.height = this.body.getBoundingClientRect().height;
        }

        return this._sizes.height;
      }
    };

    this.tr._sizes = sizes;

    this.vertAxis.setCentralPart(this.tr);
    this.horzAxis.setCentralPart(this.tr);

    this.centralPart.tr = this.tr;
  };

  function createTransform(el) {
    var svg = el.ownerSVGElement;
    var xForm = el.scaleIndependentXForm = svg.createSVGTransform();
    el.transform.baseVal.clear();
    el.transform.baseVal.appendItem(xForm);

    return xForm;
  }

  function updateText(roofline, text, startX, startY, endX, endY) {
    function getCTM(el) {
      if (!roofline._CTM) {
        roofline._CTM = el.getCTM();
      }

      return roofline._CTM;
    }

    if (!text) return;

    var el = text.svgText.el;
    var offset = text.alongOffset;

    var xf = createTransform(el);

    var tr = roofline.tr;

    var textPos1 = tr.L2P(startX, startY);
    var textPos2 = tr.L2P(endX, endY);

    var dX = textPos2.x - textPos1.x;
    var dY = textPos1.y - textPos2.y;
    var angle = Math.atan2(dY, dX);

    var textPos = (offset >= 0) ? textPos1 : textPos2;
    var CTM = getCTM(el);
    if (CTM) {
      xf.setMatrix(CTM.inverse().translate(
          textPos.x + offset * Math.cos(angle) - text.acrossOffset * Math.sin(angle),
          textPos.y - offset * Math.sin(angle) - text.acrossOffset * Math.cos(angle))
        .rotate(-angle / (2 * Math.PI) * 360));
    }
  }

  function createLine(roofline, startX, startY, endX, endY, className, id, toBack) {
    var tr = roofline.tr;

    var startPos = tr.L2P(startX, startY);
    var endPos = tr.L2P(endX, endY);
    return roofline.centralPart.graphicsRoot
      .createLine(id, toBack)
        .setClass(className)
        .setX1(startPos.x)
        .setY1(startPos.y)
        .setX2(endPos.x)
        .setY2(endPos.y);
  }

  RoofLine.prototype.addPoint = function(x, y, r, className, id, Constructor) {
    Constructor = Constructor || CirclePoint;
    r = r || 8;
    className = className || 'idvcroofline_point';

    var result = new Constructor(this, x, y, r, className, id);

    this.points.push(result);

    return result;
  };

  RoofLine.prototype.setPointFront = function(point) {
    if (!point) return;

    if (this.firstFrontEl) {
      point.el.before(this.firstFrontEl);
    } else {
      point.front();
      if (this.centerMarker) this.centerMarker.front();
    }
  };

  const markerClass = 'idvcchart_roofline_center_marker';
  const markerClassActive = 'active';

  function DefMarker(x, y, pos, canvas, scale) {
    this.x = x;
    this.y = y;
    this.pos = pos;

    scale = scale || 1;
    const markerSize = 39;
    var halfMarkerSize = Math.ceil(markerSize * scale / 2);

    this.halfMarkerSize = halfMarkerSize;

    this.horzLine = canvas.addLine(pos.x - halfMarkerSize, pos.y, pos.x + halfMarkerSize, pos.y, markerClass);
    this.vertLine = canvas.addLine(pos.x, pos.y - halfMarkerSize, pos.x, pos.y + halfMarkerSize, markerClass);
  }

  DefMarker.prototype.move = function(tr) {
    var pos;

    if (tr) {
      pos = tr.L2P(this.x, this.y);
      this.pos = pos;
    } else {
      pos = this.pos;
    }

    this.horzLine
      .setX1(pos.x - this.halfMarkerSize)
      .setX2(pos.x + this.halfMarkerSize)
      .setY1(pos.y)
      .setY2(pos.y);

    this.vertLine
      .setX1(pos.x)
      .setX2(pos.x)
      .setY1(pos.y - this.halfMarkerSize)
      .setY2(pos.y + this.halfMarkerSize);
  };

  DefMarker.prototype.front = function() {
    this.horzLine.front();
    this.vertLine.front();
  };

  DefMarker.prototype.activate = function() {
    function setActiveStyle(line) {
      line
        .addClass(markerClassActive);
    }

    var canvas = this.horzLine.getCanvas();
    if (!canvas) return;

    var boundingRect = canvas.getBoundingRect();

    this.horzLine
      .setX1(0)
      .setX2(boundingRect.width);

    this.vertLine
      .setY1(0)
      .setY2(boundingRect.height);

    setActiveStyle(this.horzLine);
    setActiveStyle(this.vertLine);
  };

  DefMarker.prototype.deactivate = function() {
    function remActiveStyle(line) {
      line
        .remClass(markerClassActive);
    }

    this.move();
    remActiveStyle(this.horzLine);
    remActiveStyle(this.vertLine);
  };

  RoofLine.prototype.setCenterMarker = function(x, y, scale, MarkerConstructor) {
    scale = scale || 1;
    var pos = this.tr.L2P(x, y);

    MarkerConstructor = MarkerConstructor || DefMarker;

    this.centerMarker = new MarkerConstructor(x, y, pos, this.centralPart.graphicsRoot, scale);
    this.centerMarker.front();

    return this.centerMarker;
  };

  RoofLine.prototype.addRoof = function(points, className, id) {
    var result = new Roof(points, className, id, this);

    this.roofs.push(result);

    return result;
  };

  RoofLine.prototype.addGridLines = function(className) {
    function accepted(axisValue) {
      return axisValue && axisValue.representation &&
             !(axisValue.representation.noGridLine && axisValue.representation.noGridLine());
    }

    className = className || 'idvcroofline_grid_line';

    var addHorzGridLine = function(axisValue) {
      if (!accepted(axisValue)) return;

      var startY = axisValue.value;
      var endY = startY;
      var endX = this.tr.getMaxIntens();
      var startX = this.tr.getMinIntens();
      this.gridLines.push(createLine(this, startX, startY, endX, endY, className, undefined, true));
    }.bind(this);

    var addVertGridLine = function(axisValue) {
      if (!accepted(axisValue)) return;

      var startX = axisValue.value;
      var endX = startX;
      var endY = this.tr.getMaxPerf();
      var startY = this.tr.getMinPerf();
      this.gridLines.push(createLine(this, startX, startY, endX, endY, className, undefined, true));
    }.bind(this);

    if (this.gridLines) this.gridLines.forEach(function(line) {
      line.remove();
    });

    this.gridLines = [];

    this.vertAxis.values.forEach(addHorzGridLine);
    if (this.vertAxis.intermValues) this.vertAxis.intermValues.values.forEach(addHorzGridLine);

    this.horzAxis.values.forEach(addVertGridLine);
    if (this.horzAxis.intermValues) this.horzAxis.intermValues.values.forEach(addVertGridLine);
  };

  RoofLine.prototype.getLastGridLine = function() {
    if (this.gridLines) return this.gridLines[0];

    return undefined;
  }

  function removeRoofs(roof) {
    var roofIndex = this.roofs.indexOf(roof);
    if (roofIndex >= 0) this.roofs.splice(roofIndex, 1);
  }

  return {
    create: function(parent, tabIndex) {
      return new RoofLine(parent, tabIndex);
    },
    SelectionOperations: SelectionOperations,
    BasePoint: BasePoint,
    CirclePoint: CirclePoint,
    SquarePoint: SquarePoint,
    TrianglePoint: TrianglePoint,
    DiamondPoint: DiamondPoint,
    createPolygonPoint: createPolygonPoint,
    getPointIcon: getPointIcon
  };
});
