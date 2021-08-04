/**
 * @license Copyright 2013 - 2013 Intel Corporation All Rights Reserved.
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

define(['require', './signal', './utils'], function(require, Signal, Utils) {

  function loadGridStyles() {
    Utils.appendCSS(require.toUrl('./grid_styles.css'));
  }

  function getParentByClass(elem, className) {
    var result = null;

    while (elem) {
      if (elem.className.indexOf &&
          elem.className.indexOf(className, 0) >= 0) {
        result = elem;
        break;
      }
      elem = elem.parentElement;
    }

    return result;
  }

  //////////////////////////////////////////////////////////////////////////
  //
  //          VertScrollBar
  //
  //////////////////////////////////////////////////////////////////////////

  function VertScrollBar(parentEl) {
    this.scrollBody = document.createElement('div');
    this.scrollBody.className = 'idvcgrid_vertical_scroll';
    this.scrolled = [];
    this.scrolledCoef = 1.;

    this.scrollSize = document.createElement('div');
    this.scrollSize.className = 'idvcgrid_scroll_size';

    this.scrollBody.appendChild(this.scrollSize);
    parentEl.appendChild(this.scrollBody);

    this.scrollBody.onscroll = function() {
      var columnScrollTop = 0;
      var topRow = 0;
      var needColumnScrollTopFit = false;
      var topRowsEqual = true;

      this.scrolled.forEach(function(scrolled, index) {
        if (!scrolled._isActive()) return;

        scrolled._updateScrollTop(this.getScrollTop());
        var scrollState = scrolled._getScrollState();
        var newColumnScrollTop = scrollState.columnScrollTop;
        if (!index) {
          columnScrollTop = newColumnScrollTop;
          topRow = scrollState.topRow;
        } else if (newColumnScrollTop !== columnScrollTop) {
          columnScrollTop = Math.min(columnScrollTop, newColumnScrollTop);
          needColumnScrollTopFit = true;
          topRowsEqual = topRowsEqual && (topRow === scrollState.topRow);
        }
      }.bind(this));

      if (topRowsEqual && needColumnScrollTopFit) this.updateColumnsScrollTop(columnScrollTop);
    }.bind(this);
  }

  const maxScrollSize = 10000000;

  VertScrollBar.prototype.setScrollSize = function(scrollSize, pageSize) {
    var scrollBarHeight = this.scrollBody.getBoundingClientRect().height;
    if (scrollBarHeight > 0) {
      var scrollTop = this.toArea(this.scrollBody.scrollTop);

      if (scrollSize <= maxScrollSize) {
        this.scrolledCoef = pageSize / scrollBarHeight;
        this.scrollSize.style.height = this.fromArea(scrollSize) + 'px';
      } else {
        this.scrolledCoef = (scrollSize - pageSize) / (maxScrollSize - scrollBarHeight);
        this.scrollSize.style.height = maxScrollSize + 'px';
      }

      this.scrollBody.scrollTop = this.fromArea(scrollTop);
    }
  };

  VertScrollBar.prototype.toArea = function(size) {
    return size * this.scrolledCoef;
  };

  VertScrollBar.prototype.fromArea = function(size) {
    return size / this.scrolledCoef;
  };

  VertScrollBar.prototype.updateColumnsScrollTop = function(scrollTop) {
    this.scrolled.forEach(function(scrolled) {
      scrolled._updateColumnsScrollTop(scrollTop);
    });
  };

  VertScrollBar.prototype.addScrolled = function(scrolled) {
    this.scrolled.push(scrolled);
  };

  VertScrollBar.prototype.removeExternalScrolled = function(scrolled) {
    this.scrolled.splice(1, Number.MAX_VALUE);
  };

  VertScrollBar.prototype.setScrollTop = function(val) {
    this.scrollBody.scrollTop = this.fromArea(val);;
  };

  VertScrollBar.prototype.getScrollTop = function() {
    return this.toArea(this.scrollBody.scrollTop);
  };

  VertScrollBar.prototype.hide = function() {
    return this.scrollBody.style.display = 'none';
  };

  VertScrollBar.prototype.show = function() {
    return this.scrollBody.style.display = 'block';
  };

  VertScrollBar.prototype.isVisible = function() {
    return this.scrollBody.style.display !== 'none';
  };

  //////////////////////////////////////////////////////////////////////////

  //          GridColumn

  //////////////////////////////////////////////////////////////////////////

  var HeaderItemState = {
    collapsed: '+',
    expanded: '-',
    simple: ' '
  };

  function preventMouseAction(e) {
    e.stopPropagation();
    e.preventDefault();
  }

  function GridColumn(parentEl, dataIndex, state) {
    this.dataIndex = dataIndex;

    this.area = document.createElement('div');
    this.area.columnObj = this;

    this.header = document.createElement('div');
    this.scrollArea = document.createElement('div');
    this.footer = document.createElement('div');

    this.header.className = 'idvcgrid_header_section';
    this.scrollArea.className = 'idvcgrid_column_scrolled';
    this.footer.className = 'idvcgrid_footer_section';

    this.footer.onmousedown = preventMouseAction;
    this.footer.onmouseup = preventMouseAction;
    this.footer.onmousemove = preventMouseAction;

    this.setState(state);

    this.area.appendChild(this.scrollArea);
    this.area.appendChild(this.footer);
    this.area.appendChild(this.header);

    parentEl.appendChild(this.area);
  }

  GridColumn.prototype.setState = function(state) {
    if (!state) return;

    if (state !== HeaderItemState.simple &&
        !this.expandCollapse) {
      this.expandCollapse = document.createElement('div');
      this.header.appendChild(this.expandCollapse);
      this.header.classList.add('idvcgrid_header_expand_collapse');

      this.expandCollapse.onmousedown = function(ev) {
        ev.stopPropagation();
      };
      this.expandCollapse.onmouseup = this.expandCollapse.onmousedown;

      this.expandCollapse.onclick = function (ev) {
        ev.stopPropagation();
        var visItem = this.visItem;
        if (visItem) {
          var state = visItem.getState();
          state = (state === HeaderItemState.expanded) ?
            HeaderItemState.collapsed :
            HeaderItemState.expanded;
          this.setState(state);
        }

        if (this.onExpandColumn) {
          this.onExpandColumn(this);
        }
      }.bind(this);
    }

    if (state === HeaderItemState.simple &&
        this.expandCollapse) {
      this.header.removeChild(this.expandCollapse);
      delete this.expandCollapse;
      this.header.classList.remove('idvcgrid_header_expand_collapse');
    }

    var className;
    if (this.expandCollapse) {
      className = 'idvcgrid_expand_collapse_column';
      if (state === HeaderItemState.expanded)
        className += ' idvcgrid_expanded_column';
      else
        className += ' idvcgrid_collapsed_column';
      this.expandCollapse.className = className;
    }

    var visItem = this.visItem;
    if (visItem) {
      visItem.setState(state);
    }

    className = 'idvcgrid_column';
    if (visItem && !visItem.isLeaf()) className += ' idvcgrid_inactive_column';
    this.area.className = className;

    this.resetLayout();
  };

  GridColumn.prototype.getState = function() {
    var result = HeaderItemState.simple;

    if (this.expandCollapse) {
      if (this.expandCollapse.classList.contains('idvcgrid_expanded_column'))
        result = HeaderItemState.expanded;
      else if (this.expandCollapse.classList.contains('idvcgrid_collapsed_column'))
        result = HeaderItemState.collapsed;
    }

    return result;
  };

  GridColumn.prototype.hide = function() {
    if (!this.canBeHidden()) return;

    var visItem = this.visItem;
    if (visItem) {
      visItem.setVisible(false);
    }
  };

  GridColumn.prototype.canBeHidden = function() {
    var visItem = this.visItem;
    if (visItem) {
      var visParent = visItem.getParent();
      if (visParent) {
        var count = 0;

        for (var i = visParent.getChildrenCount() - 1; i >= 0; i--) {
          var visChild = visParent.getChild(i);
          if (visChild.isVisible()) {
            count++;
          }
        }

        return count > 1;
      }
    }

    return false;
  };

  GridColumn.prototype.resetLayout = function() {
    if (this._columnLayout) this.setLayout(this._columnLayout);
  };

  var layoutPropertyPairs = [
    ['scrollArea', 'cells'],
    ['header', 'header'],
    ['area', 'column'],
    ['footer', 'footer']
  ];

  GridColumn.prototype.setLayout = function(columnLayout) {
    function applyLayout(elem, layout) {
      if (!layout) return;

      var props = Object.getOwnPropertyNames(layout);
      props.forEach(function(prop) {
        if (prop !== 'className')
          elem.style[prop] = layout[prop];
        else
          elem.classList.add(layout.className);
      });
    }

    function clearLayout(elem, layout) {
      if (!layout) return;

      var props = Object.getOwnPropertyNames(layout);
      props.forEach(function(prop) {
        if (prop !== 'className')
          elem.style[prop] = '';
        else
          elem.classList.remove(layout.className);
      });
    }

    function process(funct) {
      if (!funct) return;

      layoutPropertyPairs.forEach(function(pair) {
        funct(this[pair[0]], this._columnLayout[pair[1]]);
      }.bind(this));
    }

    if (this._columnLayout) process.call(this, clearLayout);

    if (!columnLayout) {
      if (this._columnLayout) delete this._columnLayout;
    } else {
      this._columnLayout = columnLayout;

      process.call(this, applyLayout);

      // for compatibility
      if (columnLayout.width) {
        this.area.style.width = columnLayout.width;
      }

      if (columnLayout.textAlign) {
        this.scrollArea.style.textAlign = columnLayout.textAlign;
        this.footer.style.textAlign = columnLayout.textAlign;
      }
    }
  };

  GridColumn.prototype.setCaption = function(caption) {
    this.header.innerHTML = caption;
    if (this.expandCollapse) {
      this.header.appendChild(this.expandCollapse);
    }
  };

  GridColumn.prototype.setSortable = function(sortable) {
    if (sortable) Utils.removeClass(this.header, 'idvc_grid_notsortable');
    else Utils.addClass(this.header, 'idvc_grid_notsortable');
  };

  GridColumn.prototype.setScrollTop = function(val) {
    if (this.scrollArea.scrollTop !== val) {
      this.scrollArea.scrollTop = val;
    }
  };

  GridColumn.prototype.getScrollTop = function() {
    return this.scrollArea.scrollTop;
  };

  GridColumn.prototype.getColumnWidth = function() {
    return this.area.offsetWidth;
    //return this.area.getBoundingClientRect().width;
  };

  GridColumn.prototype.setTop = function(top) {
    this._columnTop = top;
    this.area.style.top = top + 'px';
  };

  GridColumn.prototype.getTop = function() {
    return this._columnTop || 0;
  };

  GridColumn.prototype.setHeaderHeight = function(height) {
    this._columnHeaderHeight = height;

    var headerEl = this.header;
    headerEl.style.boxSizing = 'border-box';
    headerEl.style.height = height + 'px';
  };

  GridColumn.prototype.getHeaderHeight = function() {
    // return this.header.offsetHeight;

    if (!this._columnHeaderHeight) {
      this._columnHeaderHeight = this.header.getBoundingClientRect().height
    }

    return this._columnHeaderHeight;
  };

  GridColumn.prototype.getRowBufferSize = function() {
    return this.scrollArea.children.length;
  };

  function isHeaderIgnoredForAutoSize(ignore) {
    return ignore ||
      (this.visItem ? this.visItem.ignoreHeaderForAutoSize() : true);
  }

  GridColumn.prototype.prepare4OptimalWidth = function(ignoreHeader) {
    var maxContent = Utils.Consts.browserPrefix + 'max-content';

    this.scrollArea.style.width = maxContent;

    ignoreHeader = isHeaderIgnoredForAutoSize.call(this, ignoreHeader);

    if (!ignoreHeader) {
      this.header.style.width = maxContent;
    }

    this._prepared4OptimalWidth = true;
  }

  GridColumn.prototype.cleanUp4OptimalWidth = function(ignoreHeader) {
    ignoreHeader = isHeaderIgnoredForAutoSize.call(this, ignoreHeader);

    if (!ignoreHeader) {
      this.header.style.width = null;
    }
    this.scrollArea.style.width = null;

    if (this._prepared4OptimalWidth) delete this._prepared4OptimalWidth;
  }

  GridColumn.prototype.getOptimalWidth = function(extraSpace, ignoreHeader) {
    if (this._columnOptimalWidth) return this._columnOptimalWidth;

    extraSpace = extraSpace || Utils.em2px(1.25, this.area);

    ignoreHeader = isHeaderIgnoredForAutoSize.call(this, ignoreHeader);

    var result = 0;

    if (!this._prepared4OptimalWidth) {
      this.prepare4OptimalWidth(ignoreHeader);
      delete this._prepared4OptimalWidth;
    }

    if (!ignoreHeader) {
      result = this.header.offsetWidth;
    }

    result = Math.max(this.scrollArea.offsetWidth, result);

    if (!this._prepared4OptimalWidth) {
      this.cleanUp4OptimalWidth(ignoreHeader);
    }

    this._columnOptimalWidth = Math.round(result + extraSpace);

    return this._columnOptimalWidth;
  };

  GridColumn.prototype.clearRows = function() {
    this.area.removeChild(this.scrollArea);

    this.scrollArea = document.createElement('div');
    this.scrollArea.className = 'idvcgrid_column_scrolled';

    this.area.appendChild(this.scrollArea);

    this.resetLayout();
  };

  GridColumn.prototype.setLastColumnStyle = function() {
    var columnStyle = this.area.style;

    columnStyle.minWidth = columnStyle.width;
    columnStyle.width = 'auto';
    columnStyle.right = '0';
  };

  GridColumn.prototype.isLastColumn = function() {
    return this.area.style.width === 'auto';
  };

  GridColumn.prototype.clearLastColumnStyle = function() {
    if (!this.isLastColumn()) return;

    var columnStyle = this.area.style;

    columnStyle.width = columnStyle.minWidth;
    columnStyle.minWidth = '20px';
    columnStyle.right = 'auto';
  };

  GridColumn.prototype.getRowsViewHeight = function() {
    return this.scrollArea.offsetHeight;
    //return this.scrollArea.getBoundingClientRect().height;
  };

  GridColumn.prototype.getRowsViewStart = function() {
    return this._scrollAreaTop || this.scrollArea.offsetTop;
  };

  GridColumn.prototype.getRowHeight = function() {
    //return this.scrollArea.children[0].offsetHeight;
    return this._rowHeight || this.scrollArea.children[0].getBoundingClientRect().height;
  };

  GridColumn.prototype.updateRowStyle = function (row, childRow, selectionStyle, dataModel) {
    var isSelected = selectionStyle !== undefined;
    selectionStyle = selectionStyle || '';
    var style = getCellStyle(isSelected, selectionStyle, row, this.dataIndex, dataModel);
    var rowElem = this.scrollArea.children[childRow];
    if (rowElem) rowElem.className = style;
  };

  GridColumn.prototype.moveRows4Insert = function(to, count) {
    var area = this.scrollArea;
    var from = area.children.length - 1;
    for (var j = 0; j < count; j++) {
      var cell = area.removeChild(area.children[from]);
      cell.className = 'idvcgrid_cell';
      area.insertBefore(cell, area.children[to]);
    }
  };

  GridColumn.prototype.moveRows4Remove = function(from, count, maxMoved) {
    // move to the end
    var moved = 0;
    var area = this.scrollArea;
    for (var j = 0; j < count; j++) {
      var elt = area.removeChild(area.children[from]);
      if (j < maxMoved) {
        area.appendChild(elt);
        moved++;
      }
    }

    return moved;
  };

  GridColumn.prototype.moveRows4ScrollBottom = function(count, moveCount) {
    var area = this.scrollArea;
    for (var j = 0; j < count; j++) {
      var elt = area.removeChild(area.children[0]);
      if (j < moveCount) {
        area.appendChild(elt);
      }
    }
  };

  GridColumn.prototype.moveRows4ScrollTop = function(count) {
    var area = this.scrollArea;

    for (var j = 0; j < count; j++) {
      var elt = area.removeChild(area.children[area.children.length - 1]);
      area.insertBefore(elt, area.children[0]);
    }
  };

  GridColumn.prototype.addRowsTop = function(count) {
    var area = this.scrollArea;

    for (var j = 0; j < count; j++) {
      var elt = document.createElement('div');
      area.insertBefore(elt, area.children[0]);
    }
  };

  GridColumn.prototype.addRowsBottom = function(count) {
    var area = this.scrollArea;

    for (var j = 0; j < count; j++) {
      var elt = document.createElement('div');
      area.appendChild(elt);
    }
  };

  GridColumn.prototype.fitChildrenCount = function(count) {
    var area = this.scrollArea;

    var removeCount = area.children.length - count;
    for (var j = 0; j < removeCount; j++) {
      area.removeChild(area.lastChild);
    }
  };

  GridColumn.prototype.fitRowsCount = function(count) {
    var currentCount = this.getRowBufferSize();
    if (count > currentCount) {
      this.addRowsBottom(count - currentCount);
    } else if (count < currentCount) {
      this.fitChildrenCount(count);
    }
  };

  function getCellStyle(isSelected, defSelectedStyle, row, col, dataModel) {
    var style;
    var defStyle = 'idvcgrid_cell';

    if (dataModel && dataModel.getCellStyle) {
      style = dataModel.getCellStyle(isSelected, defSelectedStyle, defStyle, row, col);
    }

    if (!style) {
      style = defStyle;
      if (isSelected) style += ' ' + defSelectedStyle;
    }

    return style;
  };

  function fillCellData(cell, row, col, dataModel) {
    if (!cell || !dataModel) return;

    var newContent = dataModel.getCell(row, col);

    if (typeof newContent === 'string') {
      if (cell.isDirty) {
        cell.style.cssText = null;
        Utils.removeAllChildren(cell);
        cell.getBoundingClientRect(); //recalculate cell layout
        delete cell.isDirty;
      }
      if (newContent !== null) cell.innerHTML = newContent;
    } else if (Utils.isHTMLNode(newContent)) {
      Utils.removeAllChildren(cell);
      cell.appendChild(newContent);
      cell.isDirty = true;
    } else if (newContent) {
      Utils.applyObjectProperties(cell, newContent);
      cell.isDirty = true;
    }
  }

  function fillCell(cell, row, col, isSelected, selectedStyle, dataModel) {
    if (!cell) return;

    cell.className = getCellStyle(isSelected, selectedStyle, row, col, dataModel);
    fillCellData(cell, row, col, dataModel);
  }

  GridColumn.prototype.createRows = function(viewHeight, start, count, indexBefore,
      currentRow, selectedStyle, dataModel, rowHeight) {
    if (this._columnOptimalWidth) delete this._columnOptimalWidth;

    if (dataModel) {
       //insert new rows into rows buffer
      var beforeEl = null;

      if (indexBefore !== undefined) {
        beforeEl = this.scrollArea.children[indexBefore];
      }

      var childrenLen = this.scrollArea.children.length;
      var rowCount = dataModel.getRowCount();
      if (childrenLen + count > rowCount) {
        count = rowCount - childrenLen;
      }

      var end = Math.min(start + count, rowCount);
      for (var j = start; j < end; j++) {
        var cell = document.createElement('div');
        fillCell(cell, j, this.dataIndex, j === currentRow,
          selectedStyle, dataModel);

        if (beforeEl) {
          this.scrollArea.insertBefore(cell, beforeEl);
        } else {
          this.scrollArea.appendChild(cell);
        }

        if (!rowHeight) {
          rowHeight = cell.getBoundingClientRect().height;
        }

        viewHeight -= rowHeight;

        if (-viewHeight > rowHeight) {
          break;
        }
      }
    }

    this._rowHeight = rowHeight;

    return rowHeight;
  };

  GridColumn.prototype.updateFooter = function(dataModel) {
    if (dataModel && dataModel.getFooter) {
      this.footer.innerHTML = dataModel.getFooter(this.dataIndex);
    }
  };

  GridColumn.prototype.regetRows = function(start, lastRow, from,
      currentRow, selectedStyle, dataModel) {
    if (this._columnOptimalWidth) delete this._columnOptimalWidth;

    if (dataModel) {
      for (var i = from, j = start; j <= lastRow; j++, i++) {
        var cell = this.scrollArea.children[i];
        fillCell(cell, j, this.dataIndex, j === currentRow,
          selectedStyle, dataModel);
      }
    }
  };

  GridColumn.prototype.updateRow = function(row, childIndex,
      currentRow, selectedStyle, dataModel) {
    if (this._columnOptimalWidth) delete this._columnOptimalWidth;

    if (dataModel) {
      var cellEl = this.scrollArea.children[childIndex];
      fillCell(cellEl, row, this.dataIndex, row === currentRow,
        selectedStyle, dataModel);
    }
  };

  GridColumn.prototype.updateLayout = function(dataModel) {
    var columnLayout = null;
    if (dataModel && dataModel.getColumnLayout) {
      columnLayout = dataModel.getColumnLayout(this.dataIndex);
    }

    this.setLayout(columnLayout);
  };

  GridColumn.prototype.updateColumn = function(rowFrom, lastRow,
      currentRow, selectedStyle, dataModel) {
    this.updateLayout(dataModel);

    if (dataModel) {
      this.regetRows(rowFrom, lastRow, 0, currentRow, selectedStyle, dataModel);
      this.updateFooter(dataModel);
    }
  };

  GridColumn.prototype.setWidth = function(width, isOptimal, noFitParent) {
    var widthStyle = this.area.style.width;
    if (widthStyle.charAt(widthStyle.length - 1) === '%') {
      var parentWidth = this.area.parentElement.offsetWidth;
      widthStyle = (width * 100 / parentWidth) + '%';
    } else {
      widthStyle = width + 'px';
    }

    if (this.isLastColumn()) {
      this.area.style.minWidth = widthStyle;
    } else {
      this.area.style.width = widthStyle;
    }

    var visItem = this.visItem;
    if (visItem &&
        visItem.getState() !== HeaderItemState.expanded) {
      if (isOptimal) {
        if (this.scrollArea.children.length) visItem.isOptimalWidth = true;
      } else {
        if (visItem.isOptimalWidth) delete visItem.isOptimalWidth;
      }

      visItem.setAutoSize(isOptimal);
      visItem.setWidth(widthStyle);
    } else if (!visItem) {
      if (isOptimal) {
        if (this.scrollArea.children.length) this.isOptimalWidth = true;
      } else {
        if (this.isOptimalWidth) delete this.isOptimalWidth;
      }
    }

    if (!noFitParent) this.fitParent();
  };

  GridColumn.prototype.setIsOptimalWidth =  function() {
    if (!this.scrollArea.children.length) return;

    var visItem = this.visItem;
    if (visItem &&
        visItem.getState() !== HeaderItemState.expanded) {
      visItem.isOptimalWidth = true;
    } else if (!visItem) {
      this.isOptimalWidth = true;
    }
  };

  GridColumn.prototype.setMaxAutoSizeWidth = function(maxWidth) {
    if (typeof maxWidth === 'number') {
      this._maxWidth = maxWidth;
    } else {
      delete this._maxWidth;
    }
  };

  GridColumn.prototype.getMaxAutoSizeWidth = function() {
    var result = this._maxWidth;
    if (!result && this.visItem) {
      var maxWidth = this.visItem.getMaxAutoSizeWidth();
      if (typeof maxWidth === 'string') {
        if (maxWidth.endsWith('em')) {
          result = Utils.em2px(parseInt(maxWidth), this.scrollArea);
        } else {
          result = parseInt(maxWidth);
        }
      } else if (typeof maxWidth === 'number') {
        result = maxWidth;
      }

      if (result) this.setMaxAutoSizeWidth(result);
    }

    return result;
  };

  GridColumn.prototype.setScrollAreaTop = function(top) {
    this.scrollArea.style.top = top + 'px';
    this._scrollAreaTop = top;
  }

  GridColumn.prototype.setLeft = function(left, noFitParent) {
    this.area.style.left = left + 'px';
    this._columnLeft = left;
    if (!noFitParent) this.fitParent();
  };

  GridColumn.prototype.getLeft = function() {
    return this._columnLeft || this.area.offsetLeft;
  };

  GridColumn.prototype.move = function(delta) {
    var left = this.area.offsetLeft;
    this.setLeft(left + delta);
  };

  GridColumn.prototype.getParentColumn = function() {
    var parent;
    if (this.visItem) {
      var visParent = this.visItem.getParent();
      if (visParent) parent = visParent.column;
    }
    return parent;
  };

  function getLastChildVisItem(parent) {
    if (parent && !parent.isLeaf()) {
      var visChild;
      for (var i = parent.getChildrenCount() - 1; i >= 0; i--) {
        visChild = parent.getChild(i);
        if (visChild.isVisible()) {
          break;
        }
      }

      return visChild;
    }

    return undefined;
  }

  function getFirstChildVisItem(parent) {
    if (parent && !parent.isLeaf()) {
      var visChild;
      for (var i = 0, len = parent.getChildrenCount(); i < len; i++) {
        visChild = parent.getChild(i);
        if (visChild.isVisible()) {
          break;
        }
      }

      return visChild;
    }

    return undefined;
  }

  GridColumn.prototype.getLastChild = function() {
    var result = this;
    var visItem = this.visItem;
    if (visItem && !visItem.isLeaf()) {
      var visChild = getLastChildVisItem(visItem);
      if (visChild) {
        result = visChild.column.getLastChild();
      }
    }
    return result;
  };

  GridColumn.prototype.getFirstChild = function() {
    var result = this;
    var visItem = this.visItem;
    if (visItem && !visItem.isLeaf()) {
      var visChild = getFirstChildVisItem(visItem);
      if (visChild) {
        result = visChild.column.getFirstChild();
      }
    }
    return result;
  };

  GridColumn.prototype.fitParent = function() {
    var visItem = this.visItem;
    if (visItem) {
      var visParent = visItem.getParent();
      if (visParent) {
        var parentColumn = visParent.column;
        if (parentColumn) {
          if (getFirstChildVisItem(visParent) === visItem) {
            var childLeft = this.getLeft();
            var parentLeft = parentColumn.getLeft();
            parentColumn.move(childLeft - parentLeft);
          }
          if (getLastChildVisItem(visParent) === visItem) {
            var childRight = this.getLeft() + this.getColumnWidth();
            var parentWidth = parentColumn.getColumnWidth();
            var parentRight = parentColumn.getLeft() + parentWidth;
            var delta = childRight - parentRight;
            parentColumn.setWidth(parentWidth + delta);
          }
        }
      }
    }
  };

  //////////////////////////////////////////////////////////////////////////

  //          GridBody

  //////////////////////////////////////////////////////////////////////////

  function getContentStyle(elem) {
    var style = null;

    if (elem) {
      style = window.getComputedStyle(elem, null);
    } else {
      var button = document.createElement('button');
      button.style.position = 'absolute';
      button.style.left = '0';
      button.style.top = '0';
      document.body.appendChild(button);
      style = window.getComputedStyle(button, null);
      document.body.removeChild(button);
    }

    return style;
  }

  function GridBody(parentEl, tabIndex) {
    this.onDblClick = Signal.create();
    this.onContextMenu = Signal.create();
    this.onChangeCurrentRow = Signal.create();
    this.onFitHeaderHeight = Signal.create();
    this.onExpandColumn = Signal.create();
    this.onChangeColumnWidth = Signal.create();
    this.onShowTooltip = Signal.create();
    this.onSetFocus = Signal.create();
    this.onLostFocus = Signal.create();

    this.area = document.createElement('div');
    this.area.className = 'idvcgrid_body';

    if (tabIndex !== undefined) {
      this.area.setAttribute('tabindex', tabIndex);
    }

    this.connectedBody = null;
    parentEl.appendChild(this.area);

    this.columns = [];
    this.inActiveColumns = [];
    this.dataModel = null;

    this.scrolling = null;

    this._expandLastColumn = true;

    this.updateNum = Utils.createCounter();

    this.fitcentralColumnAsync = Utils.createAsyncCall(
      this.fitCentralColumnWidth, this, 300);

    this.currentChangeAsync = Utils.createAsyncCall(function(row, keyState) {
      this.onChangeCurrentRow.raise(row, keyState);
    }.bind(this), this, 50);

    this.S = Utils.createSequence();

    this._sizes = {};

    this.area.refreshSize = function(size) {
      if (this._needRefreshView) {
        delete this._needRefreshView;
        this.refreshView();
      } else {
        if (size && !size.width) return;

        this.fitCentralColumnHeader();
        this.fitLastColumn();

        this._viewport.refreshRowsContent();
      }
      return true;
    }.bind(this);

    var that = this;

    this._viewport = (function() {
      var topRow = 0;
      var bottomRow = 0;
      var scrollTop = 0;
      var currentRow = -1;
      var currentStyle = 'idvcgrid_cell idvcgrid_selected_row';

      function forEachVisibleColumns(proc, onlyRefresh) {
        var columnCount = that.columns.length;
        var isBigColumnNumber = columnCount > thresholdColumnCount;

        var range;

        if (isBigColumnNumber) {
          if (!onlyRefresh) that.updateNum.next();
          range = that.getVisibleColumnsRange();
        } else {
          range = {
            first: 0,
            last: columnCount - 1
          };
        }

        var updateNum = that.updateNum.get();

        for(var i = range.first; i <= range.last; i++) {
          var column = that.columns[i];
          if (!isBigColumnNumber ||
              column && column.updateNum !== updateNum) {
            column.updateNum = updateNum;
            proc(column, i)
          }
        }
      }

      var getTopRow = function() {
        return topRow;
      };

      var getBottomRow = function() {
        return bottomRow;
      };

      var isExistingRow = function(row) {
        return row >= getTopRow() &&
          row <= getBottomRow();
      };

      var updateBottomRow = function() {
        if (that.columns.length) {
          bottomRow = topRow + that.getRowBufferSize() - 1;
        }
      };

      var getChildIndex = function(row) {
        return row - getTopRow();
      };

      var getViewHeight = function() {
        return that.getRowsAreaHeight();
      };

      var getRowHeight = function() {
        if (that.getRowBufferSize()) {
          return that.getRowHeight();
        }

        return 0;
      };

      var isViewCovered = function() {
        var viewHeight = getViewHeight();
        var rowHeight = getRowHeight();
        var scrollTop = this.getColumnsScrollTop();

        return viewHeight <= rowHeight * (bottomRow - topRow + 1) - scrollTop;
      };

      var updateRowStyle = function(inRow, style) {
        if (that.columns.length &&
            isExistingRow(inRow)) {
          var row = getChildIndex(inRow);

          if (row >= 0 &&
              row < that.getRowBufferSize()) {
            forEachVisibleColumns(function(column) {
              column.updateRowStyle(inRow, row, style, that.dataModel);
            });
          }
        }
      };

      var moveRows4Insert = function(to, count) {
        var chiledTo = getChildIndex(to);
        forEachVisibleColumns(function(column) {
          column.moveRows4Insert(chiledTo, count);
        });
      };

      var moveRows4Remove = function(from, count) {
        // move to the end
        var moved = 0;

        var rowCount = that.getRowBufferSize();
        var childFrom = getChildIndex(from);
        if (childFrom + count >= rowCount) {
          count = rowCount - childFrom;
        }

        var maxMoved = count - (topRow + rowCount -
                                that.dataModel.getRowCount());

        forEachVisibleColumns(function(column) {
          moved = column.moveRows4Remove(childFrom, count, maxMoved);
        });

        return moved;
      };

      var moveRows4ScrollBottom = function(count, moveCount) {
        forEachVisibleColumns(function(column) {
          column.moveRows4ScrollBottom(count, moveCount);
        });
      };

      var moveRows4ScrollTop = function(count) {
        forEachVisibleColumns(function(column) {
          column.moveRows4ScrollTop(count);
        });
      };

      var addRowsTop = function(count) {
        var columnCount = that.columns.length;

        for(var i = 0; i < columnCount; i++) {
          that.columns[i].addRowsTop(count);
        }
      };

      var addRowsBottom = function(count) {
        var columnCount = that.columns.length;

        for(var i = 0; i < columnCount; i++) {
          that.columns[i].addRowsBottom(count);
        }
      };

      var getVisibleRowCount = function(viewHeight, rowHeight, topRowInvisiblePart) {
        rowHeight = rowHeight || getRowHeight();
        if (!rowHeight) return 0;

        viewHeight = viewHeight || getViewHeight();

        // add column scroll top (hidden part of the top row) to rows view height
        if (topRowInvisiblePart === undefined &&
            that.columns.length) {
          topRowInvisiblePart = that.columns[0].getScrollTop()
        }

        var result = Math.ceil((viewHeight + topRowInvisiblePart) / rowHeight);
        if (that.dataModel.getRowCount() < result) {
          result = that.dataModel.getRowCount();
        }

        return result;
      };

      return {
        clear: function() {
          topRow = 0;
          bottomRow = 0;
          scrollTop = 0;
          currentRow = -1;
        },
        setScrollTop: function(val) {
          if (val < 0) {
            val = 0;
          }

          function calcMaxScrollTop(rowCount, rowHeight, viewHeight) {
            var maxScrollTop = rowCount * rowHeight - viewHeight;
            if (maxScrollTop < 0) maxScrollTop = 0;
            return maxScrollTop;
          }

          var rowHeight = getRowHeight();
          var viewHeight = getViewHeight();

          var maxScrollTop = calcMaxScrollTop(that.dataModel.getRowCount(), rowHeight, viewHeight);
          if (val > maxScrollTop) {
            val = maxScrollTop;
          }

          if (val !== this.getScrollTop()) {
            scrollTop = val;

            if (rowHeight &&
                viewHeight) {
              var newTop = Math.floor(val / rowHeight + 0.05);
              // scroll top for each column increase/decrease its size for one pixel
              // to make wholy visible top/bottom row
              var colScrollTop = val - newTop * rowHeight;
              if (colScrollTop < 0) colScrollTop = 0;

              var regetStart = -1;
              var scrollCount = newTop - topRow;
              var rowCount = bottomRow - topRow + 1;

              var neededChildren = getVisibleRowCount(viewHeight, rowHeight, colScrollTop);
              if (rowCount < neededChildren &&
                  -scrollCount > 0) {
                var addCount = neededChildren - rowCount;
                addRowsTop(addCount);
                topRow = newTop;
                if (addCount === -scrollCount) {
                  this.regetRows(topRow, -scrollCount);
                } else {
                  this.regetRows(topRow);
                }
              } else {
                var oldBottom = bottomRow;

                this.fitRowsCount(neededChildren);
                if (!scrollCount &&
                    oldBottom < bottomRow) {
                  this.regetRows(oldBottom + 1, bottomRow - oldBottom);
                }

                oldBottom = bottomRow;
                bottomRow += scrollCount;
                if (bottomRow >= that.dataModel.getRowCount()) {
                  bottomRow = that.dataModel.getRowCount() - 1;
                }
                topRow = newTop;

                if (Math.abs(scrollCount) < rowCount / 2) {
                  if (scrollCount > 0) {
                    var maxMoveCount = bottomRow - oldBottom;
                    regetStart = bottomRow - maxMoveCount;
                    if (bottomRow === that.dataModel.getRowCount() - 1) {
                      regetStart--;
                    }
                    moveRows4ScrollBottom(scrollCount, maxMoveCount);
                    scrollCount = undefined;
                  } else if (scrollCount < 0) {
                    regetStart = newTop;
                    scrollCount = -scrollCount;
                    moveRows4ScrollTop(scrollCount);
                  }
                } else {
                  regetStart = topRow;
                  scrollCount = undefined;
                }

                if (regetStart >= 0) {
                  this.regetRows(regetStart, scrollCount);
                }
              }

              this.setColumnsScrollTop(colScrollTop);
            }
          }
        },
        getScrollTop: function() {
          return scrollTop;
        },
        setColumnsScrollTop: function(columnsScrollTop) {
          this.columnsScrollTop = undefined;

          that.columns.forEach(function(column) {
            column.setScrollTop(columnsScrollTop);
          });

          var realColumnsScrollTop = this.getColumnsScrollTop();
          this.columnsScrollTop = realColumnsScrollTop;
          scrollTop += realColumnsScrollTop - columnsScrollTop;
        },
        getColumnsScrollTop: function() {
          if (this.columnsScrollTop !== undefined) return this.columnsScrollTop;

          var result = 0;

          that.columns.some(function(column) {
            if (column.getState() !== HeaderItemState.expanded) {
              result = column.getScrollTop();
              return true;
            }
            return false;
          });

          return result;
        },
        updateCurrentRow: function(row) {
          currentRow = row;
        },
        setCurrentRow: function(newRow, oldRow) {
          var style = currentStyle;

          updateRowStyle(oldRow);

          currentRow = newRow;

          updateRowStyle(newRow, style);
        },
        getCurrentRow: function() {
          return currentRow;
        },
        getSelectionStyle: function() {
          return currentStyle;
        },
        insertRows: function(start, count) {
          // Rows buffer is completed; move rows from the end to inserted position
          if (start <= this.getCurrentRow()) {
            currentRow += count;
          }

          if (isViewCovered.call(this)) {
            if (start <= bottomRow &&
                start + count >= topRow) {
              if (start < topRow &&
                  start + count >= topRow) {
                count -= topRow - start;
                start = topRow;
              }

              moveRows4Insert(start, count);
              this.regetRows(start);
            }
          } else {
            this.createRows(start, count);
          }
        },
        createRows: function(start, count) {
          if (that.dataModel) {
            //insert new rows into rows buffer
            var indexBefore;

            if (start === undefined) {
              start = getTopRow();
            } else if (start <= getBottomRow()) {
              indexBefore = getChildIndex(start);
            }

            if (count === undefined) {
              count = that.dataModel.getRowCount();
            }

            var viewHeight = getViewHeight();

            var rowHeight;

            that.S
            .do(function() {
              that.S.forEach(that.columns, function(column) {
                if (!column) return;

                rowHeight = column.createRows(viewHeight, start, count, indexBefore, this.getCurrentRow(),
                  this.getSelectionStyle(), that.dataModel, rowHeight);
              }.bind(this), thresholdColumnCount);
            }.bind(this))
            .do_(updateBottomRow);
          }
        },
        regetRows: function(start, count) {
          if (that.dataModel) {
            if (start === undefined ||
              start < getTopRow()) {
              start = getTopRow();
            }

            var lastRow = getBottomRow();
            if (count !== undefined &&
                start + count < lastRow) {
              lastRow = start + count - 1;
            }
            if (lastRow >= that.dataModel.getRowCount()) {
              lastRow = that.dataModel.getRowCount() - 1;
            }

            var startIndex = getChildIndex(start);

            forEachVisibleColumns(function(column) {
              column.regetRows(start, lastRow, startIndex,
                this.getCurrentRow(), this.getSelectionStyle(), that.dataModel);
            }.bind(this));
          }
        },
        removeRows: function(start, count) {
          if (that.dataModel) {
            if (that.getCurrentRow() >= start &&
                that.getCurrentRow() < start + count) {
              that.setCurrentRow(start - 1);
            }

            if (start < this.getCurrentRow()) {
              currentRow -= count;
            }

            if (start < topRow &&
                start + count >= topRow) {
              count -= topRow - start;
              start = topRow;
            }

            if (isExistingRow(start) &&
                that.columns.length > 0) {
              var moved = moveRows4Remove(start, count);
              updateBottomRow();
              if (moved > 0) {
                //this.regetRows(bottomRow - moved + 1, moved);
                this.regetRows(start);
              }

              this.refreshSize();
            }
          }
        },
        updateRow: function(row) {
          if (isExistingRow(row) &&
              that.dataModel) {
            var index = getChildIndex(row);

            forEachVisibleColumns(function(column) {
              column.updateRow(row, index, this.getCurrentRow(),
                this.getSelectionStyle(), that.dataModel);
            }.bind(this));
          }
        },
        updateColumn: function(col) {
          var column = that.getColumnByDataIndex(col);
          if (that.dataModel &&
              column) {
            column.updateColumn(getTopRow(), getBottomRow(), this.getCurrentRow(),
                this.getSelectionStyle(), that.dataModel);
          }
        },
        updateCell: function(row, col) {
          if (isExistingRow(row)) {
            var column = that.getColumnByDataIndex(col);
            if (that.dataModel &&
                column) {
              var index = getChildIndex(row);
              column.updateRow(row, index, this.getCurrentRow(),
                this.getSelectionStyle(), that.dataModel);
            }
          }
        },
        refreshSize: function() {
          var visibleRowCount = getVisibleRowCount();
          if (!visibleRowCount) return;

          var newBottomRow = topRow + visibleRowCount;
          if (newBottomRow > bottomRow &&
              newBottomRow >= that.dataModel.getRowCount()) {
            newBottomRow = that.dataModel.getRowCount() - 1;
          }

          if (newBottomRow > bottomRow) {
            var bottomCount = newBottomRow - bottomRow;
            addRowsBottom(bottomCount);
            bottomRow = newBottomRow;
            this.regetRows(bottomRow - bottomCount + 1, bottomCount);
          }
        },
        getRowTop: function(row) {
          row -= topRow;
          return row * getRowHeight();
        },
        calcExpand: function (expandedRow, expandedCount) {
          var result = scrollTop;
          if (expandedCount &&
              isExistingRow(expandedRow)) {
            var viewHeight = getViewHeight();
            var rowHeight = getRowHeight();

            if (expandedCount * rowHeight >= viewHeight) {
              result = expandedRow * rowHeight;
            } else if (expandedRow + expandedCount > getBottomRow()) {
              result = (expandedRow + expandedCount + 1) * rowHeight - viewHeight;
            }
          }
          return result;
        },
        fitRowsCount: function(count) {
          count = count || getVisibleRowCount();
          for (var i = 0, columnCount = that.columns.length; i < columnCount; i++) {
            that.columns[i].fitRowsCount(count);
          }

          updateBottomRow();
        },
        refreshRowsContent: function() {
          if (that.columns.length <= thresholdColumnCount) return;

          var firstRow = getTopRow();
          var lastRow = getBottomRow();

          var startIndex = getChildIndex(firstRow);

          forEachVisibleColumns(function(column) {
            column.regetRows(firstRow, lastRow, startIndex,
              this.getCurrentRow(), this.getSelectionStyle(), that.dataModel);
          }.bind(this), true);
        },
        getTopRow: getTopRow
      };
    })();

    var setTooltipPos = function(tooltipX, tooltipY, tooltip) {
      tooltip.classList.remove('idvcgrid_tooltip_ellipsis');
      tooltip.style.height = '';

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
        document.documentElement.clientWidth + window.scrollX) {
        tooltipLeft = document.documentElement.clientWidth +
          window.scrollX - tooltip.offsetWidth - marginLeft - rightOffset;
      }

      var marginTop = parseInt(cs.getPropertyValue('margin-top'), 10);
      var bottomOffset = 2;
      var tooltipTop = tooltipY;
      if (tooltipTop < 0) tooltipTop = 0;
      if (tooltipTop + tooltip.offsetHeight + marginTop + bottomOffset >
        document.documentElement.clientHeight + window.scrollY) {
        tooltipTop = document.documentElement.clientHeight +
          window.scrollY - tooltip.offsetHeight - marginTop - bottomOffset;

        if (tooltipTop < 3) {
          tooltipTop = 0;
          tooltip.style.height = (document.documentElement.clientHeight -
            2 * (parseInt(cs.getPropertyValue('padding-top'), 10) + bottomOffset)) + 'px';
          tooltip.classList.add('idvcgrid_tooltip_ellipsis');
        }
      }

      tooltip.style.left = tooltipLeft + 'px';
      tooltip.style.top = tooltipTop + 'px';
    };

    var tooltipInfo = {elem: null, tooltip: null, timer: null};

    var hideTooltip = function() {
      if (tooltipInfo.tooltip) {
        document.body.removeChild(tooltipInfo.tooltip);
      }

      if (tooltipInfo.timer) {
        window.clearTimeout(tooltipInfo.timer);
        tooltipInfo.timer = null;
      }

      if (tooltipInfo.attrs) {
        delete tooltipInfo.attrs;
      }

      tooltipInfo.tooltip = null;
      tooltipInfo.elem = null;
    };

    var showCellTooltip = function() {
      if (!tooltipInfo.elem) {
        return;
      }

      var tooltipText = tooltipInfo.elem.innerHTML;
      var tooltipMargin = 0;

      if (that.dataModel &&
          that.dataModel.getCellLayout) {
        var cellLayout = that.dataModel.getCellLayout(tooltipText);
        if (cellLayout) {
          tooltipText = cellLayout.text;
          tooltipMargin = cellLayout.margin;
        }
      }

      if (!tooltipText.length) {
        return;
      }

      var overCellPos = Utils.getElementPos(tooltipInfo.elem);
      overCellPos.x += tooltipMargin;

      if (overCellPos.x > lastMousePosition.x) {
        return;
      }

      var gridPos = Utils.getElementPos(that.area);
      var overWidth = tooltipInfo.elem.offsetWidth - tooltipMargin;
      if (overCellPos.x + overWidth > window.innerWidth + window.scrollX) {
        overWidth = window.innerWidth + window.scrollX -
          overCellPos.x;
      }
      if (overCellPos.x + overWidth > gridPos.x + that.area.clientWidth) {
        overWidth = gridPos.x + that.area.clientWidth - overCellPos.x;
      }

      var tooltip = document.createElement('div');
      tooltip.className = tooltipInfo.elem.className + ' idvcgrid_popup';
      tooltip.innerHTML = tooltipText;

      Utils.copyAppearance(tooltip, window.getComputedStyle(tooltipInfo.elem, null));

      document.body.appendChild(tooltip);

      if ((tooltip.offsetWidth - 1 > overWidth) ||
          (gridPos.x > overCellPos.x)) {
        if (gridPos.x > overCellPos.x) {
          overCellPos.x = gridPos.x;
        }

        setTooltipPos(overCellPos.x, overCellPos.y, tooltip);
        tooltipInfo.tooltip = tooltip;
      } else {
        document.body.removeChild(tooltip);
      }
    };

    var showStdTooltip = function() {
      var attrs = tooltipInfo.attrs;

      if (!attrs ||
          !attrs.text.length) {
        return;
      }

      var complition = {completed: false};
      that.onShowTooltip.raise(attrs.x, attrs.y, attrs.text, attrs.row, attrs.col, tooltipInfo.elem, complition);
      if (complition.completed) return;

      var tooltip = document.createElement('div');
      tooltip.className = 'idvcgrid_popup idvcgrid_tooltip';
      tooltip.innerHTML = attrs.text;
      Utils.setFont(tooltip, getContentStyle(that.area));

      document.body.appendChild(tooltip);

      setTooltipPos(attrs.x, attrs.y, tooltip);
      tooltipInfo.tooltip = tooltip;
    };

    this.area.onmouseout = hideTooltip;

    var lastMousePosition = {x: -1, y: -1};
    var currentDrag = {
      x: -1,
      columnIndex: -1,
      columnObj: undefined,
      isStarted: false,
      isScrolling: false,
      scrollingInterval: undefined,
      areaPos: undefined,
      scrollingInfo: {
        scrollingDelta: 0
      },
      oldClassName: '',
      clear: function() {
        this.x = -1;
        this.columnIndex = -1;
        this.columnObj = undefined;
        this.isStarted = false;
        this.isScrolling = false;
        this.oldClassName = '';

        if (this.scrollingInterval) {
          clearInterval(this.scrollingInterval);
          this.scrollingInterval = undefined;
        }

        this.areaPos = undefined;

        if (this.columns) delete this.columns;
        if (this.maxX) delete this.maxX;
        if (this.oldClientHeight) delete this.oldClientHeight;
      }};

    this.area.onmousemove = function(e) {
      function showMousePosTooltip(tooltipText, row, col, elem) {
        tooltipInfo.elem = elem;
        tooltipInfo.attrs = {
          x: e.pageX,
          y: e.pageY,
          row: row,
          col: col,
          text: tooltipText
        };
        tooltipInfo.timer = window.setTimeout(showStdTooltip, 350);
      }

      e = e || event;
      if (e.pageX === lastMousePosition.x &&
          e.pageY === lastMousePosition.y) {
        return;
      }

      lastMousePosition.x = e.pageX;
      lastMousePosition.y = e.pageY;

      hideTooltip();

      if (!e.ctrlKey && !e.shiftKey &&
          that.columns.length > 0) {
        if (currentDrag.columnIndex < 0) {
          var res = that.hitTest(e);
          var row = res.row;
          if (row === -1) {
            if (res.columnObj) {
              var sepSize = 8;

              var column = res.columnObj;
              var columnPos = Utils.getElementPos(column.area);
              if (!column.isLastColumn() &&
                  that.isResizable(column.dataIndex) &&
                  e.pageX - columnPos.x > columnPos.width - sepSize) {
                column.header.style.cursor = 'ew-resize';
              } else {
                column.header.style.cursor = 'default';

                if (that.dataModel.getColumnDescription) {
                  showMousePosTooltip(that.dataModel.getColumnDescription(column.dataIndex), row, res.columnObj.dataIndex, column.header);
                }
              }
            }
          } else if (row >= 0) {
            var cellTooltipText;
            var targetCell;
            if (that.dataModel.getCellTooltip) {
              if (res.columnObj) {
                cellTooltipText = that.dataModel.getCellTooltip(row, res.columnObj.dataIndex);
                targetCell = getParentByClass(e.target, 'cell');
                if (cellTooltipText) showMousePosTooltip(cellTooltipText, row, res.columnObj.dataIndex, targetCell);
              }
            }

            if (!cellTooltipText) {
              targetCell = getParentByClass(e.target, 'cell');
              if (targetCell) {
                tooltipInfo.elem = targetCell;
                tooltipInfo.timer = window.setTimeout(showCellTooltip, 250);
              }
            }
          }
        }
      }
    };

    var resizingColumn = function(e) {
      function getScrollingDelta(posX, areaPos) {
        const maxDelta = 50;

        var delta = posX - (areaPos.x + areaPos.width);

        if (delta > maxDelta) delta = maxDelta;
        else if (delta < 0) delta = 0;

        return delta;
      }

      if (currentDrag.columnIndex >= 0 &&
          currentDrag.columnObj) {
        var delta = e.pageX - currentDrag.x;
        if (!currentDrag.isStarted) {
          if (Math.abs(delta) > 5) {
            currentDrag.isStarted = true;

            currentDrag.areaPos = Utils.getElementPos(that.area);

            globalCursor = document.createElement('div');
            globalCursor.className = 'idvcgrid_global_cursor';

            document.body.appendChild(globalCursor);

            if (that.isColumnResizingConstrainedByGridWidth()) {
              var bodyPos = Utils.getElementPos(that.area);
              var rightOffset = 20;
              currentDrag.maxX = bodyPos.x + bodyPos.width - rightOffset;
            }
          }
        } else {
          e.preventDefault();
          var resizingColumn = that.columns[currentDrag.columnIndex];
          if (resizingColumn) {
            var width = resizingColumn.getColumnWidth();
            delta = e.pageX - currentDrag.x;
            if ((currentDrag.maxX && currentDrag.maxX >= e.pageX || !currentDrag.maxX) &&
                width + delta >= 30) {
              that.setColumnWidth(currentDrag.columnIndex, Math.round(width + delta));
              currentDrag.x = e.pageX;
            }
          }

          var scrollingDelta = getScrollingDelta(e.pageX, currentDrag.areaPos);

          currentDrag.scrollingInfo.scrollingDelta = scrollingDelta;

          if (!currentDrag.isScrolling &&
              scrollingDelta > 0) {
            currentDrag.isScrolling = true;

            currentDrag.scrollingInterval = setInterval(function(info) {
              var scrollingDelta = info.scrollingDelta;

              that.area.scrollLeft += scrollingDelta;

              currentDrag.x -= scrollingDelta;

              Utils.dispatchMouseEvent({x: currentDrag.x + scrollingDelta}, 'mousemove', window);
            }, 100, currentDrag.scrollingInfo);
          } else if (currentDrag.isScrolling &&
                     !scrollingDelta) {
            currentDrag.isScrolling = false;
            clearInterval(currentDrag.scrollingInterval);
            currentDrag.scrollingInterval = undefined;
          }
        }
      }
    };

    var forbidSelection = function() {
      return false;
    };

    var globalCursor = null;

    var stopResizingColumn = function() {
      if (currentDrag.columnObj) {
        currentDrag.columnObj.header.className = currentDrag.oldClassName;
      }

      var resized = currentDrag.isStarted;

      if (globalCursor) {
        document.body.removeChild(globalCursor);
        globalCursor = null;
      }

      window.removeEventListener('mousemove', resizingColumn, true);
      window.removeEventListener('mouseup', stopResizingColumn, true);
      window.removeEventListener('selectstart', forbidSelection, false);

      if (resized) {
        if (currentDrag.oldClientHeight !== that.area.clientHeight) {
          that.refreshLayout({height: true});
        }
        that.raiseColumnChanges(false);
      }

      currentDrag.clear();
    };

    var getToColumn = function(pageX, columns) {
      columns = columns || that.columns;

      var res = that.getColumnByPageX(pageX, columns);
      var result = res.columnIndex;

      if (result >= 0) {
        var column = columns[result];
        if (res.x > column.getColumnWidth() / 2) {
          result++;
        }
      } else {
        result = columns.length;
      }

      return result;
    };

    var stopMovingColumn = function(e) {
      e = e || window.event;

      if (currentDrag.columnObj) {
        currentDrag.columnObj.header.className = currentDrag.oldClassName;
      }

      if (currentDrag.isStarted) {
        if (!that.columnsVisModel) {
          that.moveColumn(currentDrag.columnIndex, getToColumn(e.pageX), true);
        } else {
          var parentItem = currentDrag.columnObj.visItem.getParent();
          parentItem.moveChild(currentDrag.columnIndex, getToColumn(e.pageX, currentDrag.columns));
          that.refreshColumns();
          globalCursor = null; // dragging items are removed by refreshColumns
        }
      } else {
        that.clickColumnHeader(currentDrag.columnObj);
      }

      currentDrag.clear();

      if (globalCursor) {
        that.area.removeChild(globalCursor.header);
        that.area.removeChild(globalCursor.pointer);
        globalCursor = null;
      }

      window.removeEventListener('mousemove', movingColumn, true);
      window.removeEventListener('mouseup', stopMovingColumn, true);
      window.removeEventListener('selectstart', forbidSelection, false);
    };

    function buildMovingContent(column) {
      function createMovingSection(column, left, top) {
        if (!column || !column.area.offsetParent) return {section: undefined, left: 0, top:0, width: 0, height: 0};

        var section = document.createElement('div');
        section.className = 'idvcgrid_header_section idvcgrid_header_section_moving';
        section.innerHTML = column.header.innerHTML;

        var columnArea = column.area;
        section.style.left = left + 'px';
        section.style.top = top + 'px';
        section.style.width = columnArea.offsetWidth + 'px';
        var headerHeight = column.getHeaderHeight();
        section.style.height = headerHeight + 'px';

        return {
          section: section,
          left: columnArea.offsetLeft,
          top: columnArea.offsetTop,
          width: columnArea.offsetWidth,
          height: headerHeight
        };
      }

      function processVisItems(items, content, left, top) {
        if (!items) return;

        var count = items.getChildrenCount();
        for (var i = 0; i < count; i++) {
          var sectionContent = undefined;
          var item = items.getChild(i);
          if (item &&
              item.column &&
              item.isVisible()) {
            sectionContent = createMovingSection(item.column, left, top);

            var newBottom = content.top + top + sectionContent.height;
            if (content.bottom < newBottom) {
              content.bottom = newBottom;
            }

            if (sectionContent.section) content.childSections.push(sectionContent.section);
          }

          if (sectionContent) {
            processVisItems(item, content, left, top + sectionContent.height);
            left += sectionContent.width;
          }
        }
      }

      if (!column) return {section: undefined, left: 0, top: 0, height: 0};

      var sectionContainer = document.createElement('div');
      sectionContainer.className = 'idvcgrid_header_section_moving_container';

      var content = createMovingSection(column, 0, 0);
      if (column.visItem) {
        content.childSections = [];
        content.bottom = content.top + content.height;
        processVisItems(column.visItem, content, 0, content.height);
        content.height = content.bottom - content.top;
      }

      sectionContainer.style.left = content.left + 'px';
      sectionContainer.style.top = content.top + 'px';
      sectionContainer.style.height = content.height + 'px';
      sectionContainer.style.width = content.width + 'px';

      sectionContainer.appendChild(content.section);
      if (content.childSections) {
        content.childSections.forEach(sectionContainer.appendChild.bind(sectionContainer));
      }

      return {
        section: sectionContainer,
        left: content.left,
        top: content.top,
        height: content.height
      };
    }

    var movingColumn = function(e) {
      e = e || window.event;
      if (currentDrag.columnObj) {
        e.preventDefault();

        if (!that.isMovable(currentDrag.columnObj.dataIndex)) {
          return;
        }

        var delta = e.pageX - currentDrag.x;
        if (!currentDrag.isStarted) {
          if (Math.abs(delta) > 5) {
            if (currentDrag.columnObj.visItem) {
              currentDrag.columns = [];
              var parentItem = currentDrag.columnObj.visItem.getParent();
              var count = parentItem.getChildrenCount();
              for (var i = 0; i < count; i++) {
                var item = parentItem.getChild(i);
                if (item &&
                    item.isVisible()) {
                  if (item === currentDrag.columnObj.visItem) currentDrag.columnIndex = i;
                  currentDrag.columns.push(item.column);
                }
              }

              if (currentDrag.columns.length <= 1) {
                delete currentDrag.columns;
                return;
              }
            }

            currentDrag.isStarted = true;

            var movingContent = buildMovingContent(currentDrag.columnObj);
            that.area.appendChild(movingContent.section);

            var arrow = document.createElement('div');
            arrow.className = 'idvcgrid_arrow_up';
            arrow.style.top = (movingContent.top + movingContent.height) + 'px';
            arrow.style.left = (movingContent.left - arrow.offsetWidth / 2) + 'px';
            that.area.appendChild(arrow);

            globalCursor = {header: movingContent.section, pointer: arrow};
          }
        } else {
          var currentLeft = parseInt(globalCursor.header.style.left, 10);
          globalCursor.header.style.left = (currentLeft + delta) + 'px';
          currentDrag.x = e.pageX;
          var columns = currentDrag.columns || that.columns;
          var toColumn;
          var toIndex = getToColumn(e.pageX, currentDrag.columns);
          if (toIndex < 0) {
            globalCursor.pointer.style.left =
              (globalCursor.pointer.offsetWidth / 2) + 'px';
          } else if (toIndex >= columns.length) {
            toColumn = columns[columns.length - 1];
            globalCursor.pointer.style.left = (toColumn.area.offsetLeft +
                                               toColumn.area.offsetWidth -
                                               globalCursor.pointer.offsetWidth / 2) + 'px';
          } else {
            toColumn = columns[toIndex];
            globalCursor.pointer.style.left = (toColumn.area.offsetLeft -
                                               globalCursor.pointer.offsetWidth / 2) + 'px';
          }

          var calcScrollDelta = function() {
            var scrollDelta = 0;

            if (globalCursor && globalCursor.header) {
              if (globalCursor.header.offsetLeft +
                  globalCursor.header.offsetWidth > that.area.scrollLeft +
                  that.area.clientWidth) {
                scrollDelta = globalCursor.header.offsetLeft +
                  globalCursor.header.offsetWidth -
                  that.area.scrollLeft -
                  that.area.clientWidth;
                scrollDelta = Math.min(scrollDelta, currentDrag.wholeWidth -
                                      that.area.scrollLeft - that.area.clientWidth);
                if (scrollDelta < 0) {
                  scrollDelta = 0;
                }
              } else if (globalCursor.header.offsetLeft < that.area.scrollLeft &&
                      that.area.scrollLeft > 0) {
                scrollDelta = that.area.scrollLeft -
                  globalCursor.header.offsetLeft;
                scrollDelta = Math.min(scrollDelta, that.area.scrollLeft);
                scrollDelta = -scrollDelta;
              }
            }

            return scrollDelta;
          };

          if (!globalCursor.isScrolling) {
            var scrollDelta = calcScrollDelta();
            if (scrollDelta !== 0) {
              globalCursor.isScrolling = true;

              var scrolling = setInterval(function() {
                var scrollDelta = calcScrollDelta();
                if (scrollDelta !== 0) {
                  that.area.scrollLeft += scrollDelta;
                  currentLeft = parseInt(globalCursor.header.style.left, 10);
                  globalCursor.header.style.left =
                    (currentLeft + scrollDelta) + 'px';

                  Utils.dispatchMouseEvent({x: currentDrag.x}, 'mousemove', window);
                } else {
                  clearInterval(scrolling);
                  if (globalCursor) globalCursor.isScrolling = false;
                }
              }, 200);
            }
          }
        }
      }
    };

    var onMouseDown = function(e) {
      e = e || event;
      if (that.columns.length > 0) {
        var res = that.hitTest(e);
        var row = res.row;
        if (row === -1) {
          if (res.columnObj &&
              e.button === 0 && !e.ctrlKey && !e.shiftKey) {
            currentDrag.x = e.pageX;
            var column = res.columnObj;
            currentDrag.columnObj = column;
            currentDrag.columnIndex = that.columns.indexOf(column);
            currentDrag.oldClassName = column.header.className;
            e.preventDefault();

            if (column.header.style.cursor === 'ew-resize') {
              column.header.className += ' idvcgrid_header_section_hover';
              currentDrag.isStarted = false;
              if (currentDrag.columnIndex < 0) {
                var lastChild = column.getLastChild();
                if (lastChild) {
                  currentDrag.columnIndex = that.columns.indexOf(lastChild);
                }
              }

              currentDrag.oldClientHeight = that.area.clientHeight;

              window.addEventListener('mousemove', resizingColumn, true);
              window.addEventListener('mouseup', stopResizingColumn, true);
              window.addEventListener('selectstart', forbidSelection, false);
            } else if (that.columns.length > 0) {
              currentDrag.isStarted = false;
              currentDrag.wholeWidth = that.area.scrollWidth;

              if (that.isSortable(column.dataIndex)) {
                column.header.className += ' idvcgrid_header_section_active';
              }

              if (that.columns.length > 1) {
                window.addEventListener('mousemove', movingColumn, true);
              }
              window.addEventListener('mouseup', stopMovingColumn, true);
              window.addEventListener('selectstart', forbidSelection, false);
            }
          }
        } else if (row >= 0) {
          if (e.button !== 0 && that.isRowSelected(row)) return;

          that.setCurrentRow(row, false,
            {ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, toggle: e.ctrlKey, isMouse: true});
          that.rowVisible(row);
        }
      }
    };

    this.area.addEventListener('mousedown', onMouseDown, false);

    function processMouseWheel(prop, coef, processHorz, e) {
      e = e || window.event;

      var wheelDelta = e[prop] * coef;

      if (!e.shiftKey) {
        var newScroll = this.getScrollTop() + wheelDelta
        this.setScrollTop(newScroll);
      } else if (processHorz) {
        this.area.scrollLeft += wheelDelta;
        e.stopPropagation();
        e.preventDefault();
      }
    }

    this.area.addEventListener('mousewheel', processMouseWheel.bind(this, 'wheelDelta', -1/4, false), false);
    this.area.addEventListener('DOMMouseScroll', processMouseWheel.bind(this, 'detail', 30, true), false);

    function makeEventParams(row) {
      return {
        isFooter: row === -2,
        isHeader: row === -1,
        isRow: row >= 0
      };
    }

    this.area.ondblclick = function(e) {
      e = e || event;
      if (!e.ctrlKey && !e.shiftKey &&
          that.columns.length > 0) {
        var res = that.hitTest(e);

        var row = res.row;
        var column = res.columnObj;
        if (column && row === -1 &&
            column.header.style.cursor === 'ew-resize') {
          column = column.getLastChild();
          that.fitColumnOptimalWidth(that.columns.indexOf(column), column.getMaxAutoSizeWidth());
          that.raiseColumnChanges(false);
        } else {
          that.onDblClick.raise(row, column ? column.dataIndex : -1, makeEventParams(row));
        }
      }
    };

    this.area.oncontextmenu = function(e) {
      e = e || event;
      if (!e.ctrlKey && !e.shiftKey &&
          that.columns.length > 0) {
        var res = that.hitTest(e);

        var row = res.row;
        var column = res.columnObj;
        var propagation = {stopPropagation: true};
        that.onContextMenu.raise(row, column ? column.dataIndex : -1, propagation, makeEventParams(row), e.pageX, e.pageY, e);

        if (that.onContextMenu._subscribers.length && propagation.stopPropagation) {
          e.stopPropagation();
        }
      }
    };

    this.area.onselectstart = function() {
      return false;
    };

    this.area.onkeydown = function(e) {
      var keyState = {ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, toggle: e.keyCode === 32};
      if (e.keyCode === 33) {
        that.currentPgUp(keyState);
        e.preventDefault();
      } else if (e.keyCode === 34) {
        that.currentPgDown(keyState);
        e.preventDefault();
      } else if (e.keyCode === 35) {
        that.currentEnd(keyState);
        e.preventDefault();
      } else if (e.keyCode === 36) {
        that.currentHome(keyState);
        e.preventDefault();
      } else if (e.keyCode === 38) {
        that.currentUp(keyState);
        e.preventDefault();
      } else if (e.keyCode === 40) {
        that.currentDown(keyState);
        e.preventDefault();
      } else if (e.keyCode === 13) {
        if (that.getCurrentRow() >= 0) {
          that.onDblClick.raise(that.getCurrentRow());
        }
      } else if (e.keyCode === 32) {
        that.setCurrentRow(that.getCurrentRow(), false, keyState);
      } else if (e.keyCode === 65 && (e.ctrlKey || e.metaKey)) {
        keyState.all = true;
        that.setCurrentRow(that.getCurrentRow(), false, keyState);
        e.preventDefault();
      }
    };

    this.area.onfocus = function() {
      this.processSetFocus(true);
    }.bind(this);

    this.area.onblur = function() {
      that.processLostFocus(true);
    };

    this.area.onscroll = function() {
      this.fitCentralColumnHeader();

      this.visibleColumnsRange = undefined;
      this._viewport.refreshRowsContent();

      if (Utils.Consts.engine === 'moz') {
        if (!this.hoverEnableAsync) {
          this.hoverEnableAsync = Utils.createAsyncCall(
            Utils.enableHover, undefined, 250);
        }

        Utils.disableHover(this.area);

        this.hoverEnableAsync.call(this.area);
      }
    }.bind(this);
  }

  GridBody.prototype.hitTest = function(ev) {
    var row = -1;

    var column = getColumnByElement(ev.target);
    if (column &&
        this.getRowsAreaHeight()) {
      var elemPos = Utils.getElementPos(column.scrollArea);
      if (!elemPos.height && !elemPos.width) {
        row = -1; // inactive column
      } else {
        var top = ev.pageY - elemPos.y;
        if (top > elemPos.height) {
          row = -2;
        } else if (top > 0) {
          var targetCell = getParentByClass(ev.target, 'cell');
          if (targetCell) {
            row = 0;
            var sibling = targetCell;
            while (sibling = sibling.previousSibling) row++;
            row += this._viewport.getTopRow();
          } else {
            row = -3;
          }
        }
      }
    } else if (!column) {
      row = -3;
    }

    return {
      row: row,
      columnObj: column
    };
  };

  function getColumnByElement(element) {
    var columnObj;
    if (element) {
      var parent = element.parentElement;
      if (parent) {
        columnObj = parent.columnObj;
        if (!columnObj) {
          columnObj = getColumnByElement(parent);
        }
      }
    }

    return columnObj;
  }

  GridBody.prototype.getColumnByPageX = function(val, columns) {
    columns = columns || this.columns;
    var result = -1;
    var obj;

    var len = columns.length;
    if (len) {
      var elemPos = Utils.getElementPos(this.area);
      var left = val - elemPos.x + this.area.scrollLeft - columns[0].area.offsetLeft;

      for (var i = 0; i < len; i++) {
        left -= columns[i].getColumnWidth();
        if (left <= 0) {
          result = i;
          obj = columns[i];
          left = columns[i].getColumnWidth() + left;
          break;
        }
      }
    }

    return {
      columnIndex: result,
      x: left,
      columnObj: obj
    };
  };

  GridBody.prototype._isActive = function() {
    return this.columns.length > 0;
  };

  GridBody.prototype._updateScrollTop = function(val) {
    if (val !== this.getScrollTop()) {
      this._viewport.setScrollTop(val);

      if (this.isCentralColumn()) {
        this.fitcentralColumnAsync.call();
      }
    }
  };

  GridBody.prototype._updateColumnsScrollTop = function(val) {
    this._viewport.setColumnsScrollTop(val);
  };

  GridBody.prototype._getScrollState = function() {
    return {
      columnScrollTop: this._viewport.getColumnsScrollTop(),
      topRow: this._viewport.getTopRow()
    };
  };

  GridBody.prototype.setScrollTop = function(val) {
    if (val !== this.getScrollTop()) {
      this.scrolling.setScrollTop(val);
    }
  };

  GridBody.prototype.getScrollTop = function() {
    return this._viewport.getScrollTop();
  };

  GridBody.prototype.clearView = function() {
    this.setScrollTop(0);

    Utils.removeAllChildren(this.area);

    this.columns.length = 0;
    this.inActiveColumns.length = 0;
    this._viewport.clear();
  };

  GridBody.prototype.clearRows = function(currentRow) {
    this.setScrollTop(0);

    for(var i = 0, len = this.columns.length; i < len; i++) {
      this.columns[i].clearRows();
    }

    this._viewport.clear();

    if (currentRow === undefined) {
      this._viewport.updateCurrentRow(-1);
    } else {
      this._viewport.updateCurrentRow(currentRow);
    }
  };

  GridBody.prototype.refreshDataModel = function() {
    if (this.dataModel &&
        this.dataModel.setElement !== undefined) {
      this.dataModel.setElement(this);
    }
  };

  GridBody.prototype.refreshRows = function(currentRow, rowCount) {
    var keepRows = (rowCount !== undefined &&
                    this.dataModel &&
                    this.dataModel.getRowCount() === rowCount);

    if (!keepRows) {
      this.clearRows(currentRow);
      this._viewport.createRows();
    } else {
      this._viewport.regetRows();
      this.setCurrentRow(currentRow);
    }

    this.refreshDataModel();
  };

  GridBody.prototype.refreshView = function() {
    Utils.removeAllChildren(this.area);

    this.columns.length = 0;
    this.inActiveColumns.length = 0;

    this.updateView();
  };

  GridBody.prototype.refreshColumns = function() {
    var scrollLeft = this.area.scrollLeft;
    var scrollTop = this._viewport.getColumnsScrollTop();

    this.S
    .do_(this.refreshView.bind(this))
    .do_(function() {
      this.area.scrollLeft = scrollLeft;
      this.scrolling.updateColumnsScrollTop(scrollTop);

      this.raiseColumnChanges(true);
    }.bind(this));
  };

  GridBody.prototype.raiseColumnChanges = function(global) {
    if (this.columnsVisModel && this.columnsVisModel.onChange) {
      this.columnsVisModel.onChange.raise(global);
    }
  };

  GridBody.prototype.processExpandColumn = function(column) {
    this.refreshColumns();
    this.onExpandColumn.raise(column.dataIndex, column.visItem.getState());
  };

  GridBody.prototype.refreshScroll = function() {
    if (this.onRefreshScroll) this.onRefreshScroll();
  };

  GridBody.prototype.updateView = function() {
    if (!this.area.offsetParent) {
      this._needRefreshView = true;
      return;
    }

    this._sizes = {};
    if (this.dataModel) {
      this.S
      .do_(this.insertColumns.bind(this))
      .do_(this._viewport.createRows.bind(this._viewport))
      .do(function() {
        this.refreshDataModel();
        this.updateFooter();

        if (this.isCentralColumn()) {
          this.fitCentralColumnWidth();
          this.S.end();
        } else {
          this.applyColumnAutoSize();
        }
      }.bind(this))
      .do_(this.refreshScroll.bind(this));
    }
  };

  function updateColumnCaption(column, state) {
    if (this.dataModel && column) {
      var params = {
        state: state || column.getState(),
        width: 300, // some default column width
        height: column.getHeaderHeight() || this.headerLevelHeight,
        levelHeight: this.headerLevelHeight
      };
      column.setCaption(this.dataModel.getColumnCaption(column.dataIndex, params));
    }
  };


  GridBody.prototype.insertColumns = function() {
    var processedColumns = 0;
    var isCanceled = false;

    function addColumn(dataIndex, state, isLeaf) {
      if (isCanceled) return;

      var column = new GridColumn(this.area, dataIndex, state);

      if (!this.isSortable(dataIndex)) {
        column.setSortable(false);
      }

      column.updateLayout(this.dataModel);

      if (isLeaf) this.columns.push(column);
      else this.inActiveColumns.push(column);

      return column;
    }

    var columnSizes = {
      headerBottom: 0,
      scrollTop: 0,
      levelHeight: 0
    };

    function enumVisItems(items, level, processItem, processItemRes, onInterrupt, onEnd, index) {
      processItem = processItem || function() {};
      processItemRes = processItemRes || function() {};
      onInterrupt = onInterrupt || function() {};
      onEnd = onEnd || function() {};

      index = index || 0;

      var result = 0;

      var checkCanceled = function() {
        var result = false;
        if (this.S.canceled()) {
          isCanceled = true;
          this.S.end();
          result = true;
        }

        return result;
      }.bind(this);

      processChildren.call(this, index, items);

      function processChildren(startIndex, items) {
        if (checkCanceled()) {
          return;
        }

        var i = startIndex;
        var count = items.getChildrenCount();
        while (i < count) {
          if (checkCanceled()) {
            return;
          }

          var item = items.getChild(i);
          if (item &&
              item.isVisible()) {
            result += processItem.call(this, item, level) || 0;
            processedColumns++;

            if (!item.isLeaf()) {
              var res = enumVisItems.call(this, item, level + 1, processItem,
                processItemRes, onInterrupt, onEnd);
              processItemRes.call(this, item, res);
            }
          }

          i++;

          if (level === 0 &&
              processedColumns >= thresholdColumnCount &&
              i < count - 1) {
            onInterrupt.call(this);

            processedColumns = 0;
            this.S.nextStep(enumVisItems.bind(this, items, 0, processItem, processItemRes,
                onInterrupt, onEnd, i));
            if (checkCanceled()) {
              return;
            }
            break;
          }
        }

        if (level === 0 &&
            i >= count) {
          onEnd.call(this);
          this.S.end();
        }
      }

      return result;
    }

    function createColumnsByVisItems(items) {
      processedColumns = 0;
      enumVisItems.call(this, items, 0, function(item) {
        var isLeafColumn = item.isLeaf();

        var columnState = item.getState();
        var column = addColumn.call(this, item.getDataIndex(), columnState, isLeafColumn);
        processedColumns++;

        column.visItem = item;
        item.column = column;
        column.setState(columnState);
        column.onExpandColumn = this.processExpandColumn.bind(this);

        if (isLeafColumn) {
          var styleWidth = item.getWidth();
          if (styleWidth) column.area.style.width = styleWidth;
        }
      });
    }

    function updateColumnCaptionsByVisItems(items) {
      processedColumns = 0;
      enumVisItems.call(this, items, 0, function(item) {
        updateColumnCaption.call(this, item.column, item.getState());
      });
    }

    function calcPositionsByVisItems(items) {
      processedColumns = 0;
      var bottomMap = new Map();
      enumVisItems.call(this, items, 0, function(item, level) {
        var headerBottom = 0;
        if (level === 0) {
          bottomMap.clear();
        } else {
          headerBottom = bottomMap.get(level -1);
        }

        var column = item.column;

        var calculatedPos = {};

        var headerEl = column.header;
        var headerPos = headerEl.getBoundingClientRect();
        calculatedPos.headerPosTop = headerPos.top;
        calculatedPos.headerPosHeight = headerPos.height;
        if (!columnSizes.levelHeight) {
          columnSizes.levelHeight = headerPos.height;
          this.headerLevelHeight = columnSizes.levelHeight;
        }

        var scrollAreaTop = column.getRowsViewStart();
        calculatedPos.scrollTopDelta = this.keepScrollAreaOffset ?
              scrollAreaTop - headerPos.height :
              0;

        if (item.getHeight) {
          var columnHeight = item.getHeight();
          if (columnHeight > 1) {
            calculatedPos.headerPosHeight = columnHeight * columnSizes.levelHeight;
            calculatedPos.customHeaderPosHeight = calculatedPos.headerPosHeight;
          }
        }

        headerBottom += calculatedPos.headerPosHeight;
        var savedHeaderBottom = bottomMap.get(level);

        if (!savedHeaderBottom || savedHeaderBottom < headerBottom) {
          bottomMap.set(level, headerBottom);
        }

        if (columnSizes.headerBottom < headerBottom + 1) {
          columnSizes.headerBottom = headerBottom + 1;
          columnSizes.scrollTop = columnSizes.headerBottom + calculatedPos.scrollTopDelta;
        }

        if (item.isLeaf()) {
          calculatedPos.columnWidth = column.getColumnWidth();
        }

        item.calculatedPos = calculatedPos;
      });
    }

    function setColumnPositionsByVisItems(items) {
      processedColumns = 0;

      var topMap = new Map();
      var columnLeft = 0;
      enumVisItems.call(this, items, 0, function(item, level) {
        var columnTop = 0;
        if (level === 0) {
          topMap.clear();
        } else {
          columnTop = topMap.get(level);
        }

        var column = item.column;
        var calculatedPos = item.calculatedPos;

        topMap.set(level + 1, columnTop + calculatedPos.headerPosHeight);

        column.setTop(columnTop);
        column.setLeft(columnLeft, true);

        if (item.calculatedPos.customHeaderPosHeight) {
          column.setHeaderHeight(calculatedPos.customHeaderPosHeight);
        }

        var result = 0;
        if (calculatedPos.columnWidth) {
          result = calculatedPos.columnWidth;
          columnLeft += calculatedPos.columnWidth;
        }

        delete item.calculatedPos;

        return result;
      }, function(item, width) {
        item.column.area.style.width = width + 'px';
      }, function() {
        this.fitHeaderHeight(columnSizes);
      }, function() {
        this.fitHeaderHeight(columnSizes);
      });
    }

    if (this.dataModel) {
      var columnCount = this.dataModel.getColumnCount();

      this.S
      .do_(function createColumns() {
        if (!this.columnsVisModel) {
          var headerHeight;
          for (var i = 0; i < columnCount; i++) {
            var dataIndex = i;
            if (this.dataModel.getDataIndex) {
              dataIndex = this.dataModel.getDataIndex(dataIndex);
            }
            var column = addColumn.call(this, dataIndex, HeaderItemState.simple, true);
            if (!headerHeight) {
              headerHeight = column.getHeaderHeight();
              this.headerLevelHeight = headerHeight;
            }
            column.setHeaderHeight(headerHeight);
          }

          this.fitColumns();
          this.fitHeaderHeight();

          for (i = 0, len = this.columns.length; i < len; i++) {
            updateColumnCaption.call(this, this.columns[i], HeaderItemState.simple);
          }
        } else {
          this.S
            .do(createColumnsByVisItems.bind(this, this.columnsVisModel))
            .do(calcPositionsByVisItems.bind(this, this.columnsVisModel))
            .do(setColumnPositionsByVisItems.bind(this, this.columnsVisModel))
            .do(updateColumnCaptionsByVisItems.bind(this, this.columnsVisModel))
        }
      }.bind(this))
      .do_(function expandLastColumn() {
        var columnLength = this.columns.length;
        if (columnLength >= 1 &&
            this.isLastColumnExpanded()) {
          this.columns[columnLength - 1].setLastColumnStyle();
        }
      }.bind(this));
    }
  };

  GridBody.prototype.fitColumns = function() {
    if (this.columnsVisModel) return;

    var len = this.columns.length;
    if (!len) return;

    var currentLeft = 0;
    var scrollTop;

    if (!this.keepScrollAreaOffset) {
      scrollTop = this.columns[0].getHeaderHeight();
    }

    var widths = [];
    widths.length = len;

    for (var i = 0; i < len; i++) {
      widths[i] = this.columns[i].getColumnWidth();
    }

    for (i = 0; i < len; i++) {
      var column = this.columns[i];
      column.setLeft(currentLeft);
      currentLeft += widths[i];

      if (scrollTop !== undefined) {
        column.setScrollAreaTop(scrollTop);
      }
    }
  };

  var thresholdColumnCount = 200;

  GridBody.prototype.applyColumnAutoSize = function(columns) {
    columns = columns || this.columns;

    var currentLeft = 0;
    var needClearSizes = false;

    this.S.forEach(columns, function(column, index) {
      if (!column) {
        return;
      }

      column.prepare4OptimalWidth();

    }.bind(this), thresholdColumnCount);

    var widths = [];
    widths.length = columns.length;

    this.S.forEach(columns, function(column, index) {
      if (!column) {
        return;
      }

      var visItem = column.visItem;
      if (((visItem &&
          (visItem.isAutoSize() || !parseInt(visItem.getWidth())) &&
          !visItem.isOptimalWidth) ||
         (!visItem &&
          !column.isOptimalWidth)) &&
         (!this.dataModel ||
          !this.dataModel.beforeColumnAutoSize ||
          this.dataModel.beforeColumnAutoSize(column.dataIndex))) {
        var optimalWidth = column.getOptimalWidth();
        optimalWidth = Math.ceil(Math.min(optimalWidth, column.getMaxAutoSizeWidth() || optimalWidth));

        widths[index] = optimalWidth;
      } else {
        widths[index] = -column.getColumnWidth();
      }

    }.bind(this), thresholdColumnCount);

    this.S.forEach(columns, function(column, index) {
      if (!column) {
        return;
      }

      column.cleanUp4OptimalWidth();

    }.bind(this), thresholdColumnCount);

    var currentLeft = 0;

    this.S.forEach(columns, function(column, index) {
      if (!column) {
        return;
      }

      column.setLeft(currentLeft, true);

      var columnWidth = widths[index];
      if (columnWidth > 0) {
        column.setWidth(columnWidth, true, true);
        needClearSizes = true;
      }

      currentLeft += Math.abs(columnWidth);

    }.bind(this), thresholdColumnCount);

    this.S.forEach(columns, function(column, index) {
      if (!column) {
        return;
      }

      column.fitParent();

    }.bind(this), thresholdColumnCount);

    if (needClearSizes) this._sizes = {};
  };

  GridBody.prototype.fitHeaderHeight = function(columnSizes, isSignal) {
    //if (this._sizes.headerBottom === columnSizes.headerBottom) return;

    this._sizes = {};

    if (!this.columns.length) return;

    if (columnSizes) {
      this._sizes.headerBottom = columnSizes.headerBottom;

      for (var i = 0, len = this.columns.length; i < len; i++) {
        var column = this.columns[i];
        var columnTop = column.getTop();
        column.setHeaderHeight(columnSizes.headerBottom - columnTop);
        column.setScrollAreaTop(columnSizes.scrollTop - columnTop);
      }

      if (columnSizes.levelHeight &&
          !this.headerLevelHeight) {
        this.headerLevelHeight = columnSizes.levelHeight;
      }
    }

    if (this.isCentralColumn()) {
      this.updateColumnCaption(0);
    }

    this.refreshScroll();
    this._viewport.refreshSize();
    if (!isSignal) this.onFitHeaderHeight.raise(columnSizes, true);
  };

  GridBody.prototype.fitExpand = function (expandedRow, expandedCount) {
    if (expandedCount) {
      var scrollTop = this._viewport.calcExpand(expandedRow, expandedCount);
      this.setScrollTop(scrollTop);
    }
  }

  GridBody.prototype.getColumnByDataIndex = function(index, all) {
    var result = this.columns[index];

    function isColumn(column) {
      if (column.dataIndex === index) {
        result = column;
        return true;
      }

      return false;
    }

    if (!result ||
        result.dataIndex !== index) {
      result = null;

      this.columns.some(isColumn);
      if (!result && all) this.inActiveColumns.some(isColumn);
    }

    return result;
  };

  GridBody.prototype.updateCells = function(updatedCells) {
    if (!updatedCells.length) {
      this._viewport.regetRows();
    }

    updatedCells.forEach(function(cell) {
      if (!cell) return;

      if (cell.col === undefined) {
        this._viewport.updateRow(cell.row);
      } else if (cell.row === undefined) {
        this._viewport.updateColumn(cell.col);
      } else if (cell.row === -1) {
        this.updateColumnCaption(cell.col);
      } else {
        this._viewport.updateCell(cell.row, cell.col);
      }
    }.bind(this));
  };

  GridBody.prototype.updateColumnCaption = function(col) {
    var column = this.getColumnByDataIndex(col, true);
    if (column) updateColumnCaption.call(this, column);
  };

  GridBody.prototype.getSelectionStyle = function() {
    return 'idvcgrid_cell idvcgrid_selected_row';
  };

  GridBody.prototype.setCurrentRow = function(row, stopPropagation, keyState) {
    if (isNaN(row)) {
      return;
    }

    var updateCurrentRow = function(row) {
      var result = false;

      var oldCurrent = this.getCurrentRow();
      if (oldCurrent !== row) {
        this._viewport.setCurrentRow(row, oldCurrent);
        result = true;
      }

      return result;
    }.bind(this);

    if (this.dataModel &&
        this.dataModel.setCurrentRow) {
      updateCurrentRow = function(row, keyState) {
        var result = false;

        this._viewport.updateCurrentRow(row);
        if (!stopPropagation) {
          result = this.dataModel.setCurrentRow(row, keyState);
        }

        return result;
      }.bind(this);
    }

    if (updateCurrentRow(row, keyState) &&
        !stopPropagation) {
      this.currentChangeAsync.call(row, keyState);

      if (this.connectedBody) {
        this.connectedBody.setCurrentRow(row, true, keyState, this);
      }
    }
  };

  GridBody.prototype.getCurrentRow = function() {
    if (this.dataModel &&
        this.dataModel.getCurrentRow) {
      return this.dataModel.getCurrentRow();
    }
    return this._viewport.getCurrentRow();
  };

  GridBody.prototype.isRowSelected = function(row) {
    if (this.dataModel &&
        this.dataModel.isRowSelected) {
      return this.dataModel.isRowSelected(row);
    }
    return this._viewport.getCurrentRow() === row;
  };

  GridBody.prototype.processSetFocus = function(propagate) {
    this.area.classList.add('idvcgrid_focused');

    if (this.connectedBody &&
        propagate) {
      this.connectedBody.processSetFocus(false, this);
    }

    if (propagate) this.onSetFocus.raise();
  };

  GridBody.prototype.processLostFocus = function(propagate) {
    this.area.classList.remove('idvcgrid_focused');

    if (this.connectedBody &&
          propagate) {
      this.connectedBody.processLostFocus(false, this);
    }

    if (propagate) this.onLostFocus.raise();
  };

  GridBody.prototype.getVisibleColumnsRange = function() {
    if (this.visibleColumnsRange) return this.visibleColumnsRange;

    var first = -1;
    var last = -1;

    var len = this.columns.length;
    if (len) {
      var left = -this.area.scrollLeft;
      var right = this.area.offsetWidth;

      for (var i = 0; i < len; i++) {
        left += this.columns[i].getColumnWidth();
        if (left > 0) {
          first = i;
          break;
        }
      }

      if (left >= right) {
        last = first;
      } else {
        for (i = first + 1; i < len; i++) {
          left += this.columns[i].getColumnWidth();
          if (left >= right) {
            last = i;
            break;
          }
        }

        if (last < 0) last = len - 1;
      }
    }

    this.visibleColumnsRange = {
      first: first,
      last: last
    };

    return this.visibleColumnsRange;
  };

  GridBody.prototype.getVisibleRowsRange = function() {
    var bodyHeight = this.getRowsAreaHeight();
    var rowHeight = this.getRowHeight();
    var scrollTop = this.getScrollTop();
    var epsilon = 0.2;

    return {
      first: Math.ceil(scrollTop / rowHeight),
      last: Math.floor((scrollTop + bodyHeight) / rowHeight + epsilon) - 1
    };
  };

  GridBody.prototype.isRowVisible = function(row) {
    var range = this.getVisibleRowsRange();
    return row >= range.first && row <= range.last;
  };

  GridBody.prototype.getRowPos = function(row) {
    var result = 0;

    var range = this.getVisibleRowsRange();
    if (row < range.first) result = -1;
    else if (row > range.last) result = 1;

    return result;
  };

  GridBody.prototype.currentToVisibleTop = function() {
    this.rowVisibleTop(this.getCurrentRow());
  };

  GridBody.prototype.currentToVisibleBottom = function() {
    this.rowVisibleBottom(this.getCurrentRow());
  };

  GridBody.prototype.currentToVisibleCenter = function(scrollAllways) {
    this.rowVisibleCenter(this.getCurrentRow(), scrollAllways);
  };

  GridBody.prototype.rowVisibleTop = function(row) {
    var newScrollTop = row * this.getRowHeight();
    if (newScrollTop < 0) {
      newScrollTop = 0;
    }

    if (newScrollTop != this.getScrollTop()) {
      this.setScrollTop(newScrollTop);
    }
  };

  GridBody.prototype.rowVisibleBottom = function(row) {
    var bodyHeight = this.getRowsAreaHeight();

    var newScrollTop = (row + 1) * this.getRowHeight() -
      bodyHeight;

    if (newScrollTop != this.getScrollTop()) {
      this.setScrollTop(newScrollTop);
    }
  };

  GridBody.prototype.rowVisibleCenter = function(row, scrollAllways) {
    if (!scrollAllways &&
        this.isRowVisible(row)) {
      return;
    }

    var bodyHeight = this.getRowsAreaHeight();

    var newScrollTop = (row + 1) * this.getRowHeight() -
      bodyHeight / 2;

    if (newScrollTop !== this.getScrollTop()) {
      this.setScrollTop(newScrollTop);
    }
  };

  GridBody.prototype.columnToVisible = function(col, colOffset) {
    function updateScrollLeft(minOffset, maxOffset) {
      var area = this.area;
      var scrollLeft = area.scrollLeft;
      var clientWidth = area.clientWidth;

      var newScrollLeft = scrollLeft;

      if (maxOffset > newScrollLeft + clientWidth) {
        newScrollLeft = maxOffset - clientWidth;
      }

      if (minOffset < newScrollLeft) {
        newScrollLeft = minOffset;
      }

      if (newScrollLeft !== scrollLeft) {
        this.area.scrollLeft = newScrollLeft;
      }
    }

    function normalizeOffset(offset) {
      offset = offset || {};

      var result = {
        left: (offset.left || 0),
        width: (offset.width || 0),
        useScrollLeft: (offset.useScrollLeft || false),
        contentWidth: (offset.contentWidth || 0)
      }

      var padding = Utils.em2px(0.5, this.area);

      if (offset.left) {
        result.left -= padding;
        if (result.left < 0) result.left = 0;
      }

      if (offset.left) padding += (offset.left - result.left);
      if (result.width) result.width += padding;

      return result;
    }

    function applyScrollLeft(offset, columnWidth) {
      if (!offset || !offset.useScrollLeft) return offset;

      var contentWidth = offset.contentWidth || 0;
      var left = offset.left;
      if (left &&
          contentWidth &&
          contentWidth > columnWidth) {
        if (contentWidth - left >= columnWidth) {
          offset.left = 0;
        } else {
          offset.left -= (contentWidth - columnWidth);
          if (offset.left < 0) offset.left = 0;
        }
      }

      return offset;
    }

    var target = this.getColumnByDataIndex(col, true);
    if (!target) return false;

    target = target.getFirstChild();

    var minColumnOffset = 0;
    var maxColumnOffset = 0;
    this.columns.some(function(column) {
      if (column !== target) {
        minColumnOffset += column.getColumnWidth();
        return false;
      }

      maxColumnOffset = minColumnOffset + column.getColumnWidth();
      return true;
    });

    var normOffset = applyScrollLeft(normalizeOffset.call(this, colOffset),
      maxColumnOffset - minColumnOffset);

    var minContentOffset = normOffset.left;
    var maxContentOffset = minContentOffset + normOffset.width;

    if (maxContentOffset) {
       maxColumnOffset = Math.min(maxColumnOffset, minColumnOffset + maxContentOffset)
    }

    updateScrollLeft.call(this, minColumnOffset + minContentOffset, maxColumnOffset);

    return true;
  };

  GridBody.prototype.currentRowVisible = function() {
    this.rowVisible(this.getCurrentRow());
  };

  GridBody.prototype.rowVisible = function(row) {
    var pos = this.getRowPos(row);
    if (pos < 0) this.rowVisibleTop(row);
    else if (pos > 0) this.rowVisibleBottom(row);
  };

  GridBody.prototype.currentUp = function(keyState) {
    var newCurrent = this.getCurrentRow() - 1;
    if (newCurrent >= 0) {
      this.setCurrentRow(newCurrent, false, keyState);
      this.rowVisible(newCurrent);
    }
  };

  GridBody.prototype.currentDown = function(keyState) {
    var newCurrent = this.getCurrentRow() + 1;
    if (this.dataModel &&
        newCurrent <= this.dataModel.getRowCount() - 1) {
      this.setCurrentRow(newCurrent, false, keyState);
      this.rowVisible(newCurrent);
    }
  };

  GridBody.prototype.getPageRowCount = function() {
    var bodyHeight = this.getRowsAreaHeight();
    return Math.floor(bodyHeight / this.getRowHeight());
  };

  GridBody.prototype.currentPgUp = function(keyState) {
    if (this.getCurrentRow() > 0) {
      var newCurrent = this.getCurrentRow() - this.getPageRowCount();
      if (newCurrent < 0) {
        newCurrent = 0;
      }

      this.setCurrentRow(newCurrent, false, keyState);
      this.rowVisible(newCurrent);
    }
  };

  GridBody.prototype.currentPgDown = function(keyState) {
    if (this.dataModel &&
        this.getCurrentRow() < this.dataModel.getRowCount() - 1) {
      var newCurrent = this.getCurrentRow() + this.getPageRowCount();
      if (newCurrent >= this.dataModel.getRowCount()) {
        newCurrent = this.dataModel.getRowCount() - 1;
      }

      this.setCurrentRow(newCurrent, false, keyState);
      this.rowVisible(newCurrent);
    }
  };

  GridBody.prototype.currentHome = function(keyState) {
    if (this.getCurrentRow() > 0) {
      this.setCurrentRow(0, false, keyState);
      this.rowVisibleTop(0);
    }
  };

  GridBody.prototype.currentEnd = function(keyState) {
    var newCurrent = this.dataModel.getRowCount() - 1;
    if (this.dataModel &&
        this.getCurrentRow() < newCurrent) {
      this.setCurrentRow(newCurrent, false, keyState);
      this.rowVisibleBottom(newCurrent);
    }
  };

  GridBody.prototype.getRowHeight = function() {
    if (this._sizes.rowHeight !== undefined) return this._sizes.rowHeight;

    if (this.getRowBufferSize()) {
      this._sizes.rowHeight = this.columns[0].getRowHeight();
      return this._sizes.rowHeight;
    }

    return 1;
  };

  GridBody.prototype.getRowTop = function(row) {
    return this._viewport.getRowTop(row);
  };

  GridBody.prototype.getViewHeight = function() {
    if (this.columns.length) {
      return this.getRowsAreaHeight();
    }

    return 1;
  };

  GridBody.prototype.getRowBufferSize = function() {
    if (this.columns.length > 0) {
      return this.columns[0].getRowBufferSize();
    }

    return 0;
  };

  GridBody.prototype.getHeaderHeight = function() {
    if (this.columns.length > 0) {
      return this.columns[0].getHeaderHeight();
    }

    return 0;
  };

  GridBody.prototype.getRowsAreaStart = function() {
    if (this.columns.length > 0) {
      var scrollPos = Utils.getElementPos(this.columns[0].scrollArea);
      var bodyPos = Utils.getElementPos(this.area);
      return scrollPos.y - bodyPos.y;
    }

    return 0;
  };

  GridBody.prototype.getRowsAreaHeight = function() {
    if (this._sizes.rowsAreaHeight !== undefined) return this._sizes.rowsAreaHeight;

    if (this.columns.length > 0) {
      this._sizes.rowsAreaHeight = this.columns[0].getRowsViewHeight();
      return this._sizes.rowsAreaHeight;
    }

    return 0;
  };

  GridBody.prototype.setColumnWidth = function(col, width, isOptimal) {
    if (this.onSetColumnWidth &&
        this.onSetColumnWidth(col, width)) {
      return;
    }

    if (width < 20) {
      return;
    }

    var column = this.columns[col];
    if (column) {
      var oldWidth = column.getColumnWidth();

      if (width !== oldWidth) {
        column.setWidth(width, isOptimal);
        this._sizes = {};
        width = column.getColumnWidth();
        var delta = width - oldWidth;
        for (var i = col + 1, len = this.columns.length; i < len; i++) {
          this.columns[i].move(delta);
        }

        this.onChangeColumnWidth.raise(col, width);
      } else if (isOptimal) {
        column.setIsOptimalWidth();
      }
    }
  };

  GridBody.prototype.getColumnWidth = function(col) {
    var column = this.columns[col];
    if (column) {
      return column.getColumnWidth();
    }

    return 0;
  };

  GridBody.prototype.getColumnOptimalWidth = function(col) {
    var column = this.columns[col];
    if (column) {
      return column.getOptimalWidth();
    }

    return 0;
  };

  GridBody.prototype.fitColumnOptimalWidth = function(col, maxWidth) {
    var column = this.columns[col];
    if (column) {
      var optimalWidth = column.getOptimalWidth();
      if (maxWidth && optimalWidth > maxWidth) {
        optimalWidth = maxWidth;
      }
      this.setColumnWidth(col, optimalWidth, true);
    }
  };

  GridBody.prototype.isCentralColumn = function() {
    return this.columns.length === 1 && this.columns[0].isLastColumn();
  };

  GridBody.prototype.fitCentralColumnWidth = function() {
    if (this.isCentralColumn()) {
      var column = this.columns[0];
      var width = column.getOptimalWidth(1, true);

      column.setWidth(width);
      this._sizes = {};

      this.fitCentralColumnHeader();
    }
  };

  GridBody.prototype.fitLastColumn = function() {
    var columns = this.columns;
    if (this.isLastColumnExpanded() &&
        columns.length) {
      columns[columns.length - 1].fitParent();
    }
  }

  GridBody.prototype.isSortable = function(col) {
    if (this.dataModel &&
        this.dataModel.isColumnSortable) {
      return this.dataModel.isColumnSortable(col);
    }

    return true;
  };

  GridBody.prototype.isMovable = function(col) {
    if (this.dataModel &&
        this.dataModel.isColumnMovable) {
      return this.dataModel.isColumnMovable(col);
    }

    return true;
  };

  GridBody.prototype.isResizable = function(col) {
    if (this.dataModel &&
        this.dataModel.isColumnResizable) {
      return this.dataModel.isColumnResizable(col);
    }

    return true;
  };

  GridBody.prototype.clickColumnHeader = function(column) {
    if (this.dataModel &&
        this.dataModel.onSortColumn &&
        column &&
        this.isSortable(column.dataIndex)) {
      var sorted = this.dataModel.onSortColumn(
        column.dataIndex,
        this.getCurrentRow());

      if (sorted) {
        this.currentToVisibleCenter();
      }
    }
  };

  GridBody.prototype.moveColumn = function(from, to, anim) {
    var isLastColumnMoved = from === this.columns.length - 1 ||
                            to >= this.columns.length;
    if (from === to ||
        this.columns.length < 2 ||
        from < to && from === this.columns.length - 1) {
      return;
    }

    if (to > this.columns.length) {
      to = this.columns.length;
    } else if (to < 0) {
      to = 0;
    }

    if (from < to) {
      to--;
    }

    if (from === to) {
      return;
    }

    var column = this.columns[from];
    if (column) {
      if (isLastColumnMoved &&
          this.isLastColumnExpanded()) {
        this.columns[this.columns.length - 1].clearLastColumnStyle();
      }

      var fromWidth = column.getColumnWidth();
      var delta = (from > to) ? fromWidth : -fromWidth;
      var step = (from > to) ? -1 : 1;
      var fromDeltaLeft = 0;
      for (var i = from + step; i !== to + step; i += step) {
        fromDeltaLeft += this.columns[i].getColumnWidth();
      }

      fromDeltaLeft = (from > to) ? -fromDeltaLeft : fromDeltaLeft;

      var that = this;

      var finalMove = function() {
        for (var i = from + step; i !== to + step; i += step) {
          that.columns[i].setLeft(that.columns[i].getLeft() + delta, true);
        }

        that.columns[from].setLeft(that.columns[from].getLeft() + fromDeltaLeft, true);

        that.columns.splice(from, 1);
        that.columns.splice(to, 0, column);

        if (isLastColumnMoved &&
            that.isLastColumnExpanded()) {
          that.columns[that.columns.length - 1].setLastColumnStyle();
        }
      };

      if (anim) {
        var lastAnimStep = 8;
        var curAnimStep = 0;
        var moveStep = Math.floor(delta / (lastAnimStep + 1));
        var moveStep1 = Math.floor(fromDeltaLeft / (lastAnimStep + 1));

        var animation = setInterval(function() {
          for (var i = from + step; i !== to + step; i += step) {
            that.columns[i].setLeft(that.columns[i].getLeft() + moveStep, true);
          }

          that.columns[from].setLeft(that.columns[from].getLeft() + moveStep1, true);

          delta -= moveStep;
          fromDeltaLeft -= moveStep1;

          curAnimStep++;
          if (curAnimStep === lastAnimStep) {
            clearInterval(animation);
            finalMove();
          }
        }, 10);
      } else {
        finalMove();
      }
    }
  };

  GridBody.prototype.getColumnsInfo = function() {
    return this.columns.map(function(item) {
      return {index: item.dataIndex, width: item.area.style.width };
    });
  };

  GridBody.prototype.updateFooter = function() {
    for (var i = 0, len = this.columns.length; i < len; i++) {
      this.columns[i].updateFooter(this.dataModel);
    }
  };

  GridBody.prototype.fitCentralColumnHeader = function () {
    var area = this.area;

    if (!this.isCentralColumn()) return;

    var column = this.columns[0];

    var leftPadding = parseInt(column.header.style.paddingLeft);
    var rightPadding = parseInt(column.header.style.paddingRight);

    if (area.scrollWidth <= area.clientWidth &&
        leftPadding === rightPadding) return;

    column.header.style.paddingLeft = '0px';
    column.footer.style.paddingLeft = '0px';
    column.header.style.paddingRight = '0px';
    column.footer.style.paddingRight = '0px';

    var defPadding = 4;
    var paddingLeft = (defPadding + area.scrollLeft) + 'px';

    var scrollRight = area.scrollWidth - area.scrollLeft - area.clientWidth;
    if (scrollRight  < 0) scrollRight = 0;
    var paddingRight = (defPadding + scrollRight) + 'px';

    column.header.style.paddingLeft = paddingLeft;
    column.footer.style.paddingLeft = paddingLeft;
    column.header.style.paddingRight = paddingRight;
    column.footer.style.paddingRight = paddingRight;
  }

  GridBody.prototype.expandLastColumn = function(expand) {
    this._expandLastColumn = expand;
  }

  GridBody.prototype.isLastColumnExpanded = function() {
    return this._expandLastColumn;
  }

  GridBody.prototype.refreshLayout = function(mode) {
    mode = mode || {width: true, height: true};
    var refreshElem = this.area.idvcGridObject._parent;
    Utils.refreshSize(refreshElem, mode);
  }

  GridBody.prototype.setColumnResizingConstrainedByGridWidth = function(constrained) {
    if (constrained) this._isColumnResizingConstrainedByGridWidth = true;
    else delete this._isColumnResizingConstrainedByGridWidth;
  }

  GridBody.prototype.isColumnResizingConstrainedByGridWidth = function() {
    return !!this._isColumnResizingConstrainedByGridWidth;
  }

  GridBody.prototype.hideTooltip = function() {
    if (this.area.onmouseout) this.area.onmouseout();
  };

  //////////////////////////////////////////////////////////////////////////

  //          Grid

  //////////////////////////////////////////////////////////////////////////

  function Grid(parent, tabIndex) {
    this._parent = Utils.getDomElement(parent);

    this._vertScroll = new VertScrollBar(this._parent);
    this.gridBody = new GridBody(this._parent, tabIndex);
    this.gridBody.scrolling = this._vertScroll;
    this._vertScroll.addScrolled(this.gridBody);
    this.gridBody.onRefreshScroll = this.recalcScroll.bind(this);

    this.gridBody.area.idvcGridObject = this;

    var that = this;

    function updateVertSize(size) {
      if (size && !size.height) return;

      that.gridBody._sizes = {};
      that.gridBody._viewport.refreshSize();

      if (that._vertScroll.isVisible() &&
          Math.floor(that.gridBody.getScrollTop()) !== Math.floor(that._vertScroll.getScrollTop())) {
        that._vertScroll.setScrollTop(that.gridBody.getScrollTop());
      }

      that.recalcScroll();
    }

    this._parent.refreshSize = updateVertSize;

    this.windowResizeListener = Utils.addWindowResizeListener(this._parent);
  }

  Grid.prototype.destroy = function() {
    this.setDataModel(undefined, undefined);

    this.windowResizeListener.remove();
    delete this.windowResizeListener;

    delete this.gridBody.area.idvcGridObject;
  };

  Grid.prototype.updateView = function() {
    this.gridBody.S
    .cancel()
    .do_(this.gridBody.updateView.bind(this.gridBody));
  };

  Grid.prototype.processDataChanges = function(ev) {
    var fitFirstColumnWidth = true;
    if (ev &&
        ev.count !== undefined &&
        ev.start !== undefined) {
      if (ev.count > 0) {
        this.gridBody._viewport.insertRows(ev.start, ev.count);
      } else {
        this.gridBody._viewport.removeRows(ev.start, -ev.count);
      }

      this.recalcScroll();
    } else if (Array.isArray(ev)) {
      this.gridBody.updateCells(ev);
      fitFirstColumnWidth = false;
    } else if (ev &&
               (ev.currentRow !== undefined ||
                ev.rowCount !== undefined)) {
      this.gridBody.refreshRows(ev.currentRow, ev.rowCount);

      this.recalcScroll();
    } else if (ev &&
               (ev.regetStart !== undefined ||
                ev.regetCount !== undefined)) {
      if (ev.rowCountChanged) {
        this.gridBody._viewport.fitRowsCount();
      }
      this.gridBody._viewport.regetRows(ev.regetStart, ev.regetCount);
      if (ev.rowCountChanged) {
        this.recalcScroll();
      }
    } else {
      this.gridBody.clearView();
      this.updateView();
    }

    if (fitFirstColumnWidth && this.gridBody.isCentralColumn()) {
      setTimeout(this.gridBody.fitCentralColumnWidth.bind(this.gridBody), 0);
    }
  };

  Grid.prototype.recalcScroll = function() {
    var scrollBody = this._vertScroll.scrollBody;
    var updated = false;

    var rowCount = this.gridBody.dataModel ?
      this.gridBody.dataModel.getRowCount() :
      0;

    if (rowCount) {
      var rowHeight = this.gridBody.getRowHeight();
      if (rowHeight > 1) {
        var scrollSize = rowCount * rowHeight;
        var pageSize = this.gridBody.getRowsAreaHeight();
        this._vertScroll.setScrollSize(scrollSize, pageSize);

        if (scrollSize > pageSize) {
          if (scrollBody.style === undefined ||
              scrollBody.style.display === undefined ||
              scrollBody.style.display !== 'none') {
            scrollBody.style.visibility = 'visible';
            scrollBody.style.width = '2em'; //set fake width for scroll bar width calculation

            var scrollWidth = scrollBody.offsetWidth - scrollBody.clientWidth;
            if (scrollWidth <= 1) scrollWidth = 16; //fix for OSX where scrollbars may be invisible by default

            var bottomOffset = this.gridBody.area.offsetHeight - this.gridBody.area.clientHeight;
            if (bottomOffset < 0) bottomOffset = 0;

            if (Utils.Consts.engine === 'webkit') scrollWidth++; //Chrome hides scrollbar somehow
            scrollBody.style.width = scrollWidth + 'px';
            this.gridBody.area.style.right = scrollWidth + 'px';
            scrollBody.style.bottom = bottomOffset + 'px';

            this._vertScroll.setScrollSize(scrollSize, pageSize);

            updated = true;
          }
        } else {
          scrollBody.style.visibility = 'hidden';
          this.gridBody.area.style.right = '0px';
          updated = true;
        }
      }
    } else {
      scrollBody.style.visibility = 'hidden';
      this.gridBody.area.style.right = '0px';
      updated = true;
    }

    if (updated) this.gridBody.fitLastColumn();
  };

  Grid.prototype.setDataModel = function(dataModel, columnsVisModel) {
    var oldModel = this.gridBody.dataModel;
    if (oldModel) {
      if (oldModel.setElement !== undefined) {
        oldModel.setElement(null);
      }
      this.gridBody.clearView();
      oldModel.changed.unsubscribe(this, this.processDataChanges);
    }

    this.gridBody.dataModel = dataModel;
    this.gridBody.columnsVisModel = columnsVisModel;

    if (dataModel) {
      dataModel.changed.subscribe(this, this.processDataChanges);
      this.updateView();
    }
  };

  Grid.prototype.setCurrentRow = function(row) {
    this.gridBody.setCurrentRow(row);
  };

  Grid.prototype.getCurrentRow = function() {
    return this.gridBody.getCurrentRow();
  };

  Grid.prototype.hideVertScroll = function() {
    this._vertScroll.hide();
    this.gridBody.area.style.right = '0px';
  };

  Grid.prototype.showVertScroll = function() {
    this._vertScroll.show();
    this.gridBody.area.style.right = '';
  };

  Grid.prototype.isVertScrollVisible = function() {
    return this._vertScroll.isVisible();
  };

  Grid.prototype.setHorzScrollType = function(type) {
    this.gridBody.area.style.overflowX = type;
  };

  Grid.prototype.hideHeader = function() {
    Utils.addClass(this.gridBody.area, 'idvcgrid_hidden_header');
  };

  Grid.prototype.showFooter = function() {
    Utils.addClass(this.gridBody.area, 'idvcgrid_visible_footer');
    Utils.refreshSize(this._parent, {height: true});
  };

  Grid.prototype.hideFooter = function() {
    Utils.removeClass(this.gridBody.area, 'idvcgrid_visible_footer');
    Utils.refreshSize(this._parent, {height: true});
  };

  Grid.prototype.updateFooter = function() {
    this.gridBody.updateFooter();
  };

  Grid.prototype.getColumnByDataIndex = function(index, all) {
    return this.gridBody.getColumnByDataIndex(index, all);
  };

  Grid.prototype.hideColumn = function(index) {
    var column = this.getColumnByDataIndex(index, true);
    if (column) {
      column.hide();
      this.gridBody.refreshColumns();
    }
  };

  Grid.prototype.canColumnBeHidden = function(index) {
    var column = this.getColumnByDataIndex(index, true);
    if (column) {
      return column.canBeHidden();
    }

    return false;
  };

  Grid.prototype.hideTooltip = function() {
    this.gridBody.hideTooltip();
  };

  function processVisItems(items, callback) {
    if (!items) return;

    callback = callback || function() {};

    var count = items.getChildrenCount();
    for (var i = 0; i < count; i++) {
      var item = items.getChild(i);
      callback(item);
      processVisItems(item, callback);
    }
  }

  Grid.prototype.showAllColumns = function() {
    processVisItems(this.gridBody.columnsVisModel, function(item){
      if (item &&
          !item.isVisible()) {
        item.setVisible(true);
      }
    });
    this.gridBody.refreshColumns();
  };

  Grid.prototype.getInvisibleColumnsCount = function() {
    var result = 0;
    processVisItems(this.gridBody.columnsVisModel, function(item){
      if (item &&
          !item.isVisible()) {
        result++;
      }
    });
    return result;
  };

  Grid.prototype.getColumnsInfo = function() {
    return this.gridBody.getColumnsInfo();
  };

  Grid.prototype.columnToVisible = function(col, colOffset) {
    this.gridBody.columnToVisible(col, colOffset);
  }

  Grid.prototype.getRowCount = function() {
    var dataModel = this.gridBody.dataModel;
    if (dataModel &&
        dataModel.getRowCount) {
      return dataModel.getRowCount();
    }

    return 0;
  }

  function checkWidth(width) {
    if (typeof width === 'number') return width + 'px';

    return width;
  }

  function createHeaderVisModel() {
    function createItem(dataIndex, parent, inWidth, inState) {
      var children = [];
      var width = checkWidth(inWidth);
      var state = inState;
      var visible = true;
      var autoSize = false;
      var ignoreHeader = false;
      var maxWidth;
      return {
        getParent: function() {
          return parent;
        },
        getChildrenCount: function() {
          return children.length;
        },
        getChild: function(index) {
          return children[index];
        },
        addChild: function(dataIndex, width, state) {
          state = state || HeaderItemState.expanded;
          var item = createItem(dataIndex, this, width, state);
          children.push(item);
          return item;
        },
        getDataIndex: function() {
          return dataIndex;
        },
        getWidth: function() {
          return width || '0';
        },
        setWidth: function(inWidth) {
          width = checkWidth(inWidth);
        },
        getMaxAutoSizeWidth: function() {
          return maxWidth;
        },
        setMaxAutoSizeWidth: function(inWidth) {
          maxWidth = inWidth;
        },
        getState: function() {
          if (!this.getChildrenCount()) return HeaderItemState.simple;
          return state;
        },
        setState: function(inState) {
          state = inState;
        },
        setVisible: function(vis) {
          visible = vis;
        },
        isVisible: function() {
          return visible;
        },
        setAutoSize: function(as) {
          autoSize = as;
        },
        isAutoSize: function() {
          return autoSize;
        },
        ignoreHeaderForAutoSize: function(val) {
          if (val !== undefined) ignoreHeader = !!val;

          return ignoreHeader;
        },
        moveChild: function(from, to) {
          var child = children.splice(from, 1)[0];
          if (child) {
            if (to > from) to--;
            children.splice(to, 0, child);
          }
        },
        isLeaf: function() {
          return (state === HeaderItemState.collapsed) ||
              !this.getChildrenCount();
        }
      };
    }

    var model = createItem(-1, undefined, undefined, HeaderItemState.expanded);
    model.onChange = Signal.create();
    return model;
  }

  return {
    create: function(parent, tabIndex) {
      return new Grid(parent, tabIndex);
    },
    loadCSS: loadGridStyles,
    HeaderItemState: HeaderItemState,
    createHeaderVisModel: createHeaderVisModel
  };
});
