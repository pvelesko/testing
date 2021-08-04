/**
 * @license Copyright 2013 - 2013 Intel Corporation All Rights Reserved.
 *
 * The source code, information and material ("Material") contained herein is owned by Intel Corporation or its
 * suppliers or licensors, and title to such Material remains with Intel Corporation or its suppliers or
 * licensors. The Material contains proprietary information of Intel or its suppliers and licensors. The
 * Material is protected by worldwide copyright laws and treaty provisions. No part of the Material may be used,
 * copied, reproduced, modified, published, uploaded, posted, transmitted, distributed or disclosed in any way
 * without Intel's prior express written permission. No license under any patent, copyright or other intellectual
 * property rights in the Material is granted to or conferred upon you, either expressly, by implication,
 * inducement, estoppel or otherwise. Any license under such intellectual property rights must be express and
 * approved by Intel in writing.
 *
 * Unless otherwise agreed by Intel in writing, you may not remove or alter this notice or any other notice
 * embedded in Materials by Intel or Intel's suppliers or licensors in any way.
 */

define([], function() {

  function Signal() {
    this._subscribers = [];
  }

  Signal.prototype.find = function (obj, funct) {
    for (var i = 0, len = this._subscribers.length; i < len; i++) {
      if ((obj === this._subscribers[i].obj) &&
          ((funct === this._subscribers[i].funct) ||
           (funct === undefined && this._subscribers[i].funct === undefined))) {
        return i;
      }
    }

    return -1;
  };

  Signal.prototype.subscribe = function (obj, funct) {
    var index = this.find(obj, funct);
    if (index < 0) {
      this._subscribers.push({'obj': obj, 'funct': funct});
    }
  };

  Signal.prototype.unsubscribe = function (obj, funct) {
    var index = this.find(obj, funct);
    if (index >= 0) {
      this._subscribers.splice(index, 1);
    }
  };

  Signal.prototype.unsubscribeAll = function (obj) {
    for (var i = this._subscribers.length - 1; i >= 0; i--) {
      if (obj === this._subscribers[i].obj) {
        this._subscribers.splice(i, 1);
      }
    }
  };

  Signal.prototype.raise = function() {
    for (var i = 0; i < this._subscribers.length; i++) {
      var obj = this._subscribers[i].obj || window;
      if (this._subscribers[i].funct) {
        this._subscribers[i].funct.apply(obj, arguments);
      } else if (obj.raise) {
        obj.raise.apply(obj, arguments);
      }
    }
  };

  Signal.prototype.clear = function() {
    this._subscribers.length = 0;
  };

  return {
    create: function() {
      return new Signal();
    }
  };
});