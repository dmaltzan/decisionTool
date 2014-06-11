var request = require('request');
var xml2js = require('xml2js');
var _ = require('underscore');
var async = require('async');

var Logger = require('./Logger.js');
var config = require('../config');
var predictions = {};
var stopTags = _.union(_.values(config.stops.outbound), _.values(config.stops.inbound));

var download = function(stopTag, callback) {
  var predictionsUrl = 'http://webservices.nextbus.com/service/publicXMLFeed?command=predictions&a=mbta&s=' + stopTag + '&r=' + config.routeId;
  request({url: predictionsUrl}, function(requestError, response, body) {
    if (!requestError && response.statusCode == 200) {
      xml2js.parseString(body, function(xmlParseError, result) {
        if (xmlParseError) {
          Logger.log('XML Parse Error: ' + xmlParseError);
          callback(xmlParseError);
        }
        
        var nextbusError = null;
        if (result.body.Error && result.body.Error[0]._) {
          nextbusError = result.body.Error[0]._;
        } else if (result.body.predictions && result.body.predictions[0].direction) {
          predictions[stopTag] = _.sortBy(result.body.predictions[0].direction[0].prediction, function(p) { return p.epochTime; });
        } else if (result.body.predictions && result.body.predictions[0].message) {
          Logger.log('Received error message in body of predictions: ' + result.body.predictions[0].message[0].$.text);
          nextbusError = result.body.predictions[0].message[0].$.text;
        } else {
          Logger.log('Unknown error with download of predictions, result = ' + JSON.stringify(result, null, 4));
          nextbusError = 'unknown error';
        }
        callback(nextbusError);
      });
    }
  });
};

module.exports = {
  initialize: function() {
    stopTags.forEach(function(s) {
      predictions[s] = [];
    })
  },
  
  get: function(stopTag) {
    return predictions[stopTag];
  },
  
  getByStopAndVehicle: function(stopTag, vehicleId) {
    return _.find(predictions[stopTag], function(v) { return v.$.vehicle == vehicleId; })
  },
  
  downloadPredictions: function(callback) {
    async.each(stopTags, download, callback);
  }
};