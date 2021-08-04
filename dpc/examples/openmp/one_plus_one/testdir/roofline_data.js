

var testRooflineData = "{withCallstacks:0,attrs: {selfTime: {name: 'Self Elapsed Time', measure : 's'}, totalTime: {name: 'Total Elapsed Time',measure : 's'}},legendCaption: 'loop self elapsed time / program total elapsed time * 100',nameX: 'Arithmetic Intensity', measureX: 'FLOP/Byte', nameY: 'Performance', measureY: 'GFLOPS',namePref: 'Self ',namePref1: 'Total '," +
 "minX:-4.38024,minY:-2.50228,maxX:-0.555317,maxY:2.93376,maxSelfTime:3.04373,totalTime:40.8438,programTotal:{x:-0.908314,y:0.0277321}," +

"roofs: [ {val: 2.44842414384 , isMem: 0 , measure:'GFLOPS',name:'DP FMA',desc:'DP FMA'}, {val: 3.04522350692 , isMem: 0 , measure:'GFLOPS',name:'SP FMA',desc:'SP FMA'}, {val: 2.17608789307 , isMem: 0 , measure:'GFLOPS',name:'DP Add',desc:'DP Add'}, {val: 2.75357855269 , isMem: 0 , measure:'GFLOPS',name:'SP Add',desc:'SP Add'}, {val: 2.75089294142 , isMem: 1 , measure:'GB/sec',name:'SLM',desc:'SLM'}, {val: 2.58838190943 , isMem: 1 , measure:'GB/sec',name:'L3',desc:'L3'}, {val: 1.43723854646 , isMem: 1 , measure:'GB/sec',name:'DRAM',desc:'DRAM'}, ],loops:[ ]}";

window.idvcGlobalSender = {
  sendNotification: function(message) {

  }
};

var rooflineState = '{"stackViewVisible":false,"colorMode":2,"copyContentIndex":2,"rooflineType":"", "useZoneColoring": false, "roofsState":{"l1bandwidth":{"hidden":false,"selected":true},"drambandwidth":{"hidden":false,"selected":true}} ,"roofsMtValues":[{"val":4.403433562199674,"index":0},{"val":3.2645915807384025,"index":1}],"compareItems":[{"caption":"compare_data","path":"C:/Tools/test_roofs_state/compare_data.json"},null,null,null,null], "crossings":{"DRAMBandwidthSPVectorFMAPeak": {selected:true}}}';

window.idvcGlobalRequest.receiveData('rooflineState', rooflineState);

var rooflineUIInfo = "{'scale': '1', 'hierarchy': 1 ,defaultRooflineType: '',i18n: [{id: 'roofline_menu_collapse', message: 'Collapse'}, {id: 'roofline_menu_expand', message: 'Expand'}, {id: 'roofline_histogram_loops', message: '{1} loops total'}, {id: 'roofline_histogram_loop', message: '{1} loop total'}, {id: 'roofline_histogram_tooltip_loops', message: '{1}% - {2} loops'}, {id: 'roofline_histogram_tooltip_loop', message: '{1}% - {2} loop'}],dataOptions:{}}"

window.idvcGlobalRequest.receiveData('uiInfo', rooflineUIInfo);

var rooflineUIInfo1 = "{dataOptions:{defConfigurationCaption:'Default Configuration', groups:[{caption:'Operations',isRadio: 1,options:[{caption:'FLOAT',value:'f'},{caption:'INT',value:'i'},{caption:'INT+FLOAT',value:'b'},],defRooflineTypes:['f']},{caption:'Callstacks',isTwoStates: 1,options:[{caption:'With Callstacks',value:'0',expl:'Roofline with Callstacks provides aggregated data for outermost loops and functions. It also separates the data for the cases when the same loop is invoked from different caller functions. This mode enables Roofline Callstack view and provides synchronization with program Top-Down call tree.'},{caption:'No Callstacks',value:'1'},],defRooflineTypes:['1',]},{caption:'Memory',isCertainValue: 1,options:[{caption:'L1',value:'l1'},{caption:'L2',value:'l2'},{caption:'DRAM',value:'dram'}],defRooflineTypes:['l1',]}]}}";

