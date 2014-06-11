var config = require('../config');
var pg = require('pg');
var _ = require('underscore');

var Logger = require('./Logger.js');

var getSnapshotString = function(v) {
  return [v.eventId, v.currentTime, v.suggDeparture, v.predDeparture, v.arrivalTime, v.status].join(',') + '\n';
};

var getStream = function(tableName, columnList) {
  var client2 = new pg.Client(config.connStr);
  client2.connect();
  var stream = client2.copyFrom('COPY ' + tableName + ' (' + columnList + ') FROM STDIN WITH CSV');
  stream.on('close', function () {
    client2.end();
  });
  stream.on('error', function (error) {
    Logger.log('error while inserting into decision_tool_snapshots: ' + error);
    stream.end();
    client2.end();
  });
  return stream;
};

// function: if event_id not found in decision_tool_events table, insert new row in

// function: update row in decision_tool_events where event_id = event_id, set stuff

var getYYYYMMDD = function(date) {
  var yyyy = date.getFullYear().toString();
  var mm = (date.getMonth()+1).toString(); // getMonth() is zero-based
  var dd  = date.getDate().toString();
  return yyyy + (mm[1]?mm:"0"+mm[0]) + (dd[1]?dd:"0"+dd[0]); // padding
};

module.exports = {
  writeSnapshotToDb: function(vehicles) {
    var stream = getStream('decision_tool_snapshots', 'event_id, "current_time", sugg_dep, pred_dep, arrival, status');
    _.each(vehicles, function(vehDir, dir) {
      _.each(vehDir, function(v) {
        if (!_.isEmpty(v)) {
          v.direction = dir;
          v.currentTime = new Date().getTime();
          v.eventId = getYYYYMMDD(new Date()) + '-' + v.apprTripId + '-' + v.direction;
          stream.write(getSnapshotString(v));
        }
      });
    });
    stream.end();
  }
};