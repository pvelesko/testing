define(['../idvcjs/utils'], function(Utils) {

function formatVal(val, prec, noExp) {
  prec = prec || 4;
  var expBorder = 4;
  if (noExp || val >= -expBorder && val <= expBorder) {
    if (val > -1) prec = 2;
    else prec = Math.ceil(Math.abs(val)) + 1;

    var result = Utils.round(Math.pow(10, val), prec);
    if (noExp && (val < -expBorder || val > expBorder)) result = +result.toFixed(prec);
    return result;
  } else {
    return Utils.roundExp(Math.pow(10, val), 1);
  }
}

function simpleFormat(val, prec) {
  prec = prec || 4;

  return Utils.round(val, prec);
}

function formatTime(val) {
  val = val || 0;
  return val.toFixed(3);
}

function log10(val) {
  return Math.log(val) / Math.LN10;
}

function getLine(point1, point2) {
  var denominator = point1.x - point2.x;
  if (denominator === 0) return () => void 0;

  var k = (point1.y - point2.y) / denominator;
  var b = point1.y - point1.x * k;

  return function (x) {
    return k * x + b;
  }
}

return {
  pref: ': <b>',
  post: '</b> ',
  formatVal: formatVal,
  simpleFormat: simpleFormat,
  formatTime: formatTime,
  log10: log10,
  getLine: getLine
};

});