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

define(['./utils'], function (Utils) {

  var RowState = {
    collapsed: '+',
    expanded: '-',
    simple: ' ',
    waiting: 'w',
    none: ''
  };

  function buildValueDecoration(bar) {
    if (!Array.isArray(bar)) return '';

    var classes = Array.isArray(bar.classes) ? bar.classes : [];
    classes.push('idvcgrid_cell_items_container');
    var result = '<div class="' + classes.join(' ') + '">';

    bar.forEach(function (barSegment) {
      var classes = Array.isArray(barSegment.classes) ? barSegment.classes : [];
      classes.push('idvcgrid_cell_item');

      var colorStr = '';
      if (barSegment.color) colorStr = 'color:' + barSegment.color + ';';

      result += '<span class="' + classes.join(' ') + '" style="' +
      colorStr + 'width: ' + barSegment.width + ';"></span>';
    });

    result += '</div>';

    return result;
  }

  function buildValueText(value, width) {
    if (value === undefined || value === null) return '';

    var result = value;

    if (width) {
      result = '<span class="idvcgrid_cell_text" style="width: ' + width + '">' + value + '</span>';
    }

    return result;
  }

  function decoratePercent(val, decimal) {
    if (val === '') {
      return val;
    }

    if (val > 100) val = 99.9999;

    var text = val;
    if (decimal !== undefined) {
      text = (+val).toFixed(decimal);
    }

    var result = '<span class="idvcgrid_cell_text">' + text + '%</span>';
    if (val > 0) {
      var color = 'rgb(' + Math.floor(val/100 * 255) + ', 0, ' +
        Math.floor((100 - val) / 100 * 255) + ')';

      result += buildValueDecoration([{color: color, width: text + '%'}]);
    }

    return result;
  }

  function decorateValue(val, maxValue, format) {
    if (val === '') {
      return val;
    }

    if (val > 0) {
      var text = val;
      if (typeof(format) === 'number') {
        text = (+val).toFixed(format);
      } else if (typeof(format) === 'function') {
        text = format(val);
      }

      if (maxValue) {
        var red = 255;
        if (val * 2 < maxValue) {
          red = Math.floor(2 * val / maxValue * 255);
        }

        var color = 'rgb(' + red + ',' + (255 - red) + ',0)';
        var width = Math.floor(val / maxValue * 100);
        if (width > 6) {
          return text + buildValueDecoration([{color: color, width: width + '%'}]);
        } else {
          return text;
        }
      } else {
        return text;
      }
    } else {
      return '0';
    }
  }

  function decorateValueEx(val, width, params) {
    return '<div class="idvcgrid_cell_content_container">' +
      buildValueText(val, width) +
      buildValueDecoration(params) +
      '</div>';
  }

  function decorateMemorySize(value, isFull) {
    function formatMemoryValue(value) {
      var classes = ['b', 'Kb ', 'Mb ', 'Gb'];
      var chunk = 1024;
      var result = '';
      var len = classes.length;
      for (var i = 0; i < len && value > 0; i++) {
        var newValue = Math.floor(value / chunk);
        result = (value - newValue * chunk).toFixed(0) + classes[i] + result;
        value = newValue;
      }

      if (!result.length) result = '0b';

      return result;
    }
    function formatMemoryValueShort(value) {
      var classes = ['b', 'Kb', 'Mb', 'Gb'];
      var chunk = 1024;
      var result = '0b';
      var len = classes.length;
      for (var i = 0; i < len && value > 1; i++) {
        if (value > 1) {
          result = value.toFixed((i > 0) ? 3 : 0) + classes[i];
        }
        value /= chunk;
      }

      return result;
    }

    if (isFull) {
      return formatMemoryValue(value);
    }

    return formatMemoryValueShort(value);
  }

  function decorateTime(val) {
    return (val.toFixed(0) / 1000) + 's';
  }

  function addSortingIndicator(caption, params) {
    var indicator = '';
    var sortingClass;

    var baseSortingClass = 'idvcgrid_column_sorting';
    if (caption.indexOf(baseSortingClass) < 0) {
      if (params.sortingWait !== undefined) {
        sortingClass = baseSortingClass + ' idvcgrid_sorting_waiting';
      } else if (params.sortingForward !== undefined) {
        sortingClass = baseSortingClass;
        if (!params.sortingForward) sortingClass += ' idvcgrid_sorting_backward';
      }

      if (sortingClass) indicator = '<span class="' + sortingClass + '"></span>';
    }

    return caption + indicator;
  }

  function decorateCaption(text, params) {
    var caption = '';
    var style = '';
    if (params && params.levelHeight &&
        params.height < params.levelHeight * 1.5) {
      style = ' style="white-space: nowrap;"';
    }

    caption = '<span class="idvcgrid_header_section_text"' +
               style + '>' + text +
               '</span>';

    caption = addSortingIndicator(caption, params);

    return caption;
  }

  function buildHeaderLegend(params) {
    if (!Array.isArray(params)) return '';

    var classes = ['idvcgrid_header_legend'].concat(params.classes).join(' ');

    var result = '<div class="' + classes + '">';

    params.forEach(function (param) {
      var colorClasses = ['idvcgrid_legend_color'].concat(param.colorClasses).join(' ');
      var textClasses = ['idvcgrid_legend_text'].concat(param.textClasses).join(' ');

      result += '<span class="' + colorClasses + '" style="color: ' + param.color + ';"></span>' +
        '<span class="' + textClasses + '">' + param.text + '</span>';
    });

    result += '</div>';

    return result;
  }

  function buildHeaderWithLegend(caption, legend) {
    var result =
      '<div class="idvcgrid_header_container">' +
        '<div class="idvcgrid_header_caption">' + caption +
        '</div>' +
        buildHeaderLegend(legend) +
      '</div>';

    return result;
  }

  var escapeHTML = (function() {
    var replacement = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;'
    };

    return function(val) {
      if (typeof val === 'string') {
        return val.replace(/[<>&"]/g, function(c) {
          return replacement[c];
        });
      }

      return val;
    };
  })();

  var unEscapeHTML = (function() {
    var replacement = {
      '&lt;'  : '<',
      '&gt;'  : '>',
      '&amp;' : '&',
      '&quot;': '"'
    };

    return function(val) {
      if (typeof val === 'string') {
        return val.replace(/\&[a-z]{2,4};/gi, function(c) {
          return replacement[c] || c;
        });
      }

      return val;
    };
  })();

  function getExpandWidgetStyle(text) {
    switch (text) {
      case RowState.collapsed:
        return ' idvcgrid_collapsed';
      case RowState.expanded:
        return ' idvcgrid_expanded';
      case RowState.simple:
        return ' idvcgrid_empty';
      case RowState.waiting:
        return ' idvcgrid_waiting';
      default:
        return '';
    }
  }

  function decorateSearchStr(content, searchStr, params) {
    function escapeSpecialChars(str) {
      return str.replace(/[.*+?^=!:${}()\-[\]|\/\\]/g, '\\$&');
    }

    var result = content;

    params = params || {};
    var className = params.className || 'idvcgrid_search_str';
    var currentIndex = (params.currentIndex !== undefined) ? params.currentIndex : -1;
    var currentClassName = params.currentClassName || 'idvcgrid_current_search_str';

    var flags = 'g';
    if (params.ignoreCase) {
      flags += 'i';
    }

    var index = 0;
    if (searchStr) {
      result = result.toString().replace(new RegExp(
          escapeSpecialChars(searchStr), flags), function(repl) {
        var name = className;
        if (index === currentIndex) {
          name = currentClassName;
        }
        index++;
        return '<span class="' + name + '">' + repl + '</span>'
      });
    }

    return result;
  }

  function decorateSearchPositions(content, searchPositions, params) {
    var result = content;

    if (searchPositions.length) {
      params = params || {};
      var className = params.className || 'idvcgrid_search_str';
      var currentIndex = (params.currentIndex !== undefined) ? params.currentIndex : -1;
      var currentClassName = params.currentClassName || 'idvcgrid_current_search_str';

      var currentPosition;
      if (currentIndex >= 0) {
        currentPosition = searchPositions[currentIndex]
      }

      for (var i = searchPositions.length - 1; i >= 0; i--) {
        var name = className;
        var position = searchPositions[i];
        if (currentPosition === position) {
          name = currentClassName;
        }
        var strBefore = result.slice(0, position.start);
        var searchStr = result.slice(position.start, position.end);
        var strAfter = result.slice(position.end);

        result = strBefore +
          '<span class="' + name + '">' + searchStr + '</span>' +
          strAfter;
      }
    }

    return result;
  }

  var levelIndent;
  function getLevelIndent() {
    if (!levelIndent) {
      levelIndent = '1em';

      loop:
      for (var i in document.styleSheets) {
        var ss = document.styleSheets[i];
        if (!ss) continue;

        var rules = ss.cssRules || ss.rules;
        for (var j in rules) {
          var rule = rules[j];
          if (!rule.selectorText ||
              rule.selectorText !== '.expand_collapse') {
            continue;
          }

          if (rule.style.left) {
            levelIndent = rule.style.left;
            break loop;
          }
        }
      }
    }

    return levelIndent;
  }

  function getLevelSize(area) {
    var levelSize;

    if (area) {
      var expandDiv = document.createElement('div');
      expandDiv.className = 'idvcgrid_expand_collapse idvcgrid_collapsed';
      expandDiv.style.marginLeft = getLevelIndent();
      expandDiv.style.position = 'absolute';
      expandDiv.style.left = '0';

      area.appendChild(expandDiv);

      levelSize = {offset: expandDiv.offsetLeft,
        width: expandDiv.offsetWidth};

      area.removeChild(expandDiv);
    }

    return levelSize;
  };

  function getMarginLeft(level) {
    if (level) {
      return Utils.Consts.browserPrefix + 'calc(' + (level + '*' + getLevelIndent()) + ')';
    }

    return '0';
  }

  function decorateExpand(id, state, level) {
    if (state === RowState.none) return '';

    return '<span class="idvcgrid_widget idvcgrid_expand_collapse' +
            getExpandWidgetStyle(state) +
            '" onclick="event.stopPropagation();" ondblclick="event.preventDefault();" id="' + id +
            '" style="margin-left: ' + getMarginLeft(level) + '" data-hierarchical-level=' + level + '></span>';
  }

  function decorateMore(moreText, id, level) {
    return '<span class="idvcgrid_widget idvcgrid_more_text' +
              '" onclick="event.stopPropagation();" ondblclick="event.preventDefault();" id="' + id +
              '" style="margin-left: ' + getMarginLeft(level) + '">' + moreText + '</span>';
  }

  function getContentLayout(content, controlArea, findSearch) {
    var result = {text: content, margin: 0};

    if (content.indexOf('idvcgrid_expand_collapse', 0) >= 0 &&
        controlArea) {
      var marginLeft = 'margin-left: ';
      var pos = content.indexOf(marginLeft) + marginLeft.length;
      var endMargin = content.indexOf(')', pos) + 1;
      var calcMargin = (endMargin > pos) ? content.slice(pos, endMargin) : '0';
      pos = content.indexOf('>', pos) + 1;
      pos = content.indexOf('>', pos) + 1;

      var textContent = content.slice(pos);

      var classAttr = 'class="';
      var classStart = content.indexOf(classAttr) + classAttr.length;
      var classEnd = content.indexOf('"', classStart);
      var className = content.slice(classStart, classEnd);
      className = className.replace('idvcgrid_expanded', 'idvcgrid_collapsed');

      var expandDiv = document.createElement('div');
      expandDiv.className = className;
      expandDiv.style.marginLeft = calcMargin;
      expandDiv.style.position = 'absolute';
      expandDiv.style.left = '0';

      controlArea.appendChild(expandDiv);

      var expandStyle = window.getComputedStyle(expandDiv, null);
      var expandDivRect = expandDiv.getBoundingClientRect();
      var contentAreaRect = controlArea.getBoundingClientRect();

      var margin = expandDivRect.left + expandDivRect.width + parseFloat(expandStyle.getPropertyValue('margin-right')) -
          contentAreaRect.left;

      controlArea.removeChild(expandDiv);

      result = {text: textContent, margin: margin};
    }

    if (findSearch) {
      result.search = [];

      var contentDiv = document.createElement('div');
      contentDiv.innerHTML = result.text;
      contentDiv.style.position = 'absolute';
      contentDiv.style.whiteSpace = 'pre';
      contentDiv.style.left = '0';

      controlArea.appendChild(contentDiv);

      var divLeft = Utils.getElementPos(contentDiv).x;

      result.contentWidth = contentDiv.scrollWidth + result.margin;

      var spans = contentDiv.querySelectorAll('span');
      [].forEach.call(spans, function(span) {
        if (span.className.indexOf('_search_str') >= 0) {
          var spanPos = Utils.getElementPos(span);
          result.search.push({left: spanPos.x - divLeft + result.margin, width: spanPos.width});
        }
      });

      controlArea.removeChild(contentDiv);
    }

    return result;
  };

return {
    RowState: RowState,
    decoratePercent: decoratePercent,
    decorateValue: decorateValue,
    decorateValueEx: decorateValueEx,
    decorateMemorySize: decorateMemorySize,
    decorateTime: decorateTime,
    addSortingIndicator: addSortingIndicator,
    decorateCaption: decorateCaption,
    buildHeaderWithLegend: buildHeaderWithLegend,
    escapeHTML: escapeHTML,
    unEscapeHTML: unEscapeHTML,
    getLevelSize: getLevelSize,
    getExpandWidgetStyle: getExpandWidgetStyle,
    decorateSearchStr: decorateSearchStr,
    decorateSearchPositions: decorateSearchPositions,
    decorateExpand: decorateExpand,
    decorateMore: decorateMore,
    getContentLayout: getContentLayout
  };
});
