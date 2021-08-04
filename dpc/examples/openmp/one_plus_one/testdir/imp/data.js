define(['../idvcjs/utils', './i18n', './roofs_storage'], function(Utils, I18n, RoofsStorage) {

var savedHierarchicalData;
var rooflineData;
var rooflineDataIsHierarchical = false;
var roofsStorage = RoofsStorage.create();

var _filterInfos = [];

var pointConstructors = (function() {
  var items;
  var itemsOrig;

  return {
    init: function(arr) {
      itemsOrig = arr;
      items = itemsOrig.concat();
    },
    use: function() {
      if (!items || !items.length) return;

      var res = items.shift();
      items.push(res);

      return res;
    },
    unUse: function(constr) {
      if (!items || !items.length) return;

      var index = items.indexOf(constr);
      if (index > 0) {
        items.splice(index, 1);
        items.unshift(constr);
      }
    },
    revert: function() {
      items = itemsOrig.concat();
    }
  }
})();

var results = {
  items: [],
  originalLoopsCount: 0,
  clear: function() {
    this.items = [];
    this.originalLoopsCount = 0;
    if (this.minMax) delete this.minMax;
  },
  getIndexByPath: function(path) {
    var resultIndex = -1;

    this.items.some(function(result, index) {
      var ret = result.resultInfo.path === path;
      if (ret) resultIndex = index;

      return ret;
    });

    return resultIndex;
  },
  getItem: function(index) {
    return index < this.items.length && index >= 0 ? this.items[index] : undefined;
  }
};

function getPath(item) {
  if (!item || !item.resultInfo) return '';

  return item.resultInfo.path || item.resultInfo.caption.toLowerCase();
}

function getDefaultState() {
  return rooflineDataIsHierarchical ? '-' : '+';
}

function getChangedState() {
  return rooflineDataIsHierarchical ? '+' : '-';
}

function getHierachicalData(data) {
  if (!data) return;

  var result = [];

  data.forEach(function(loop, index) {
    if (loop &&
        loop.state === getChangedState()) {
      result.push({
        i: index,
        n: loop.name
      });
    }
  });

  return result;
}

function applyHierarchy(data) {
  function isEqual(item, hierarchItem) {
    return item.name === hierarchItem.n;
  }

  if (savedHierarchicalData) {
    savedHierarchicalData.forEach(function(item) {
      if (!item) return;

      var loop = data[item.i];
      if (loop &&
          isEqual(loop, item) &&
          loop.state === getDefaultState()) {
        loop.state = getChangedState();
      }
    });

    // TODO
    savedHierarchicalData = undefined;
  }
}

function setResultMinMax(data, mainResult) {
  if (!data || !Array.isArray(data.loops)) return;

  function testX(x) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
  }

  function testY(y) {
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  if (mainResult &&
      !data.wholeMinMax &&
      data.minX !== undefined &&
      data.maxX !== undefined &&
      data.minY !== undefined &&
      data.maxY !== undefined) {
    var wholeMinMax = {
      minX: data.minX,
      maxX: data.maxX,
      minY: data.minY,
      maxY: data.maxY
    };

    data.wholeMinMax = wholeMinMax;
  }

  if (data.loops.length) {
    var minX = Number.MAX_VALUE;
    var maxX = -Number.MAX_VALUE;
    var minY = Number.MAX_VALUE;
    var maxY = -Number.MAX_VALUE;

    data.loops.forEach(function(loop) {
      if (loop.x !== undefined &&
          loop.y !== undefined) {
        testX(loop.x);
        testY(loop.y);
      }

      if (loop.x1 !== undefined &&
          loop.y1 !== undefined) {
        testX(loop.x1);
        testY(loop.y1);
      }
    });

    data.minX = minX;
    data.maxX = maxX;
    data.minY = minY;
    data.maxY = maxY;

    if (mainResult &&
        !data.fitMinMax &&
        data.minX !== undefined &&
        data.maxX !== undefined &&
        data.minY !== undefined &&
        data.maxY !== undefined) {
      var fitMinMax = {
        minX: data.minX,
        maxX: data.maxX,
        minY: data.minY,
        maxY: data.maxY
      };

      data.fitMinMax = fitMinMax;
    }
  } else {
    data.minX = data.maxX = data.minY = data.maxY = undefined;
  }
}

function forEachLoopsSimple(loops, processFn) {
  if (!loops) return;

  loops.forEach(function(loop) {
    processFn(loop, undefined);
  });
}

function forEachLoops(loops, processFn, isAll, loopsParent) {
  if (!loops ||
      !rooflineData ||
      !rooflineData.loops) return;

  var processing = [];
  var mainLoops = rooflineData.loops;

  function appendLoops(loops, parent, isHidden) {
    if (!loops) return;

    var ignoreChildren = !parent;

    loops.forEach(function(loopRaw) {
      var loop;
      if (typeof(loopRaw) === 'number') {
        loop = mainLoops[loopRaw];
      } else {
        loop = loopRaw;
      }

      if (loop) {
        if (!ignoreChildren || loop.parent === undefined) {
          processFn(loop, parent, isHidden);

          processing.push({
            loop: loop,
            isHidden: isHidden
          });
        }
      }
    })
  }

  var isSimpleHierarchy = !loopsParent && rooflineDataIsHierarchical && !results.items.length;

  if (!isSimpleHierarchy) {
    var childrenHidden = loopsParent ? loopsParent.state !== '-' : false;
    appendLoops(loops, loopsParent, childrenHidden);
  } else {
    appendLoops([loops[0]], undefined, false);
  }

  for (var i = 0; i < processing.length; i++) {
    var current = processing[i];
    childrenHidden = current.isHidden || current.loop.state !== '-';

    if (isAll || !childrenHidden) {
      appendLoops(current.loop.children, current.loop, childrenHidden);
    }
  }
}

var saveHierarchyCall;
function createSaveHierarchyCall() {
  saveHierarchyCall = Utils.createAsyncCall(
            window.saveLocalProperty.bind(window, 'hierarchy'), window, 10000);
}

function sortRoofs(roofs) {
  if (!roofs) return;

  roofs.sort(function(roof1, roof2) {
    var result = 0;
    if (roof1.isMem && !roof2.isMem) result = -1;
    else if (!roof1.isMem && roof2.isMem) result = 1;

    if (!result) result = roof2.val - roof1.val;

    return result;
  });
}

function isNoLoopPosition(loop) {
  if (!loop) return true;

  return (loop.state && loop.state !== '+' || !loop.state) &&
         (loop.x === undefined || loop.y === undefined);
}

function getLoopPosition(loop, noLoopPosition) {
  if (!loop) return {};

  if (noLoopPosition === undefined) {
    noLoopPosition = isNoLoopPosition(loop);
  }

  return {
    x: ((noLoopPosition || loop.state === '+') ? loop.x1 : loop.x) || loop.x,
    y: ((noLoopPosition || loop.state === '+') ? loop.y1 : loop.y) || loop.y,
  }
}

function isTheSamePosition(loop1, loop2, minDistance) {
  if (!loop1 || !loop2) return false;

  var pos1 = getLoopPosition(loop1);
  var pos2 = getLoopPosition(loop2);

  return Math.abs(pos1.x1 - pos2.x1) <= minDistance.x &&
         Math.abs(pos1.y1 - pos2.y1) <= minDistance.y;
}

function getLoopByIndex(index) {
  if (index >= 0) {
    return rooflineData.loops[index];
  }

  return undefined;
}

var generateId = (function() {
  var id = 0;
  return function(prefix) {
    id++;
    prefix = prefix || 'id';
    return prefix + id;
  };
})();

function updateLoopIndexes(loop, indexDelta) {
  if (!loop || !indexDelta) return;

  if (loop.parent !== undefined) {
    loop.parent += indexDelta;
  }

  if (loop.children) {
    for (var i = 0, len = loop.children.length; i < len; i++) {
      loop.children[i] += indexDelta;
    }
  }
}

function updateResultsIndexes(data, startResultIndex, startLoopIndex, indexDelta) {
  if (!data || !indexDelta) return;

  for (var i = startResultIndex, len = results.items.length; i < len; i++) {
    results.items[i].resultInfo.baseIndex += indexDelta;
  }

  for (i = startLoopIndex, len = data.loops.length; i < len; i++) {
    updateLoopIndexes(data.loops[i], indexDelta);
  }
}

function addCurrentResultInfo() {
  if (!results.items.length) {
    if (!rooflineData.resultInfo) {
      rooflineData.resultInfo = {
        caption: I18n.getMessage('roofline_compare_current_result_label'),
        id: 'cr',
        baseIndex: 0,
        loopCount: rooflineData.loops.length
      };
    } else {
      rooflineData.resultInfo.baseIndex = 0;
      rooflineData.resultInfo.loopCount = rooflineData.loops.length
    }

    rooflineData.resultInfo.id = rooflineData.resultInfo.id || generateId();

    results.items.push(rooflineData);
  }
}

function setCompareData(compareData) {
  if (!compareData || !compareData.length) return undefined;

  if (!results.items.length) {
    addCurrentResultInfo();
  }

  compareData.forEach(function(item) {
    if (item && item.resultInfo) item.resultInfo.pointConstructor = pointConstructors.use();
    results.items.push(item);
  })
}

function addResultInfo(data, baseIndex) {
  if (!data || !data.loops || !data.resultInfo) return undefined;

  if (!results.items.length) {
    addCurrentResultInfo();
  }

  var resultIndex = results.getIndexByPath(data.resultInfo.path);
  if (resultIndex >= 0) {
    baseIndex = results.items[resultIndex].resultInfo.baseIndex;
  }

  if (baseIndex) {
    var resIndex = resultIndex >= 0 ? resultIndex : results.items.length;

    data.loops.forEach(function(loop) {
      loop.resIndex = resIndex;

      updateLoopIndexes(loop, baseIndex);
    });

    data.resultInfo.baseIndex = baseIndex;
    data.resultInfo.loopCount = data.loops.length;

    data.resultInfo.id = data.resultInfo.id || generateId();

    setResultMinMax(data);

    var oldData;
    if (resultIndex >= 0) {
      oldData = results.items[resultIndex];

      data.resultInfo.pointConstructor = oldData.resultInfo.pointConstructor;

      results.items[resultIndex] = data;

      oldData.replasedResultIndex = resultIndex;
    } else {
      data.resultInfo.pointConstructor = pointConstructors.use();
      results.items.push(data);
    }

    return oldData;
  }

  return undefined;
}

function setNewData(data) {
  if (!data) return;

  setResultMinMax(data, true);

  if (results.items.length &&
      results.originalLoopsCount !== undefined) {
    var newMainLoopsCount = data.loops.length;
    var oldMainLoopsCount = results.originalLoopsCount;

    var indexDelta = newMainLoopsCount - oldMainLoopsCount;
    var mainResult = results.items[0];

    var restLoops = [];
    if (rooflineData.loops.length > oldMainLoopsCount) {
      restLoops = rooflineData.loops;
      restLoops.splice(0, oldMainLoopsCount);
    }

    mainResult.resultInfo.loopCount = results.originalLoopsCount = newMainLoopsCount;

    if (restLoops.length) {
      data.loops = data.loops.concat(restLoops);
    }
    updateResultsIndexes(data, 1, newMainLoopsCount, indexDelta);

    if (mainResult.loops) delete mainResult.loops;
  }

  rooflineData = data;

  if (rooflineData.compareData) {
    setCompareData(rooflineData.compareData);

    delete rooflineData.compareData;
  }

  rooflineDataIsHierarchical = !!data.withCallstacks;
  sortRoofs(roofsStorage.get());

  if (data.isFiltered) {
    applyFiltering(data.loops);
  }
}

function getLoopId(loop) {
  return loop.objId || loop.id;
}

function getLoopIdEx(loop) {
  var ret = getLoopId(loop);

  var postfix;

  if (loop.resIndex) {
    var item = results.getItem(loop.resIndex);
    if (item) {
      postfix = getPath(item);
    }
  }

  ret += postfix || loop.resIndex || 0;

  return ret;
}

var FilterOperation = {
  in: 'in',
  out: 'out'
};

var FilterPredicates = {
  in: (arg => !arg),
  out: (arg => arg)
};

function filterOutHidddenLoops(loops) {
  forEachLoops(loops, function(loop, parent, isHidden) {
    if (loop && isHidden) {
      loop.filtered = true;
    }
  });
}

function applyFilterInfo(loops, filtering, filterInfo) {
  function filterByIds(loops, ids, predicate, filtering) {
    if (!loops || !ids) return;

    predicate = predicate || FilterPredicates.out;

    function idIsIn(loop, loopIds) {
      var loopId = getLoopIdEx(loop);
      return loopIds.some(id => id === loopId);
    }

    loops.forEach(function(loop) {
      if (predicate(idIsIn(loop, ids))) {
        if (filtering) {
          if (!loop.filtered) loop.filtered = 1;
          else loop.filtered++;
        } else {
          if (!loop.filtered) console.error('Filtering undo failed');

          loop.filtered--;
          if (!loop.filtered) delete loop.filtered;
        }
      }
    });
  }

  if (!loops || !filterInfo) return;

  filterByIds(loops, filterInfo[FilterOperation.in], FilterPredicates[FilterOperation.in], filtering);
  filterByIds(loops, filterInfo[FilterOperation.out], FilterPredicates[FilterOperation.out], filtering);
}

function applyFiltering(loops) {
  filterOutHidddenLoops(loops);
  _filterInfos.forEach(applyFilterInfo.bind(undefined, loops, true));
}

function addResult(data) {
  if (!rooflineData || !data || !data.loops || !data.resultInfo) return;

  var baseIndex = rooflineData.loops.length;
  var oldData = addResultInfo(data, baseIndex);

  if (data.isFiltered) {
    applyFiltering(data.loops);
  }

  if (oldData) {
    var indexDelta = data.loops.length - oldData.resultInfo.loopCount;
    var restLoopIndex = oldData.resultInfo.baseIndex + oldData.resultInfo.loopCount;

    var arrBefore = rooflineData.loops.slice(0, oldData.resultInfo.baseIndex);
    var arrAfter = rooflineData.loops.slice(restLoopIndex);
    rooflineData.loops = arrBefore.concat(data.loops, arrAfter);

    restLoopIndex += indexDelta;

    updateResultsIndexes(rooflineData, oldData.replasedResultIndex + 1, restLoopIndex, indexDelta);
    removeResultFromCompared(data.resultInfo.path);
  } else {
    rooflineData.loops = rooflineData.loops.concat(data.loops);
  }
  delete data.loops;

  if (!results.originalLoopsCount) results.originalLoopsCount = baseIndex;
}

function forEachMatchingLoops(loop, processFn, scope) {
  if (!loop.matchingLoops) return;
  loop.matchingLoops.forEach(processFn, scope ? scope : this);
}

function setResultsCompared(item1, item2) {
  const path1 = item1.resultInfo && item1.resultInfo.path ? item1.resultInfo.path : 'current';
  const path2 = item2.resultInfo && item2.resultInfo.path ? item2.resultInfo.path : 'current';

  function addCompared(item, comparedItemPath) {
    if (!item.compared) {
      item.compared = new Set([comparedItemPath]);
    } else {
      item.compared.add(comparedItemPath);
    }
  }

  function try2RemComparingFlag(item) {
    if (item.compared.size >= results.items.findIndex(i => i === item)) {
        if(item.resultInfo) {
          delete item.resultInfo.comparing;
          return true;
        }
    }
    return false;
  }

  addCompared(item1, path2);
  addCompared(item2, path1);

  return try2RemComparingFlag(item1) | try2RemComparingFlag(item2);
}

function updateComparisonResults(data) {
  const path1 = data.path1, path2 = data.path2;

  const item1Idx = path1 === 'current' ? 0 : results.getIndexByPath(path1);
  if (item1Idx < 0) return;
  const item2Idx = path2 === 'current' ? 0 : results.getIndexByPath(path2);
  if (item2Idx < 0) return;

  if (item1Idx === item2Idx) return;

  var resultIdsEqual = (index1, index2) => !index1 && !index2 || index1 === index2;

  var loopsEqual = (loop1, loop2, loop2ResIdx) =>
    getLoopId(loop1) === getLoopId(loop2) && resultIdsEqual(loop1.resIndex, loop2ResIdx);

  if (data.comparison) {
    data.comparison.forEach(function (matchInfo) {
      var loop1 = rooflineData.loops.find(loop => loopsEqual(loop, matchInfo[path1], item1Idx));
      if (!loop1) return;

      var loop2 = rooflineData.loops.find(loop => loopsEqual(loop, matchInfo[path2], item2Idx));
      if (!loop2) return;

      if (!loop1.matchingLoops) loop1.matchingLoops = [];
      if (!loop2.matchingLoops) loop2.matchingLoops = [];

      const index1 = loop1.matchingLoops.findIndex(loop => resultIdsEqual(loop2.resIndex, loop.resIndex));
      loop1.matchingLoops.splice(index1, index1 > -1 ? 1 : 0, loop2);

      const index2 = loop2.matchingLoops.findIndex(loop => resultIdsEqual(loop1.resIndex, loop.resIndex));
      loop2.matchingLoops.splice(index2, index2 > -1 ? 1 : 0, loop1);
    }, this);
  }

  return setResultsCompared(results.items[item1Idx], results.items[item2Idx]);
}

function removeLoopComparisons(loop) {
  forEachMatchingLoops(loop, function(matching) {
    if (!matching.matchingLoops) return;

    var index = matching.matchingLoops.indexOf(loop);
    if (index > -1) {
      matching.matchingLoops.splice(index, 1);
    }
  });
  delete loop.matchingLoops;
}

function removeResultFromCompared(path) {
  results.items.forEach(item => item && item.compared && item.compared.delete(path));
}

return {
  isNewData: function(data) {
    var newData = !rooflineData || !data.resultInfo || data.resultInfo.isNew ||
      (!results.items.length && data.resultInfo && data.resultInfo.replase &&
        rooflineData.resultInfo && data.resultInfo.id === rooflineData.resultInfo.id);
    return !!newData;
  },
  setRooflineData: function(data, threadCount, roofsStrategyId, packageCount) {
    if (!data) return;

    if (this.isNewData(data)) {
      roofsStorage.clear();

      if (threadCount && roofsStrategyId) {
        roofsStorage.setThreadCount(threadCount);
        roofsStorage.setStrategyId(roofsStrategyId);
        roofsStorage.setPackageCount(packageCount); //could be undefined

        if (data.allRoofs) {
          data.allRoofs.forEach(function (roofsData) {
            roofsStorage.add(roofsData.roofs, roofsData.threadCount, roofsData.strategyId, roofsData.packageCount);
          });
          delete data.allRoofs;
        } else if (data.roofs && data.roofs.length) {
          roofsStorage.add(data.roofs);
          delete data.roofs;
        }
      }

      setNewData(data);
    } else {
      addResult(data);
    }

    if (results.minMax) delete results.minMax;
  },
  updateComparisonResults: updateComparisonResults,
  getRooflineData: function() {
    return rooflineData;
  },
  getRooflineData4Loop: function(loop) {
    if (!loop) return undefined;

    return loop.resIndex ? results.items[loop.resIndex] : rooflineData;
  },
  getMemoryLevelPrefix: function(loop, data) {
    data = data || this.getRooflineData4Loop(loop);
    return (loop && loop.memoryLevelPref) || (data && data.memoryLevelPref ? data.memoryLevelPref : 'L1 ');
  },
  isHierarchical: function() {
    return rooflineDataIsHierarchical;
  },
  isScalarRoof: function (roof) {
    if (!roof || !roof.name) return false;
    return roof.name.toLowerCase().indexOf('scalar') >= 0;
  },
  getProp: function(propName) {
    if (rooflineData) return rooflineData[propName];

    return undefined;
  },
  getTotalTime: function(index) {
    return this._getTime('totalTime', index);
  },
  getMaxSelfTime: function(index) {
    return this._getTime('maxSelfTime', index);
  },
  _getTime: function(timeProp, index) {
    var result = 0;
    index = index || 0;

    if (rooflineData) {
      if (index > 0 && index < results.items.length) {
        result = results.items[index][timeProp];
      } else {
        result = rooflineData[timeProp];
      }
    }

    return result || 0;
  },
  getMaxTotalTime: function() {
    return this._getMaxTime('totalTime');
  },
  getMaxMaxSelfTime: function() {
    return this._getMaxTime('maxSelfTime');
  },
  _getMaxTime: function(timeProp) {
    var result = 0;

    if (rooflineData) {
      result = rooflineData[timeProp];

      var resLen = results.items.length;
      if (resLen > 1) {
        for (var i = 1; i < resLen; i++) {
          result = Math.max(results.items[i][timeProp] || 0, result);
        }
      }
    }

    return result;
  },
  getLoops: function() {
    if (rooflineData && rooflineData.loops) return rooflineData.loops;

    return [];
  },
  getRoofs: function(threadCount, strategyId, packageCount) {
    return roofsStorage.get(threadCount, strategyId, packageCount) || [];
  },
  getParent: function(loop, minDistance) {
    if (loop &&
        rooflineData &&
        rooflineData.loops &&
        loop.parent !== undefined) {

      if (minDistance) {
        var parent;
        while ((parent = getLoopByIndex(loop.parent)) &&
              isTheSamePosition(loop, parent, minDistance)) {
          loop = parent;
        }
      }

      return getLoopByIndex(loop.parent);
    }

    return undefined;
  },
  setHierarchicalData: function(data) {
    savedHierarchicalData = data;
  },
  addRoofs: function(data, threadCount, strategyId, packageCount) {
    if (!data) return;

    sortRoofs(data);
    roofsStorage.add(data, threadCount, strategyId, packageCount);
  },
  setRoofsStrategyId: function(id) {
    roofsStorage.setStrategyId(id);
  },
  getRoofsStrategyId: function() {
    return roofsStorage.getStrategyId();
  },
  setThreadCount: function(count) {
    roofsStorage.setThreadCount(count);
  },
  getThreadCount: function() {
    return roofsStorage.getThreadCount();
  },
  setPackageCount: function (count) {
    roofsStorage.setPackageCount(count);
  },
  getPackageCount: function () {
    return roofsStorage.getPackageCount();
  },
  setAllRoofsLoaded: function(loaded) {
    roofsStorage.setAllRoofsLoaded(loaded);
  },
  areAllRoofsLoaded: function() {
    return roofsStorage.areAllRoofsLoaded();
  },
  applySavedHierarchy: applyHierarchy,
  saveHierarchy: function() {
    if (!rooflineData) return;

    if (!saveHierarchyCall) createSaveHierarchyCall();
    saveHierarchyCall.call(getHierachicalData(rooflineData.loops));
  },
  isNoLoopPosition: isNoLoopPosition,
  getLoopPosition: getLoopPosition,
  forEachLoops: forEachLoops,
  forEachLoopsSimple: forEachLoopsSimple,
  forEachChildren: function(loop, processFn, minDistance) {
    if (!loop ||
        !loop.children ||
        !rooflineData ||
        !rooflineData.loops) return;

    var firstChild;

    while (minDistance &&
           loop.children &&
           loop.children.length === 1 &&
           (firstChild = getLoopByIndex(loop.children[0])) &&
           firstChild.children &&
           firstChild.children.length &&
           isTheSamePosition(loop, firstChild, minDistance)) {
      loop = firstChild;
    }

    if (!loop || !loop.children) return;

    loop.children.forEach(function(childIndex) {
      var child = getLoopByIndex(childIndex);
      if (child) processFn(child);
    });
  },
  forEachChildrenEx: function(loop, processFn, isAll) {
    if (!loop) return;

    this.forEachLoops(loop.children, processFn, isAll, loop);
  },
  forEachRoofs: function(processFn) {
    this.getRoofs().forEach(processFn);
  },
  forEachAllRoofs: function(processFn) {
    roofsStorage.forEach(processFn);
  },
  isResultEmpty: function(index) {
    var result = results.items[index];
    return !(result && result.resultInfo.loopCount !== 0);
  },
  getResultCount: function() {
    return results.items.length;
  },
  getResultCaption: function(index) {
    var result = results.items[index];
    if (result && result.resultInfo) return result.resultInfo.caption;

    return undefined;
  },
  getResultInfo: function(index) {
    var result = results.items[index];

    return result && result.resultInfo;
  },
  setExtraData: function(prop, data, index) {
    function setData(result) {
      if (!result) return;

      if (!result.extraData) result.extraData = {};
      result.extraData[prop] = data;
    }

    if (!index) {
      setData(rooflineData);
    } else {
      setData(results.items[index]);
    }
  },
  getExtraData: function(prop, index) {
    function getData(result) {
      if (result && result.extraData) return result.extraData[prop];
    }

    if (!index) {
      return getData(rooflineData);
    } else {
      return getData(results.items[index]);
    }
  },
  removeResult: function(index) {
    if (index <= 0) return;

    var result = results.items[index];
    if (result && result.resultInfo) {
      pointConstructors.unUse(result.resultInfo.pointConstructor);

      var removeCount = result.resultInfo.loopCount;
      var loopStartIndex = result.resultInfo.baseIndex;

      for (var i = loopStartIndex; i < loopStartIndex + removeCount; ++i) {
        removeLoopComparisons(rooflineData.loops[i]);
      }

      rooflineData.loops.splice(loopStartIndex, removeCount);

      removeResultFromCompared(result.resultInfo.path);
      results.items.splice(index, 1);

      if (removeCount > 0) {
        updateResultsIndexes(rooflineData, index, loopStartIndex, -removeCount);
      }

      for (var i = loopStartIndex, len = rooflineData.loops.length; i < len; i++) {
        var loop = rooflineData.loops[i];
        if (loop.resIndex) loop.resIndex -= 1;
      }

      if (results.items.length <= 1) {
        results.clear();
        pointConstructors.revert();
      }
    }
  },
  removeResultByPath: function(path) {
    if (!path) return false;

    var resultIndex = results.getIndexByPath(path);
    this.removeResult(resultIndex);

    return resultIndex >= 1;
  },
  clearCompareData: function() {
    var removeCount = rooflineData.loops.length - results.originalLoopsCount;

    rooflineData.loops.splice(results.originalLoopsCount, removeCount);
    rooflineData.loops.forEach(function (loop) {
      removeLoopComparisons(loop);
    });

    results.clear();
    pointConstructors.revert();
  },
  getCompareData: function() {
    var result = [];
    for (var i = 1, len = results.items.length; i < len; i++) {
      var copy = {};
      Utils.copyObject(results.items[i], copy, function(value, name) {
        return (name.indexOf('roof') !== 0) &&
               (name !== 'compareItem');
      });
      result.push(copy);
    }

    return result;
  },
  forEachMatchingLoops: forEachMatchingLoops,
  getMinMax: function() {
    var props = [
      {
        name: 'minX',
        fn: Math.min
      },
      {
        name: 'minY',
        fn: Math.min
      },
      {
        name: 'maxX',
        fn: Math.max
      },
      {
        name: 'maxY',
        fn: Math.max
      }
    ];

    if (!results.minMax) {
      var minMax = {
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0
      };

      if (rooflineData) {
        props.forEach(function(prop) {minMax[prop.name] = rooflineData[prop.name];});
      }

      var resCount = results.items.length;
      if (resCount > 1) {
        for (var i = 1; i < resCount; i++) {
          var data = results.items[i];
          props.forEach(function(prop) {
            var val = data[prop.name];
            if (val !== undefined) {
              minMax[prop.name] = prop.fn(val, minMax[prop.name]);
            }
          });
        }
      }

      results.minMax = minMax;
    }

    return results.minMax;
  },
  getViewFrame: function() {
    var result = {
      minIntens: 0,
      minPerf: 0,
      maxIntens: 0,
      maxPerf: 0
    };

    if (rooflineData) {
      result.minIntens = rooflineData.minIntens;
      result.minPerf = rooflineData.minPerf;
      result.maxIntens = rooflineData.maxIntens;
      result.maxPerf = rooflineData.maxPerf;
    }

    return result;
  },
  FilterOperation: FilterOperation,
  clearFiltering: function() {
    var ret = _filterInfos;

    _filterInfos = [];

    this.forEachLoopsSimple(this.getLoops(), function(loop) {
      if (loop.filtered) delete loop.filtered;
    });

    return ret;
  },
  isFiltered: function() {
    return !!_filterInfos.length;
  },
  addFilterInfo: function(filterInfo) {
    if (!filterInfo) return;

    if (!Array.isArray(filterInfo)) filterInfo = [filterInfo];

    if (!_filterInfos.length) {
      filterOutHidddenLoops(this.getLoops());
    }

    filterInfo.forEach(applyFilterInfo.bind(undefined, this.getLoops(), true));

    _filterInfos = _filterInfos.concat(filterInfo);
  },
  remFilterInfo: function(filterInfo) {
    if (!filterInfo) return;

    if (!Array.isArray(filterInfo)) filterInfo = [filterInfo];

    if (_filterInfos.length === filterInfo.length &&
        _filterInfos.every(function(info, index) {
          return info === filterInfo[index];
        })) {
      this.clearFiltering();
    } else {
      filterInfo.forEach(function(info) {
        var index = _filterInfos.indexOf(info);
        if (index >= 0) {
          applyFilterInfo(this.getLoops(), false, info);
          _filterInfos.splice(index, 1);
        }
      }.bind(this));
    }
  },
  getLoopId: getLoopIdEx,
  setPointConstructors: function(arr) {
    pointConstructors.init(arr);
  },
  getPointConstructor: function(index) {
    var res;
    if (index > 0)  {
      var result = results.items[index];
      if (result && result.resultInfo) res = result.resultInfo.pointConstructor;
    }

    return res;
  },
  setWholeView: function(whole) {
    var minMax;

    if (whole) {
      minMax = rooflineData.wholeMinMax;
    } else {
      minMax = rooflineData.fitMinMax;
    }

    if (minMax) {
      rooflineData.minX = minMax.minX;
      rooflineData.maxX = minMax.maxX;
      rooflineData.minY = minMax.minY;
      rooflineData.maxY = minMax.maxY;

      delete results.minMax;
    }
  }
};

});
