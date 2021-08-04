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

define(['./utils'], function(Utils) {

  var svgns = 'http://www.w3.org/2000/svg';
  var getId = (function() {
    var count = 0;
    var idFunction = function() {
      return 'SVG_' + (count++) + '_';
    };
    return idFunction;
  })();

  ///////////////////////////////////////////
  //
  //    SVGItem
  //
  ///////////////////////////////////////////

  function SVGItem(name) {
    this.el = document.createElementNS(svgns, name);
    this.el.owner = this;
  }

  SVGItem.prototype.activate = function () {
    this.el.classList.add('idvc_active');
    return this;
  };

  SVGItem.prototype.deactivate = function () {
    this.el.classList.remove('idvc_active');
    return this;
  };

  SVGItem.prototype.hide = function () {
    this.el.classList.add('idvc_hidden');
    return this;
  };

  SVGItem.prototype.isHidden = function () {
    return this.el.classList.contains('idvc_hidden');
  };

  SVGItem.prototype.show = function () {
    this.el.classList.remove('idvc_hidden');
    return this;
  };

  SVGItem.prototype.getAttr = function (name, namespace) {
    namespace = namespace || null;
    var result;
    if (name) result = this.el.getAttributeNS(namespace, name);
    return result;
  };

  SVGItem.prototype.setAttr = function (name, val, namespace) {
    namespace = namespace || null;
    if (name && val !== undefined) this.el.setAttributeNS(namespace, name, val);
    return this;
  };

  SVGItem.prototype.remAttr = function (name, namespace) {
    namespace = namespace || null;
    if (name) this.el.removeAttributeNS(namespace, name);
    return this;
  };

  SVGItem.prototype.setRef = function(ref) {
    return this.setAttr('href', ref, 'http://www.w3.org/1999/xlink');
  };

  SVGItem.prototype.remRef = function() {
    return this.remAttr('href', 'http://www.w3.org/1999/xlink');
  };

  SVGItem.prototype.setClass = function (name) {
    name = name || '';
    return this.setAttr('class', name);
  };

  SVGItem.prototype.addClass = function (name) {
    this.el.classList.add(name);
    return this;
  };

  SVGItem.prototype.remClass = function (name) {
    this.el.classList.remove(name);
    return this;
  };

  SVGItem.prototype.hasClass = function (name) {
    return this.el.classList.contains(name);
  };

  SVGItem.prototype.toggleClass = function (name) {
    this.el.classList.toggle(name);
    return this;
  };
  
  SVGItem.prototype.getStyle = function () {
    return this.getAttr('style');
  };

  SVGItem.prototype.setStyle = function (style) {
    return this.setAttr('style', style);
  };

  SVGItem.prototype.style = function (name, val) {
    this.el.style[name] = val;
    return this;
  };

  SVGItem.prototype.setId = function (val) {
    return this.setAttr('id', this.getLocalId(val));
  };

  SVGItem.prototype.getLocalId = function (id) {
    if (!id) return undefined;

    var canvas = this.getCanvas();
    if (canvas) {
      return canvas.getLocalId(id);
    }

    return id;
  };

  SVGItem.prototype.getElementById = function(id) {
    if (!id) return undefined;

    var canvas = this.getCanvas();
    if (canvas) {
      return canvas.getElementById(id);
    }
  };

  SVGItem.prototype.localRef = function (id) {
    return '#' + this.getLocalId(id);
  };

  SVGItem.prototype.localUrl = function (id) {
    return 'url(' + this.localRef(id) + ')';
  };

  SVGItem.prototype.setTransform = function (val) {
    return this.setAttr('transform', val);
  };

  SVGItem.prototype.setTitle = function(text) {
    var element = this.el;

    while (element.hasChildNodes()) {
      element.removeChild(element.lastChild);
    }

    var title = document.createElementNS(svgns, 'title');
    title.textContent = text;
    element.appendChild(title);
  };

  SVGItem.prototype.getCanvas = function () {
    var svgOwner = this.el.ownerSVGElement;
    if (svgOwner) return svgOwner.owner;
    return undefined;
  };

  SVGItem.prototype.getViewport = function () {
    var svgViewport = this.el.viewportElement;
    if (svgViewport) return svgViewport.owner;
    return undefined;
  };

  SVGItem.prototype.getParent = function () {
    var svgParent = this.el.parentNode;
    if (svgParent) return svgParent.owner;
    return undefined;
  };

  SVGItem.prototype.createAnimation = function (type, id) {
    var anim = (new SVGAnimation(type));
    this.el.appendChild(anim.el);
    anim.setId(id);
    return anim;
  };

  SVGItem.prototype.setFilter = function (id) {
    this.setAttr('filter', this.localUrl(id));
    return this;
  };

  SVGItem.prototype.remFilter = function (id) {
    this.remAttr('filter');
    return this;
  };

  SVGItem.prototype.getBoundingRect = function () {
    var result;

    try {
      result = this.el.getBBox();
    }
    catch(e) {
      result = new DOMRect(0, 0, 0, 0);
    }

    return result;
  };

  SVGItem.prototype.remove = function () {
    var parentNode = this.el.parentNode;
    if (parentNode) parentNode.removeChild(this.el);
    return this;
  };

  SVGItem.prototype.release = function () {
    delete this.el.owner;
    return this;
  };

  SVGItem.prototype.front = function () {
    var parent = this.getParent();
    if (parent) parent.toFront(this);
    return this;
  };

  SVGItem.prototype.back = function () {
    var parent = this.getParent();
    if (parent) parent.toBack(this);
    return this;
  };

  SVGItem.prototype.before = function (ref) {
    var parent = this.getParent();
    if (parent) parent.beforeElement(this, ref);
    return this;
  };

  SVGItem.prototype.after = function (ref) {
    var parent = this.getParent();
    if (parent) parent.afterElement(this, ref);
    return this;
  };

  SVGItem.prototype.on = function(event, handler, useCapture) {
    if (useCapture === undefined) useCapture = false;
    this.el.addEventListener(event, handler, useCapture);
    return this;
  };

  SVGItem.prototype.off = function(event, handler, useCapture) {
    if (useCapture === undefined) useCapture = false;
    this.el.removeEventListener(event, handler, useCapture);
    return this;
  };

  SVGItem.prototype.createTransform = function() {
    var svg = this.el.ownerSVGElement;
    var xForm = this.el.scaleIndependentXForm = svg.createSVGTransform();
    this.el.transform.baseVal.clear();
    this.el.transform.baseVal.appendItem(xForm);

    return xForm;
  }

  ///////////////////////////////////////////
  //
  //    SVGAnimation
  //
  ///////////////////////////////////////////

  /* animation examples

    rect.createAnimation('animate')
      .setAttr('attributeName', "width")
      .setAttr('dur', "11s")
      .setAttr('from', "200")
      .setAttr('to', "1")
      .setAttr('repeatCount', "indefinite");

    canvas
      .createG()
        .createPath('MovePath')
          .moveToAbs(600, 100)
          .lineToAbs(800, 200)
          .lineToHorizontalRel(40)
          .lineToRel(100, -50)
          .lineToAbs(600, 100)
          .setD()
          .setAttr('fill', 'black')
          .setAttr('stroke', 'yellow')
          .setAttr('stroke-width', '1');

    ellipse.createAnimation('animateMotion')
      .setAttr('begin', "0s")
      .setAttr('dur', "4s")
      .setAttr('repeatCount', "indefinite")
      .setAttr('rotate', 'auto')
      .setPath('MovePath');

  */

  function SVGAnimation(type) {
    SVGItem.call(this, type);
  }

  SVGAnimation.prototype = Object.create(SVGItem.prototype);

  SVGAnimation.prototype.setPath = function(id) {
    var path = new SVGItem('mpath');
    this.el.appendChild(path.el);
    path.setRef(this.localRef(id));
    return this;
  };

  ///////////////////////////////////////////
  //
  //    SVGFilter
  //
  ///////////////////////////////////////////

  /* filter example

    canvas.createDefs()
      .createFilter('TextBackground')
        .addElement('feFlood')
          .setAttr('flood-color', 'white')
          .getParent()
        .addElement('feComposite')
          .setAttr('in', 'SourceGraphic');

    someSVGText.setFilter('TextBackground');

    someSVGText.remFilter('TextBackground');

  */

  /* gaussian blur example

    canvas
      .createDefs();
        .createFilter('Filter1')
          .addElement('feGaussianBlur')
            .setAttr('in', 'SourceGraphic')
            .setAttr('stdDeviation', '5');

    canvas
      .createCircle()
        .setCX(50)
        .setCY(50)
        .setR(100)
        .setAttr('fill', 'blue')
        .setFilter('Filter1');

  */

  function SVGFilter() {
    SVGItem.call(this, 'filter');
  }

  SVGFilter.prototype = Object.create(SVGItem.prototype);

  SVGFilter.prototype.addElement = function(type) {
    var item = (new SVGItem(type));
    this.el.appendChild(item.el);
    return item;
  };

  ///////////////////////////////////////////
  //
  //    SVGGradient
  //
  ///////////////////////////////////////////

  /* using gradient for path example

    // JS
    function addGradient(canvas, maxVal, minVal) {
      var threshold = 80;
      var pos = (threshold - minVal) * 100 / (maxVal - minVal) + '%';
      canvas.createDefs()
      .createLinearGradient('StrokeGradient')
        .setTopBottom()
        .addStopClass('0%', 'ordinaryStop')
        .addStopClass(pos, 'ordinaryStop')
        .addStopClass(pos, 'criticalStop')
        .addStopClass('100%', 'criticalStop');
    }

    addGradient(canvas,  minValue, maxValue);
    path.setClass('gradientLine').setAttr('stroke', path.localUrl('StrokeGradient'));

    // CSS
    .gradientLine {
      fill: transparent;
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
    }

    .criticalStop {
      stop-color: #FF5555;
    }

    .ordinaryStop {
      stop-color: lightgreen;
    }

  */

  function SVGGradient(type) {
    SVGItem.call(this, type);
  }

  SVGGradient.prototype = Object.create(SVGItem.prototype);

  SVGGradient.prototype.addStop = function(offset, color, opacity) {
    var stop = (new SVGItem('stop'));
    this.el.appendChild(stop.el);
    stop.setAttr('offset', offset);
    stop.setAttr('stop-color', color);
    if (opacity) stop.setAttr('stop-opacity', opacity);
    return this;
  };

  SVGGradient.prototype.addStopClass = function(offset, className) {
    var stop = (new SVGItem('stop'));
    this.el.appendChild(stop.el);
    stop.setAttr('offset', offset);
    stop.setAttr('class', className);
    return this;
  };

  SVGGradient.prototype.setTransform = function(val) {
    return this.setAttr('gradientTransform', val);
  };

  SVGGradient.prototype.useAbsoluteCoords = function() {
    return this.setAttr('gradientUnits', 'userSpaceOnUse');
  };

  SVGGradient.prototype.clear = function() {
    Utils.removeAllChildren(this.el);

    return this;
  };

  ///////////////////////////////////////////
  //
  //    SVGLinearGradient
  //
  ///////////////////////////////////////////

  /* using linear gradient

    canvas
      .createDefs()
        .createLinearGradient('FillGradient')
          .setX1('0%')
          .setX2('0%')
          .setY1('0%')
          .setY2('100%')
          .addStop('0%', 'red')
          .addStop('100%', 'green');

    canvas.createRect('GradientRect')
      .setAttr('stroke', 'white')
      .setAttr('fill', canvas.localUrl('FillGradient'))
      .setX(200)
      .setY(10)
      .setWidth(200)
      .setHeight(100);

  */

  function SVGLinearGradient() {
    SVGGradient.call(this, 'linearGradient');
  }

  SVGLinearGradient.prototype = Object.create(SVGGradient.prototype);

  SVGLinearGradient.prototype.setX1 = function(x) {
    return this.setAttr('x1', x);
  };

  SVGLinearGradient.prototype.setY1 = function(y) {
    return this.setAttr('y1', y);
  };

  SVGLinearGradient.prototype.setX2 = function(x) {
    return this.setAttr('x2', x);
  };

  SVGLinearGradient.prototype.setY2 = function(y) {
    return this.setAttr('y2', y);
  };

  SVGLinearGradient.prototype.setTopBottom = function() {
    return this.setX1('0%')
            .setX2('0%')
            .setY1('0%')
            .setY2('100%');
  };

  SVGLinearGradient.prototype.setBottomTop = function() {
    return this.setX1('0%')
            .setX2('0%')
            .setY1('100%')
            .setY2('0%');
  };

  SVGLinearGradient.prototype.setLeftRight = function() {
    return this.setX1('0%')
            .setX2('100%')
            .setY1('0%')
            .setY2('0%');
  };

  SVGLinearGradient.prototype.setRightLeft = function() {
    return this.setX1('100%')
            .setX2('0%')
            .setY1('0%')
            .setY2('0%');
  };

  ///////////////////////////////////////////
  //
  //    SVGRadialGradient
  //
  ///////////////////////////////////////////

  function SVGRadialGradient() {
    SVGGradient.call(this, 'radialGradient');
  }

  SVGRadialGradient.prototype = Object.create(SVGGradient.prototype);

  SVGRadialGradient.prototype.setCX = function(x) {
    return this.setAttr('cx', x);
  };

  SVGRadialGradient.prototype.setCY = function(y) {
    return this.setAttr('cy', y);
  };

  SVGRadialGradient.prototype.setR = function(r) {
    return this.setAttr('r', r);
  };

  SVGRadialGradient.prototype.setFX = function(x) {
    return this.setAttr('fx', x);
  };

  SVGRadialGradient.prototype.setFY = function(y) {
    return this.setAttr('fy', y);
  };

  ///////////////////////////////////////////
  //
  //    SVGPath
  //
  ///////////////////////////////////////////

  function SVGPath() {
    SVGItem.call(this, 'path');
    this.segs = [];
  }

  SVGPath.prototype = Object.create(SVGItem.prototype);

  SVGPath.prototype.setD = function() {
    return this.setAttr('d', this.segs.join(' '));
  };

  SVGPath.prototype.moveToAbs = function(x, y) {
    this.segs.push('M ' + x + ' '+ y);
    return this;
  };

  SVGPath.prototype.moveToRel = function(x, y) {
    this.segs.push('m ' + x + ' '+ y);
    return this;
  };

  SVGPath.prototype.lineToAbs = function(x, y) {
    this.segs.push('L ' + x + ' '+ y);
    return this;
  };

  SVGPath.prototype.lineToRel = function(x, y) {
    this.segs.push('l ' + x + ' '+ y);
    return this;
  };

  SVGPath.prototype.curveToCubicAbs = function(x1, y1, x2, y2, x, y) {
    this.segs.push('C ' + [].join.call(arguments, ' '));
    return this;
  };

  SVGPath.prototype.curveToCubicRel = function(x1, y1, x2, y2, x, y) {
    this.segs.push('c ' + [].join.call(arguments, ' '));
    return this;
  };

  SVGPath.prototype.curveToQuadraticAbs = function(x1, y1, x, y) {
    this.segs.push('Q ' + [].join.call(arguments, ' '));
    return this;
  };

  SVGPath.prototype.curveToQuadraticRel = function(x1, y1, x, y) {
    this.segs.push('q ' + [].join.call(arguments, ' '));
    return this;
  };

  SVGPath.prototype.arcAbs = function(rx, ry, angle, largeArcFlag, sweepFlag, x, y) {
    this.segs.push('A ' + [].join.call(arguments, ' '));
    return this;
  };

  SVGPath.prototype.arcRel = function(rx, ry, angle, largeArcFlag, sweepFlag, x, y) {
    this.segs.push('a ' + [].join.call(arguments, ' '));
    return this;
  };

  SVGPath.prototype.lineToHorizontalAbs = function(x) {
    this.segs.push('H ' + x);
    return this;
  };

  SVGPath.prototype.lineToHorizontalRel = function(x) {
    this.segs.push('h ' + x);
    return this;
  };

  SVGPath.prototype.lineToVerticalAbs = function(y) {
    this.segs.push('V ' + y);
    return this;
  };

  SVGPath.prototype.lineToVerticalRel = function(y) {
    this.segs.push('v ' + y);
    return this;
  };

  SVGPath.prototype.curveToCubicSmoothAbs = function(x2, y2, x, y) {
    this.segs.push('S ' + [].join.call(arguments, ' '));
    return this;
  };

  SVGPath.prototype.curveToCubicSmoothRel = function(x2, y2, x, y) {
    this.segs.push('s ' + [].join.call(arguments, ' '));
    return this;
  };

  SVGPath.prototype.curveToQuadraticSmoothAbs = function(x, y) {
    this.segs.push('T ' + x + ' '+ y);
    return this;
  };

  SVGPath.prototype.curveToQuadraticSmoothRel = function(x, y) {
    this.segs.push('t ' + x + ' '+ y);
    return this;
  };

  SVGPath.prototype.closePath = function() {
    this.segs.push('Z');
    return this;
  };

  SVGPath.prototype.getTotalLength = function() {
    return this.el.getTotalLength();
  };

  SVGPath.prototype.getPointAtLength = function(len) {
    return this.el.getPointAtLength(len);
  };

  SVGPath.prototype.getSegmentsCount = function() {
    return this.segs.length;
  };

  SVGPath.prototype.gatSegment = function(index) {
    return this.segs[index];
  };

  SVGPath.prototype.clearSegments = function() {
    this.segs.length = 0;
    return this;
  };

  SVGPath.prototype.animateDrawing = function(duration, type, color) {
    type = type || 'linear';

    var len = this.getTotalLength();
    this.el.style.transition = 'none';
    this.el.style.strokeDasharray = [len, len].join(' ');
    this.el.style.strokeDashoffset = len;

    if (color) {
      this.el.style.stroke = color;
    }
    this.el.getBoundingClientRect(); //recalculate layout

    this.el.style.transition =
      'stroke-dashoffset ' + duration + ' ' + type;
    this.el.style.strokeDashoffset = '0';
    return this;
  };

  ///////////////////////////////////////////
  //
  //    SVGRect
  //
  ///////////////////////////////////////////

  function SVGRect() {
    SVGItem.call(this, 'rect');
  }

  SVGRect.prototype = Object.create(SVGItem.prototype);

  SVGRect.prototype.setX = function(x) {
    return this.setAttr('x', x);
  };

  SVGRect.prototype.setY = function(y) {
    return this.setAttr('y', y);
  };

  SVGRect.prototype.setWidth = function(width) {
    return this.setAttr('width', width);
  };

  SVGRect.prototype.setHeight = function(height) {
    return this.setAttr('height', height);
  };

  SVGRect.prototype.getX = function() {
    return this.getAttr('x');
  };

  SVGRect.prototype.getY = function() {
    return this.getAttr('y');
  };

  SVGRect.prototype.getWidth = function() {
    return this.getAttr('width');
  };

  SVGRect.prototype.getHeight = function() {
    return this.getAttr('height');
  };

  ///////////////////////////////////////////
  //
  //    SVGImage
  //
  ///////////////////////////////////////////

  function SVGImage() {
    SVGItem.call(this, 'image');
  }

  SVGImage.prototype = Object.create(SVGItem.prototype);

  SVGImage.prototype.setX = function(x) {
    return this.setAttr('x', x);
  };

  SVGImage.prototype.setY = function(y) {
    return this.setAttr('y', y);
  };

  SVGImage.prototype.setWidth = function(width) {
    return this.setAttr('width', width);
  };

  SVGImage.prototype.setHeight = function(height) {
    return this.setAttr('height', height);
  };

  ///////////////////////////////////////////
  //
  //    SVGLine
  //
  ///////////////////////////////////////////

  function SVGLine() {
    SVGItem.call(this, 'line');
  }

  SVGLine.prototype = Object.create(SVGItem.prototype);

  SVGLine.prototype.setX1 = function(x) {
    return this.setAttr('x1', x);
  };

  SVGLine.prototype.setY1 = function(y) {
    return this.setAttr('y1', y);
  };

  SVGLine.prototype.setX2 = function(x) {
    return this.setAttr('x2', x);
  };

  SVGLine.prototype.setY2 = function(y) {
    return this.setAttr('y2', y);
  };

  ///////////////////////////////////////////
  //
  //    SVGCircle
  //
  ///////////////////////////////////////////

  function SVGCircle() {
    SVGItem.call(this, 'circle');
  }

  SVGCircle.prototype = Object.create(SVGItem.prototype);

  SVGCircle.prototype.setCX = function(x) {
    return this.setAttr('cx', x);
  };

  SVGCircle.prototype.setCY = function(y) {
    return this.setAttr('cy', y);
  };

  SVGCircle.prototype.setR = function(r) {
    return this.setAttr('r', r);
  };

  SVGCircle.prototype.getCX = function() {
    return this.getAttr('cx');
  };

  SVGCircle.prototype.getCY = function() {
    return this.getAttr('cy');
  };

  SVGCircle.prototype.getR = function() {
    return this.getAttr('r');
  };

  ///////////////////////////////////////////
  //
  //    SVGEllipse
  //
  ///////////////////////////////////////////

  function SVGEllipse() {
    SVGItem.call(this, 'ellipse');
  }

  SVGEllipse.prototype = Object.create(SVGItem.prototype);

  SVGEllipse.prototype.setCX = function(x) {
    return this.setAttr('cx', x);
  };

  SVGEllipse.prototype.setCY = function(y) {
    return this.setAttr('cy', y);
  };

  SVGEllipse.prototype.setRX = function(r) {
    return this.setAttr('rx', r);
  };

  SVGEllipse.prototype.setRY = function(r) {
    return this.setAttr('ry', r);
  };

  SVGEllipse.prototype.getCX = function() {
    return this.getAttr('cx');
  };

  SVGEllipse.prototype.getCY = function() {
    return this.getAttr('cy');
  };

  SVGEllipse.prototype.getRX = function() {
    return this.getAttr('rx');
  };

  SVGEllipse.prototype.getRY = function() {
    return this.getAttr('ry');
  };

  ///////////////////////////////////////////
  //
  //    SVGPolyline
  //
  ///////////////////////////////////////////

  // points format: [[x1, y1], [x2, y2], ...[xn, yn]]

  function points2Str(points) {
    return points.join(' ');
  }

  function str2Points(str) {
    var res = [];

    if (str) {
      res = str.split(' ').map(p => p.split(',').map(v => parseFloat(v)));
    }

    return res;
  }

  function SVGPolyline() {
    SVGItem.call(this, 'polyline');
  }

  SVGPolyline.prototype = Object.create(SVGItem.prototype);

  SVGPolyline.prototype.setPoints = function(points) {
    if (points.length) return this.setAttr('points', points2Str(points));
    return this;
  };

  SVGPolyline.prototype.getPoints = function() {
    return str2Points(this.getAttr('points'));
  };

  ///////////////////////////////////////////
  //
  //    SVGPolygon
  //
  ///////////////////////////////////////////

  function SVGPolygon() {
    SVGItem.call(this, 'polygon');
  }

  SVGPolygon.prototype = Object.create(SVGItem.prototype);

  SVGPolygon.prototype.setPoints = function(points) {
    if (points.length) return this.setAttr('points', points2Str(points));
    return this;
  };

  SVGPolygon.prototype.getPoints = function() {
    return str2Points(this.getAttr('points'));
  };

  ///////////////////////////////////////////
  //
  //    SVGText
  //
  ///////////////////////////////////////////

  /* using path for text

    canvas
      .createDefs();
        .createPath('TextPath')
          .setAttr('d', 'M3.858,58.607 c16.784-5.985,33.921-10.518,51.695-12.99c50.522-7.028,101.982,0.51,151.892,8.283c17.83,2.777,35.632,5.711,53.437,8.628 c51.69,8.469,103.241,11.438,155.3,3.794c53.714-7.887,106.383-20.968,159.374-32.228c11.166-2.373,27.644-7.155,39.231-4.449');

    canvas
      .createText('There are over 8,000 grape varieties worldwide.')
        .setAttr('fill', 'yellow')
        .setPath('TextPath', '20%');

  */

  /* multyline rotated text example

    canvas
      .createText('Line1')
        .setX(10)
        .setY(200)
        .setAttr('fill', 'yellow')
        .setTransform('rotate(45 10,200)')
        .addNewLine('Line2')
        .setX(15)
        .setY(220);

  */

  function SVGText(text, type) {
    type = type || 'text';
    SVGItem.call(this, type);
    if (text !== undefined) this.setText(text);
  }

  SVGText.prototype = Object.create(SVGItem.prototype);

  SVGText.prototype.setX = function(x) {
    return this.setAttr('x', x);
  };

  SVGText.prototype.setY = function(y) {
    return this.setAttr('y', y);
  };

  SVGText.prototype.setDX = function(x) {
    return this.setAttr('dx', x);
  };

  SVGText.prototype.setDY = function(y) {
    return this.setAttr('dy', y);
  };

  SVGText.prototype.setText = function(text) {
    if (!this.textNode) {
      this.textNode = document.createTextNode(text);
      this.el.appendChild(this.textNode);
    } else {
      this.textNode.data = text;
    }

    return this;
  };

  SVGText.prototype.setPath = function(id, startOffset) {
    this.el.removeChild(this.textNode);
    this.textPath = new SVGItem('textPath');
    this.el.appendChild(this.textPath.el);
    this.textPath.el.appendChild(this.textNode);
    this.textPath
      .setRef(this.localRef(id))
      .setAttr('startOffset', startOffset);
  };

  SVGText.prototype.addSpan = function(text) {
    var line = new SVGText(text, 'tspan');
    this.el.appendChild(line.el);
    return line;
  };

  SVGText.prototype.getSpan = function(index) {
    var spanEl = this.el.children[index];
    if (spanEl) return spanEl.owner;

    return undefined;
  };

  ///////////////////////////////////////////
  //
  //    SVGUse
  //
  ///////////////////////////////////////////

  function SVGUse() {
    SVGItem.call(this, 'use');
  }

  SVGUse.prototype = Object.create(SVGItem.prototype);

  SVGUse.prototype.setX = function(x) {
    return this.setAttr('x', x);
  };

  SVGUse.prototype.setY = function(y) {
    return this.setAttr('y', y);
  };

  SVGUse.prototype.setWidth = function(width) {
    return this.setAttr('width', width);
  };

  SVGUse.prototype.setHeight = function(height) {
    return this.setAttr('height', height);
  };

  SVGUse.prototype.getX = function() {
    return this.getAttr('x');
  };

  SVGUse.prototype.getY = function() {
    return this.getAttr('y');
  };

  SVGUse.prototype.getWidth = function() {
    return this.getAttr('width');
  };

  SVGUse.prototype.getHeight = function() {
    return this.getAttr('height');
  };


  ///////////////////////////////////////////
  //
  //    SVGContainer
  //
  ///////////////////////////////////////////

  function SVGContainer(name) {
    SVGItem.call(this, name);
  }

  SVGContainer.prototype = Object.create(SVGItem.prototype);

  SVGContainer.prototype.appendChild = function(child) {
    if (child) {
      this.el.appendChild(child.el ? child.el : child);
    }
    return this;
  };

  SVGContainer.prototype.createChild = function(id, toBack, ChildConstructor, arg) {
    var res = new ChildConstructor(arg);

    if (toBack && this.el.firstChild) this.el.insertBefore(res.el, this.el.firstChild);
    else this.el.appendChild(res.el);

    res.setId(id);
    return res;
  };

  SVGContainer.prototype.toFront = function(item) {
    var child = this.el.removeChild(item.el);
    if (child) this.el.appendChild(child);
    return this;
  };

  SVGContainer.prototype.toBack = function(item) {
    var child = this.el.removeChild(item.el);
    if (child) this.el.insertBefore(child, this.el.firstChild);
    return this;
  };

  SVGContainer.prototype.beforeElement = function(item, ref) {
    if (!ref) return this.toBack(item);

    var child = this.el.removeChild(item.el);
    if (child && ref.el) this.el.insertBefore(child, ref.el);
    return this;
  };

  SVGContainer.prototype.afterElement = function(item, ref) {
    if (!ref) return this.toFront(item);

    var child = this.el.removeChild(item.el);
    if (child && ref.el) {
      if (this.el.lastElementChild === ref.el) {
        this.el.appendChild(child);
      } else {
        this.el.insertBefore(child, ref.el.nextSibling);
      }
    }
    return this;
  };

  SVGContainer.prototype.getChildrenCount = function() {
    return this.el.children.length;
  };

  SVGContainer.prototype.getChild = function(index) {
    return this.el.children[index];
  };

  SVGContainer.prototype.forEach = function(process) {
    [].forEach.call(this.el.children, process);

    return this;
  };

  SVGContainer.prototype.createPath = function(id, toBack) {
    return this.createChild(id, toBack, SVGPath);
  };

  SVGContainer.prototype.createRect = function(id, toBack) {
    return this.createChild(id, toBack, SVGRect);
  };

  SVGContainer.prototype.createImage = function(id, toBack) {
    return this.createChild(id, toBack, SVGImage);
  };

  SVGContainer.prototype.createLine = function(id, toBack) {
    return this.createChild(id, toBack, SVGLine);
  };

  SVGContainer.prototype.createCircle = function(id, toBack) {
    return this.createChild(id, toBack, SVGCircle);
  };

  SVGContainer.prototype.createEllipse = function(id, toBack) {
    return this.createChild(id, toBack, SVGEllipse);
  };

  SVGContainer.prototype.createPolyline = function(id, toBack) {
    return this.createChild(id, toBack, SVGPolyline);
  };

  SVGContainer.prototype.createPolygon = function(id, toBack) {
    return this.createChild(id, toBack, SVGPolygon);
  };

  SVGContainer.prototype.createText = function(text, id, toBack) {
    return this.createChild(id, toBack, SVGText, text);
  };

  SVGContainer.prototype.createUse = function(id, toBack) {
    return this.createChild(id, toBack, SVGUse);
  };

  SVGContainer.prototype.createG = function(id, toBack) {
    return this.createChild(id, toBack, SVGContainer, 'g');
  };

  SVGContainer.prototype.createDefs = function(id, toBack) {
    return this.createChild(id, toBack, SVGDefs);
  };

  SVGContainer.prototype.getDefs = function (id, toBack) {
    if (!id) return undefined;

    var result = this.getElementById(id);
    if (!result) {
      result = this.createDefs(id, toBack);
    }

    return result;
  };

  SVGContainer.prototype.createClipPath = function(id, toBack) {
    return this.createChild(id, toBack, SVGClipPath);
  };

  SVGContainer.prototype.createSymbol = function(id, toBack) {
    return this.createChild(id, toBack, SVGScalableContainer, 'symbol');
  };

  SVGContainer.prototype.createCanvas = function(id, toBack) {
    return this.createChild(id, toBack, SVGCanvas);
  };

  SVGContainer.prototype.addRect = function(x, y, width, height, style, id, toBack) {
    return this.createRect(id, toBack)
             .setX(x)
             .setY(y)
             .setWidth(width)
             .setHeight(height)
             .setClass(style);
  };

  SVGContainer.prototype.addLine = function(x1, y1, x2, y2, style, id, toBack) {
    return this.createLine(id, toBack)
             .setX1(x1)
             .setY1(y1)
             .setX2(x2)
             .setY2(y2)
             .setClass(style);
  };

  SVGContainer.prototype.addText = function(x, y, text, style, id, toBack) {
    return this.createText(text, id, toBack)
             .setX(x)
             .setY(y)
             .setClass(style);
  };

  SVGContainer.prototype.clear = function() {
    Utils.removeAllChildren(this.el);

    return this;
  };

  ///////////////////////////////////////////
  //
  //    SVGDefs
  //
  ///////////////////////////////////////////

  function SVGDefs() {
    SVGContainer.call(this, 'defs');
  }

  SVGDefs.prototype = Object.create(SVGContainer.prototype);

  SVGDefs.prototype.createLinearGradient = function(id, toBack) {
    return this.createChild(id, toBack, SVGLinearGradient);
  };

  SVGDefs.prototype.createRadialGradient = function(id, toBack) {
    return this.createChild(id, toBack, SVGRadialGradient);
  };

  SVGDefs.prototype.createFilter = function(id, toBack) {
    return this.createChild(id, toBack, SVGFilter);
  };

  SVGDefs.prototype.createMarker = function(id, toBack) {
    return this.createChild(id, toBack, SVGMarker);
  };

  SVGDefs.prototype.createPattern = function(id, toBack) {
    return this.createChild(id, toBack, SVGPattern);
  };

  ///////////////////////////////////////////
  //
  //    SVGClipPath
  //
  ///////////////////////////////////////////

  function SVGClipPath() {
    SVGContainer.call(this, 'clipPath');
  }

  SVGClipPath.prototype = Object.create(SVGContainer.prototype);

  ///////////////////////////////////////////
  //
  //    SVGPattern
  //
  ///////////////////////////////////////////

  function SVGPattern() {
    SVGContainer.call(this, 'pattern');
  }

  SVGPattern.prototype = Object.create(SVGContainer.prototype);

  SVGPattern.prototype.setX = function(x) {
    return this.setAttr('x', x);
  };

  SVGPattern.prototype.setY = function(y) {
    return this.setAttr('y', y);
  };

  SVGPattern.prototype.setWidth = function(width) {
    return this.setAttr('width', width);
  };

  SVGPattern.prototype.setHeight = function(height) {
    return this.setAttr('height', height);
  };

  SVGPattern.prototype.useLocalCoords = function() {
    return this.setAttr('patternUnits', 'userSpaceOnUse');
  };

  SVGPattern.prototype.useParentContentCoords = function() {
    return this.setAttr('patternContentUnits', 'objectBoundingBox');
  };

  ///////////////////////////////////////////
  //
  //    SVGScalableContainer
  //
  ///////////////////////////////////////////

  function SVGScalableContainer(name) {
    SVGContainer.call(this, name);
  }

  SVGScalableContainer.prototype = Object.create(SVGContainer.prototype);

  SVGScalableContainer.prototype.setViewSize = function(minX, minY, width, height, par) {
    var viewBoxAttr = [minX, minY, width, height].join(' ');
    this.setAttr('viewBox', viewBoxAttr);
    par = par || 'none';
    this.setAttr('preserveAspectRatio', par);

    return this;
  };

  SVGScalableContainer.prototype.getViewSize = function() {
    var viewBoxAttr = this.getAttr('viewBox');
    if (viewBoxAttr) {
      var values = viewBoxAttr.split(' ');
      return {
        minX: parseInt(values[0], 10),
        minY: parseInt(values[1], 10),
        width: parseInt(values[2], 10),
        height: parseInt(values[3], 10),
        par: this.getAttr('preserveAspectRatio')
      }
    } else {
      return undefined;
    }
  };

  ///////////////////////////////////////////
  //
  //    SVGMarker
  //
  ///////////////////////////////////////////

  function SVGMarker() {
    SVGScalableContainer.call(this, 'marker');
  }

  SVGMarker.prototype = Object.create(SVGScalableContainer.prototype);

  SVGMarker.prototype.setMarkerUnits = function(units) {
    return this.setAttr('markerUnits', units);
  };

  SVGMarker.prototype.setRefX = function(x) {
    return this.setAttr('refX', x);
  };

  SVGMarker.prototype.setRefY = function(y) {
    return this.setAttr('refY', y);
  };

  SVGMarker.prototype.setMarkerWidth = function(width) {
    return this.setAttr('markerWidth', width);
  };

  SVGMarker.prototype.setMarkerHeight = function(height) {
    return this.setAttr('markerHeight', height);
  };

  SVGMarker.prototype.setOrient = function(orient) {
    return this.setAttr('orient', orient);
  };

  ///////////////////////////////////////////
  //
  //    SVGCanvas
  //
  ///////////////////////////////////////////

  function SVGCanvas(simpleCTM) {
    SVGScalableContainer.call(this, 'svg');
    this.id = getId();
    this.setId(this.id);
    if (simpleCTM) this._simpleCTM = true;
    this.setAttr('preserveAspectRatio', 'none');
  }

  SVGCanvas.prototype = Object.create(SVGScalableContainer.prototype);

  SVGCanvas.prototype.getCanvas = function() {
    return this;
  };

  SVGCanvas.prototype.getElementById = function(id) {
    var element = document.getElementById(this.getLocalId(id));
    if (element) return element.owner;

    return undefined;
  };

  SVGCanvas.prototype.getLocalId = function(id) {
    if (this.id) return this.id + id;

    return id;
  };

  function getCTM(el, prop, funct) {
    var CTM;
    if (this._simpleCTM) {
      CTM = this[prop];
      if (!CTM) {
        this[prop] = CTM = el[funct]();
      }
    } else {
      CTM = el[funct]();
    }

    return CTM;
  }

  SVGCanvas.prototype.Screen2SVG = function(x, y, target) {
    target = target || this;
    var pnt = this.el.createSVGPoint();
    pnt.x = x;
    pnt.y = y;

    var CTM = getCTM.call(this, target.el, '_screenCTM', 'getScreenCTM');
    if (CTM) return pnt.matrixTransform(CTM.inverse());

    return pnt;
  };

  SVGCanvas.prototype.Element2SVG = function(x, y, target) {
    target = target || this;
    var pnt = this.el.createSVGPoint();
    pnt.x = x;
    pnt.y = y;

    var CTM = getCTM.call(this, target.el, '_CTM', 'getCTM');
    if (CTM) return pnt.matrixTransform(CTM.inverse());

    return pnt;
  };

  SVGCanvas.prototype.SVG2Screen = function(x, y, target) {
    target = target || this;
    var pnt = this.el.createSVGPoint();
    pnt.x = x;
    pnt.y = y;

    var CTM = getCTM.call(this, target.el, '_screenCTM', 'getScreenCTM');
    if (CTM) return pnt.matrixTransform(CTM);

    return pnt;
  };

  SVGCanvas.prototype.SVG2Element = function(x, y, target) {
    target = target || this;
    var pnt = this.el.createSVGPoint();
    pnt.x = x;
    pnt.y = y;

    var CTM = getCTM.call(this, target.el, '_CTM', 'getCTM');
    if (CTM) return pnt.matrixTransform(CTM);

    return pnt;
  };

  SVGCanvas.prototype.Screen2SVGX = function(x, target) {
    return this.Screen2SVG(x, 0, target).x;
  };

  SVGCanvas.prototype.Element2SVGX = function(x, target) {
    return this.Element2SVG(x, 0, target).x;
  };

  SVGCanvas.prototype.SVG2ScreenX = function(x, target) {
    return this.SVG2Screen(x, 0, target).x;
  };

  SVGCanvas.prototype.SVG2ElementX = function(x, target) {
    return this.SVG2Element(x, 0, target).x;
  };

  SVGCanvas.prototype.Screen2SVGY = function(y, target) {
    return this.Screen2SVG(0, y, target).y;
  };

  SVGCanvas.prototype.Element2SVGY = function(y, target) {
    return this.Element2SVG(0, y, target).y;
  };

  SVGCanvas.prototype.SVG2ScreenY = function(y, target) {
    return this.SVG2Screen(0, y, target).y;
  };

  SVGCanvas.prototype.SVG2ElementY = function(y, target) {
    return this.SVG2Element(0, y, target).y;
  };

  SVGCanvas.prototype.getTextHeight = function(params) {
    params = params || {};

    var text = this.createText('TEST');
    if (params.fontFamily !== undefined) text.setAttr('font-family', params.fontFamily);
    if (params.fontSize !== undefined) text.setAttr('font-size', params.fontSize);
    if (params.className !== undefined) text.setClass(params.className);

    var result = text.getBoundingRect().height;

    text.remove();

    return result;
  };

  function createSVGCanvas(className, simpleCTM) {
    className = className || 'idvc_canvas';
    return (new SVGCanvas(simpleCTM)).setClass(className);
  }

  return {
    create: createSVGCanvas,
    createItem: function(name) {
      return new SVGItem(name);
    },
    createContainer: function(name) {
      return new SVGContainer(name);
    },
    createScalableContainer: function(name) {
      return new SVGScalableContainer(name);
    }
  };
});

