var _ = require('underscore');
var request = require('request');
var xml2js = require('xml2js');
var Utils = require('../lib/Utils.js');
var Logger = require('./Logger.js');

var schedule = { outbound: {}, inbound: {} };

var getServiceClass = function() {
  if (new Date().getDay() === 0) {
    return 'Sunday';
  } else if (new Date().getDay() === 6) {
    return 'Saturday';
  } else if (new Date().getDay() === 5) {
    return 'Friday';
  } else {
    //return 'WkdyNoSchool';
    return 'MoTuWeTh';
  }
};

module.exports = {
  initialize: function(routeId, stopTags, callback) {
    Logger.log('initialize schedule...');
    request({url:'http://webservices.nextbus.com/service/publicXMLFeed?command=schedule&a=mbta&r=' + routeId}, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        stopTags.forEach(function(stop) {
          xml2js.parseString(body, function(err, result) {
            var blocks = _.find(result.body.route, function(val) { return val.$.direction === stop.direction && val.$.serviceClass === getServiceClass(); }).tr;
            var tempArr = _.map(blocks, function(val) { return [val.$.blockID, parseInt(_.find(val.stop, function(s) { return s.$.tag === stop.tag; }).$.epochTime)]; });
          
            tempArr.forEach(function(e) {
              if (schedule[stop.direction.toLowerCase()][e[0]]) {
                schedule[stop.direction.toLowerCase()][e[0]].push(e[1]);
              } else {
                schedule[stop.direction.toLowerCase()][e[0]] = [e[1]];
              }
            });
          });
          Logger.log('finished initializing in ' + stop.direction + ' direction');
        });
        callback();
      }
    });
  },
  
  getNextSchedDep: function(blockId, direction) {
    var times = _.map(schedule[direction][blockId], function(s) { return s + Utils.getMidnight(); });
    var newTimes = _.map(times, function(t) {
      if (t > new Date().getTime() - 30 * 60 * 1000) {
        return t;
      } else {
        return Number.MAX_VALUE;
      }
    });
    
    return _.min(newTimes);
  },
  
  getMostRecentSchedDep: function(blockId, direction) {
    var times = _.map(schedule[direction][blockId], function(s) { return s + Utils.getMidnight(); });
    var newTimes = _.map(times, function(t) {
      if (t < new Date().getTime()) {
        return t;
      } else {
        return 0;
      }
    });
    return _.max(newTimes) === 0 ? _.max(times) : _.max(newTimes);
  }
};