require(['./imp/i18n'], function(I18n) {

  I18n.addMessage('roofline_compare_results_label', 'Compared results');
  I18n.addMessage('roofline_compare_recent_label', 'Ready for comparison');
  I18n.addMessage('roofline_compare_nodata_label', 'No Results to Compare');
  I18n.addMessage('roofline_compare_data_label', '{1} Compared Results');
  I18n.addMessage('roofline_compare_noitems_label', 'No Items');
  I18n.addMessage('roofline_compare_tooltip_result_label', 'Result:');
  I18n.addMessage('roofline_compare_current_result_label', 'Current');

  I18n.addMessage('roofline_filter_in_label', 'Filter In Selection');
  I18n.addMessage('roofline_filter_out_label', 'Filter Out Selection');
  I18n.addMessage('roofline_filter_clear_label', 'Clear Filters');

  I18n.addMessage('roofline_toolbar_select_zoom', 'Zoom By Mouse Rect');
  I18n.addMessage('roofline_toolbar_select_move', 'Move View By Mouse');
  I18n.addMessage('roofline_toolbar_undo', 'Undo');
  I18n.addMessage('roofline_toolbar_redo', 'Redo');
  I18n.addMessage('roofline_toolbar_cancel_zoom', 'Cancel Zoom');
  I18n.addMessage('roofline_toolbar_copy_clipboard', 'Copy To Clipboard');
  I18n.addMessage('roofline_toolbar_save_file', 'Save To File');
  I18n.addMessage('roofline_toolbar_html_export', 'Export as HTML');
  I18n.addMessage('roofline_toolbar_svg_export', 'Export as SVG');
  I18n.addMessage('roofline_toolbar_svg_width', 'Width:');
  I18n.addMessage('roofline_toolbar_svg_height', 'Height:');
  I18n.addMessage('roofline_toolbar_save_compare', 'Save For Comparison');
  I18n.addMessage('roofline_toolbar_clear_compare', 'Claer comparison result(s)');
  I18n.addMessage('roofline_toolbar_load_compare', 'Load result for comparison');

  I18n.addMessage('roofline_N_threaded_roofs', 'Cores');
  I18n.addMessage('roofline_N_threaded_roofs_expl', 'Calculated as average value per core.');
  I18n.addMessage('roofline_with_callstacks', 'Roofline with Callstacks');
  I18n.addMessage('roofline_with_callstacks_expl', 'Roofline with Callstacks provides aggregated data for outermost loops and functions. It also separates the data for the cases when the same loop is invoked from different caller functions. This mode enables Roofline Callstack view and provides synchronization with program Top-Down call tree.');

  I18n.addMessage('roofline_settings_roof_name', 'Roof Name');
  I18n.addMessage('roofline_settings_roof_visible', 'Visible');
  I18n.addMessage('roofline_settings_roof_selected', 'Selected');
  I18n.addMessage('roofline_settings_roof_value', 'Value');
  I18n.addMessage('roofline_settings_roof_default', 'Default');
  I18n.addMessage('roofline_settings_roof_load', 'Load...');
  I18n.addMessage('roofline_settings_roof_save', 'Save...');

  //I18n.addMessage('roofline_settings_loop_caption', 'Loop Weight Representation');
  I18n.addMessage('roofline_settings_loop_cancel', 'Cancel');
  I18n.addMessage('roofline_settings_loop_default', 'Default');
  I18n.addMessage('roofline_settings_loop_size', 'Size');
  I18n.addMessage('roofline_settings_loop_color', 'Color');
  I18n.addMessage('roofline_settings_loop_visible', 'Visible');
  I18n.addMessage('roofline_settings_loop_color_fixed', 'Fixed');
  //I18n.addMessage('roofline_settings_loop_color_time', 'Time');
  I18n.addMessage('roofline_settings_loop_color_vectorization', 'Vectorization');
  I18n.addMessage('roofline_settings_loop_color_default', 'Default loop color');
  I18n.addMessage('roofline_settings_loop_color_nst', 'No self time loop color');

  I18n.addMessage('roofline_physical_cores_count', 'Physical Cores:');
  I18n.addMessage('roofline_cores_expl', 'Number of Physical CPU cores');
  I18n.addMessage('roofline_used_threads_count', 'App Threads:');
  I18n.addMessage('roofline_threads_expl', 'Number of CPU threads used in Application');

  I18n.addMessage('roofline_zoom_synchronize', 'Synchronize zoom with Roofline chart without stacks');

  I18n.addMessage('roofline_menu_collapse_root', 'Collapse Root');
  I18n.addMessage('roofline_menu_expand_all', 'Expand All');
  I18n.addMessage('roofline_menu_show_callstack', 'Show Call Stack');
  I18n.addMessage('roofline_menu_hide_callstack', 'Hide Call Stack');

  I18n.addMessage('roofline_loading', 'Please, Wait for Data Loading...');

  I18n.addMessage('roofline_show_callstack_tooltip', 'Click to show callstack');

  I18n.addMessage('roofline_settings_roofs_caption', 'Roofs Settings');

  I18n.addMessage('roofine_settings_use_single_thread_strategy', 'Show roofs calculated using single-threaded benchmarks');

  I18n.addMessage('roofline_configuration_apply', 'Apply');
  I18n.addMessage('roofline_configuration_cancel', 'Cancel');

  I18n.addMessage('roofline_zone_theoretically', 'Theoretically');
  I18n.addMessage('roofline_zone_memory_bound', 'Memory-Bound');
  I18n.addMessage('roofline_zone_mixed_bound', 'Mixed-Bound');
  I18n.addMessage('roofline_zone_compute_bound', 'Compute-Bound');
  I18n.addMessage('roofline_settings_use_single_thread_strategy', 'Use single-threaded benchmark results to build roofs');
  I18n.addMessage('roofline_settings_guidance_caption', 'Optimization Guidance');
  I18n.addMessage('roofline_settings_caption', 'Roofline Representation');
  I18n.addMessage('roofline_settings_zone_coloring', 'Use Roofline zones coloring');
  I18n.addMessage('roofline_settings_representation_caption', 'Roofline Representation');
  I18n.addMessage('roofline_settings_fit_to_view', 'Fit to optimal view for each Roofline type');
  I18n.addMessage('roofline_settings_one_view', 'Use one comprehensive view for all Roofline types');

  I18n.processElement(['data-tooltip', 'data-caption']);

  window.idvcGlobalRequest.receiveData("i18n", "[{id: 'roofline_callstack_caption', message: 'Callstack:'}, {id: 'roofline_toolbar_select_point', message: 'Selects Loops By Mouse Rect'}, {id: 'roofline_settings_loop_caption', message: 'Loop Weight Representation'}, {id: 'roofline_settings_loop_color_time', message: 'Time'}]");
});

window.idvcGlobalRequest.receiveData('clearRoofline');

setTimeout(function() {
  window.idvcGlobalRequest.receiveData('threadsInfo', '{physicalCoreCount: 8, usedNumberOfThreads: 4, coreCount4Roofs: 4}');

  window.idvcGlobalRequest.receiveData('rooflineData', testRooflineData);
}, 1000);
