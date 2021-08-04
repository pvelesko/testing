define(function () {
  function getLoopPoint(loop) {
    var rooflinePoint = loop.rooflinePoint;
    return {
      x: rooflinePoint.getX(),
      y: rooflinePoint.getY()
    };
  }

  function getLoopPointEx(loop, startPoint) {
    return loop.rooflinePoint.calcLineEndPoint(startPoint.x, startPoint.y);
  }

  function getLoopPoints(loop1, loop2, descending) {
    var point1 = getLoopPoint(loop1);
    var point2 = getLoopPointEx(loop2, point1);
    point1 = getLoopPointEx(loop1, point2);
    return !descending ? [point1, point2] : [point2, point1];
  }

  function setLoopPointFront(loopPoint, roofline) {
    if (roofline) roofline.setPointFront(loopPoint);
  }

  function getLoopMemoryLevel(loopMemLevelPrefix) {
    var defaultMemLevelForLoop = 'L1';

    if (loopMemLevelPrefix) {
      var loopMemLevelParts = loopMemLevelPrefix.split(' ');

      if (loopMemLevelParts.length > 0) {
        var loopMemLevel = loopMemLevelParts[0];

        if (loopMemLevelParts.length > 1 && loopMemLevelParts[1].indexOf(defaultMemLevelForLoop) !== -1) {
          loopMemLevel = defaultMemLevelForLoop;
        }

        return loopMemLevel;
      }
    }

    return defaultMemLevelForLoop; //for any unknown loop we report that it has L1 memory level
  }

  return {
    getLoopPoints: getLoopPoints,
    setLoopPointFront: setLoopPointFront,
    getLoopMemoryLevel: getLoopMemoryLevel,
  };
});