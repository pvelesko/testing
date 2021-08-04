define([
  './state_manager',
  './value_utils',
  './request',
  './data',
  './ui_utils',
  './error_handling',
  './events',
  '../idvcjs/utils',
  '../idvcjs/signal',
  './roofs_storage',
  './roofs_utils'
], function(StateManager, ValueUtils, Request, Data, UiUtils, Errors, Events, Utils, Signal, RoofsStorage, RoofsUtils) {

var roofline;
var revertRoofValuesSettingsBtn;

var _scale = 1.0;
var _configuration = {};

var roofsCrossingId = 'roofsCrossing';
var roofsRepresentationId = 'roofsRepresentation';

var selectedClassName = 'selected';

var stateManager = StateManager.get();

//////////////////////////////////////////////////////////
////////////////   roofsRepresentation   /////////////////
//////////////////////////////////////////////////////////

var roofsRepresentation = (function() {
  var activeTextClassName = 'idvcchart_roofline_text_active';
  var activeLineClassName = 'idvcroofline_line_hover';

  var hiddenClassName = 'hidden';

  var textBackgroundFilterId = 'TextBackground';

  function updateRooflineRoofs(changedRoof) {
    if (!changedRoof) return;

    function acceptRoof(roof) {
      return !!changedRoof.isMem === !!roof.isMem;
    }

    var maxRoof, minRoof;
    var maxRoofVal = -Number.MAX_VALUE;
    var minRoofVal = Number.MAX_VALUE;
    Data.forEachRoofs(function(roof) {
      if (roof !== changedRoof && roof.hidden || !acceptRoof(roof)) return;

      if (roof.val > maxRoofVal) {
        maxRoof = roof;
        maxRoofVal = roof.val;
      }

      if (roof.val < minRoofVal) {
        minRoof = roof;
        minRoofVal = roof.val;
      }
    });

    if (maxRoof === changedRoof ||
        minRoof === changedRoof) {
      Events.send('rooflineDataUpdated', {isOldData: true, changingRoofs: true});
    }
  }

  function processVisibleCheckBox(e) {
    var cb = e.target;
    if (!cb) return;

    var roofRepresentation = cb.roofRepresentation;
    if (!roofRepresentation) return;

    if (cb.checked) {
      roofRepresentation.show();
    } else {
      roofRepresentation.hide();
    }

    roofRepresentation.highlight();

    updateRooflineRoofs(roofRepresentation.roofData);

    Events.send('roofVisibilityChanged', Data.getRoofs());
    roofsRepresentation._updateRoofsText(roofline.tr);
    roofsRepresentation.updateSelection();

    stateManager.save(roofsRepresentationId);
  }

  function processSelectedCheckBox(e) {
    var cb = this;
    if (!cb) return;

    var roofRepresentation = cb.roofRepresentation;
    if (!roofRepresentation) return;

    roofRepresentation.setSelected(cb.checked);

    Events.send('roofSelectionChanged', Data.getRoofs());
    roofsRepresentation._updateRoofsText(roofline.tr);
    roofsRepresentation.updateSelection();

    stateManager.save(roofsRepresentationId);
  }

  var changedValueCount = 0;
  function markEditorChanged(editor, changed) {
    if (!editor) return;

    if (changed) {
      editor.style.fontWeight = 'bold';
      changedValueCount++;
    } else {
      editor.style.fontWeight = '';
      changedValueCount--;
    }

    if (changedValueCount < 0) changedValueCount = 0;
  }

  function processValueEdit(e) {
    var editor = e.target;
    if (!editor) return;

    var roofRepresentation = editor.roofRepresentation;
    if (!roofRepresentation) return;

    var roofData = roofRepresentation.roofData;
    if (!roofData) return;

    var oldVal = ValueUtils.formatVal(roofData.val, 2, true);
    var newVal = parseFloat(editor.value);
    if (isNaN(newVal) || !newVal) {
      editor.value = oldVal;
    } else if (oldVal !== newVal) {
      if (roofData.defVal === undefined) {
        roofData.defVal = roofData.val;
        markEditorChanged(editor, true);
      } else if (newVal === ValueUtils.formatVal(roofData.defVal, 2, true)) {
        roofData.val = roofData.defVal;
        delete roofData.defVal;
        markEditorChanged(editor, false);
      }

      if (roofData.defVal !== undefined) roofData.val = ValueUtils.log10(newVal);

      revertRoofValuesSettingsBtn.disabled = (changedValueCount === 0);

      try {
        var activeElement = e.relatedTarget;
        if (activeElement && activeElement.roofRepresentation) {
          roofsRepresentation.activeRoofRepresentation = activeElement.roofRepresentation;
        }
      } catch (e) {
        Errors.handleException(e);
      }

      Events.send('rooflineDataUpdated', {isOldData: true});
      stateManager.save(roofsRepresentationId);
    }
  }

  function processEnterKey(e) {
    if (e.keyCode === 13) {
      var editor = e.target;
      e.relatedTarget = editor;
      editor.onblur(e);
    }
  }

  function processMouseEnter(e) {
    var editor = e.target;
    roofsRepresentation.activeRoofRepresentation = editor.roofRepresentation;
  }

  function processMouseExit() {
    if (roofsRepresentation.activeRoofRepresentation) delete roofsRepresentation.activeRoofRepresentation;
  }

  function processCellClick(e) {
    var cell = e.target;
    if (cell) {
      var checkbox = cell.firstChild;
      if (checkbox) checkbox.click();
    }
  }

  function addRoofSettings(table, name, roofRepresentation, visible, selected) {
    function fillInputCell(cell, checked, onclick) {
      var checkbox = Utils.createElement('', '', '', cell, 'input', function(cb) {
        cb.type = 'checkbox';
      });
      checkbox.roofRepresentation = roofRepresentation;
      checkbox.onclick = onclick;
      checkbox.checked = checked;

      cell.className = 'roof_settings_input';
      cell.roofRepresentation = roofRepresentation;
      cell.onclick = processCellClick;

      return checkbox;
    }

    var roofData = roofRepresentation.roofData;

    var row = table.insertRow(-1);
    row.className = roofData.isMem ? 'roof_memory' : 'roof_calculation';
    var nameCell = row.insertCell(0);
    nameCell.innerHTML = name;
    nameCell.style.whiteSpace = 'nowrap';
    nameCell.roofRepresentation = roofRepresentation;

    var visibleCell = row.insertCell(1);
    fillInputCell(visibleCell, visible, processVisibleCheckBox);

    var selectedCell = row.insertCell(2);
    var selectedCheckBox = fillInputCell(selectedCell, selected, processSelectedCheckBox);
    roofRepresentation.onClick.subscribe(selectedCheckBox, selectedCheckBox.click);

    var valueCell = row.insertCell(3);
    valueCell.style.whiteSpace = 'nowrap';
    valueCell.roofRepresentation = roofRepresentation;
    var valueEd = Utils.createElement('', 'value_input', '', valueCell, 'input', function(edit) {
      edit.setAttribute('value', ValueUtils.formatVal(roofData.val, 2, true));
      if (roofData.defVal !== undefined) {
        markEditorChanged(edit, true);
      }
      edit.onkeydown = processEnterKey;
      edit.onblur = processValueEdit;
      edit.onkeypress = UiUtils.filterNumberInput;
      edit.onmouseover = processMouseEnter;
      edit.onmouseout = processMouseExit;
      edit.roofRepresentation = roofRepresentation;
    });

    if (this.activeRoofRepresentation &&
        this.activeRoofRepresentation === valueEd.roofRepresentation) {
      valueEd.focus();
      valueEd.select();
      Utils.dispatchElementMouseEvent('mousemove', valueEd);
    }

    Utils.createElement(roofData.measure, 'measure_label', '', valueCell, 'label', function(lbl) {
      lbl.roofRepresentation = roofRepresentation;
    });
  }

  function getRoofId(roofName) {
    return roofName.toLowerCase()
    .replace('(single-threaded)', '')
    .replace(/\s/g, '');
  }

  //////////////////////////////////////////////////////////
  ////////////////  RoofRepresentation /////////////////////
  //////////////////////////////////////////////////////////

  function getSVGItem(item) {
    if (item && item.el) return item.el.el;
    return undefined;
  }

  function RoofRepresentation(roof, coords) {
    function getRoofClassName(name) {
      return 'idvcroofline_line ' + name.replace(/\s+/g, '');
    }

    function removeSingleThreadedCaption(name) {
      return name.replace(' (single-threaded)', '');
    }

    function getRoofName(roof, formatFn) {
      return removeSingleThreadedCaption(roof.name) + ': ' + formatFn(roof.val, 2) + ' ' + roof.measure;
    }

    var hotLine = roofline.addRoof(coords, 'line_hotarea');
    hotLine.el.after(roofline.getLastGridLine());
    var line = roofline.addRoof(coords, getRoofClassName(roof.name));

    if (!roofline.firstFrontEl) roofline.firstFrontEl = line.el;

    hotLine.el.activate();

    this.line = line;
    this.hotLine = hotLine;
    this.roofData = roof;
    this.caption = removeSingleThreadedCaption(roof.name);
    this.text = this.createText(getRoofName(roof, ValueUtils.formatVal));

    this.onClick = Signal.create();

    this.setTo(hotLine);

    getSVGItem(this.hotLine).onclick = this.processRoofClick;

    var selected = roof.selected;
    if (selected) {
      this._setSelectedVis(selected);
    }
  }

  RoofRepresentation.prototype.setTo = function(line) {
    getSVGItem(line).roofRepresentation = this;
  };

  RoofRepresentation.getFrom = function(line) {
    return getSVGItem(line).roofRepresentation;
  };

  RoofRepresentation.prototype._setSelectedVis = function(selected) {
    var classOp = selected ? 'addClass' : 'remClass';

    this.line.el[classOp](selectedClassName);
    if (this.text) this.text.svgText[classOp](selectedClassName);
  }

  RoofRepresentation.prototype.setSelected = function(selected) {
    var roof = this.roofData;

    if (selected) {
      roof.selected = true;
      roof.userSelected = true;
    } else {
      delete roof.selected;
      delete roof.userSelected;
    }

    this._setSelectedVis(selected);
  };

  RoofRepresentation.prototype.show = function() {
    this.line.show();
    this.hotLine.show();
    delete this.roofData.hidden;
  };

  RoofRepresentation.prototype.hide = function() {
    this.unhighlight();

    this.line.hide();
    this.hotLine.hide();
    this.roofData.hidden = true;
  };

  RoofRepresentation.prototype.clear = function() {
    var svgLine = getSVGItem(this.hotLine);
    if (svgLine) delete svgLine.roofRepresentation;

    this.line = undefined;
    this.hotLine = undefined;
    this.roofData = undefined;
  };

  RoofRepresentation.prototype.highlight = function() {
    function highlightText(text) {
      if (!text) return;

      text.svgText.front();
      text.svgText.addClass(activeTextClassName);
      text.svgText.setFilter(textBackgroundFilterId);
    }

    var svgLine = getSVGItem(this.line);
    svgLine.classList.add(activeLineClassName);

    if (!this.line.isHidden()) {
      highlightText(this.text);
    }

    this.line.el.front();
  };

  RoofRepresentation.prototype.unhighlight = function() {
    function unHighlightText(text, ref) {
      if (!text) return;

      text.svgText.remClass(activeTextClassName);
      text.svgText.remFilter(textBackgroundFilterId);
      text.svgText.after(ref);
    }

    var svgLine = getSVGItem(this.line);
    svgLine.classList.remove(activeLineClassName);

    if (!this.line.isHidden()) {
      unHighlightText(this.text, this.hotLine);
    }

    //this.line.el.after(this.hotLine.el);
  };

  RoofRepresentation.prototype.recalculate = function(calcRoofCoord) {
    if (!calcRoofCoord) return;

    var points = calcRoofCoord(this.roofData);

    this.line.change(points);
    this.hotLine.change(points);

    return points;
  };

  RoofRepresentation.prototype.processRoofClick = function(e) {
    var svgLine = e.target;
    if (!svgLine ||
        !svgLine.roofRepresentation) return;

    svgLine.roofRepresentation.onClick.raise(e);
  }

  RoofRepresentation.prototype.setStyle = function(styleName) {

    function appendStyleToElement(element, styleStringToAppend) {
      if (!element) return;

      var lineStyle = element.getStyle();
      if (!lineStyle) lineStyle = '';

      //only add this style string if it is not present
      if (lineStyle.indexOf(styleStringToAppend) === -1) {
        lineStyle += styleName;
        element.setStyle(lineStyle);
      }
    }

    if (this.line) appendStyleToElement(this.line.el, styleName);
    if (this.selectedLine) appendStyleToElement(this.selectedLine.el, styleName);
    if (this.text) appendStyleToElement(this.text.svgText, styleName);
  };

  RoofRepresentation.prototype.clearStyle = function(styleName) {

    function eraseStyleString(fullString, styleToErase) {
      if (!fullString) return '';

      return fullString.replace(styleToErase,'');
    }

    function clearStyleFromElement(element, styleStringToErase) {
      if (!element) return;

      var clearedStyle = eraseStyleString(element.getStyle(), styleName);
      element.setStyle(clearedStyle);
    }

    if (this.line) clearStyleFromElement(this.line.el, styleName);
    if (this.selectedLine) clearStyleFromElement(this.selectedLine.el, styleName);
    if (this.text) clearStyleFromElement(this.text.svgText, styleName);
  };

  function MemRoofRepresentation(roof, coords) {
    this.startY = coords[0];

    RoofRepresentation.call(this, roof, coords);
  }

  MemRoofRepresentation.prototype = Object.create(RoofRepresentation.prototype);

  MemRoofRepresentation.prototype.show = function() {
    RoofRepresentation.prototype.show.call(this);

    if (this.selectedLine) this.selectedLine.show();
  };

  MemRoofRepresentation.prototype.hide = function() {
    RoofRepresentation.prototype.hide.call(this);

    if (this.selectedLine) this.selectedLine.hide();
  };

  MemRoofRepresentation.prototype.highlight = function() {
    RoofRepresentation.prototype.highlight.call(this);

    if (this.selectedLine) {
      var svgLine = getSVGItem(this.selectedLine);
      svgLine.classList.add(activeLineClassName);
      this.selectedLine.el.front();
    }
  };

  MemRoofRepresentation.prototype.unhighlight = function() {
    RoofRepresentation.prototype.unhighlight.call(this);

    if (this.selectedLine) {
      var svgLine = getSVGItem(this.selectedLine);
      svgLine.classList.remove(activeLineClassName);
    }
  };

  MemRoofRepresentation.prototype.clear = function() {
    RoofRepresentation.prototype.clear.call(this);

    if (this.selectedLine) delete this.selectedLine;
  };
  
  MemRoofRepresentation.prototype._setSelectedVis = function(selected) {
    RoofRepresentation.prototype._setSelectedVis.call(this, selected);

    if (this.startY !== undefined) {
      this.line.el.remClass(selectedClassName);

      if (selected) {
        var topCalcRoof = RoofsUtils.getTopSelectedRoof(Data.getRoofs(), false);

        var crossPos = RoofsUtils.getRoofsCrossing(this.roofData, topCalcRoof || {val: roofline.tr.getMaxPerf()});

        this.selectedLine = roofline.addRoof([this.startY, crossPos.x, crossPos.y], 'idvcroofline_line ' + selectedClassName);
        this.selectedLine.el.after(this.line.el);

        if (this.line.el.hasClass(activeLineClassName)) this.selectedLine.el.addClass(activeLineClassName);
      } else if (this.selectedLine) {
        this.selectedLine.remove();
        delete this.selectedLine;
      }
    }
  };

  MemRoofRepresentation.prototype.updateSelection = function(topCalcRoof) {
    if (this.selectedLine) {
      topCalcRoof = topCalcRoof || RoofsUtils.getTopSelectedRoof(Data.getRoofs(), false);

      var crossPos = RoofsUtils.getRoofsCrossing(this.roofData, topCalcRoof || {val: roofline.tr.getMaxPerf()});

      this.selectedLine.change([this.startY, crossPos.x, crossPos.y]);
    }
  };

  MemRoofRepresentation.prototype.recalculate = function(calcRoofCoord, topCalcRoof) {
    if (!calcRoofCoord) return;

    var points = RoofRepresentation.prototype.recalculate.call(this, calcRoofCoord);

    this.startY = points[0];
    this.updateSelection(topCalcRoof);
  };


  MemRoofRepresentation.prototype.createText = function(name) {
    if (this.hotLine && this.roofData) {
      this.hotLine.setBeginText(name, undefined, undefined, !!this.roofData.desc);
      return this.hotLine.startText;
    }
  };

  MemRoofRepresentation.prototype.updateTextPos = function(acrossOffset, alongOffset) {
    this.hotLine.updateBeginOffsets(alongOffset, acrossOffset);
  };

  function CalcRoofRepresentation(roof, coords) {
    RoofRepresentation.call(this, roof, coords);
  }

  CalcRoofRepresentation.prototype = Object.create(RoofRepresentation.prototype);

  CalcRoofRepresentation.prototype.createText = function(name) {
    if (this.hotLine && this.roofData) {
      this.hotLine.setEndText(name, undefined, undefined, !!this.roofData.desc);
      return this.hotLine.endText;
    }
  };

  CalcRoofRepresentation.prototype.updateTextPos = function(acrossOffset, alongOffset) {
    alongOffset = alongOffset || this.hotLine.endText.alongOffset;

    this.hotLine.updateEndOffsets(alongOffset, acrossOffset);
  };

  function createRoofrepresentation(roof, coords) {
    if (!roof) return;

    if (roof.isMem) {
      return new MemRoofRepresentation(roof, coords);
    } else {
      return new CalcRoofRepresentation(roof, coords);
    }
  }

  return {
    representations: [],
    setRoofline: function(val) {
      roofline = val;

      var settingsContent = Utils.getElementById('roofline_settings');
      roofline.centralPart.body.onmousemove = settingsContent.onmousemove = function(e) {
        hotElement.processMouseMove(e.target);
      };
      roofline.centralPart.body.onmouseout = settingsContent.onmouseout = function(e) {
        hotElement.processMouseOut(e.target);
      };
    },
    setScale: function(scale) {
      _scale = scale;
    },
    setConfiguration: function(configuration) {
      if (configuration) Utils.applyObjectProperties(_configuration, configuration);
    },
    processResize: function(tr) {
      this._updateRoofsText(tr);
    },
    clear: function(remove) {
      if (this.activeRoofRepresentation) delete this.activeRoofRepresentation;

      this.representations.forEach(function(representation) {
        representation.clear();
      });

      this.representations.length = 0;

      RoofsUtils.roofDefs.clear();
    },
    updateSelection: function() {
      var topCalcRoof = RoofsUtils.getTopSelectedRoof(Data.getRoofs(), false);

      this.representations.forEach(function(representation) {
        if (representation.updateSelection) representation.updateSelection(topCalcRoof);
      });
    },
    fillRoofsPatterns: function() {
      var defsSection = RoofsUtils.roofDefs.get(roofline);
      defsSection
        .createFilter(textBackgroundFilterId)
          .setAttr('x', '0')
          .setAttr('y', '0')
          .setAttr('width', '1')
          .setAttr('height', '1')
          .addElement('feFlood')
            .setAttr('flood-color', 'white')
            .getParent()
          .addElement('feComposite')
            .setAttr('in', 'SourceGraphic');
    },
    fillRoofs: function(roofs, calcRoofCoord) {
      if (!roofs) return;

      var roofsTableBody = Utils.getElementById('roofs_table_body');
      Utils.removeAllChildren(roofsTableBody);

      changedValueCount = 0;

      if (!this._captionTextHeight) this._captionTextHeight = roofline.centralPart.canvas.getTextHeight({className: 'idvcchart_roofline_text'});

      roofs
      .sort(function(a, b) {
        return (!!b.isMem - !!a.isMem) || (b.val - a.val);
      })
      .forEach(function(roof) {
        var roofRepresentation = createRoofrepresentation(roof, calcRoofCoord(roof));

        this.representations.push(roofRepresentation);

        var hidden = roof.hidden;
        if (hidden) {
          roofRepresentation.hide();
        }

        addRoofSettings.call(this, roofsTableBody, roofRepresentation.caption, roofRepresentation, !hidden, roof.selected);
      }.bind(this));

      this._updateRoofsText(roofline.tr);
      this.updateSelection();

      Events.send('roofsCreated', roofs);

      if (this.activeRoofRepresentation) delete this.activeRoofRepresentation;
    },
    recalculateRoofs: function(roofs, calcRoofCoord) {
      var topCalcRoof = RoofsUtils.getTopSelectedRoof(Data.getRoofs(), false);

      this.representations.forEach(function(representation) {
        representation.recalculate(calcRoofCoord, topCalcRoof);
      });

      Events.send('roofsUpdated', roofs);
    },
    apply: function(state) {
      if (!state) return;
      if (!Data.getThreadCount()) return;

      var dataRoofs = Data.getRoofs();
      if (dataRoofs) {
        var validRoofsState = state.roofsState;
        dataRoofs.forEach(function(dataRoof) {
          var roof = validRoofsState ? state.roofsState[getRoofId(dataRoof.name)] : null;
          if (roof && roof.hidden) dataRoof.hidden = true;
          else delete dataRoof.hidden;
          if (roof && (roof.selected || roof.userSelected || dataRoof.userSelected)) dataRoof.selected = true;
          else delete dataRoof.selected;
          if (roof && (roof.userSelected || dataRoof.userSelected)) dataRoof.userSelected = true;
          else delete dataRoof.userSelected;
        });
      }

      var roofsValuesStorage = state.roofsValues ?
        RoofsStorage.create(state.roofsValues) :
        null;

      var currRoofsValues = roofsValuesStorage ?
        roofsValuesStorage.get(Data.getThreadCount(), Data.getRoofsStrategyId(), Data.getPackageCount()) :
        null;

      // Old roofline state was collected before support of packageCount and stores differently in a storage.
      // If we don't have roofs for current configuration on multisocket PC, check whether we have old values with package count 0.
      // We can remove this code later after some releases.
      var oldRooflineState = false;
      if (roofsValuesStorage && !currRoofsValues && Data.getPackageCount()) {
        currRoofsValues = roofsValuesStorage.get(Data.getThreadCount(), Data.getRoofsStrategyId(), 0);
        oldRooflineState = currRoofsValues;
      }

      revertRoofValuesSettingsBtn.disabled = !roofsValuesStorage || roofsValuesStorage.empty();

      if (dataRoofs && currRoofsValues) {
        dataRoofs.forEach(function(dataRoof) {
          // Don't apply old values for DRAM roof since after package count support, we calculate it differently.
          if (oldRooflineState && RoofsUtils.isMatchedRoof(dataRoof, 'dram')) return;
          var roofVal = currRoofsValues[getRoofId(dataRoof.name)];
          if (roofVal) {
            if (dataRoof.val !== roofVal) {
              if (dataRoof.defVal === undefined) dataRoof.defVal = dataRoof.val;
              dataRoof.val = roofVal;
            }
          }
        });
      }
    },
    saveState: function(state, args) {
      if (!state) return;

      args = args || {};

      if (args.clearRoofsValues) {
        delete state.roofsValues;
        return;
      }

      state.roofsValues = state.roofsValues || {};
      var roofsValuesStorage = RoofsStorage.create(state.roofsValues);

      function saveChangedValue(roof, threadCount, strategyId, packageCount) {
        var currRoofsValues = roofsValuesStorage.get(threadCount, strategyId, packageCount);
        var id = getRoofId(roof.name);

        if (args.all || roof.defVal !== undefined) {
          if (!currRoofsValues) {
            currRoofsValues = {};
            currRoofsValues[id] = roof.val;
            roofsValuesStorage.add(currRoofsValues, threadCount, strategyId, packageCount);
          } else {
            currRoofsValues[id] = roof.val;
          }
        } else if (currRoofsValues && currRoofsValues[id]) {
          delete currRoofsValues[id];
          roofsValuesStorage.removeIfEmpty(threadCount, strategyId, packageCount);
        }
      }

      if (!state.roofsState) state.roofsState = {};

      Data.forEachRoofs(function(roof) {
        var roofId = getRoofId(roof.name);
        if (args.all || roof.hidden || roof.selected || roof.userSelected) {
          state.roofsState[roofId] = {
            hidden: roof.hidden || false,
            selected: roof.selected || false,
            userSelected: roof.userSelected || false,
          };
        } else {
          if (roofId in state.roofsState) {
            delete state.roofsState[roofId];
          }
        }
      });

      if (!Object.keys(state.roofsState).length) {
        delete state.roofsState;
      }

      if (args.all) {
        Data.forEachAllRoofs(saveChangedValue);
      } else {
        var threadCount = Data.getThreadCount();
        var strategyId = Data.getRoofsStrategyId();
        var packageCount = Data.getPackageCount();
        Data.forEachRoofs(function(roof) {
          saveChangedValue(roof, threadCount, strategyId, packageCount);
        });
      }
      if (roofsValuesStorage.empty()) delete state.roofsValues;
    },
    _updateRoofsText: function(tr) {
      // We give priority for visualizing selected roofs over others.
      // So there is special processing of selected roofs that first position them on roofline
      // and then try to position all other non-selected roofs in the rest of space left.

      const defAlongOffset = 4 * _scale;

      function updateRoofsText(accept) {
        function updateRoofText(roof, oldPosition, roofText) {
          function isOverlapped(pos, distance, usedPositions) {
            return (distance && distance < toleranceDistance) ||
                   (usedPositions && usedPositions.some(function(usedPos) {
                            return Math.abs(pos - usedPos) < toleranceDistance;
                          }));
          }

          function getMemRoofNextPos(roofVal, prevPos) {
            var acrossOffset;
            var alongOffset;
            var minIntens = tr.getMinIntens();
            var minPerf = tr.getMinPerf();
            var roofCrossX = minPerf - roofVal;
            var roofCrossY = roofVal + minIntens;

            var roofCrossPY = tr.L2PY(roofCrossY) - tr.L2PY(minPerf);
            var roofCrossPX = tr.L2PX(roofCrossX);
            var roofCrossPD = Math.sqrt(Math.pow(roofCrossPX, 2) + Math.pow(roofCrossPY, 2));

            var newPos = tr.L2PY(roofCrossY);
            var distance = 0;
            if (prevPos !== undefined) {
              distance = Math.abs((newPos - prevPos) / roofCrossPD * roofCrossPX);
            }

            if (isOverlapped(newPos, distance, usedPositions)) {
              acrossOffset = -1;
              newPos += minDistance;
            }

            if (roofCrossX > minIntens) {
              // roof crosses horizontal axis
              alongOffset = roofCrossPD + 2;
              if (acrossOffset === -1) {
                alongOffset += Math.abs(roofCrossPX * minDistance / roofCrossPY);
              }
            } else {
              if (acrossOffset === -1) {
                alongOffset = 1;
              } else {
                alongOffset = Math.abs(minDistance / roofCrossPX * roofCrossPY) + defAlongOffset;
              }
            }

            return {
              roofPosition: newPos,
              acrossOffset: acrossOffset,
              alongOffset: alongOffset
            };
          }

          function getCalcRoofNextPos(roofVal, prevPos) {
            var acrossOffset;
            var newPos = tr.L2PY(roofVal);
            var distance = 0;
            if (prevPos !== undefined) {
              distance = newPos - prevPos;
            }

            if (isOverlapped(newPos, distance, usedPositions)) {
              acrossOffset = -1;
              newPos += minDistance;
            }

            return {
              roofPosition: newPos,
              acrossOffset: acrossOffset,
              alongOffset: -defAlongOffset
            };
          }

          function doUpdate(getNextPos) {

            // Checks that roof text with nextPos does not overlap text
            // in prevPos and usedPositions and can be shown.
            // Shows roof text if it can be shown.
            // Save visible text position in newUsedPositions array
            function checkRoofPosition(prevPos, nextPos, svgText) {
              var result = prevPos;

              var newPos = nextPos.roofPosition;
              var distance = 0;
              if (prevPos !== undefined) {
                distance = newPos - prevPos;
              }
              if (isOverlapped(newPos, distance, usedPositions)) {
                svgText.addClass(hiddenClassName);
                nextPos.acrossOffset = 1;
              } else {
                svgText.remClass(hiddenClassName);
                result = newPos;

                newUsedPositions.push(result);
              }

              return result;
            }

            if (!roof) return oldPosition;

            var nextPos = getNextPos(roof.val, oldPosition);

            var newPosition = checkRoofPosition(oldPosition, nextPos, roofText);

            roofRepresentation.updateTextPos(nextPos.acrossOffset, nextPos.alongOffset);

            return newPosition;
          };

          if (!roof) return;

          return doUpdate(roof.isMem ? getMemRoofNextPos : getCalcRoofNextPos);
        };

        var oldPos;
        var newUsedPositions = [];

        var roofRepresentation;

        var accept = accept || function(roof) { return roof && !roof.hidden; };

        roofline.roofs.forEach(function(line) {
          roofRepresentation = RoofRepresentation.getFrom(line);
          if (!roofRepresentation) return;

          var roof = roofRepresentation.roofData;
          if (!accept(roof)) return;

          oldPos = updateRoofText(roof, oldPos, roofRepresentation.text.svgText);
        });

        usedPositions = newUsedPositions;
      }

      if (!tr || !this._captionTextHeight) return;

      const distanceToleranceMultiplier = 0.9;
      //checking that next roof we try to show is near previous already shown roof,
      //but with tolerance of 0.9

      var minDistance = this._captionTextHeight;
      var toleranceDistance = distanceToleranceMultiplier * minDistance;

      var usedPositions;

      // Showing roofs is done in 2 steps, first we try to show selected roofs, then all other roofs.

      // This method helps to show selected roofs, calculates its positions,
      // saves them inside usedPositions*Roofs arrays.
      updateRoofsText.call(this, function(roof) { return roof && !roof.hidden && roof.isMem && roof.selected; });
      // This method helps to show other non-selected roofs by checking (usedPositions*Roofs arrays)
      // that they are not too near with any selected shown roofs.
      updateRoofsText.call(this, function(roof) { return roof && !roof.hidden && roof.isMem && !roof.selected; });

      usedPositions = undefined;

      // the same for calculated roofs
      updateRoofsText.call(this, function(roof) { return roof && !roof.hidden && !roof.isMem && roof.selected; });
      updateRoofsText.call(this, function(roof) { return roof && !roof.hidden && !roof.isMem && !roof.selected; });
    }
  };
})();

stateManager.addProcessor(roofsRepresentationId, roofsRepresentation);

Events.recv('rooflineCleared', roofsRepresentation.clear, roofsRepresentation);
Events.recv('rooflineResized', roofsRepresentation.processResize, roofsRepresentation);

//////////////////////////////////////////////////////////
////////////////     roofsCrossing       /////////////////
//////////////////////////////////////////////////////////

var roofsCrossing = (function() {
  function getId(name) {
    return name.replace(/\s+/g, '');
  }

  var crossings = {};
  var crossingSize = 6;

  ////////////////  CrossingRepresentation /////////////////

  var activeCrossPointClassName = 'idvcroofline_roofs_cross_hover';
  var activeCrossLineClassName = 'roofline_coord_line_hover';

  function getSVGItem(item) {
    if (item) return item.el;

    return undefined;
  }

  function CrossingRepresentation(selected) {
    this.line = undefined;
    this.rect = undefined;
    this.selected = !!selected;
  }

  function getRectPos(centerPos) {
    var size = crossingSize * _scale;
    return {
      x: centerPos.x - size / 2,
      y: centerPos.y - size / 2
    };
  };

  function getLinePos(centerPos) {
    var size = crossingSize * _scale;
    return {
      x: centerPos.x,
      y: centerPos.y + size / 2
    };
  };

  CrossingRepresentation.prototype.create = function(crossPos, name1, name2, tr) {
    if (this.line) this.line.remove();
    if (this.rect) this.rect.remove();

    var crossPoint = tr.L2P(crossPos.x, crossPos.y);

    var rectPos = getRectPos(crossPoint);
    var size = crossingSize * _scale;
    var rect = roofline.centralPart.graphicsRoot.addRect(rectPos.x, rectPos.y, size, size, 'roofline_roofs_cross')
      .front()
      .activate()
      .on('mousedown', this.processCrossPointClick, false);

    var linePos = getLinePos(crossPoint);
    var line = roofline.centralPart.graphicsRoot.addLine(linePos.x, linePos.y, linePos.x, roofline.tr.getMinY(), 'roofline_coord_line');

    this.name1 = name2;
    this.name2 = name1;
    this.x = crossPos.x;
    this.y = crossPos.y;
    this.line = line;
    this.rect = rect;

    if (this.selected) {
      this.toggleSelection();
    }

    this.setTo(rect);
  };

  CrossingRepresentation.prototype.setTo = function(rect) {
    getSVGItem(rect).crossingRepresentation = this;
  };

  CrossingRepresentation.getFrom = function(rect) {
    return getSVGItem(rect).crossingRepresentation;
  };

  CrossingRepresentation.prototype.toggleSelection = function() {
    if (this.rect) this.rect.toggleClass(selectedClassName);

    if (this.line) {
      this.line.toggleClass(selectedClassName);
      this.selected = this.line.hasClass(selectedClassName);
    }
  };

  CrossingRepresentation.prototype.highlight = function() {
    if (this.rect) this.rect.addClass(activeCrossPointClassName);

    if (this.line) this.line.addClass(activeCrossLineClassName);
  };

  CrossingRepresentation.prototype.unhighlight = function() {
    if (this.rect) this.rect.remClass(activeCrossPointClassName);

    if (this.line) this.line.remClass(activeCrossLineClassName);
  };

  CrossingRepresentation.prototype.updatePos = function(tr) {
    var pos = tr.L2P(this.x, this.y);

    if (this.rect) {
      var rectPos = getRectPos(pos);
      this.rect
        .setX(rectPos.x)
        .setY(rectPos.y);
    }

    if (this.line) {
    var linePos = getLinePos(pos);
    this.line
      .setX1(linePos.x)
      .setX2(linePos.x)
      .setY1(linePos.y)
      .setY2(tr.getMinY());
    }
  };

  CrossingRepresentation.prototype.clear = function(remove) {
    if (this.rect) {
      if (remove) this.rect.remove();
      this.rect = undefined;
    }

    if (this.line) {
      if (remove) this.line.remove();
      this.line = undefined;
    }

    this.x = 0;
    this.y = 0;
  };

  CrossingRepresentation.prototype.processCrossPointClick = function(e) {
    var svgRect = e.target;
    if (svgRect && svgRect.crossingRepresentation) {
      svgRect.crossingRepresentation.toggleSelection();

      stateManager.save(roofsCrossingId);
    }
  };

  var result = {
    set: function(crossPos, name1, name2, tr) {
      tr = tr || roofline.tr;

      var crossingRepresentation = this.get(name1, name2);

      crossingRepresentation.create(crossPos, name1, name2, tr);
    },
    get: function(name1, name2) {
      var id1 = getId(name1);
      var id2 = getId(name2);

      var crossing = crossings[id1 + id2];
      if (!crossing) crossing = crossings[id2 + id1];
      if (!crossing) {
        crossing = new CrossingRepresentation();
        crossings[id1 + id2] = crossing;
      }

      return crossing;
    },
    forEach: function(proc) {
      Object.getOwnPropertyNames(crossings).forEach(function(prop) {
        var crossing = crossings[prop];

        if (crossing) proc(crossing, prop);
      });
    },
    processResize: function(tr) {
      if (!tr) return;

      this.forEach(function(crossingRepresentation) {
        crossingRepresentation.updatePos(tr);
      });
    },
    clear: function(remove) {
      this.forEach(function(crossingRepresentation) {
        crossingRepresentation.clear(remove);
      });
    },
    apply: function(state) {
      if (state && state.crossings) {
        Object.getOwnPropertyNames(state.crossings).forEach(function(prop) {
          var crossing = state.crossings[prop];
          if (crossing) {
            var existCrossing = crossings[prop];
            if (existCrossing) existCrossing.clear(true);

            crossings[prop] = new CrossingRepresentation(crossing.selected);
          }
        });
      }
    },
    saveState: function(state, all) {
      if (state) {
        if (state.crossings) delete state.crossings;
        this.forEach(function(crossing, prop) {
          if (all || crossing.selected) {
            if (!state.crossings) state.crossings = {};

            state.crossings[prop] = { selected: !!crossing.selected };
          }
        });
      }
    }
  };

  function refreshRoofsCrossing(roofs) {
    this.clear(true);
    calcRoofsCrossing.call(this, roofs);
  }

  function calcRoofsCrossing(roofs) {
    RoofsUtils.forEachRoofsCrossings(roofs, function(crossing, memRoof, calcRoof) {
      this.set(crossing, memRoof.name, calcRoof.name);
    }.bind(this));
  }

  Events.recv('rooflineCleared', result.clear, result);
  Events.recv('rooflineResized', result.processResize, result);
  Events.recv('roofsCreated', calcRoofsCrossing, result);
  Events.recv('roofVisibilityChanged', refreshRoofsCrossing, result);

  return result;
})();

stateManager.addProcessor(roofsCrossingId, roofsCrossing);

var hotElement = (function() {
  var hotElement;
  var processors = [];

  function clearHotElement() {
    if (hotElement) {
      processors.some(function(processor) {
        return processor.unhighlight(hotElement);
      });
      hotElement = undefined;
    }
  }

  return {
    processMouseMove: function(target) {
      if (!target || target === hotElement) return;

      clearHotElement();

      processors.some(function(processor) {
        var result = processor.highlight(target);
        if (result) hotElement = target;

        return result;
      });
    },
    processMouseOut: clearHotElement,
    addProcessor: function(processor) {
      processors.push(processor);
    },
    clear: function() {
      hotElement = undefined;
    }
  };
})();

hotElement.addProcessor({
  accept: function(target) {
    return target && target.roofRepresentation;
  },
  highlight: function(target) {
    if (!this.accept(target)) return false;

    target.roofRepresentation.highlight();

    return true;
  },
  unhighlight: function(target) {
    if (!this.accept(target)) return false;

    target.roofRepresentation.unhighlight();

    return true;
  }
});

hotElement.addProcessor({
  accept: function(target) {
    return target && target.crossingRepresentation;
  },
  highlight: function(target) {
    if (!this.accept(target)) return false;

    target.crossingRepresentation.highlight();

    return true;
  },
  unhighlight: function(target) {
    if (!this.accept(target)) return false;

    target.crossingRepresentation.unhighlight();

    return true;
  }
});

Events.recv('rooflineCleared', hotElement.clear, hotElement);

UiUtils.addTooltipProcessor({
  accept: function(target) {
    return target && target.roofRepresentation;
  },
  getText: function(target) {
    var roof = target.roofRepresentation.roofData;
    return roof.name + ValueUtils.pref + (roof.isMem ? ValueUtils.formatVal(roof.val, 2) : ValueUtils.formatVal(roof.val, 2)) + ValueUtils.post + roof.measure;
  }
});

UiUtils.addTooltipProcessor({
  accept: function(target) {
    return target && target.crossingRepresentation;
  },
  getText: function(target) {
    var cross = target.crossingRepresentation;
    var data = Data.getRooflineData();
    return cross.name1 + ' X ' + cross.name2 + '<br>' +
           data.nameY + ValueUtils.pref + ValueUtils.formatVal(cross.y) + ValueUtils.post + data.measureY + '<br>' +
           data.nameX + ValueUtils.pref + ValueUtils.formatVal(cross.x) + ValueUtils.post + data.measureX;
  }
});

function isRoofExplanation(target) {
  return target && target.parentNode && target.parentNode.parentRoof;
}

function getRoofExplanationText(target) {
  if (isRoofExplanation(target) &&
      target.parentNode.parentRoof.el.roofRepresentation) {
    return target.parentNode.parentRoof.el.roofRepresentation.roofData.desc;
  }
}

UiUtils.addTooltipProcessor({
  accept: isRoofExplanation,
  getText: getRoofExplanationText
});

revertRoofValuesSettingsBtn = document.getElementById('revert_roofs_values_settings_button');
revertRoofValuesSettingsBtn.disabled = true;
revertRoofValuesSettingsBtn.onclick = function() {
  function revertChangedValue(roof) {
    if (roof.defVal !== undefined) {
      roof.val = roof.defVal;
      delete roof.defVal;
    }
  }
  Data.forEachAllRoofs(revertChangedValue);

  revertRoofValuesSettingsBtn.disabled = true;
  Events.send('rooflineDataUpdated', {isOldData: true});
  stateManager.save(roofsRepresentationId, {clearRoofsValues: true});
};

var loadRoofsBtn = document.getElementById('load_roofs_settings_button');
loadRoofsBtn.onclick = function() {
  Request.sendNotification('loadRoofs');
};

Request.addConsumer('loadedRoofs', {
  process: function(data) {
    var state = stateManager.getState();

    state.roofsState = data.roofsState || {};
    state.roofsValues = data.roofsValues;
    stateManager.apply(undefined, roofsRepresentationId);

    state.crossings = data.crossings;
    stateManager.apply(undefined, roofsCrossingId);

    Events.send('rooflineDataUpdated', {isOldData: true});
    stateManager.save(roofsCrossingId);
    stateManager.save(roofsRepresentationId);
  },
  onerror: function(e) {
    if (e.message) UiUtils.toast(e.message);
  }
});

function saveRoofs() {
  var state = { roofsValues: {} };
  roofsRepresentation.saveState(state, { all: true });
  Utils.copyObject(stateManager.getState().roofsValues, state.roofsValues);
  roofsCrossing.saveState(state, true);
  window.saveLocalProperty('saveRoofs', state);
}

var saveRoofsBtn = document.getElementById('save_roofs_settings_button');
saveRoofsBtn.onclick = function() {
  if (!Data.areAllRoofsLoaded()) {
    Request.sendNotification('getAllRoofs');
  } else {
    saveRoofs();
  }
}

Request.addConsumer('allRoofs', {
  process: function(allRoofs) {
    allRoofs.forEach(function(roofsData) {
      var threadCount = roofsData.threadCount;
      var strategyId = roofsData.strategyId;
      var packageCount = roofsData.packageCount;
      if (!Data.getRoofs(threadCount, strategyId, packageCount).length) {
        Data.addRoofs(roofsData.roofs, threadCount, strategyId, packageCount);
      }
    });
    Data.setAllRoofsLoaded(true);
    saveRoofs();
  }
});

StateManager.addCheckSetting('use_single_thread_strategy', 'useSTRoofsStrategy', function() {
  var state = stateManager.getState() || {};
  var useSTRoofsStrategy = !!state.useSTRoofsStrategy;

  Data.setRoofsStrategyId(RoofsUtils.getRoofsStrategyId(useSTRoofsStrategy));

  if (!Data.getRoofs().length) {
    Request.sendNotification('changeRoofs-' + RoofsUtils.getRoofsConfiguration(Data.getThreadCount(),
      useSTRoofsStrategy, Data.getPackageCount()).str());
  } else {
    Events.send('rooflineDataUpdated', {isOldData: true, isNewRoofs: true});
  }
}, true);

return roofsRepresentation;
});
