var express = require('express');
var _ = require('underscore');
var config = require('./departureConfig.js');
var Stops = config.stops;

var Predictions = require('./models/departureTimeTester/DeparturePredictions.js');
var DepartureDatabaseLayer = require('./models/departureTimeTester/DepartureDatabaseLayer.js');

var departures = [];
var list = { inbound: { terminal: [], secondStop: [], thirdStop: [] }, outbound: { terminal: [], secondStop: [], thirdStop: [] } };
var prevList = {};

var markAsDeparted = function(id, stopType, dir) {
  console.log(dir + ': Marking as departed: bus ' + id + ', ' + stopType + ' at ' + new Date().toLocaleString());
  departures.unshift({ direction: dir, id: id, stopType: stopType, time: new Date().getTime() });
  DepartureDatabaseLayer.writePredToDb({ direction: dir, id: id, stopType: stopType, time: new Date().getTime() });
};

var handleNewPredictions = function() {
  var directions = ['inbound', 'outbound'];
  var pred = { inbound: [], outbound: [] };
  list = { inbound: { terminal: [], secondStop: [], thirdStop: [] }, outbound: { terminal: [], secondStop: [], thirdStop: [] } };  
  directions.forEach(function(direction) {
    list[direction].terminal = _.map(Predictions.get(Stops[direction].thisStopDep), function(p) { return p.$.vehicle; });
    list[direction].secondStop = _.map(Predictions.get(Stops[direction].secondStop), function(p) { return p.$.vehicle; });
    list[direction].thirdStop = _.map(Predictions.get(Stops[direction].thirdStop), function(p) { return p.$.vehicle; });
  });
  
  var changed = false;
  if (!_.isEmpty(prevList)) {
    //console.log('prevList.outbound.terminal = ' + JSON.stringify(prevList.outbound.terminal, null, 4));
    //console.log('list.outbound.terminal = ' + JSON.stringify(list.outbound.terminal, null, 4));
    _.each(prevList, function(d, dir) {
      _.each(d, function(s, stopType) {
        s.forEach(function(id) {
          if (dir === 'outbound' && stopType === 'terminal') {
            //console.log('_.contains(list[' + dir + '][' + stopType + '], ' + id + ') = ' + _.contains(list[dir][stopType], id));
          }
          if (!_.contains(list[dir][stopType], id)) {
            markAsDeparted(id, stopType, dir);
            changed = true;
          }
        });
      });
    });
  }
  if (!changed) {
    //console.log('no change at ' + new Date().toLocaleString());
  }
  prevList = JSON.parse(JSON.stringify(list));
  //console.log(JSON.stringify(list, null, 4));
};

var setIntervalAndExecute = function(fn, t) {
  fn();
  return(setInterval(fn, t));
};

timerID = setIntervalAndExecute(function () {
    Predictions.downloadPredictions(handleNewPredictions);
  }, config.pollingInterval * 1000
);

var app = express();
app.listen(config.port);
app.use(express.static('./public/departureTimeTester'));
app.get('/stuff', function(req, res) {
  res.json(departures);
});