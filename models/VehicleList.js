var request = require('request');
var xml2js = require('xml2js');
var _ = require('underscore');
var async = require('async');
var Predictions = require('./Predictions.js');
var Vehicle = require('./Vehicle.js');
var Schedule = require('./Schedule.js');

var config = require('../config');
var Stops = config.stops;
var vehicles = {inbound: {}, outbound: {}};
var layoverTime = 2 * 60 * 1000; // 2 minutes

Predictions.initialize();
Schedule.initialize(config.routeId, '64', function() {
  timerID = setIntervalAndExecute(function () {
      if (isDayTime()) {
        Predictions.downloadPredictions(VehicleList.handleNewPredictions);
      }
    }, 15000
  );
});

var getDepartureTime = function(vehicleId, direction) {
  var stopIds = [Stops[direction].quarterpoint, Stops[direction].midpoint, Stops[direction].oppTerminal];
  var tripTimes = [config.tripTimes.quarterpoint, config.tripTimes.midpoint, config.tripTimes.oppTerminal];
  for(var i = 0; i < 3; i++) {
    var pred = Predictions.getByStopAndVehicle(stopIds[i], vehicleId);
    if (pred) {
      var estDep = +pred.$.epochTime - tripTimes[i];
      return Math.min(estDep, Math.round(new Date().getTime()));
      break;
    }
  }
};

var getDepartedVehicles = function(nextPoint, direction) {
  var departedVehicles = {};
  var vehDepThisStop = Predictions.get(Stops[direction].thisStopDep);
  var vehFromNextPoint = Predictions.get(nextPoint);
  for (var i = 0; i < vehFromNextPoint.length; i++) {
    if (vehDepThisStop[0].$.vehicle !== vehFromNextPoint[i].$.vehicle) {
      var tempVehicle;
      if (vehicles[vehFromNextPoint[i].$.vehicle]) {
        tempVehicle = vehicles[vehFromNextPoint[i].$.vehicle];
        if (vehicles[vehFromNextPoint[i].$.vehicle].status !== 'Departed') {
          tempVehicle.status = 'Departed';
          tempVehicle.departureTime = getDepartureTime(tempVehicle.id, direction);
        }
      } else {
        tempVehicle = new Vehicle();
        tempVehicle.id = vehFromNextPoint[i].$.vehicle;
        tempVehicle.status = 'Departed';
        tempVehicle.departureTime = getDepartureTime(tempVehicle.id, direction);
        tempVehicle.schedDeparture = Schedule.getMostRecentSchedDep(vehFromNextPoint[i].$.block);
      }
      departedVehicles[tempVehicle.id] = tempVehicle;
    } else {
      break;
    }
  }
  
  return departedVehicles;
};

var getSuggDeparture = function(v, leading, trailing) {
  var leadingSchedHw = leading.schedDeparture - v.schedDeparture;
  var trailingSchedHw = v.schedDeparture - trailing.schedDeparture;
  var suggDep;

  // Assumed departure time of trailing bus is arrival + layover or schedule, whichever is later
  var trailingDep = Math.max(+trailing.arrivalTime + layoverTime, trailing.schedDeparture);
  suggDep = (leading.departureTime + trailingDep) / 2;
  
  return Math.max(suggDep, v.schedDeparture);
};

module.exports = {
  handleNewPredictions: function(err) {
    var direction = 'outbound';
    if (err) {
      console.log('error: ' + err);
      return;
    }
    console.log('handling new predictions at ' + new Date().toLocaleString());
    var vehDepThisStop = Predictions.get(Stops[direction].thisStopDep);
  
    //var stopIds = [Stops.midpoint, Stops.oppTerminal]
    var DVfromMidpoint = getDepartedVehicles(Stops[direction].midpoint, direction);
    var DVfromOppTerm = getDepartedVehicles(Stops[direction].oppTerminal, direction);
    var departedVehicles = _.extend(DVfromOppTerm, DVfromMidpoint);
  
    // delete old departedVehicles that have disappeared from the predictions
    var oldDepVeh = _.pluck(_.where(vehicles, {status: 'Departed'}), 'id');
    var newDepVeh = _.keys(departedVehicles);
    oldDepVeh.forEach(function(id) {
      if (!_.contains(newDepVeh, id)) {
        delete vehicles[id];
      }
    });
  
    var notYetDeparted = {};
    var onLastTrip = {};
    // for the next two departing vehicles
    var i = 0;
    while (_.size(notYetDeparted) < 3) {
      var tempVehicle = new Vehicle();
    
      if (vehDepThisStop.length >= i) {
        tempVehicle.id = vehDepThisStop[i].$.vehicle;
      } else {
        break;
      }
    
      var arrPred = Predictions.getByStopAndVehicle(Stops[direction].thisStop, tempVehicle.id);
      // if there is an arrival time pred for this stop use it
      if (arrPred) {
        tempVehicle.arrivalTime = Math.round(arrPred.$.epochTime);
        tempVehicle.status = 'Approaching';
        tempVehicle.schedDeparture = Schedule.getNextSchedDep(vehDepThisStop[i].$.block);
        tempVehicle.predDeparture = +vehDepThisStop[i].$.epochTime;
      } else if (vehicles[tempVehicle.id]) { // else if there was already a value use that
        tempVehicle = vehicles[tempVehicle.id];
        tempVehicle.status = 'Terminal';
        tempVehicle.predDeparture = +vehDepThisStop[i].$.epochTime;
      } else { // else assume arrived just now
        tempVehicle.arrivalTime = Math.round(new Date().getTime());
        tempVehicle.status = 'Terminal';
        tempVehicle.schedDeparture = Schedule.getNextSchedDep(vehDepThisStop[i].$.block);
        tempVehicle.predDeparture = +vehDepThisStop[i].$.epochTime;
      }
    
      if (tempVehicle.schedDeparture > tempVehicle.predDeparture) {
        tempVehicle.schedDeparture = tempVehicle.predDeparture;
      }
      if (tempVehicle.schedDeparture === Number.MAX_VALUE) {
        tempVehicle.status = 'Approaching/Last Trip';
        onLastTrip[tempVehicle.id] = tempVehicle;
      } else {
        notYetDeparted[tempVehicle.id] = tempVehicle;
      }
      i++;
    }
    
    // Maybe you don't need to sort here...
    var sortedVeh = _.pluck(_.sortBy(notYetDeparted, 'schedDeparture'), 'id');
    var mostRecDep = _.max(departedVehicles, function(v) { return v.departureTime; });
    notYetDeparted[sortedVeh[0]].suggDeparture = getSuggDeparture(notYetDeparted[sortedVeh[0]], mostRecDep, notYetDeparted[sortedVeh[1]]);
  
    vehicles = _.extend(departedVehicles, notYetDeparted);
  },
  
  getVehicles: function(direction) {
    return vehicles[direction];
  }
};