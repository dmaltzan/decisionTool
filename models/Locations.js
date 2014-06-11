var request = require('request');
var xml2js = require('xml2js');
var _ = require('underscore');
var async = require('async');

var config = require('../config.js');
var Utils = require('../lib/Utils.js');
var Logger = require('./Logger.js');
var lastTime;
var locations = {};

var download = function(callback) {
  var locationsUrl = 'http://webservices.nextbus.com/service/publicXMLFeed?command=vehicleLocations&a=mbta&r=' + config.routeId + '&t=' + lastTime;
  request({url: locationsUrl}, function(requestError, response, body) {
    if (!requestError && response.statusCode == 200) {
      xml2js.parseString(body, function(xmlParseError, result) {
        if (xmlParseError) {
          Logger.log('XML Parse Error in Locations download: ' + xmlParseError);
          locations = 'error';
        }
        
        var nextbusError = null;
        if (result.body.Error && result.body.Error[0]._) {
          nextbusError = result.body.Error[0]._;
        } else if (result.body) {
          locations = _.map(result.body.vehicle, function(v) { return { id: v.$.id, lat: v.$.lat, lon: v.$.lon }; });
          //lastTime = result.body.lastTime[0].$.time;
          lastTime = 0;
        } else {
          nextbusError = 'unknown error';
        }
        if (nextbusError) {
          Logger.log('locations download error: ' + nextbusError);
          locations = 'error: ' + nextbusError;
        }
        callback();
      });
    }
  });
};

module.exports = {
  initialize: function() {
    lastTime = 0;
  },
  
  get: function(vehicleId) {
    return _.findWhere(locations, { id: vehicleId });
  },
  
  getDistFromTerminal: function(vehicleId, direction) {
    var vehicle = _.findWhere(locations, { id: vehicleId });
    if (vehicle) {
      return Utils.getDistanceMeters(config.stopLocations[direction].lat, config.stopLocations[direction].lon, vehicle.lat, vehicle.lon);
    } else {
      Logger.log('Location for vehicle ' + vehicleId + ' not found');
      return null;
    }
  },
  
  downloadLocations: function(callback) {
    download(callback);
  }
};