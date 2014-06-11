var config = require('../../departureConfig');
var pg = require('pg');
var _ = require('underscore');

var getDbString = function(p) {
  return [p.direction, p.id, p.stopType, p.time].join(',') + '\n';
};

var getStream = function() {
  var client2 = new pg.Client(config.connStr);
  client2.connect();
  var stream = client2.copyFrom('COPY preds_by_stop (direction, id, stop_type, departure_time) \
    FROM STDIN WITH CSV');
  stream.on('close', function () {
    client2.end();
  });
  stream.on('error', function (error) {
    console.log("error while inserting data into table", error);
    stream.end();
  });
  return stream;
};

module.exports = {
  writePredToDb: function(pred) {
    var stream = getStream();
    stream.write(getDbString(pred));
    stream.end();
  }
};