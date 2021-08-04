define([
  './extensions/roofs_crossing_line',
  './extensions/integrated_dumbbell_line',
  './extensions/zones',
  './extensions/loops_matching_line'
], function() {

  var extensions = [].slice.call(arguments);;

  function forEach(funct, arg) {
    extensions.forEach(function(extension) {
      if (extension[funct]) extension[funct](arg);
    });
  }

  return {
    setRoofline: function(roofline) {
      forEach('setRoofline', roofline);
    },
    setScale: function(scale) {
      forEach('setScale', scale);
    },
    setConfiguration: function(configuration) {
      forEach('setConfiguration', configuration);
    },
  };
});
