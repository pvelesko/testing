define(['./data'], function(Data) {

var roofDefs = (function() {
  var roofDefs;
  return {
    get: function(roofline) {
      if (!roofline) return;

      if (!roofDefs) roofDefs = roofline.centralPart.graphicsRoot.createDefs();

      return roofDefs;
    },
    clear: function() {
      roofDefs = undefined;
    }
  }
})();

  // Finds highest selected compute or memory roof or just highest roof if no roof selected
function getTopSelectedRoof(roofs, memRoof /*true for memory roofs, false for compute*/, 
    vectorRoof /*true for only vector roofs, false for only scalar, undefined for both*/) {
  var highestRoof;
  var selectedFoundRoof;

  if (!roofs) return highestRoof;

  var selectedTopY = -Number.MAX_VALUE;
  var topY = selectedTopY;

  roofs.forEach(function(roof) {
    if ((!!roof.isMem === !!memRoof) && !roof.hidden && (vectorRoof == undefined || !Data.isScalarRoof(roof) === vectorRoof)) {
      if (topY < roof.val) {
        topY = roof.val;
        highestRoof = roof;
      }

      if ((roof.selected || roof.userSelected) && selectedTopY < roof.val) {
        selectedTopY = roof.val;
        selectedFoundRoof = roof;
      }
    }
  });

  return selectedFoundRoof || highestRoof;
}

function isScalarRoof(roof) {
  if (!roof || !roof.name) return false;

  return roof.name.toLowerCase().indexOf('scalar') >= 0;
}

// Finds lowest compute roof: vector or scalar
function getBottomComputeRoof(roofs, vectorRoof /*true: search only vector roofs; false: search scalar*/) {
  var bottomComputeRoof;
  if (!roofs) return bottomComputeRoof;

  var topY = Number.MAX_VALUE;

  roofs.forEach(function(roof) {
    if (!roof.hidden && !roof.isMem && !!isScalarRoof(roof) === !vectorRoof) {
      if (topY > roof.val) {
        topY = roof.val;
        bottomComputeRoof = roof;
      }
  }
  });

  return bottomComputeRoof;
}

function getRoofsCrossing(memRoof, calcRoof) {
  return {
    x: calcRoof.val - memRoof.val,
    y: calcRoof.val
  };
}

function forEachRoofsCrossings(roofs, funct) {
  if (!roofs) return;

  funct = funct || function() {};

  roofs.forEach(function(memRoof) {
    if (!memRoof.isMem || memRoof.hidden) return;

    roofs.forEach(function(calcRoof) {
      if (calcRoof.isMem || calcRoof.hidden) return;

      funct(getRoofsCrossing(memRoof, calcRoof), memRoof, calcRoof);
    });
  });
}

function getRoofsStrategyId(useSTRoofsStrategy) {
  // Be sure that we use enum names from the models for the strategy id
  return ['rsiMultiThread', 'rsiSingleThread'][Number(!!useSTRoofsStrategy)];
}

function getRoofsConfiguration(threadCount, useSTRoofsStrategy, packageCount) {
  threadCount = threadCount || 1;
  packageCount = packageCount || 0;

  var configuration = { threadCount: threadCount, useSTRoofsStrategy: Number(!!useSTRoofsStrategy), packageCount: packageCount };
  function str() {
    var str = '';
    for (var key in configuration) {
      if (key !== 'str') {
        str += key + ':' + configuration[key] + ',';
      }
    }
    return str;
  }

  Object.assign(configuration, { str: str });

  return configuration;
}

// Gives reasonable memory level only for memory roofs
// as for compute roos memory level is not relevant.
function getRoofMemoryLevel(roofName) {
  if (!roofName) return '';

  var roofNameParts = roofName.split(' ');
  if (roofNameParts.length > 0) return roofNameParts[0];
}

// Check whether roof name contains input string.
function isMatchedRoof(roof, match) {
  return roof.name.toLowerCase().indexOf(match) >= 0;
}


return {
  roofDefs: roofDefs,
  isScalarRoof: isScalarRoof,
  getTopSelectedRoof: getTopSelectedRoof,
  getBottomComputeRoof: getBottomComputeRoof,
  getRoofsCrossing: getRoofsCrossing,
  forEachRoofsCrossings: forEachRoofsCrossings,
  getRoofsStrategyId: getRoofsStrategyId,
  getRoofsConfiguration: getRoofsConfiguration,
  getRoofMemoryLevel: getRoofMemoryLevel,
  isMatchedRoof: isMatchedRoof,
};
});
