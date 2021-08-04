define(['../idvcjs/utils'], function(Utils) {

  var processors = [];
  var menuId = 'defContextMenu';

  var isContextMenuProcessed = false;

  var menuParentId = 'roofline_content';

  var stdMenuBuilder = {
    createMenu: function() {
      menu = document.createElement('menu');
      menu.setAttribute('id', menuId);
      menu.setAttribute('type', 'context');
      menu.style.display = 'none';

      var rooflineContent = Utils.getElementById(menuParentId);
      rooflineContent.setAttribute('contextmenu', menuId);

      document.body.appendChild(menu);

      return menu;
    },
    createMenuItem: function(item) {
      var menuItem;
      if (item.caption !== '-') {
        menuItem = document.createElement('menuitem');
        menuItem.setAttribute('label', item.caption);
        menuItem.onclick = item.command;
        if (item.disabled) menuItem.setAttribute('disabled', '');
      } else {
        menuItem = document.createElement('hr');
      }

      return menuItem;
    },
    showMenu: function(menu, x, y) {

    }
  };

  var htmlMenuBuilder = {
    shownMenu: undefined,
    createMenu: function() {
      menu = Utils.createElement('', 'idvc_context_menu', '', document.body,  'div');
      menu.style.display = 'none';

      return menu;
    },
    createMenuItem: function(item) {
      var menuItem;
      if (item.caption !== '-') {
        menuItem = Utils.createElement(item.caption, 'idvc_context_menu_item', '', undefined,  'div');
        if (item.disabled) menuItem.classList.add('disabled');
        menuItem.onclick = this._processClick.bind(this, item.command);
      } else {
        menuItem = Utils.createElement('', 'idvc_context_menu_separator', '', undefined,  'div');
      }

      return menuItem;
    },
    showMenu: function(menu, x, y) {
      if (this.shownMenu) {
        this.shownMenu.style.display = 'none';
      }

      this.shownMenu = menu;

      menu.style.display = 'block';
      this._setMenuPos(menu, x, y);

      document.addEventListener('click', htmlMenuBuilder._documentClick, false);
    },
    defMenuProcessing: function(e) {
      e.stopPropagation();
      e.preventDefault();
    },
    _processClick: function(command, e) {
      if (e.target && e.target.classList.contains('disabled')) {
        e.stopPropagation();
        e.preventDefault();
      } else {
        setTimeout(command, 0);
      }
    },
    _documentClick: function(e) {
      if (e.button === 0) htmlMenuBuilder._hideMenu();
    },
    _hideMenu: function() {
      if (this.shownMenu) {
        this.shownMenu.style.display = 'none';
        this.shownMenu = undefined;
        document.removeEventListener('click', this._documentClick, false);
      }
    },
    _setMenuPos: function(menu, x, y) {
      if (x < 0) x = 0;
      else if (x + menu.offsetWidth > window.innerWidth + window.scrollX) {
        x = window.innerWidth + window.scrollX - menu.offsetWidth;
      }

      if (y < 0) y = 0;
      if (y + menu.offsetHeight > window.innerHeight + window.scrollY) {
        y = window.innerHeight + window.scrollY - menu.offsetHeight;
      }

      menu.style.left = x + 'px';
      menu.style.top = y + 'px';
    }
  };

  var menuBuilder = stdMenuBuilder;
  if (Utils.Consts.engine !== 'moz') {
    menuBuilder = htmlMenuBuilder;
  }

  function showContextMenu(menuData, x, y) {
    menuData = menuData || [];

    isContextMenuProcessed = true;

    processors.forEach(function(processor) {
      processor.process(menuData);
    });

    var menu = Utils.getElementById(menuId);
    if (!menu) {
      menu = menuBuilder.createMenu();
    }

    Utils.removeAllChildren(menu);

    menuData.forEach(function(item) {
      menu.appendChild(menuBuilder.createMenuItem(item));
    });

    menuBuilder.showMenu(menu, x, y);
  };

  document.addEventListener('contextmenu', function(e) {
    if (!isContextMenuProcessed) {
      imp.clear();
    }

    isContextMenuProcessed = false;
  }, false);

  var imp = {
    show: showContextMenu,
    addProcessor: function(processor) {
      processors.push(processor);
    },
    clear: function() {
      var menu = Utils.getElementById(menuId);
      if (menu) Utils.removeAllChildren(menu);
    },
    defProcessing: function(e) {
      if (menuBuilder && menuBuilder.defMenuProcessing) {
        menuBuilder.defMenuProcessing(e);
      }
    }
  };

  return imp;
});