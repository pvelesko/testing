/**
 * @license Copyright 2013 - 2015 Intel Corporation All Rights Reserved.
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

define([], function() {

  var Consts = {
    browserPrefix: '-webkit-',
    engine: 'webkit'
  };

  (function initConsts() {
    if (navigator.userAgent.indexOf('WebKit') === -1) {
      Consts.engine = 'moz';
      Consts.browserPrefix = '-moz-';
      var versionStart = navigator.userAgent.lastIndexOf('/');
      if (versionStart !== -1) {
        var version = parseInt(navigator.userAgent.substr(versionStart + 1));
        if (version >= 54) Consts.browserPrefix = '';
      }
    }
  })();

  function appendCSS(path) {
    var cssElt = document.createElement('link');
    if (cssElt) {
      cssElt.setAttribute('href', path);
      cssElt.setAttribute('rel', 'stylesheet');
      cssElt.setAttribute('type', 'text/css');
    }
    var head = document.getElementsByTagName('head')[0];
    head.appendChild(cssElt);
  }

  function appendScript(path, loaded, failed) {
    var head = document.getElementsByTagName('head')[0];
    var scriptElt = document.createElement('script');
    scriptElt.setAttribute('src', path);
    scriptElt.setAttribute('type', 'text/javascript');

    if (loaded) {
      scriptElt.onload = loaded;
    }

    if (failed) {
      scriptElt.onerror = failed;
    }

    head.appendChild(scriptElt);
  }

  function applyUAFont(elem) {
    var target = getDomElement(elem) || document.body;

    var button = document.createElement('button');
    button.style.position = 'absolute';
    button.style.left = '0';
    button.style.top = '0';

    target.appendChild(button);
    var UAStyle = window.getComputedStyle(button, null);
    setFont(target, UAStyle, true);
    target.removeChild(button);
  }

  var getScrollbarSize = (function() {
    var result;
    return function(update) {
      if (!result ||
          update) {
        var div = document.createElement('div');

        div.style.overflow = 'scroll';
        div.style.position = 'absolute';
        div.style.top = '0';
        div.style.left = '0';
        div.style.width = '100px';
        div.style.height = '100px';

        document.body.appendChild(div);

        result = {
          width: div.offsetWidth - div.clientWidth,
          height: div.offsetHeight - div.clientHeight
        };

        document.body.removeChild(div);
      }

      return result;
    }
  })();

  function doMath(val, prec, fn) {
    var num = Math.pow(10, prec);
    return Math[fn](val * num) / num;
  }

  function round(val, prec) {
    return doMath(val, prec, 'round');
  }

  function floor(val, prec) {
    return doMath(val, prec, 'floor');
  }

  function ceil(val, prec) {
    return doMath(val, prec, 'ceil');
  }

  function roundExp(val, prec) {
    if (val <= 10 && val >= 1 ||
        val <= -1 && val >= -10) return round(val, prec);

    return val.toExponential(prec);
  }

  function createElement(template, className, id, parent, type, customize) {
    type = type || 'div';

    var result = document.createElement(type);
    if (className) result.className = className;
    if (id) result.id = id;
    if (template) result.innerHTML = template;

    if (customize) customize(result);

    if (parent) parent.appendChild(result);

    return result;
  }

  var getElementById = (function() {
    var elements = {};

    return function(id, renew) {
      var result;
      if (renew || !elements[id]) {
        result = document.getElementById(id);
        if (result) elements[id] = result;
      } else {
        result = elements[id];
      }

      return result;
    }
  })();

  function getElementPos(elem) {
    if (!elem) return undefined;

    var rect = elem.getBoundingClientRect();

    var docElement = document.documentElement;
    var scrollTop = window.pageYOffset || docElement.scrollTop;
    var scrollLeft = window.pageXOffset || docElement.scrollLeft;

    var top  = rect.top + scrollTop - docElement.clientTop;
    var left = rect.left + scrollLeft - docElement.clientLeft;

    return { x: left, y: top, width: rect.width, height: rect.height };
  }

  function defaultCompareItems(v1, v2) {
    if (typeof v1 === 'number' ||
        typeof v1 === 'boolean') {
      return v2 - v1;
    } else if (typeof v1 === 'string') {
      return v2.localeCompare(v1);
    }

    return 0;
  }

  function format() {
    var format_args = arguments;
    var str = arguments[0];
    if (!str) return;

    str = str.replace(/\{\d+\}/g, function(val) {
      return format_args[parseInt(val.slice(1, -1), 10)];
    });
    return str;
  }

  function curryThis(func, thisArg) {
    var args = [].slice.call(arguments, 2);
    return function () {
      return func.apply(thisArg, args.concat([].slice.call(arguments)));
    };
  }

  function curry(func) {
    var args = [].slice.call(arguments, 1);
    args.unshift(undefined);
    args.unshift(func);
    return curryThis.apply(undefined, args);
  }

  function composeThis(thisArg) {
    var args = [].slice.call(arguments, 1);
    return function() {
      var callArgs = [].slice.call(arguments);
      var startCall = args.shift();
      if (startCall) {
        var result = startCall.apply(thisArg, callArgs);
        args.forEach(function(func) {
          result = func.call(thisArg, result);
        });
        return result;
      }
    };
  }

  function compose() {
    var args = [].slice.call(arguments);
    args.unshift(undefined);
    return composeThis.apply(undefined, args);
  }

  function getDomElement(val) {
    if (typeof val === 'string') {
      return document.getElementById(val);
    }
    return val;
  }

  var stopRefreshSizeAttr = 'data-stopRefreshSize';

  function refreshSize(elem, size) {
    if (!elem) return;

    var stopped;

    if (elem.hasAttribute(stopRefreshSizeAttr)) {
      stopped = true;
    } else if (elem.refreshSize) {
      stopped = elem.refreshSize(size);
    }

    if (!stopped && elem.children) {
      for (var i = 0, len = elem.children.length; i < len; i++) {
        refreshSize(elem.children[i], size);
      }
    }
  }

  function createResizeProcess(parentEl, traits, thisObj, mouseButton) {
    thisObj = thisObj || traits;
    if (mouseButton === undefined) mouseButton = 0;

    var currentDrag = {};
    var parent = getDomElement(parentEl);

    var dblClickHandle;

    parent.addEventListener('mousedown', function(e) {
      if (e.button !== mouseButton) return;

      if (traits.accepted.call(thisObj, e.target)) {
        currentDrag.isStarted = false;
        currentDrag.startMousePos = {x: e.pageX, y: e.pageY};
        currentDrag.mousePos = {x: e.pageX, y: e.pageY};

        currentDrag.globalCursor = document.createElement('div');
        currentDrag.globalCursor.className = 'idvcgrid_global_cursor';
        currentDrag.globalCursor.style.cursor = traits.getCursor();

        document.body.appendChild(currentDrag.globalCursor);

        window.addEventListener('mousemove', doResizing, true);
        window.addEventListener('mouseup', stopResizing, true);

        e.preventDefault();
        e.stopPropagation();
        if (traits.onDblClick &&
            !dblClickHandle) {
          dblClickHandle = {
            count: 0,
            timeout: setTimeout(function() {
              dblClickHandle = undefined;
            }, 800)
          };
        }
      }
    }, false);

    function doResizing(e) {
      var deltaThreshold = 5;
      if (traits.getDeltaThreshold) deltaThreshold = traits.getDeltaThreshold();

      var curMousePos = {x: e.pageX, y: e.pageY};
      var delta = traits.getDelta.call(thisObj, curMousePos,
        currentDrag.mousePos, currentDrag.startMousePos);
      if (!currentDrag.isStarted) {
        if (Math.abs(delta) > deltaThreshold) {
          currentDrag.isStarted = true;
        }
      } else {
        e.preventDefault();

        traits.onProcess.call(thisObj, delta);
        currentDrag.mousePos = curMousePos;
      }
    }

    function stopResizing(e) {
      if (currentDrag.globalCursor) {
        document.body.removeChild(currentDrag.globalCursor);
        currentDrag.globalCursor = null;
      }

      currentDrag = {};

      window.removeEventListener('mousemove', doResizing, true);
      window.removeEventListener('mouseup', stopResizing, true);

      if (dblClickHandle) {
        dblClickHandle.count++;
        if (dblClickHandle.count > 1) {
          traits.onDblClick.call(thisObj);

          clearTimeout(dblClickHandle.timeout);
          dblClickHandle = undefined;
        }
      }

      traits.onEnd.call(thisObj);

      if (Consts.engine === 'moz') {
        dispatchMouseEvent({x: e.pageX, y: e.pageY}, 'mousemove');
      }
    }
  }

  function createSplitter(parent, minSize, defSplitterSize, traits) {
    defSplitterSize = defSplitterSize || 0.3;

    function getDiv(prop, className) {
      var result;
      var div = parent[prop];
      if (div) {
        result = getDomElement(div);
        result.classList.add(className);
        parentEl = result.offsetParent || parentEl;
      }

      return result;
    }

    function createDiv(className) {
      var div = document.createElement('div');
      div.className = className;
      div.idvcCreatedBySplitter = true;
      parentEl.appendChild(div);

      return div;
    }

    if (!parent) return;

    var parentEl;
    var primaryDiv = getDiv('primaryDiv', traits.primaryDivClass);
    var splitterDiv = getDiv('splitterDiv', traits.splitterDivClass);
    var secondaryDiv = getDiv('secondaryDiv', traits.secondaryDivClass);

    if (!parentEl) parentEl = getDomElement(parent);

    if (!parentEl) return;

    if (!primaryDiv) primaryDiv = createDiv(traits.primaryDivClass);
    if (!splitterDiv) splitterDiv = createDiv(traits.splitterDivClass);
    if (!secondaryDiv) secondaryDiv = createDiv(traits.secondaryDivClass);

    splitterDiv.onselectstart = function() {
      return false;
    };

    function refreshSplitterSize(isUserAction) {
      if (!isUserAction && traits.refreshSizeByUserAction) return;

      var size = {};
      size[traits.size] = true;

      refreshSize(primaryDiv, size);
      refreshSize(secondaryDiv, size);

      if (splitterObject && splitterObject.onRefreshSize) {
        splitterObject.onRefreshSize();
      }
    }

    function setPercentSize(size, splitterSize, isUserAction) {
      if (size === '100%') {
        size = Consts.browserPrefix + 'calc(100% - ' +
          splitterSize + 'px)';
        primaryDiv.style[traits.size] = size;
        splitterDiv.style[traits.pos] = size;
        secondaryDiv.style[traits.pos] = '100%';
      } else {
        primaryDiv.style[traits.size] = size;
        splitterDiv.style[traits.pos] = size;
        var secondaryPosStr = Consts.browserPrefix + 'calc(' + size + ' + ' +
          splitterSize + 'px)';
        secondaryDiv.style[traits.pos] = secondaryPosStr;
      }

      refreshSplitterSize(isUserAction);
    }

    function setPixelSize(size, splitterSize, isUserAction) {
      primaryDiv.style[traits.size] = size + 'px';
      splitterDiv.style[traits.pos] = size + 'px';
      size += splitterSize;
      secondaryDiv.style[traits.pos] = size + 'px';

      refreshSplitterSize(isUserAction);
    }

    var setPrimaryDivSize = function(primarySize, wholeSize, isUserAction) {
      function isPercent(div) {
        var divStyleSize = div.style[traits.size];
        return divStyleSize &&
            divStyleSize[divStyleSize.length - 1] === '%' ||
            !divStyleSize;
      }

      var splitterSize = getSplitterSize();

      if (isPercent(primaryDiv)) {
        var primarySizeStr = (primarySize * 100 / (wholeSize + splitterSize)) + '%';
        setPercentSize(primarySizeStr, splitterSize, isUserAction);
      } else {
        setPixelSize(primarySize, splitterSize, isUserAction);
      }
    };

    var currentDrag = {pos: -1, dragged: false};
    var globalCursor = null;

    var updateSplitter = function(e) {
      if (primarySize4Folded) return;

      if (currentDrag.dragged) {
        minSize = minSize || 100;

        var eventPos = e[traits.eventPos];

        var primarySize = primaryDiv[traits.offsetSize];
        var secondarySize = secondaryDiv[traits.offsetSize];
        var wholeSize = primarySize + secondarySize;

        var delta = eventPos - currentDrag.pos;
        if (traits.backward) delta = -delta;

        primarySize += delta;

        if (primarySize >= minSize &&
            secondarySize - delta >= minSize) {
          setPrimaryDivSize(primarySize, wholeSize, true);
          currentDrag.pos = eventPos;
        }
      }
    };

    var stopUpdateSplitter = function() {
      document.body.removeChild(globalCursor);
      globalCursor = null;

      currentDrag.pos = -1;
      currentDrag.dragged = false;

      splitterDiv.classList.remove('idvcgrid_splitter_hover');

      window.removeEventListener('mousemove', updateSplitter, true);
      window.removeEventListener('mouseup', stopUpdateSplitter, true);

      if (splitterObject && splitterObject.onStopUpdateSplitter) {
        splitterObject.onStopUpdateSplitter();
      }
    };

    splitterDiv.onmousedown = function(e) {
      e = e || event;

      if (primarySize4Folded) {
        splitterObject.unfold(true);
        return;
      }

      if (!e.ctrlKey && !e.shiftKey &&
          e.target === splitterDiv) {
        e.preventDefault();

        globalCursor = document.createElement('div');
        globalCursor.className = 'idvcgrid_global_cursor';
        var splitterStyle = window.getComputedStyle(splitterDiv, null);
        globalCursor.style.cursor = splitterStyle.cursor;

        document.body.appendChild(globalCursor);

        splitterDiv.classList.add('idvcgrid_splitter_hover');

        currentDrag.pos = e[traits.eventPos];
        currentDrag.dragged = true;

        window.addEventListener('mousemove', updateSplitter, true);
        window.addEventListener('mouseup', stopUpdateSplitter, true);

        if (splitterObject && splitterObject.onStartUpdateSplitter) {
          splitterObject.onStartUpdateSplitter();
        }
      }
    };

    function beforeFold() {
      if (primarySize4Folded) return;

      primarySize4Folded = primaryDiv.style[traits.size];
      splitterDiv.classList.add('idvcsplitter_folded');

      if (currentDrag.dragged) {
        stopUpdateSplitter();
      }
    }

    var splitterMinVisibleSize = em2px(defSplitterSize);

    function getSplitterSize() {
      function isSplitterHidden() {
        return splitterDiv && splitterDiv.style.display === 'none';
      }

      var splitterSize = splitterDiv[traits.offsetSize];
      if (splitterSize < 0) {
        splitterSize = 0;
      }

      if (!isSplitterHidden() &&
          !splitterSize) {
        // splitter parent is hidden
        splitterSize = splitterMinVisibleSize;
      }

      return splitterSize;
    }

    var primarySize4Folded;

    var splitterObject = {
      primaryDiv: primaryDiv,
      splitterDiv: splitterDiv,
      secondaryDiv: secondaryDiv,
      setSize: function(size, userAction) {
        if (primarySize4Folded) {
          primarySize4Folded = size;
          return;
        }

        var splitterSize = getSplitterSize();

        if (size[size.length - 1] === '%') {
          setPercentSize(size, splitterSize, userAction);
        } else {
          setPixelSize(parseInt(size, 10), splitterSize, userAction);
        }
      },
      getSize: function() {
        return primaryDiv.style[traits.size];
      },
      foldPrimary: function(hideSplitter, userAction) {
        beforeFold();
        primaryDiv.style.display = 'none';
        primaryDiv.setAttribute(stopRefreshSizeAttr, '1');
        secondaryDiv.style.display = 'block';
        secondaryDiv.removeAttribute(stopRefreshSizeAttr);
        if (hideSplitter) splitterDiv.style.display = 'none';
        setPixelSize(0, getSplitterSize(), userAction);

        if (this.afterFoldPrimary) {
          this.afterFoldPrimary(userAction);
        }
      },
      isPrimaryFolded: function() {
        return primaryDiv.style.display === 'none';
      },
      foldSecondary: function(hideSplitter, userAction) {
        beforeFold();
        secondaryDiv.style.display = 'none';
        secondaryDiv.setAttribute(stopRefreshSizeAttr, '1');
        primaryDiv.style.display = 'block';
        primaryDiv.removeAttribute(stopRefreshSizeAttr);
        if (hideSplitter) splitterDiv.style.display = 'none';
        else splitterDiv.style.display = 'block';
        setPercentSize('100%', getSplitterSize(), userAction);

        if (this.afterFoldSecondary) {
          this.afterFoldSecondary(userAction);
        }
      },
      isSecondaryFolded: function() {
        return secondaryDiv.style.display === 'none';
      },
      isSplitterHidden: function() {
        return splitterDiv.style.display === 'none';
      },
      unfold: function(userAction) {
        if (!primarySize4Folded) return;

        primaryDiv.style.display = 'block';
        primaryDiv.removeAttribute(stopRefreshSizeAttr);
        secondaryDiv.style.display = 'block';
        secondaryDiv.removeAttribute(stopRefreshSizeAttr);
        splitterDiv.style.display = 'block';
        var size = primarySize4Folded;
        primarySize4Folded = undefined;
        this.setSize(size, userAction);

        splitterDiv.classList.remove('idvcsplitter_folded');

        if (this.afterUnfold) {
          this.afterUnfold(userAction);
        }
      },
      addSash: function(isPrimary, className) {
        className = className || 'idvcsplitter_sash';

        var sash = document.createElement('div');
        sash.className = className;

        sash.onmousedown = function(e) {
          if (!primarySize4Folded) {
            if (isPrimary) this.foldPrimary(false, true);
            else this.foldSecondary(false, true);
          } else {
            this.unfold(true);
          }

          e.stopPropagation();
          e.preventDefault();
        }.bind(this);

        splitterDiv.appendChild(sash);
        this.sashDiv = sash;

        return sash;
      },
      removeSash: function() {
        removeAllChildren(splitterDiv);
        delete this.sashDiv;
      },
      remove: function() {
        primaryDiv.classList.remove(traits.primaryDivClass);
        secondaryDiv.classList.remove(traits.secondaryDivClass);
        splitterDiv.classList.remove(traits.splitterDivClass);

        primaryDiv.style[traits.size] = '';
        splitterDiv.style[traits.pos] = '';
        secondaryDiv.style[traits.pos] = '';

        checkRemoveDiv(primaryDiv);
        checkRemoveDiv(secondaryDiv);
        checkRemoveDiv(splitterDiv);

        function checkRemoveDiv(elem) {
          if (elem.idvcCreatedBySplitter) elem.parentNode.removeChild(elem);
        }
      }
    };

    splitterObject.setSize('50%');

    return splitterObject;
  }

  function createVertSplitter(parent, minSize, params) {
    params = params || {};

    var isTopDown = !params.backward;

    var traits = {
      primaryDivClass: params.primaryDivClass ||
        (isTopDown ? 'idvcsplitter_vert_primary' : 'idvcsplitter_vert_secondary'),
      splitterDivClass: params.splitterDivClass || 'idvcsplitter_vert_splitter',
      secondaryDivClass: params.secondaryDivClass ||
        (isTopDown ? 'idvcsplitter_vert_secondary' : 'idvcsplitter_vert_primary'),
      size: 'height',
      pos: isTopDown ? 'top' : 'bottom',
      offsetSize: 'offsetHeight',
      eventPos: 'pageY',
      backward: !isTopDown,
      refreshSizeByUserAction: params.refreshSizeByUserAction
    };

    return createSplitter(parent, minSize, params.splitterSize, traits);
  }

  function createHorzSplitter(parent, minSize, params) {
    params = params || {};

    var isLeftRight = !params.backward;

    var traits = {
      primaryDivClass: params.primaryDivClass ||
        (isLeftRight ? 'idvcsplitter_horz_primary' : 'idvcsplitter_horz_secondary'),
      splitterDivClass: params.splitterDivClass || 'idvcsplitter_horz_splitter',
      secondaryDivClass: params.secondaryDivClass ||
        (isLeftRight ? 'idvcsplitter_horz_secondary' : 'idvcsplitter_horz_primary'),
      size: 'width',
      pos: isLeftRight ? 'left' : 'right',
      offsetSize: 'offsetWidth',
      eventPos: 'pageX',
      backward: !isLeftRight,
      refreshSizeByUserAction: params.refreshSizeByUserAction
    };

    return createSplitter(parent, minSize, params.splitterSize, traits);
  }

  function processTooltip(el, tooltipObj, delay) {
    if (!tooltipObj) return;

    var mainTooltipElement = getDomElement(el);
    if (!mainTooltipElement) return;

    var tooltipInfo = {tooltip: null, timer: null};
    var lastMouseEvent;
    var hideTimeout;

    var hideNextTooltip;
    var clearHideNextTooltip;

    var hideTooltip = function(hideInterval) {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = undefined;
      }

      if (tooltipInfo.tooltip) {
        document.body.removeChild(tooltipInfo.tooltip);
      }

      if (hideInterval) {
        hideNextTooltip = true;
        if (!clearHideNextTooltip) {
          clearHideNextTooltip = createAsyncCall(function() {
            hideNextTooltip = undefined;
          }, window, hideInterval);
        }

        clearHideNextTooltip.call();
      }

      if (tooltipInfo.timer) {
        window.clearTimeout(tooltipInfo.timer);
        tooltipInfo.timer = null;
      }

      tooltipInfo.tooltip = null;
      clearTooltipElement();
    };

    var hideTooltipByMouseOut = function() {
      hideTooltip();
      tooltipObj.getInfo(undefined, 0, 0);
    };

    var showTooltip = function(text, x, y, style) {
      if (hideNextTooltip) return;

      tooltipInfo.timer = undefined;

      var tooltip = tooltipObj.create(this, text);
      if (!tooltip) return;

      applyObjectProperties(tooltip.style, style);

      setTooltipPos(tooltip, x, y);
      tooltipInfo.tooltip = tooltip;
    };

    function setTooltipElement(element) {
      if (tooltipInfo.elem &&
          tooltipInfo.elem !== element &&
          tooltipInfo.elem !== mainTooltipElement) {
        clearTooltipElement();
      }

      if (element &&
          element !== tooltipInfo.elem &&
          element !== mainTooltipElement) {
        element.addEventListener('mouseout', hideTooltipByMouseOut, false);
      }

      tooltipInfo.elem = element;
    }

    function clearTooltipElement() {
      if (tooltipInfo.elem &&
          tooltipInfo.elem !== mainTooltipElement) {
        tooltipInfo.elem.removeEventListener('mouseout', hideTooltipByMouseOut, false);
        tooltipInfo.elem = null;
      }
    }

    function setAutoHide(autoHideDelay) {
      if (hideTimeout) clearTimeout(hideTimeout);

      hideTimeout = undefined;
      if (autoHideDelay > 0) {
        hideTimeout = setTimeout(function() {
          hideTimeout = undefined;
          hideTooltip();
        }, autoHideDelay);
      }
    }

    var setTooltipPos = function(tooltip, tooltipX, tooltipY) {
      if (tooltipX === undefined) tooltipX = lastMouseEvent.pageX;
      if (tooltipY === undefined) tooltipY = lastMouseEvent.pageY;

      if (!tooltipObj.simpleMode) {
        tooltip.classList.remove('idvcgrid_tooltip_ellipsis');
        tooltip.style.height = '';
      }

      if (tooltip.offsetWidth > 0.8 * window.innerWidth) {
        tooltip.style.height = 'auto';
        tooltip.style.width = Math.floor(0.8 * window.innerWidth) + 'px';
      }

      var cs = window.getComputedStyle(tooltip, null);

      var marginLeft = parseInt(cs.getPropertyValue('margin-left'), 10);
      var rightOffset = 6;
      var tooltipLeft = tooltipX;
      if (tooltipLeft < 0) tooltipLeft = 0;
      else if (tooltipLeft + marginLeft + tooltip.offsetWidth + rightOffset >
          window.innerWidth + window.scrollX) {
        tooltipLeft = window.innerWidth +
          window.scrollX - tooltip.offsetWidth - marginLeft - rightOffset;
      }

      var marginTop = parseInt(cs.getPropertyValue('margin-top'), 10);
      var bottomOffset = 2;
      var tooltipTop = tooltipY;
      if (tooltipTop < 0) tooltipTop = 0;
      if (tooltipTop + tooltip.offsetHeight + marginTop + bottomOffset >
          window.innerHeight + window.scrollY) {
        tooltipTop = window.innerHeight +
          window.scrollY - tooltip.offsetHeight - marginTop - bottomOffset;

        if (!tooltipObj.simpleMode && tooltipTop < 3) {
          tooltipTop = 1;
          var newHeight = window.innerHeight - tooltipTop -
            2 * (parseInt(cs.getPropertyValue('padding-top'), 10) + bottomOffset);
          tooltip.style.height = newHeight + 'px';
          tooltip.classList.add('idvcgrid_tooltip_ellipsis');

          if (tooltip.style.lineHeight) {
            var lineHeight = parseInt(tooltip.style.lineHeight);
            if (lineHeight > newHeight) {
              tooltip.style.lineHeight = tooltip.style.height;
            }
          }
        }
      }

      if (!tooltipObj.ignoreOverlapping &&
          tooltipLeft < tooltipX - 0.5 * marginLeft &&
          tooltipTop < tooltipY - 0.5 * marginTop) {
        var altTooltipLeft = tooltipX - rightOffset - 1.5 * marginLeft - tooltip.offsetWidth;
        if (altTooltipLeft >= 0) {
          tooltipLeft = altTooltipLeft;
        } else {
          var altTooltipTop = tooltipY - bottomOffset - 1.5 * marginTop - tooltip.offsetHeight;
          if (altTooltipTop >= 0) {
            tooltipTop = altTooltipTop;
          }
        }
      }

      tooltip.style.left = tooltipLeft + 'px';
      tooltip.style.top = tooltipTop + 'px';
    };

    function processTooltip(e) {
      var needUpdateTooltip = tooltipObj.needUpdate ||
                              function(curEl, newEl) { return curEl !== newEl;};

      e = e || event;

      lastMouseEvent = e;

      if (!needUpdateTooltip(tooltipInfo.elem, e.target, e.pageX, e.pageY)) {
        return;
      }

      var info = tooltipObj.getInfo(e.target, e.pageX, e.pageY);
      if (info) {
        if (info.keepCurrent && tooltipInfo.tooltip) {
          if (info.tracking) {
            if (info.text) {
              tooltipInfo.tooltip.innerHTML = info.text;
            }
            setTooltipPos(tooltipInfo.tooltip, e.pageX, e.pageY);
          }
        } else {
          hideTooltip();

          if (info.text) {
            var tooltipDelay = info.delay !== undefined ?
                              info.delay :
                              delay;

            setTooltipElement(info.target);
            tooltipInfo.timer = window.setTimeout(
              showTooltip.bind(info.target, info.text, info.x, info.y, info.style),
              tooltipDelay);
          }
        }

        if (tooltipInfo.tooltip) {
          applyObjectProperties(tooltipInfo.tooltip.style, info.style);
        }

        if (!hideTimeout) setAutoHide(info.autoHideDelay);
      } else if (tooltipInfo.tooltip) {
        hideTooltip();
      }
    }

    mainTooltipElement.addEventListener('mouseout', hideTooltipByMouseOut, false);
    mainTooltipElement.addEventListener('mousemove', processTooltip, false);

    return {
      show: function(el, text, x, y, autoHideDelay, style) {
        setTooltipElement(el);
        if (tooltipInfo.tooltip) {
          tooltipInfo.tooltip.innerHTML = text;
          applyObjectProperties(tooltipInfo.tooltip.style, style);
          setTooltipPos(tooltipInfo.tooltip, x, y);
        } else {
          showTooltip(text, x, y, style);
        }

        setAutoHide(autoHideDelay);
      },
      hide: function(hideInterval) {
        hideTooltip(hideInterval);
      },
      update: function() {
        if (tooltipInfo.tooltip) {
          setTimeout(processTooltip.bind(this, lastMouseEvent), 0);
        }
      },
      getTooltipDOMElement: function() {
        if (tooltipInfo) return tooltipInfo.tooltip;

        return undefined;
      },
      getParentDOMElement: function() {
        if (tooltipInfo) return tooltipInfo.elem;

        return undefined;
      }
    };
  }

  function createTooltipDiv(text, style) {
    if (!text || !text.length) {
      return undefined;
    }

    var tooltip = document.createElement('div');
    tooltip.className = 'idvcgrid_popup idvcgrid_tooltip';
    if (style) tooltip.classList.add(style);
    tooltip.innerHTML = text;

    document.body.appendChild(tooltip);

    return tooltip;
  }

  function addTooltip(el, tooltipText, needUpdateTooltip, style) {
    return processTooltip(el, {
      needUpdate: function(curElem, newElem, x, y) {
        needUpdateTooltip = needUpdateTooltip ||
                            function(curEl, newEl) { return curEl !== newEl;};

        return needUpdateTooltip(curElem, newElem);
      },
      getInfo: function(el, x, y) {
        var result;
        var text;
        if (typeof tooltipText === 'function') {
          text = tooltipText(el, x, y);
        } else {
          text = tooltipText;
        }

        if (text) {
          if (typeof text === 'object') {
            result = {};
            applyObjectProperties(result, text);
          } else {
            result = {
              text: text,
              target: el
            };
          }
        }

        return result;
      },
      create: function(elem, text) {
        var tooltip = createTooltipDiv(text, style);
        var cs = window.getComputedStyle(document.body, null);
        setFont(tooltip, cs);

        return tooltip;
      }
    }, 250);
  }

  function copyAppearance(tooltip, elemStyle, background) {
    if (!tooltip || !elemStyle) return;

    setFont(tooltip, elemStyle);

    tooltip.style.paddingLeft = elemStyle.paddingLeft;
    tooltip.style.paddingTop = elemStyle.paddingTop;
    tooltip.style.paddingRight = elemStyle.paddingRight;
    tooltip.style.paddingBottom = elemStyle.paddingBottom;

    tooltip.style.borderTopStyle = elemStyle.borderTopStyle;
    tooltip.style.borderTopWidth = elemStyle.borderTopWidth;
    tooltip.style.borderRightStyle = elemStyle.borderRightStyle;
    tooltip.style.borderRightWidth = elemStyle.borderRightWidth;
    tooltip.style.borderBottomStyle = elemStyle.borderBottomStyle;
    tooltip.style.borderBottomWidth = elemStyle.borderBottomWidth;
    tooltip.style.borderLeftStyle = elemStyle.borderLeftStyle;
    tooltip.style.borderLeftWidth = elemStyle.borderLeftWidth;

    tooltip.style.color = elemStyle.color;
    tooltip.style.borderColor = background || elemStyle.backgroundColor;
    tooltip.style.backgroundColor = background || elemStyle.backgroundColor;
    tooltip.style.backgroundImage = elemStyle.backgroundImage;
    tooltip.style.backgroundRepeat = elemStyle.backgroundRepeat;
    tooltip.style.backgroundPosition = elemStyle.backgroundPosition;
    tooltip.style.backgroundOrigin = elemStyle.backgroundOrigin;
  }

  function copyContent(elem, tooltip, background, process, isVerical) {
    if (!elem || !tooltip) return;

    process = process || function(from, to) {
      to.innerHTML = from.innerHTML;
    };

    process(elem, tooltip);
    var elemStyle = window.getComputedStyle(elem, null);

    tooltip.style.boxSizing = elemStyle.boxSizing;
    tooltip.style.lineHeight = elemStyle.lineHeight;

    if (!isVerical) tooltip.style.height = elemStyle.height;
    else tooltip.style.width = elemStyle.width;

    copyAppearance(tooltip, elemStyle, background);
  }

  function addExpansion(el, processTarget, background, expandVerical) {
    processTarget = processTarget || function(el) {return el;}

    var sizeChecker;
    if (!expandVerical) {
      sizeChecker = {
        check: function(elem, tooltip) {
          if (!elem || !tooltip) return false;

          var overPos = getElementPos(elem);
          var overWidth = elem.offsetWidth;
          if (overPos.x + overWidth > window.innerWidth + window.scrollX) {
            overWidth = window.innerWidth + window.scrollX - overPos.x;
          }

          return tooltip.offsetWidth - 1 > overWidth;
        }
      };
    } else {
      sizeChecker = {
        check: function(elem, tooltip) {
          if (!elem || !tooltip) return false;

          var overPos = getElementPos(elem);
          var overHeight = elem.offsetHeight;
          if (overPos.y + overHeight > window.innerHeight + window.scrollY) {
            overHeight = window.innerHeight + window.scrollY - overPos.y;
          }

          return tooltip.offsetHeight - 1 > overHeight;
        }
      }
    }

    var tooltipProcessor = processTooltip(el, {
      ignoreOverlapping: true,
      simpleMode: true,
      needUpdate: function(curElem, newElem) {
        return curElem !== newElem;
      },
      getInfo: function(elem, x, y) {
        elem = processTarget(elem, x, y);

        if (elem) {
          var elemPos = getElementPos(elem);

          return {
              x: elemPos.x,
              y: elemPos.y,
              target: elem,
              text: 'exp'
            };
        }

        return undefined;
      },
      create: function(elem) {
        var tooltipText = elem.innerHTML;
        if (!tooltipText.length) {
          return undefined;
        }

        var tooltip = document.createElement('div');
        tooltip.className = 'idvcgrid_popup';

        copyContent(elem, tooltip, background, result.processContent, expandVerical);

        document.body.appendChild(tooltip);

        if (result.afterCreateTooltip) result.afterCreateTooltip(tooltip);

        if (sizeChecker.check(elem, tooltip)) {
          return tooltip;
        } else {
          document.body.removeChild(tooltip);
          return undefined;
        }
      }
    }, 50);

    var result = {
      update: function() {
        copyContent(tooltipProcessor.getParentDOMElement(), tooltipProcessor.getTooltipDOMElement());
      },
      hide: function() {
        tooltipProcessor.hide();
      }
    };

    return result;
  }


  function buildHierarchy(parentEl, hierarchGen, processHTML, beforeExpand, afterExpand) {
    var HierarchyContainerClass = 'idvc_hierarchy_container';
    var HierarchyCaptionClass = 'idvc_hierarchy_caption';
    var HierarchyLeafClass = 'idvc_hierarchy_leaf';
    var HierarchyBodyClass = 'idvc_hierarchy_body';
    var HierarchyExpanded = 'idvc_hierarchy_expanded';

    function buildHierarchyLevel(parent, parentObj, processHTML) {
      function addHierarchyHTML(parent, hasChildren) {
        var expandItem = document.createElement('div');

        var body, container, root;

        if (hasChildren) {
          expandItem.className = HierarchyCaptionClass;

          container = document.createElement('div');
          container.className = HierarchyContainerClass;
          container.appendChild(expandItem);

          body = document.createElement('div');
          body.className = HierarchyBodyClass;
          container.appendChild(body);

          root = container;
        } else {
          expandItem.className = HierarchyLeafClass;

          root = expandItem;
        }

        parent.appendChild(root);

        return { expand: expandItem, body: body, container: container };
      }

      if (!parent || !parentObj) return;

      var objs = parentObj.children;
      if (!Array.isArray(objs)) return;

      objs.forEach(function(obj) {
        var html = addHierarchyHTML(parent, obj.hasChildren || obj.children && obj.children.length);
        var ignoreDefault = processHTML(html, obj, parentObj);

        var expand = html.expand;

        if (!ignoreDefault) {
          if (obj.expanded) expand.classList.add(HierarchyExpanded);
          if (obj.className) expand.classList.add(obj.className);
        }

        if (obj.expanded) buildHierarchyLevel(html.body, getObj(obj), processHTML);
        else expand.hierarchicalObj = obj;
      });
    }

    function addHierarchyEventsProcessing(parent, beforeExpand, afterExpand) {
      beforeExpand = beforeExpand || function(){ return false; };
      afterExpand = afterExpand || function(){};
      parent = parent || document;

      parent.addEventListener('click', function(e) {
        e = e || window.event;
        var element = e.target;
        while (element &&
               element.classList &&
               !element.classList.contains(HierarchyCaptionClass)) {
          element = element.parentNode;
        }

        if (element &&
            element.classList &&
            element.classList.contains(HierarchyCaptionClass) &&
            !beforeExpand(element, element.classList.contains(HierarchyExpanded))) {
          if (element.hierarchicalObj) {
            buildHierarchyLevel(element.nextElementSibling, getObj(element.hierarchicalObj), processHTML);
            delete element.hierarchicalObj;
          }
          element.classList.toggle(HierarchyExpanded);
          afterExpand(element);
        }
      });
    }

    var parent = getDomElement(parentEl);

    processHTML = processHTML || function(html, obj){
      if (!html || !html.expand || !obj) return;

      var expand = html.expand;

      if (obj.html || obj.displayName) expand.innerHTML = obj.html || obj.displayName;
    };

    function getObj(obj) {
      var result = obj;

      if (typeof hierarchGen === 'function') {
        result = hierarchGen(obj);
      }

      return result;
    }

    var obj = getObj(hierarchGen);
    if (Array.isArray(obj)) {
      obj = {
        children: obj
      };
    }

    buildHierarchyLevel(parent, obj, processHTML);
    addHierarchyEventsProcessing(parent, beforeExpand, afterExpand);
  }

  function getTextWidth(elem, text) {
    var testDiv = document.createElement('div');
    testDiv.className = 'idvcgrid_popup';

    copyContent(elem, testDiv);

    document.body.appendChild(testDiv);

    var result = testDiv.offsetWidth;

    document.body.removeChild(testDiv);

    return result;
  }

  function disableElement(elem, text, needDisable) {
    needDisable = needDisable || function() {return true;}

    if (!needDisable()) {
      return {
        disabler: disabler,
        disabled: disabled,
        end: function() {}
      };
    }

    var disabler = null;
    var disabled = getDomElement(elem);
    if (disabled) {
      disabler = document.createElement('div');
      disabler.className = 'idvcgrid_disabler';

      disabled.appendChild(disabler);

      if (text) {
        disabler.innerText = text;
      }

      disabler.getBoundingClientRect(); //recalculate layout
    }

    return {
      disabler: disabler,
      disabled: disabled,
      end: function() {
        if (disabler.parentNode) {
          disabler.parentNode.removeChild(disabler);
        }
      }
    };
  }

  function makeCaption(str1, str2) {
    var result = '<b>' + str1 + '</b>';
    if (str2) {
      result += ' (' + str2 + ')';
    }
    return result;
  }

  function setFont(elem, styleSet, tuneSize) {
    if (elem && styleSet) {
      if (tuneSize) {
        // Round font size to the nearest smaller even value
        var size = parseInt(styleSet.fontSize);
        size = Math.floor(size / 2) * 2;
        elem.style.fontSize = size + 'px';
      } else {
        elem.style.fontFamily = styleSet.fontFamily;
        elem.style.fontSize = styleSet.fontSize;
      }

      elem.style.fontStyle = styleSet.fontStyle;
      elem.style.fontWeight = styleSet.fontWeight;
      elem.style.fontVariant = styleSet.fontVariant;
    }
  }

  function changeCursor(cursor) {
    var parent = document.createElement('div');
    parent.style.overflow = 'hidden';
    parent.style.position = 'absolute';
    parent.style.left = '0';
    parent.style.top = '0';
    parent.style.width = '100%';
    parent.style.height = '100%';

    var child = document.createElement('div');
    child.style.width = '120%';
    child.style.height = '120%';

    parent.appendChild(child);
    document.body.appendChild(parent);

    child.style.cursor = cursor;
    parent.scrollLeft = 1;
    parent.scrollLeft = 0;

    document.body.removeChild(parent);
  }

  function em2px(val, element) {
    element = element || document.documentElement;
    return val * parseFloat(getComputedStyle(element).fontSize);
  }

  function addClass(elem, className) {
    if (!elem || !className) return;

    var sep = ' ';
    var exist = elem.className.split(sep);
    var addition = className.split(sep).filter(function(name) {
      return (exist.indexOf(name) === -1);
    }).join(sep);
    if (addition.length) elem.className += ' ' + addition;
  }

  function removeClass(elem, className) {
    if (!elem || !className) return;

    var sep = ' ';
    var removing = className.split(sep);
    elem.className = elem.className.split(sep).filter(function(name) {
      return (removing.indexOf(name) === -1);
    }).join(sep);
  }

  function getParentByClass(elem, className) {
    while (elem && !elem.classList.contains(className)) {
      elem = elem.parentElement;
    }

    return elem;
  }

  function animate(onAnimationProcess, onEndAnimation) {
    var requestAnimationFrame = window.requestAnimationFrame ||
                                window.mozRequestAnimationFrame ||
                                window.webkitRequestAnimationFrame ||
                                window.msRequestAnimationFrame;

    if (!requestAnimationFrame) return;

    var startTimestamp;
    function step(timestamp) {
      if (!startTimestamp) {
        startTimestamp = timestamp;
        requestAnimationFrame(step);
      } else {
        var progress = timestamp - startTimestamp;
        if (onAnimationProcess(progress)) {
          requestAnimationFrame(step);
        } else if (onEndAnimation) {
          onEndAnimation(progress);
        }
      }
    }

    requestAnimationFrame(step);
  }

  function dispatchMouseEvent(pos, name, elem, params) {
    name = name || 'click';
    pos = pos || {x: 0, y: 0};
    if (pos.x === undefined) pos.x = 0;
    if (pos.y === undefined) pos.y = 0;

    var eventInit = {
      'view': window,
      'bubbles': true,
      'cancelable': true,
      'screenX': pos.x,
      'screenY': pos.y,
      'clientX': pos.x,
      'clientY': pos.y
    };

    applyObjectProperties(eventInit, params);

    elem = elem || document.elementFromPoint(pos.x, pos.y) || window;

    var event;

    try {
      event = new MouseEvent(name, eventInit);
    }
    catch(e) {
      event = document.createEvent('MouseEvents');
      event.initMouseEvent(name, true, true, window, 0, pos.x, pos.y, pos.x, pos.y, false, false, false, false, 0, null);
    }

    event.simulation = true;

    elem.dispatchEvent(event);
  }

  function dispatchElementMouseEvent(name, elem) {
    if (!elem) return;

    var elemPos = getElementPos(elem);

    var pos = {
      x: elemPos.x + elemPos.width / 2,
      y: elemPos.y + elemPos.height / 2
    };

    dispatchMouseEvent(pos, name, elem);
  }

  var disableHoverClass = 'idvc_disable_hover';

  function disableHover(elem) {
    if (elem &&
        !elem.classList.contains(disableHoverClass)) {
      elem.classList.add(disableHoverClass);
    }
  }

  function enableHover(elem) {
    if (elem ) {
      elem.classList.remove(disableHoverClass);
    }
  }

  function createAsyncCall(func, thisArg, delay) {
    delay = delay || 0;
    thisArg = thisArg || window;
    func = func || function() {};

    var timeout;
    return {
      call: function() {
        this.cancel();

        var args = arguments;
        timeout = setTimeout(function() {
          func.apply(thisArg, args);
          timeout = undefined;
        }, delay);
      },
      cancel: function() {
        if (timeout) {
          clearTimeout(timeout);
          timeout = undefined;
        }
      },
      isCalled: function() {
        return !!timeout;
      },
      setFunction: function(f) {
        func = f || function() {};
      },
      setThisArg: function(arg) {
        thisArg = arg || window;
      },
      setDelay: function(newDelay) {
        delay = newDelay;
      }
    };
  }


  var disabledLogging = function () { };
  var _log;

  function consoleLog() {
    if (typeof _log === 'function') {
      _log.apply(this, arguments);
    }
  }

  consoleLog.enable = function() {
    _log = console.log.bind(console);
  };
  consoleLog.disable = function() {
    _log = disabledLogging;
  };
  consoleLog.set = function(log) {
    _log = log;
  };

  consoleLog.disable();

  function applyObjectProperties(elem, obj) {
    if (!elem || !obj || (typeof obj !== 'object')) return;

    Object.getOwnPropertyNames(obj).forEach(function(prop) {
      if (typeof obj[prop] === 'object' &&
          !isHTMLNode(obj[prop])) {
        if (!elem[prop]) {
          if (Array.isArray(obj[prop])) elem[prop] = [];
          else elem[prop] = {};
        }
        applyObjectProperties(elem[prop], obj[prop]);
      } else if (prop === 'className' && elem.classList) {
        elem.classList.add(obj.className);
      } else {
        elem[prop] = obj[prop];
      }
    });
  }

  function copyObject(from, to, accepted) {
    if (!from || !to || (typeof to !== 'object')) return;

    accepted = accepted || function() { return true; };

    Object.getOwnPropertyNames(from).forEach(function(prop) {
      if (isSystemProp(prop)) return;

      var fromProp = from[prop];
      if (typeof fromProp === 'function' || !accepted(fromProp, prop)) return;

      if (typeof fromProp === 'object') {
        if (isHTMLNode(fromProp)) return;

        if (!to[prop]) {
          if (Array.isArray(fromProp)) to[prop] = [];
          else to[prop] = {};
        }
        copyObject(fromProp, to[prop], accepted);
      } else {
        to[prop] = fromProp;
      }
    });
  }

  function isHTMLNode(obj) {
    return obj instanceof Node &&
      obj.nodeType !== undefined &&
      obj.nodeName !== undefined;
  }

  function isSystemProp(prop) {
    var len = prop.length;
    if (len > 4) return prop[0] === '_' && prop[1] === '_' && prop[len - 1] === '_' && prop[len - 2] === '_';

    return false;
  }

  function createSequence() {
    var index = -1;
    var doIndex = -1;
    var isCall = false;
    var isCanceled = false;
    var steps = [];
    var tmpResult;

    var defTimeout = 0;

    function clear() {
      steps.length = 0;
      index = doIndex = -1;
      isCanceled = false;
      tmpResult = undefined;
      isCall = false;
    }

    function doCall(proc) {
      if (!proc) return;

      isCanceled = false;
      isCall = true;
      index++;
      doIndex = index;

      if (tmpResult !== undefined)
        proc(tmpResult);
      else
        proc();
    }

    function simpleFunc(func) {
      func();
      this.end();
    }

    return {
      do: function(proc) {
        if (!proc) return;

        steps.splice(doIndex + 1, 0, proc);
        doIndex++;
        if (!isCall) {
          doCall(proc);
        }

        return this;
      },
      do_: function(proc) {
        return this.do(simpleFunc.bind(this, proc));
      },
      end: function(result) {
        if (!isCall) return;

        tmpResult = result;
        isCall = false;

        if (index < steps.length - 1) {
          doCall(steps[index + 1]);
        } else {
          // the last step is done
          clear();
        }

        return this;
      },
      end_: function(result) {
        setTimeout(this.end.bind(this, result), defTimeout);
        return this;
      },
      nextStep: function(proc) {
        if (isCanceled) {
          return this.end();
        } else {
          setTimeout(proc, defTimeout);
          return this;
        }
      },
      cancel: function() {
        if (isCall) {
          isCanceled = true;
          steps.splice(index + 1);
        } else {
          clear();
        }

        return this;
      },
      canceled: function() {
        return isCanceled;
      },
      forEach: function(array, proc, stepCount) {
        if (!Array.isArray(array)) return;

        stepCount = stepCount || array.length;
        var restCount = array.length;
        var startIndex = 0;

        if (restCount > stepCount) processItems.call(this);
        else {
          processStep();
          this.end();
        }

        function processItems() {
          if (isCanceled) {
            this.end();
            return;
          }

          processStep();

          restCount -= stepCount;
          startIndex += stepCount;

          if (restCount > 0) this.nextStep(processItems.bind(this));
          else this.end();
        }

        function processStep() {
          for (var i = startIndex, len = startIndex + Math.min(restCount, stepCount); i < len; i++) {
            proc(array[i], i, array);
          }
        }
      }
    };
  };

  function createCounter(start) {
    start = start || 0;

    var current = start;

    return {
      next: function() {
        ++current;
        if (current < start) current = ++start;
        return current;
      },
      get: function() {
        return current;
      }
    }
  }

  function removeAllChildren(el) {
    if (!el) return;

    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  function addWindowResizeListener(elem, param) {
    param = param || {height: true, width: true};

    var processWindowResize = refreshSize.bind(undefined, elem, param);

    window.addEventListener('resize', processWindowResize, false);

    return {
      remove: function() {
        window.removeEventListener('resize', processWindowResize, false);
        processWindowResize = undefined;
      }
    };
  }

  return {
    Consts: Consts,
    appendCSS: appendCSS,
    appendScript: appendScript,
    applyUAFont: applyUAFont,
    getScrollbarSize: getScrollbarSize,
    createElement: createElement,
    getElementById: getElementById,
    round: round,
    floor: floor,
    ceil: ceil,
    roundExp: roundExp,
    getElementPos: getElementPos,
    defaultCompareItems: defaultCompareItems,
    format: format,
    curry: curry,
    curryThis: curryThis,
    compose: compose,
    composeThis: composeThis,
    getDomElement: getDomElement,
    refreshSize: refreshSize,
    createResizeProcess: createResizeProcess,
    createVertSplitter: createVertSplitter,
    createHorzSplitter: createHorzSplitter,
    addTooltip: addTooltip,
    copyAppearance: copyAppearance,
    addExpansion: addExpansion,
    buildHierarchy: buildHierarchy,
    getTextWidth: getTextWidth,
    disableElement: disableElement,
    makeCaption: makeCaption,
    setFont: setFont,
    changeCursor: changeCursor,
    em2px: em2px,
    addClass: addClass,
    removeClass: removeClass,
    getParentByClass: getParentByClass,
    animate: animate,
    dispatchMouseEvent: dispatchMouseEvent,
    dispatchElementMouseEvent: dispatchElementMouseEvent,
    disableHover: disableHover,
    enableHover: enableHover,
    createAsyncCall: createAsyncCall,
    consoleLog: consoleLog,
    applyObjectProperties: applyObjectProperties,
    copyObject: copyObject,
    isHTMLNode: isHTMLNode,
    createSequence: createSequence,
    createCounter: createCounter,
    removeAllChildren: removeAllChildren,
    addWindowResizeListener: addWindowResizeListener
  };

});
