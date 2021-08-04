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

define(['./utils', './svgcanvas'], function(Utils, Canvas) {

  function getAxisHeight(centralPart) {
    var axisHeight;

    var viewSize = centralPart.canvas.getViewSize();
    if (viewSize) {
      axisHeight = centralPart.L2PY(viewSize.minY + viewSize.height);
    } else {
      axisHeight = centralPart.body.getBoundingClientRect().height;
    }

    return axisHeight;
  }

  function isLayout(elem, layoutClass) {
    return elem && elem.classList && elem.classList.contains(layoutClass);
  }

  function isRightLayout(elem) {
    return isLayout(elem, 'idvcchart_right');
  }

  function isTopLayout(elem) {
    return isLayout(elem, 'idvcchart_top');
  }

  function getTop() {
    if (this._sizes.top === undefined) {
      this._sizes.top = this._centralPart.body.offsetTop;
    }

    return this._sizes.top;
  }

  function getHeight() {
    if (!this._sizes.height) {
      this._sizes.height = getAxisHeight(this._centralPart);
    }

    return this._sizes.height;
  }

  function getBoundingHeight() {
    if (!this._sizes.boundingHeight) {
      this._sizes.boundingHeight = this.body.getBoundingClientRect().height;
    }

    return this._sizes.boundingHeight;
  }

  function getAxisWidth(centralPart) {
    var axisWidth;

    var viewSize = centralPart.canvas.getViewSize();
    if (viewSize) {
      axisWidth = centralPart.L2PX(viewSize.minX + viewSize.width);
    } else {
      axisWidth = centralPart.body.getBoundingClientRect().width;
    }

    return axisWidth;
  }

  function getWidth() {
    if (!this._sizes.width) {
      this._sizes.width = getAxisWidth(this._centralPart);
    }

    return this._sizes.width;
  }

  function getBoundingWidth() {
    if (!this._sizes.boundingWidth) {
      this._sizes.boundingWidth = this.body.getBoundingClientRect().width;
    }

    return this._sizes.boundingWidth;
  }

  function applyCheckedPos(value) {
    if (value._checkedPos) {
      value.representation.setPos(value._checkedPos);
      delete value._checkedPos;
    }
  }

  const tickSize = 6;
  const textOffset = 10;
  const axisLineClass = 'idvcchart_axis';
  const axisTextClass = 'idvcchart_axis_text';

  var vertAxisLayout = {
    getClass: function() {
      return 'idvcchart_vertaxis';
    },
    getValueLayout: function(value) {
      if (!this._centralPart) return;

      var valueLayout = {};

      var anchor = '';
      var offsetTop = getTop.call(this);
      var pos = this._centralPart.L2PY(value) + offsetTop;

      valueLayout.tickClass = axisLineClass;
      valueLayout.textClass = axisTextClass;
      valueLayout.tickStartY = pos;
      valueLayout.tickEndY = pos;
      valueLayout.textY = pos;
      if (isRightLayout(this._parent)) {
        valueLayout.tickStartX = tickSize;
        valueLayout.tickEndX = 0;
        valueLayout.textX = textOffset;
        anchor = 'start;';
      } else {
        var axisWidth = getBoundingWidth.call(this);
        valueLayout.tickStartX = axisWidth - tickSize;
        valueLayout.tickEndX = axisWidth;
        valueLayout.textX = axisWidth - textOffset;
        anchor = 'end;';
      }
      valueLayout.textStyle = 'text-anchor: ' + anchor + 'dominant-baseline: middle';

      return valueLayout;
    },
    getLineLayout: function() {
      var lineLayout = {};

      var offsetTop = getTop.call(this);
      var axisHeight = getHeight.call(this);
      lineLayout.startY = offsetTop;
      lineLayout.endY = offsetTop + axisHeight + 1;
      lineLayout.lineClass = axisLineClass;
      if (isRightLayout(this._parent)) {
        lineLayout.startX = 0.5;
        lineLayout.endX = 0.5;
      } else {
        var axisWidth = getBoundingWidth.call(this);
        lineLayout.startX = axisWidth - 0.5;
        lineLayout.endX = axisWidth - 0.5;
      }

      return lineLayout;
    },
    getRectLayout: function(rect) {
      return {
        alongStart: rect.y,
        alongSize: rect.height,
        acrossStart: rect.x,
        acrossSize: rect.width
      }
    },
    updateValuePos: function(value) {
      if (!this._centralPart || !value) return;

      var offsetTop = getTop.call(this);
      var pos = this._centralPart.L2PY(value.value) + offsetTop;

      value.representation.updatePos({y: pos});
      value._checkedPos = {y: pos};
    },
    updateLinePos: function () {
      if (!this._centralPart) return;

      var offsetTop = getTop.call(this);
      var axisHeight = getHeight.call(this) + offsetTop;
      this.axisLine.setY2(axisHeight);
    },
    checkValuePos: function(value) {
      if (value._checkedPos) {
        var boundingRect = value.representation.getBoundingRect();
        if (boundingRect.y < 0) {
          value._checkedPos.y -= boundingRect.y;
        } else {
          delete value._checkedPos;
        }
      }
    }
  };

  var horzAxisLayout = {
    getClass: function() {
      return 'idvcchart_horzaxis';
    },
    getValueLayout: function(value) {
      if (!this._centralPart) return;

      var valueLayout = {};

      var pos = this._centralPart.L2PX(value);
      var align = '';

      valueLayout.tickClass = axisLineClass;
      valueLayout.textClass = axisTextClass;
      valueLayout.tickStartX = pos;
      valueLayout.tickEndX = pos;
      valueLayout.textX = pos;
      if (isTopLayout(this._parent)) {
        var axisHeight = getBoundingHeight.call(this);
        valueLayout.tickStartY = axisHeight - tickSize;
        valueLayout.tickEndY = axisHeight;
        valueLayout.textY = axisHeight - textOffset;
        align = 'text-after-edge;';
      } else {
        valueLayout.tickStartY = tickSize;
        valueLayout.tickEndY = 0;
        valueLayout.textY = textOffset;
        align = 'text-before-edge;';
      }
      valueLayout.textStyle = 'text-anchor: middle; dominant-baseline:' + align;

      return valueLayout;
    },
    getLineLayout: function() {
      var lineLayout = {};
      var axisWidth = getWidth.call(this);
      lineLayout.startX = 0;
      lineLayout.endX = axisWidth;
      lineLayout.lineClass = axisLineClass;
      if (isTopLayout(this._parent)) {
        var axisHeight = getBoundingHeight.call(this);
        lineLayout.startY = axisHeight - 0.5;
        lineLayout.endY = axisHeight - 0.5;
      } else {
        lineLayout.startY = 0.5;
        lineLayout.endY = 0.5;
      }

      return lineLayout;
    },
    getRectLayout: function(rect) {
      return {
        alongStart: rect.x,
        alongSize: rect.width,
        acrossStart: rect.y,
        acrossSize: rect.height
      }
    },
    updateValuePos: function(value) {
      if (!this._centralPart || !value) return;

      var pos = this._centralPart.L2PX(value.value);

      value.representation.updatePos({x: pos});
      value._checkedPos = {x: pos};
    },
    updateLinePos: function () {
      if (!this._centralPart) return;

      var axisWidth = getWidth.call(this);
      this.axisLine.setX2(axisWidth);
    },
    checkValuePos: function(value) {
      if (value._checkedPos) {
        var boundingRect = value.representation.getBoundingRect();
        if (boundingRect.x < 0) {
          value._checkedPos.x -= boundingRect.x;
        } else {
          delete value._checkedPos;
        }
      }
    }
  };

  function drawValue(value, className) {
    var valueLayout = this._layout.getValueLayout.call(this, value.value);

    value.representation.create(value, this.canvas, this.getFormatValue(), valueLayout, className);

    value._checkedPos = {x: valueLayout.textX, y: valueLayout.textY};
  }

  function drawLine() {
    if (!this.axisLine) {
      var lineLayout = this._layout.getLineLayout.call(this);
      this.axisLine = this.canvas.addLine(lineLayout.startX,
                                          lineLayout.startY,
                                          lineLayout.endX,
                                          lineLayout.endY,
                                          lineLayout.lineClass);
    }
  }

  function drawTimeValues() {
    if (this.from === undefined) return;

    var formatValue = this.getFormatValue();

    var textVertOffset = 7;

    var linePos = 0;
    var textPos = textVertOffset;
    var align = 'text-before-edge;';
    var axisHeight = this.body.offsetHeight;
    if (isTopLayout(this._parent)) {
      textPos = axisHeight - textVertOffset;
      align = 'text-after-edge;';
      linePos = axisHeight;
    }

    var textHorzOffset = 5;
    this.fromText = this.canvas.addText(textHorzOffset, textPos,
      formatValue(this.from), axisTextClass, 'minValue');
    this.fromText.setStyle('text-anchor: start; dominant-baseline:' + align);

    var width = this.body.offsetWidth - textHorzOffset;
    this.toText = this.canvas.addText(width, textPos,
      formatValue(this.to), axisTextClass, 'maxValue');
    this.toText.setStyle('text-anchor: end; dominant-baseline:' + align);

    this.line = this.canvas.addLine(0, linePos, width, linePos, axisLineClass);

    this.body.refreshSize = function() {
      var newWidth = this.body.offsetWidth - textHorzOffset;
      this.toText.setX(newWidth);
      this.line.setX2(newWidth);

      return true;
    }.bind(this);
  }

  function checkValuesPos() {
    this.values.forEach(this._layout.checkValuePos.bind(this));
    this.values.forEach(applyCheckedPos.bind(this));
  }

  function Axis(parent, layout, allowRepos) {
    this._parent = Utils.getDomElement(parent);
    this._layout = layout;

    this.values = [];

    this.body = document.createElement('div');
    this.body.className = layout.getClass();
    this._parent.appendChild(this.body);

    this.canvas = Canvas.create(undefined, !allowRepos);
    this.body.appendChild(this.canvas.el);

    this._sizes = {};

    this.body.refreshSize = function(size) {
      if (!this._centralPart) return;

      if (!size || !size.movingZoomFrame) {
        this._sizes = {};
      }

      this.values.forEach(this._layout.updateValuePos.bind(this));
      this._layout.updateLinePos.call(this);

      checkValuesPos.call(this);

      return true;
    }.bind(this);
  }

  Axis.prototype.getFormatValue = function() {
    return this.onformat || function(value) { return value; };
  };

  function DefValueRepresentation() {}

  DefValueRepresentation.prototype.create = function(value, canvas, formatValue, valueLayout, className) {
    this.line = canvas.addLine(valueLayout.tickStartX,
                          valueLayout.tickStartY,
                          valueLayout.tickEndX,
                          valueLayout.tickEndY,
                          valueLayout.tickClass);
    this.text = canvas.addText(valueLayout.textX,
                          valueLayout.textY,
                          formatValue(value.value),
                          valueLayout.textClass,
                          value.id);
    if (className) this.text.addClass(className);
    this.text.setStyle(valueLayout.textStyle);
  };

  DefValueRepresentation.prototype.updatePos = function(pos) {
    if (!pos) return;

    if (pos.y !== undefined) {
      this.text
        .setY(pos.y);
      this.line
        .setY1(pos.y)
        .setY2(pos.y);
    } else if (pos.x !== undefined) {
      this.text
        .setX(pos.x);
      this.line
        .setX1(pos.x)
        .setX2(pos.x);
    }
  };

  DefValueRepresentation.prototype.setPos = function(pos) {
    if (!pos) return;

    if (pos.y !== undefined) this.text.setY(pos.y);
    if (pos.x !== undefined) this.text.setX(pos.x);
  };

  DefValueRepresentation.prototype.getBoundingRect = function() {
    return this.text.getBoundingRect();
  };

  DefValueRepresentation.prototype.setLabel = function(value, formatValue) {
    this.text
      .setText(formatValue(value));
  };

  Axis.prototype.addValue = function(value, id, RepresentationConstructor) {
    RepresentationConstructor = RepresentationConstructor || DefValueRepresentation;

    this.values.push({
      value: value,
      id: id,
      representation: new RepresentationConstructor()
    });

    if (this._centralPart) {
      drawValue.call(this, this.values[this.values.length - 1]);
    }

    return this;
  };

  Axis.prototype.changeValue = function(index, value) {
    if (index >= 0 && index < this.values.length) {
      var valueObj = this.values[index];
      valueObj.value = value;

      this._layout.updateValuePos.call(this, valueObj, true);
      valueObj.representation.setLabel(valueObj.value, this.getFormatValue());
    }

    return this;
  };

  Axis.prototype.layoutValues = function() {
    checkValuesPos.call(this);

    return this;
  };

  Axis.prototype.setCentralPart = function(centralPart) {
    this._centralPart = centralPart;

    drawLine.call(this);

    /*this.values.forEach(drawValue.bind(this));

    checkValuesPos.call(this);*/

    return this;
  };

  Axis.prototype.clear = function() {
    this._centralPart = undefined;

    this.values.length = 0;
    this.canvas.clear();

    this.axisLine = undefined;

    return this;
  };

  function TimeAxis(parent, allowRepos) {
    this._parent = Utils.getDomElement(parent);

    this.body = document.createElement('div');
    this.body.className = 'idvcchart_horzaxis';
    this._parent.appendChild(this.body);

    this.canvas = Canvas.create(undefined, !allowRepos);
    this.body.appendChild(this.canvas.el);
  }

  TimeAxis.prototype.getFormatValue = function() {
    return this.onformat || function(value) { return value; };
  };

  TimeAxis.prototype.setTime = function(from, to) {
    this.from = from;
    this.to = to;

    if (this._centralPart) drawTimeValues.call(this);

    return this;
  };

  TimeAxis.prototype.setCentralPart = function(centralPart) {
    this._centralPart = centralPart;

    drawTimeValues.call(this);

    return this;
  };

  TimeAxis.prototype.clear = function() {
    this._centralPart = undefined;

    this.from = undefined;
    this.to = undefined;
    this.canvas.clear();

    return this;
  };

  function createDragProcessing(parent) {
    var isDragging = false;
    var dragging = function(e) {
      e = e || event;
      if (this.dragProcessor) {
        this.dragProcessor.dragging(e.pageX, e.pageY);
      }
    }.bind(this);

    var stopDragging = function(e) {
      e = e || event;
      if (this.dragProcessor) {
        this.dragProcessor.stopDragging(e.pageX, e.pageY);
      }

      isDragging = false;
      window.removeEventListener('mousemove', dragging, true);
      window.removeEventListener('mouseup', stopDragging, true);
    }.bind(this);

    parent.onmousedown = function(e) {
      if (!this.dragProcessor) return;

      e = e || event;

      if (e.button !== 0) return;

      if (!e.ctrlKey && !e.shiftKey) {
        e.preventDefault();

        this.dragProcessor.startDragging(e.pageX, e.pageY);

        isDragging = true;
        window.addEventListener('mousemove', dragging, true);
        window.addEventListener('mouseup', stopDragging, true);
      }
    }.bind(this);

    parent.addEventListener('mousemove', function(e) {
      if (!this.dragProcessor) return;

      e = e || event;
      if (!e.ctrlKey && !e.shiftKey) {
        e.preventDefault();

        if (!isDragging &&
            this.dragProcessor.movingOver) {
          this.dragProcessor.movingOver(e.pageX, e.pageY);
        }
      }
    }.bind(this), false);
  }

  const chartSelectionClass = 'idvcchart_selection';

  function CentralPart(parent, allowRepos) {
    this._parent = Utils.getDomElement(parent);
    Utils.addClass(this._parent, 'idvcchart_content');

    this.body = document.createElement('div');
    this.body.className = 'idvcchart_body';
    this._parent.appendChild(this.body);

    this.canvas = Canvas.create(undefined, !allowRepos);
    this.body.appendChild(this.canvas.el);

    this.graphicsRoot = this.canvas;

    this.dragProcessor = undefined;
    createDragProcessing.call(this, this.body);

    this.body.addEventListener('dblclick', function(e) {
      e = e || event;

      if (this.ondblclick) {
        var value = this.screenP2L(e.pageX, e.pageY);
        this.ondblclick(value.x, value.y);
      }
    }.bind(this), false);

    var tooltip = Utils.addTooltip(this.body, function(el, x, y) {
      if (this._disabledTooltip || !el) return undefined;

      var value = this.screenP2L(x, y);
      var tooltipText = this.ontooltiptext(el, value.x, value.y);
      var tooltipAttrs = {};
      if (this.ontooltipattrs) {
        tooltipAttrs = this.ontooltipattrs(el, tooltipText, value.x, value.y);
      }

      return {
        text: tooltipText,
        target: el,
        keepCurrent: true,
        tracking: true,
        autoHideDelay: tooltipAttrs.autoHideDelay || 4000,
        delay: tooltipAttrs.showDelay || 0
      };
    }.bind(this), function() {return true;}, 'idvcchart_tooltip');

    this._updateTooltip = tooltip.update.bind(tooltip);
    this.hideTooltip = tooltip.hide.bind(tooltip);
  }

  CentralPart.prototype.enableTooltip = function(enable) {
    if (!enable) {
      this._disabledTooltip = true;
    } else {
      delete this._disabledTooltip;
    }
  };

  CentralPart.prototype.setDragProcessor = function(dragProcessor) {
    this.removeSelection();
    this.dragProcessor = dragProcessor;
  };

  function createGraphicsRoot(canvas, x, y, width, height) {
    return canvas
      .createG()
        .createRect()
          .setClass('idvcchart_empty')
          .setX(x)
          .setY(y)
          .setWidth(width)
          .setHeight(height)
          .getParent();
  }

  CentralPart.prototype.setViewbox = function(minX, minY, maxX, maxY, svgItem) {
    var height = maxY - minY;
    var width = maxX - minX;

    svgItem = svgItem || createGraphicsRoot(this.canvas, minX, minY, width, height);
    this.graphicsRoot = svgItem;

    this.canvas.setViewSize(minX, minY, width, height);

    if (!isTopLayout(this._parent)) {
      var translateSize = height + 2 * minY;
      svgItem.setAttr('transform', 'translate(0,' +
        translateSize + ') scale(1,-1)');
    }

    this._updateTooltip();
  };

  CentralPart.prototype.updateCursor = function() {
    var cursor = this.body.style.cursor;
    if (cursor) Utils.changeCursor(cursor);
  };

  function normalizeParams(start, width) {
    if (width < 0) {
      return {start: start + width, width: -width};
    }
    return {start: start, width: width};
  }

  function normalizeParamsEx(start, end) {
    if (start > end) {
      return {start: end, end: start};
    }
    return {start: start, end: end};
  }

  CentralPart.prototype.removeSelection = function() {
    if (this.selection) {
      this.selection.remove();
      delete this.selection;
    }
  };

  CentralPart.prototype.createHorzSelection = function(minY, maxY) {
    if (this.selection) return this.selection;

    this.selection = this.canvas.addRect(0, minY, 0, maxY - minY, chartSelectionClass);

    var selection = this.selection;
    selection.el.onselectstart = function() {
      return false;
    };

    var that = this;
    var currentDrag = {
      x: -1,
      dragged: false,
      isBorder: false,
      width: 0,
      start: 0
    };

    function isNear(pos, testPos) {
      var delta = 4;
      return testPos > pos - delta && testPos < pos + delta;
    }

    var setSelectionWidth = function(start, width) {
      if (!width) return;
      var sel = normalizeParams(start, width);

      var sX = sel.start;
      var eX = sel.start + sel.width;

      if (that.graphicsRoot) {
        sX = that.graphicsRoot.getCanvas().Screen2SVGX(sX, that.graphicsRoot);
        eX = that.graphicsRoot.getCanvas().Screen2SVGX(eX, that.graphicsRoot);
      }

      selection
        .setX(sX)
        .setWidth(Math.abs(eX - sX));
    };

    const selectionResizeCursor = 'e-resize';

    var updateSelection = function(posX) {
      var delta = posX - currentDrag.x;
      if (!currentDrag.dragged &&
          Math.abs(delta) > 1) {
        currentDrag.dragged = true;
        that.body.style.cursor = selectionResizeCursor;
        if (!currentDrag.isBorder) {
          currentDrag.width = 0;
          currentDrag.start = currentDrag.x;
        } else {
          if (isNear(currentDrag.start, currentDrag.x)) {
            currentDrag.start += currentDrag.width;
            currentDrag.width = -currentDrag.width;
          }
        }
        if (that.onselectionstarted) {
          that.onselectionstarted(that.screenP2LX(currentDrag.start));
        }
      }

      if (currentDrag.dragged) {
        currentDrag.width += delta;
        setSelectionWidth(currentDrag.start, currentDrag.width);
        currentDrag.x = posX;
      }
    };

    this.dragProcessor = {
      startDragging: function(posX) {
        currentDrag.x = posX;
        currentDrag.isBorder = that.body.style.cursor === selectionResizeCursor;
      },
      stopDragging: function(posX) {
        if (currentDrag.dragged &&
            currentDrag.width) {
          this.movingOver(posX);
          if (that.onselectionchanged) {
            that.onselectionchanged(
              that.screenP2LX(currentDrag.start),
              that.P2LX(currentDrag.width)
            );
          }
        }

        currentDrag.x = -1;
        currentDrag.dragged = false;
      },
      dragging: function(posX) {
        updateSelection(posX);
      },
      movingOver: function(posX) {
        if (isNear(currentDrag.start, posX) ||
            isNear(currentDrag.start + currentDrag.width, posX)) {
          that.body.style.cursor = selectionResizeCursor;
        } else {
          that.body.style.cursor = '';
        }
      }
    };

    return this.selection;
  };

  CentralPart.prototype.createFreeSelection = function() {
    if (this.selection) return this.selection;

    this.selection = this.canvas.addRect(0, 0, 0, 0, chartSelectionClass);

    var selection = this.selection;
    selection.el.onselectstart = function() {
      return false;
    };

    var that = this;
    var currentDrag = {
      x: -1,
      y: -1,
      dragged: false,
      width: 0,
      height: 0,
      startX: 0,
      startY: 0
    };

    var setSelectionSize = function(startX, startY, width, height) {
      if (!width && !height) return;

      var selX = normalizeParams(startX, width);
      var selY = normalizeParams(startY, height);

      var sX = selX.start;
      var sY = selY.start;
      var eX = selX.start + selX.width;
      var eY = selY.start + selY.width;

      if (that.graphicsRoot) {
        sX = that.graphicsRoot.getCanvas().Screen2SVGX(sX, that.graphicsRoot);
        sY = that.graphicsRoot.getCanvas().Screen2SVGY(sY, that.graphicsRoot);
        eX = that.graphicsRoot.getCanvas().Screen2SVGX(eX, that.graphicsRoot);
        eY = that.graphicsRoot.getCanvas().Screen2SVGY(eY, that.graphicsRoot);
      }

      selection
        .setX(sX)
        .setY(sY)
        .setWidth(Math.abs(eX - sX))
        .setHeight(Math.abs(eY - sY));
    };

    var updateSelection = function(posX, posY) {
      var deltaX = posX - currentDrag.x;
      var deltaY = posY - currentDrag.y;
      if (!currentDrag.dragged &&
          (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1)) {
        currentDrag.dragged = true;
        currentDrag.width = 0;
        currentDrag.height = 0;
        currentDrag.startX = currentDrag.x;
        currentDrag.startY = currentDrag.y;

        if (that.onselectionstarted) {
          that.onselectionstarted(
            that.screenP2LX(currentDrag.startX),
            that.screenP2LY(currentDrag.startY)
          );
        }
      }

      if (currentDrag.dragged) {
        currentDrag.width += deltaX;
        currentDrag.height += deltaY;
        setSelectionSize(currentDrag.startX, currentDrag.startY, currentDrag.width, currentDrag.height);
        currentDrag.x = posX;
        currentDrag.y = posY;
      }
    };

    this.dragProcessor = {
      startDragging: function(posX, posY) {
        currentDrag.x = posX;
        currentDrag.y = posY;
      },
      stopDragging: function(posX, posY) {
        if (currentDrag.dragged &&
            currentDrag.width &&
            currentDrag.height &&
            that.onselectionchanged) {
          setTimeout(function() {
            var startX = that.screenP2LX(currentDrag.startX);
            var startY = that.screenP2LY(currentDrag.startY);
            var endX = that.screenP2LX(currentDrag.startX + currentDrag.width);
            var endY = that.screenP2LY(currentDrag.startY + currentDrag.height);

            var paramX = normalizeParamsEx(startX, endX);
            var paramY = normalizeParamsEx(startY, endY);

            that.onselectionchanged(paramX.start, paramY.start, paramX.end, paramY.end);
          }, 0);
        }

        currentDrag.x = -1;
        currentDrag.y = -1;
        currentDrag.dragged = false;
      },
      dragging: function(posX, posY) {
        updateSelection(posX, posY);
      }
    };

    return this.selection;
  };

  CentralPart.prototype.setSelection = function(start, width) {
    var element = this.selection;
    if (element) {
      var sel = normalizeParams(start, width);
      element
        .setX(sel.start)
        .setWidth(sel.width);

      if (this.onselectionchanged) this.onselectionchanged(start, width);
    }
  };

  CentralPart.prototype.getSelection = function() {
    var element = this.selection;
    if (element) {
      return {
        start: parseFloat(element.getAttr('x')),
        width: parseFloat(element.getAttr('width'))
      };
    }

    return undefined;
  };

  CentralPart.prototype.hideSelection = function() {
    var element = this.selection;
    if (element) {
      element
        .setX(0)
        .setY(0)
        .setWidth(0)
        .setHeight(0);
    }
  };

  CentralPart.prototype.event2SVGPos = function(e) {
    return this.screenP2L(e.pageX, e.pageY);
  };

  CentralPart.prototype.clear = function() {
    if (this.selection) {
      delete this.selection;
    }

    this.canvas.clear();

    return this;
  };

  CentralPart.prototype.L2P = function(x, y) {
    var result = {x: x, y: y};
    if (this.tr) {
      result = this.tr.L2P(x, y);
    } else if (this.graphicsRoot) {
      result = this.graphicsRoot.getCanvas().SVG2Element(x, y, this.graphicsRoot);
    }

    return result;
  };

  CentralPart.prototype.L2PX = function(x) {
    var result = x;
    if (this.tr) {
      result = this.tr.L2PX(x);
    } else if (this.graphicsRoot) {
      result = this.graphicsRoot.getCanvas().SVG2ElementX(x, this.graphicsRoot);
    }

    return result;
  };

  CentralPart.prototype.L2PY = function(y) {
    var result = y;
    if (this.tr) {
      result = this.tr.L2PY(y);
    } else if (this.graphicsRoot) {
      result = this.graphicsRoot.getCanvas().SVG2ElementY(y, this.graphicsRoot);
    }

    return result;
  };

  CentralPart.prototype.P2L = function(x, y) {
    var result = {x: x, y: y};
    if (this.tr) {
      result = this.tr.P2L(x, y);
    } else if (this.graphicsRoot) {
      result = this.graphicsRoot.getCanvas().Element2SVG(x, y, this.graphicsRoot);
    }

    return result;
  };

  CentralPart.prototype.P2LX = function(x) {
    var result = x;
    if (this.tr) {
      result = this.tr.P2LX(x);
    } else if (this.graphicsRoot) {
      result = this.graphicsRoot.getCanvas().Element2SVGX(x, this.graphicsRoot);
    }

    return result;
  };

  CentralPart.prototype.P2LY = function(y) {
    var result = y;
    if (this.tr) {
      result = this.tr.P2LY(y);
    } else if (this.graphicsRoot) {
      result = this.graphicsRoot.getCanvas().Element2SVGY(y, this.graphicsRoot);
    }

    return result;
  };

  CentralPart.prototype.screenP2L = function(x, y) {
    var result = {x: x, y: y};
    if (this.tr) {
      result = this.tr.screenP2L(x, y);
    } else if (this.graphicsRoot) {
      result = this.graphicsRoot.getCanvas().Screen2SVG(x, y, this.graphicsRoot);
    }

    return result;
  };

  CentralPart.prototype.screenP2LX = function(x) {
    var result = x;
    if (this.tr) {
      result = this.tr.screenP2LX(x);
    } else if (this.graphicsRoot) {
      result = this.graphicsRoot.getCanvas().Screen2SVGX(x, this.graphicsRoot);
    }

    return result;
  };

  CentralPart.prototype.screenP2LY = function(y) {
    var result = y;
    if (this.tr) {
      result = this.tr.screenP2LY(y);
    } else if (this.graphicsRoot) {
      result = this.graphicsRoot.getCanvas().Screen2SVGY(y, this.graphicsRoot);
    }

    return result;
  };

  CentralPart.prototype.getCanvas = function() {
    return this.canvas;
  };


  return {
    createVertAxis: function(parent, allowRepos) {
      return new Axis(parent, vertAxisLayout, allowRepos);
    },
    createHorzAxis: function(parent, allowRepos) {
      return new Axis(parent, horzAxisLayout, allowRepos);
    },
    createTimeAxis: function(parent, allowRepos) {
      return new TimeAxis(parent, allowRepos);
    },
    createCentralPart: function(parent, allowRepos) {
      return new CentralPart(parent, allowRepos);
    },
    DefValueRepresentation: DefValueRepresentation
  };
});

