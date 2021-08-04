define(['../idvcjs/utils'], function(Utils) {

var processors = [];
var defProcessor;

function getText(target, x, y) {
  var result;

  var procFound = processors.some(function(processor) {
    if (!processor) return;

    if (processor.accept(target, x, y)) {
      result = processor.getText(target, x, y);
      return true;
    }

    return false;
  });

  return !procFound && defProcessor.accept(target, x, y) ? defProcessor.getText(target, x, y) : result;
};

var tooltipAttr = 'data-tooltip';

var stdTooltip = Utils.addTooltip(document.body, function(elem) {
  if (elem) return elem.getAttribute(tooltipAttr);

  return undefined;
});

function setExplanationPos(elem, explanation) {
  var padding = 2;
  var elemPos = Utils.getElementPos(elem);

  explanation.style.left = (elemPos.x + elemPos.width + padding) + 'px';
  explanation.style.top = (elemPos.y - padding) + 'px';
}

function addExplanation(elem, explanationText) {
  if (!explanationText) return;

  var explanation = Utils.createElement('?', 'explanation_symbol', '', document.body, 'div', function(expl) {
    var elemStyle = window.getComputedStyle(elem, null);
    expl.setAttribute(tooltipAttr, explanationText);
    Utils.setFont(expl, elemStyle);
  });

  setExplanationPos(elem, explanation);

  return explanation;
}

function updateDecorationPos() {
  var focused = document.activeElement;
  if (focused && focused.rooflineExplanation) {
      setExplanationPos(focused, focused.rooflineExplanation);
  }

  if (focused && focused.rooflinePopup) {
      setPopupPos(focused, focused.rooflinePopup);
  }
}

window.addEventListener('resize', function() {
  updateDecorationPos();
  Utils.refreshSize(document.body);
}, false);

var settingsContent = Utils.getElementById('roofline_settings');
settingsContent.onscroll = updateDecorationPos;

var settingsBtn = document.getElementById('roofline_menu_button');
settingsBtn.onclick = function() {
  var focused = document.activeElement;
  if (focused && focused.rooflineExplanation) {
    focused.blur();
  }

  settingsContent.classList.toggle('visible');
  settingsBtn.classList.toggle('close');
}

function setPopupPos(elem, popup) {
  var elemPos = Utils.getElementPos(elem);
  var popupPos = Utils.getElementPos(popup);

  popup.style.left = elemPos.x + 'px';

  var offset = 1;

  var topPos = elemPos.y + elemPos.height + offset;
  if (topPos + popupPos.height < window.innerHeight + window.scrollY) {
    popup.style.top = topPos + 'px';
  } else {
    popup.style.top = (elemPos.y - popupPos.height - offset) + 'px';
  }

  popup.style.minWidth = elemPos.width + 'px';
}

function setPopupIndex(popup, index) {
  if (!popup) return;

  var oldIndex = popup.rooflineIndex;
  if (oldIndex >= 0) {
    var oldItem = popup.children[oldIndex];
    if (oldItem) oldItem.classList.remove('selected');
  }

  if (index >= 0) {
    var newItem = popup.children[index];
    if (newItem) {
      newItem.classList.add('selected');
      if (newItem.offsetTop < popup.scrollTop) newItem.scrollIntoView(true);
      else if (newItem.offsetTop + newItem.offsetHeight > popup.offsetHeight + popup.scrollTop) newItem.scrollIntoView(false);

      if (window.scrollY) window.scrollTo(0, 0);
    }
  }

  popup.rooflineIndex = index;
}

var setPopup = (function() {
  var popupElement;
  var valueAttr = 'data-value';

  function hidePopup() {
    popupElement.style.display = 'none';
    if (popupElement.rooflineElement) {
      delete popupElement.rooflineElement.rooflinePopup;
      delete popupElement.rooflineElement;
    }
  }

  document.addEventListener('click', function(e) {
    if (popupElement && popupElement.rooflineElement &&
        popupElement.rooflineElement !== e.target) {
      hidePopup();
    }
  }, false);

  return function(elem, items, callback, decorate) {
    if (!elem) return;

    callback = callback || function() {};
    decorate = decorate || function(item) { return item; };

    if (!popupElement) {
      popupElement = Utils.createElement('', 'roofline_popup', '', document.body, 'ul');
      popupElement.addEventListener('click', function(e) {
        if (!e.target ||
            (e.target.nodeName.toLowerCase() !== 'li')) {
          return;
        }
        var val = e.target.getAttribute(valueAttr);
        if (popupElement.rooflinePopupCallback) popupElement.rooflinePopupCallback(val);
        hidePopup();
      });
    } else if (popupElement.rooflineElement &&
              popupElement.rooflineElement !== elem) {
      delete popupElement.rooflineElement.rooflinePopup;
    }

    popupElement.rooflinePopupCallback = callback;

    popupElement.innerHTML = items.map(function(item) {
      return '<li ' + valueAttr + '="' + item + '">' + decorate(item) + '</li>';
    }).join('');

    if (items.length) {
      elem.rooflinePopup = popupElement;
      popupElement.rooflineElement = elem;

      popupElement.style.display = 'block';

      setPopupPos(elem, popupElement);
      setPopupIndex(popupElement, 0);
    } else {
      hidePopup();
    }
  }
})();

function addPopupNavigation(editor) {
  function popupIndexUp(popup) {
    if (!popup) return;

    var oldIndex = popup.rooflineIndex;
    if (oldIndex > 0) {
      setPopupIndex(popup, --oldIndex);
    }
  }

  function popupIndexDown(popup) {
    if (!popup) return;

    var oldIndex = popup.rooflineIndex;
    if (oldIndex < popup.children.length - 1) {
      setPopupIndex(popup, ++oldIndex);
    }
  }

  function popupIndexSelect(popup) {
    if (!popup) return;

    var index = popup.rooflineIndex;
    if (index >= 0) {
      var curItem = popup.children[index];
      if (curItem) curItem.click();
    }
  }

  editor.addEventListener('keydown', function(e) {
    var popup = editor.rooflinePopup;
    if (!popup) return;

    switch (e.keyCode) {
      case 13: popupIndexSelect(popup); e.preventDefault(); break;
      case 27: setPopup(editor, []); e.preventDefault(); break;
      case 38: popupIndexUp(popup); e.preventDefault(); break;
      case 40: popupIndexDown(popup); e.preventDefault(); break;
    }
  }, false);

  editor.addEventListener('blur', function(e) {
    setPopup(editor, []);
  }, false);
}

var colorNames = ['AliceBlue','AntiqueWhite','Aqua','Aquamarine','Azure','Beige','Bisque','Black','BlanchedAlmond','Blue','BlueViolet','Brown','BurlyWood','CadetBlue','Chartreuse','Chocolate','Coral','CornflowerBlue','Cornsilk','Crimson','Cyan','DarkBlue','DarkCyan','DarkGoldenRod','DarkGray','DarkGrey','DarkGreen','DarkKhaki','DarkMagenta','DarkOliveGreen','Darkorange','DarkOrchid','DarkRed','DarkSalmon','DarkSeaGreen','DarkSlateBlue','DarkSlateGray','DarkSlateGrey','DarkTurquoise','DarkViolet','DeepPink','DeepSkyBlue','DimGray','DimGrey','DodgerBlue','FireBrick','FloralWhite','ForestGreen','Fuchsia','Gainsboro','GhostWhite','Gold','GoldenRod','Gray','Grey','Green','GreenYellow','HoneyDew','HotPink','IndianRed','Indigo','Ivory','Khaki','Lavender','LavenderBlush','LawnGreen','LemonChiffon','LightBlue','LightCoral','LightCyan','LightGoldenRodYellow','LightGray','LightGrey','LightGreen','LightPink','LightSalmon','LightSeaGreen','LightSkyBlue','LightSlateGray','LightSlateGrey','LightSteelBlue','LightYellow','Lime','LimeGreen','Linen','Magenta','Maroon','MediumAquaMarine','MediumBlue','MediumOrchid','MediumPurple','MediumSeaGreen','MediumSlateBlue','MediumSpringGreen','MediumTurquoise','MediumVioletRed','MidnightBlue','MintCream','MistyRose','Moccasin','NavajoWhite','Navy','OldLace','Olive','OliveDrab','Orange','OrangeRed','Orchid','PaleGoldenRod','PaleGreen','PaleTurquoise','PaleVioletRed','PapayaWhip','PeachPuff','Peru','Pink','Plum','PowderBlue','Purple','Red','RosyBrown','RoyalBlue','SaddleBrown','Salmon','SandyBrown','SeaGreen','SeaShell','Sienna','Silver','SkyBlue','SlateBlue','SlateGray','SlateGrey','Snow','SpringGreen','SteelBlue','Tan','Teal','Thistle','Tomato','Turquoise','Violet','Wheat','White','WhiteSmoke','Yellow','YellowGreen'];
function addColorPicker(editor, beforePopup) {
  if (!editor) return;

  beforePopup = beforePopup || function() { return true; };

  editor.addEventListener('input', function(e) {
    var inputText = e.target.value;
    var items = colorNames.filter(function(item) {
      return item.toLowerCase().indexOf(inputText.toLowerCase()) !== -1;
    });
    setPopup(editor, beforePopup(inputText, items) ? items : [],
      function(val) {
        editor.value = val;
        editor.oninput({target: editor});
      },
      function(item) {
        return '<div class="loop_sample loop_fixed_sample" style="background-color:' + item + '"></div>' + item;
      }
    );
  }, false);

  addPopupNavigation(editor);
}

function toast(msg) {
  var content = Utils.createElement(msg, 'roofline_toast', '', document.body);

  var parent = Utils.disableElement(document.body, '');
  parent.disabler.classList.add('roofline_toast_holder');
  parent.disabler.appendChild(content);

  function hideToast() {
    content.classList.remove('toast-show');

    setTimeout(function() {
      if (parent) {
        parent.end();
        parent = undefined;
      }
    }, 400);
  }

  setTimeout(function() {
    content.classList.add('toast-show');
  }, 0);

  var hideTimeout = setTimeout(hideToast, 5400);

  parent.disabler.addEventListener('click', function(e) {
    clearTimeout(hideTimeout);
    hideToast();
    e.stopPropagation();
    e.preventDefault();
  }, false);
}

function filterNumberInput(e) {
  function insertInput(str, posStart, posEnd, value) {
    return str.substr(0, posStart) + value + str.substr(posEnd);
  }

  var char = e.key || String.fromCharCode(e.charCode);
  if (e.charCode) {
    var currentText = e.target.value;
    var posStart = e.target.selectionStart;
    var posEnd = e.target.selectionEnd;
    var newText = insertInput(currentText, posStart, posEnd, char);
    return !isNaN(newText) && (+newText >= 0);
  }
}

//disable scroll when data is represented
window.onscroll = function() {
  if (!document.body.classList.contains('data_loading') &&
      !document.body.classList.contains('no_data')) {
    window.scrollTo(0, 0);
  }
};

document.body.onselectstart = function() {
  return false;
};

function flashElement(onstart, onend, endtimeout) {
  onstart = onstart || function() {};
  onend = onend || function() {};

  setTimeout(function() {
    onstart();

    setTimeout(function() {
      onend();
    }, endtimeout);
  }, 50);
}

function addExpansion(params, isEnabled) {
  isEnabled = isEnabled || function() {return true;};

  var sizes = [];
  var invisibleSize = 0;

  var movedElements = [];

  function recalcSizes() {
    revertElements();

    sizes = [];

    [].forEach.call(body.children, function(child) {
      if (child === expandBtn || child === expansion) return;

      sizes.push(child.offsetLeft + child.offsetWidth);
    });
  };

  function revertElements() {
    movedElements.forEach(function(element) {
      element.remove();
      body.insertBefore(element, expandBtn);
    });

    movedElements = [];
  }

  var expansion;
  var expanded = false;

  function createExpansion() {
    expansion = document.createElement('div');
    expansion.className = params.expansionClassName;

    body.appendChild(expansion);
  }

  function fillExpansion() {
    function isLineBreak(elem) {
      return elem && elem.classList.contains('br');
    }

    var clientWidth = body.clientWidth - expandBtn.clientWidth - expandPadding;

    var firstMoveIndex = -1;
    sizes.some(function(size, index) {
      if (size > clientWidth) {
        firstMoveIndex = index;
        invisibleSize = body.scrollWidth - clientWidth;
        return true;
      }
    });

    if (firstMoveIndex === sizes.length - movedElements.length) return;

    revertElements();
    Utils.removeAllChildren(expansion);

    if (firstMoveIndex >= 0) {
      var subBar;
      for (var i = firstMoveIndex, len = body.children.length - 2; i < len; i++) {
        var moved = body.children[firstMoveIndex];

        if (isLineBreak(moved) || !expansion.children.length) {
          subBar = document.createElement('div');
          expansion.appendChild(subBar);
        }

        body.removeChild(moved);
        subBar.appendChild(moved);

        movedElements.push(moved);
      }
    } else {
      invisibleSize = 0;
    }
  }

  var body = document.getElementById(params.bodyId);
  body.refreshSize = function(param) {
    if (!isEnabled()) {
      revertElements();
      return;
    }

    if (param && param.recalcSizes || !sizes.length) recalcSizes();

    var expandable = body.scrollWidth + invisibleSize > body.clientWidth;
    if (expandable) {
      body.classList.add('expandable');

      if (!expansion) createExpansion();
      fillExpansion();
    }

    if (!expandable || !movedElements.length) {
      body.classList.remove('expandable');
      if (expanded) expandBtn.click();
    }
  };

  var expandBtn = document.getElementById(params.expandBtnId);
  expandBtn.onclick = function() {
    expanded = !expanded;
    if (expanded) {

      if (!expansion) {
        createExpansion();
        fillExpansion();
      }

      expansion.style.display = 'block';
      expandBtn.classList.add('expanded');
    } else {
      expansion.style.display = 'none';
      expandBtn.classList.remove('expanded');
    }
  };

  var expandPadding = Utils.em2px(0.3, body);

  return {
    refreshSize: function() {
      body.refreshSize({recalcSizes: true});
    }
  };
}

function setAnimatedClick(btn, onclick, animation) {
  function createAnimationFn(animation) {
    var animationClass;
    var endAnimationClass;
    var clearClass;
    var animationDuration;

    if (typeof animation === 'string') {
      animationClass = animation;
    } else if (typeof animation === 'object') {
      animationClass = animation.className;
      clearClass = nimation.clearClassName;
      endAnimationClass = nimation.endAnimationClassName;
      animationDuration = animation.duration;
    }

    animationClass = animationClass || 'pressing';
    clearClass = clearClass || 'clear_animation';
    endAnimationClass = endAnimationClass || 'waiting';
    animationDuration = animationDuration || 200;

    var AnimationStates = {
      begin: 'begin',
      end: 'end',
      none: 'none'
    }

    var animationState = AnimationStates.begin;
    function stopAnimation(elem) {
      if (animationState === AnimationStates.none) {
        elem.classList.remove(animationClass);
        elem.classList.remove(endAnimationClass);
        elem.classList.add(clearClass);
      }
    }

    var notifyEndAnimation = function() {};

    function endAnimation(elem) {
      elem.classList.add(endAnimationClass);
      animationState = AnimationStates.end;
    }

    var wait = Utils.createAsyncCall(function() {
      if (animationState !== AnimationStates.begin) {
        stopAnimation(this);
        notifyEndAnimation();
      } else {
        endAnimation(this);
        wait.call();
      }
    }, undefined, animationDuration);

    return function(elem, onAnimationEnded) {
      if (onAnimationEnded) {
        animationState = AnimationStates.begin;

        notifyEndAnimation = onAnimationEnded || function() {};

        elem.classList.remove(clearClass);
        elem.classList.add(animationClass);
        wait.setThisArg(elem);
        wait.call();
      } else {
        if (animationState !== AnimationStates.begin) {
          animationState = AnimationStates.none;
          stopAnimation(elem);
        } else {
          animationState = AnimationStates.none;
        }
      }
    };
  }

  if (!btn || !onclick) return;

  var animationFn;

  if (typeof animation === 'function') animationFn = animation;
  else animationFn = createAnimationFn(animation);

  var callCount = 0;
  function doClick(doAnyway) {
    if (doAnyway) {
      onclick();
    } else {
      callCount++;
      if (callCount > 1) setTimeout(onclick, 50);
    }
  }

  function isDisabled(btn) {
    return btn.classList && btn.classList.contains('disabled');
  }

  var processWindowMouseUp = function(e) {
    animationFn(btn);
    if (e.target === btn) doClick();
    window.removeEventListener('mouseup', processWindowMouseUp, false);
  };

  btn.addEventListener('mousedown', function() {
    if (isDisabled(btn)) return;

    callCount = 0;

    window.addEventListener('mouseup', processWindowMouseUp, false);
    animationFn(btn, doClick);
  }, false);

  btn.addEventListener('click', function(e) {
    if (isDisabled(btn)) return;

    if (!e.isTrusted) doClick(true);
  }, false);
}

function createLineArrowMarker(id, style, roofline, scale, refX) {
  var lineArrowsDefs = roofline.centralPart.graphicsRoot.getDefs('line_arrows');

  scale = scale || 1;

  const arrowSize = 9 * scale;
  const arrowOffset = 1 * scale;
  const arrowMiddle = Math.ceil(arrowSize / 2);

  if (refX === undefined) refX = arrowSize;

  lineArrowsDefs
    .createMarker(id)
      .setMarkerWidth(arrowSize)
      .setMarkerHeight(arrowSize)
      .setRefX(refX)
      .setRefY(arrowMiddle)
      .setOrient('auto')
      .createPath()
        .moveToAbs(arrowOffset, arrowOffset)
        .lineToAbs(arrowOffset, arrowSize - arrowOffset)
        .lineToAbs(arrowSize - arrowOffset, arrowMiddle)
        .lineToAbs(arrowOffset, arrowOffset)
        .setD()
        .setClass(style);
}

return {
  getTooltipText: getText,
  addTooltipProcessor: function(processor) {
    if (processors) processors.push(processor);

    return processor;
  },
  addDefTooltipProcessor: function(processor) {
    defProcessor = processor;
    return processor;
  },
  hideStdTooltip: function() {
    stdTooltip.hide();
  },
  tooltipAttr: tooltipAttr,
  addExplanation: addExplanation,
  markWrong: function(elem, explanation) {
    if (!elem) return;

    elem.classList.add('wrong_input');

    if (!elem.rooflineExplanation) {
      var expl = addExplanation(elem, explanation);
      elem.rooflineExplanation = expl;
    }
  },
  markNormal: function(elem) {
    if (!elem) return;

    elem.classList.remove('wrong_input');

    if (elem.rooflineExplanation) {
      document.body.removeChild(elem.rooflineExplanation);
      delete elem.rooflineExplanation;
    }
  },
  setPopup: setPopup,
  addPopupNavigation: addPopupNavigation,
  addColorPicker: addColorPicker,
  toast: toast,
  filterNumberInput: filterNumberInput,
  tooltipAttr: tooltipAttr,
  flashElement: flashElement,
  addExpansion: addExpansion,
  setAnimatedClick: setAnimatedClick,
  updatePopupPos: function(control, popupList) {
    if (!popupList || !popupList.offsetParent) return;

    var popupPos = Utils.getElementPos(popupList);
    var controlPos = Utils.getElementPos(control);
    if (popupPos.x + popupPos.width > window.innerWidth) {
      popupList.style.left = (window.innerWidth - controlPos.x - popupPos.width - 1)  + 'px';
    }

    if (popupPos.x + popupPos.width < controlPos.x + controlPos.width) {
      popupList.style.left = (controlPos.width - popupPos.width - 1)  + 'px';
    }
  },
  updatePopupWidth: function(control, popupList) {
    if (!popupList || !popupList.offsetParent || !control) return;

    if (popupList.offsetWidth < control.offsetWidth) {
      popupList.style.minWidth = (control.offsetWidth + 1) + 'px';
    }
  },
  getChartAreaPadding: function() {
    return 0.05;
  },
  createLineArrowMarker: createLineArrowMarker
};

});
