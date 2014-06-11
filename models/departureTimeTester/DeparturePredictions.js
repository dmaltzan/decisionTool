var request = require('request');
var xml2js = require('xml2js');
var _ = require('underscore');
var async = require('async');

var config = require('../../departureConfig');
var predictions = {};
var stopTags = _.union(_.values(config.stops.outbound), _.values(config.stops.inbound));

var download = function(stopTag, callback) {
  request({url:'http://webservices.nextbus.com/service/publicXMLFeed?command=predictions&a=mbta&s=' + stopTag + '&r=' + config.routeId}, function(error, response, body) {
    if (!error && response.statusCode == 200) {
      xml2js.parseString(body, function(err, result) {
        var error = null;
        if (result.body.predictions[0].direction) {
          predictions[stopTag] = _.sortBy(result.body.predictions[0].direction[0].prediction, function(p) { return p.epochTime; });
        } else if (result.body.predictions[0].message) {
          error = result.body.predictions[0].message[0].$.text;
        } else {
          error = 'unknown error';
        }
        callback(error);
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