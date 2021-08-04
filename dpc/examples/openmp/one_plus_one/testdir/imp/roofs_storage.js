define([], function () {

  function RoofsStorage(roofsMap) {
    this._roofsMap = roofsMap || {};
    this._strategyId = undefined;
    this._threadCount = undefined;
    this._packageCount = 0;
    this._allRoofsLoaded = false;
  }
  function getRoofsMapIndex(threadCount, packageCount) {
      threadCount = threadCount || this._threadCount;
      packageCount = packageCount || this._packageCount;

      if (!threadCount) return 0;
      if (!packageCount || packageCount <= 0) return threadCount;
      var index = parseFloat(threadCount + '.' + packageCount);
      if (!index) return 0;
      return index;
  }
  function getThreadCountFromIndex(index) {
      return Math.floor(index);
  }
  function getPackageCountFromIndex(index) {
      return index % 1;
  }
  RoofsStorage.prototype.add = function (roofs, threadCount, strategyId, packageCount) {
    if (!roofs) return;

    threadCount = threadCount || this._threadCount;
    strategyId = strategyId || this._strategyId;
    packageCount = packageCount || this._packageCount;

    if (!this._roofsMap[strategyId]) {
      this._roofsMap[strategyId] = {};
    }
    this._roofsMap[strategyId][getRoofsMapIndex(threadCount, packageCount)] = roofs;
  };

  RoofsStorage.prototype.get = function (threadCount, strategyId, packageCount) {
    threadCount = threadCount || this._threadCount;
    strategyId = strategyId || this._strategyId;
    packageCount = packageCount || this._packageCount;

    if (!this._roofsMap[strategyId]) return null;
    var index = getRoofsMapIndex(threadCount, packageCount);
    if (!this._roofsMap[strategyId][index]) return null;
    return this._roofsMap[strategyId][index];
  };

  RoofsStorage.prototype.removeIfEmpty = function (threadCount, strategyId, packageCount) {
    var roofs = this.get(threadCount, strategyId, packageCount);
    if (roofs) {
      if (typeof (roofs) === 'object' &&
        !Object.keys(roofs).length) {
          delete this._roofsMap[strategyId][getRoofsMapIndex(threadCount, packageCount)];
      }
    }
    if (!this._roofsMap[strategyId]) return;
    if (!Object.keys(this._roofsMap[strategyId]).length) delete this._roofsMap[strategyId];
  }

  RoofsStorage.prototype.forEach = function (handleFn) {
    for (var strategyId in this._roofsMap) {
      for (var index in this._roofsMap[strategyId]) {
        var roofs = this._roofsMap[strategyId][index];
        threadCount = getThreadCountFromIndex(index);
        packageCount = getPackageCountFromIndex(index);

        for (var key in roofs) {
          handleFn(roofs[key], threadCount, strategyId, packageCount);
        }
      }
    }
  };

  RoofsStorage.prototype.clear = function () {
    this._roofsMap = {};
    this._strategyId = undefined;
    this._threadCount = undefined;
    this._allRoofsLoaded = false;
    this._packageCount = undefined;
  };

  RoofsStorage.prototype.empty = function () {
    return !Object.keys(this._roofsMap).length;
  };

  RoofsStorage.prototype.setStrategyId = function (id) {
    if (!id) return;
    this._strategyId = id;
  };

  RoofsStorage.prototype.getStrategyId = function () {
    return this._strategyId;
  };

  RoofsStorage.prototype.setThreadCount = function (count) {
    if (!count) return;
    this._threadCount = count;
  };

  RoofsStorage.prototype.getThreadCount = function (count) {
    return this._threadCount;
  };

  RoofsStorage.prototype.setAllRoofsLoaded = function (loaded) {
    this._allRoofsLoaded = loaded;
  };

  RoofsStorage.prototype.areAllRoofsLoaded = function () {
    return this._allRoofsLoaded;
  }

  RoofsStorage.prototype.setPackageCount = function (count) {
    this._packageCount = count || 0;
  };

  RoofsStorage.prototype.getPackageCount = function () {
    return this._packageCount;
  };

  return {
    create: function (roofsMap) {
      return new RoofsStorage(roofsMap);
    },
  };
});
