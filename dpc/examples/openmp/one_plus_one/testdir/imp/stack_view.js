define([
  './state_manager',
  './data',
  './i18n',
  './context_menu',
  '../idvcjs/roofline',
  '../idvcjs/grid',
  '../idvcjs/signal'
], function(StateManager, Data, I18n, ContextMenu, Roofline, Grid, Signal) {

  var stack = [];

  function PlainDataModel() {
    this._columnCount = 1;
    this._rowCount = 100;
    this.changed = Signal.create();
  }

  PlainDataModel.prototype.getColumnCount = function() {
    return this._columnCount;
  };

  PlainDataModel.prototype.getRowCount = function() {
    return stack.length || 0;
  };

  PlainDataModel.prototype.getColumnCaption = function() {
    return '';
  };

  PlainDataModel.prototype.getCell = function(row, col) {
    var result = '';
    if (row >= 0 && row < stack.length) {
      var loop = stack[row].loop;
      var result = loop.name;
      var location = loop.locat;
      if (result && result[0] !== '[' && location) result += ' at ' + location;

      var rooflinePoint = loop.rooflinePoint;
      if (rooflinePoint && !loop.filtered) {
        var backgroundColor = stack[row].backgroundColor;
        if (!backgroundColor) {

          backgroundColor = rooflinePoint.el.getAttr('data-color');

          if (!backgroundColor) {
            var pointStyle = window.getComputedStyle(rooflinePoint.el.el, null);
            backgroundColor = pointStyle.getPropertyValue('fill');

            if (backgroundColor.indexOf('url') !== -1) backgroundColor = 'lightgray';
          }

          stack[row].backgroundColor = backgroundColor;
        }

        if (!backgroundColor) backgroundColor = 'lightgray';

        var bkImage = Roofline.getPointIcon(Data.getPointConstructor(loop.resIndex) || Roofline.CirclePoint, backgroundColor);

        result = {
          innerHTML: result,
          style: {
            backgroundImage: bkImage
          }
        };
      }
    }

    return result;
  };

  PlainDataModel.prototype.getCellStyle = function(isSelected, defSelectedStyle, defStyle, row, col) {
    var entry;
    if (row >= 0 && row < stack.length &&
        (entry = stack[row]) &&
        entry.loop &&
        entry.loop.rooflinePoint) {
      var rooflinePoint = entry.loop.rooflinePoint.el;

      if (rooflinePoint && rooflinePoint.isHidden() || entry.loop.filtered) {
        return defStyle + ' ' + (isSelected ? defSelectedStyle + ' ' : ' ') + 'hidden_loop';
      }
    }

    return undefined;
  };

  PlainDataModel.prototype.toString = function () {
    return '[object DataModel]';
  };

  var plainData = new PlainDataModel();

  var grid;

return {
  create: function(parent, onhighlight, onselect, oncollapse) {
    grid = Grid.create(parent, '0');
    grid.hideHeader();
    grid.setDataModel(plainData);
    if (typeof onhighlight === 'function') {
      grid.gridBody.onChangeCurrentRow.subscribe(this, function(row) {
        if (this.processFill) {
          delete this.processFill;
          return;
        }

        onhighlight(stack[row].loop);
      });
    }

    if (typeof onselect === 'function') {
      grid.gridBody.onDblClick.subscribe(this, function(row) {
        onselect(stack[row].loop);
      });
    }

    if (typeof oncollapse === 'function') {
      grid.gridBody.onContextMenu.subscribe(this, function(row, col, propagation, _, x, y, e) {
        var menuItems = [];

        if (row >= 0) {
          var loop = stack[row].loop;
          if (loop && loop.state) {
            menuItems.push({
              caption: loop.state === '-' ? I18n.getMessage('roofline_menu_collapse') : I18n.getMessage('roofline_menu_expand'),
              id: 1,
              command: oncollapse.bind(this, loop)
            });
          }
        }

        propagation.stopPropagation = false;

        ContextMenu.show(menuItems, x, y);
        ContextMenu.defProcessing(e);
      });
    }

    StateManager.onChangeSettings.subscribe(this, function(id) {
      if (id === 'colorMode' ||
          id === 'defLoopColor' ||
          id === 'nstLoopColor' ||
          id === 'loopsThs') {
        this.refresh();
      }
    });
  },
  fill: function(loop) {
    if (this.currentLoop === loop) return;

    this.currentLoop = loop;

    stack = [];
    while (loop) {
      stack.unshift({loop: loop});
      loop = Data.getParent(loop);
    }

    if (stack.length &&
        stack[0].loop.name === 'Total') {
      stack.shift();
    }

    plainData.changed.raise();

    this.processFill = true;
    grid.gridBody.setCurrentRow(stack.length - 1);
    grid.gridBody.currentToVisibleBottom();
  },
  refresh: function(loop) {
    if (loop &&
        loop !== this.currentLoop &&
        !stack.some(function(item) {
          return item.loop === loop;
        })) {
      return;
    }

    stack.forEach(function(item) {
      if (item && item.backgroundColor) delete item.backgroundColor;
    });

    setTimeout(function() {
      plainData.changed.raise({
        regetStart: 0,
        regetCount: stack.length
      });
    }, 10);
  }
};

});
