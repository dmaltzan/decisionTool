var express = require('express');
var _ = require('underscore');
var async = require('async');
var Vehicle = require('./models/Vehicle.js');
var Schedule = require('./models/Schedule.js');
var Predictions = require('./models/Predictions.js');
var Locations = require('./models/Locations.js');
var DatabaseLayer = require('./models/DatabaseLayer.js');
var Utils = require('./lib/Utils.js');
var config = require('./config');
var Stops = config.stops;
var Logger = require('./models/Logger.js');
var routeId = config.routeId;

Predictions.initialize();
Locations.initialize();
var vehicles = {inbound: {}, outbound: {}};
var layoverTime = 2 * 60 * 1000; // 2 minutes

var getDepartureTime = function(vehicleId, direction) {
  var stopIds = [Stops[direction].quarterpoint, Stops[direction].midpoint, Stops[direction].oppTerminal];
  var tripTimes = [config.tripTimes[direction].quarterpoint, config.tripTimes[direction].midpoint, config.tripTimes[direction].oppTerminal];
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
      if (vehicles[direction][vehFromNextPoint[i].$.vehicle]) {
        tempVehicle = vehicles[direction][vehFromNextPoint[i].$.vehicle];
        if (vehicles[direction][vehFromNextPoint[i].$.vehicle].status !== 'Departed') {
          tempVehicle.status = 'Departed';
          tempVehicle.departureTime = getDepartureTime(tempVehicle.id, direction);
        }
      } else {
        tempVehicle = new Vehicle();
        tempVehicle.id = vehFromNextPoint[i].$.vehicle;
        tempVehicle.depTripId = vehFromNextPoint[i].$.tripTag;
        tempVehicle.status = 'Departed';
        tempVehicle.departureTime = getDepartureTime(tempVehicle.id, direction);
        tempVehicle.schedDeparture = Schedule.getMostRecentSchedDep(vehFromNextPoint[i].$.block, direction);
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
  
  return Math.round(Math.max(suggDep, v.schedDeparture));
};

var handleNewPredictions = function(err) {
  if (err) {
    vehicles = { inbound: { error: err }, outbound: { error: err }};
    return err;
  }
  var directions = ['inbound', 'outbound'];
  //Logger.log('handling new predictions');
  directions.forEach(function(direction) {
    var vehDepThisStop = Predictions.get(Stops[direction].thisStopDep);
    
    //var stopIds = [Stops.midpoint, Stops.oppTerminal]
    var DVfromMidpoint = getDepartedVehicles(Stops[direction].midpoint, direction);
    var DVfromOppTerm = getDepartedVehicles(Stops[direction].oppTerminal, direction);
    var departedVehicles = _.extend(DVfromOppTerm, DVfromMidpoint);
    
    // delete old departedVehicles that have disappeared from the predictions
    var oldDepVeh = _.pluck(_.where(vehicles[direction], {status: 'Departed'}), 'id');
    var newDepVeh = _.keys(departedVehicles);
    oldDepVeh.forEach(function(id) {
      if (!_.contains(newDepVeh, id)) {
        delete vehicles[direction][id];
      }
    });
    
    var notYetDeparted = {};
    
    // if any are not yet > 75 m away, move them to notYetDeparted
    newDepVeh.forEach(function(id) {
      var dist = Locations.getDistFromTerminal(id, direction);
      var terminal; if (direction === 'outbound') terminal = 'Dudley'; else terminal = 'Harvard';
//       if (dist < 500) {
//         Logger.log('vehicle ' + id + ' is ' + dist + ' meters from ' + terminal);
//       }
      if (dist < 75) {
        notYetDeparted[id] = departedVehicles[id];
        notYetDeparted[id].status = 'Terminal';
        delete departedVehicles[id];
      }
    });
    
    if (_.isEmpty(departedVehicles)) {
      var errorText = 'No departed vehicles found';
      vehicles[direction] = { error: errorText };
      return;
    }
    
    var onLastTrip = {};
    // for the next two departing vehicles
    var i = 0;
    while (_.size(notYetDeparted) < 3) {
      if (vehDepThisStop.length <= i) {
        break; 
      }
      
      var tempVehicle = new Vehicle();
      tempVehicle.id = vehDepThisStop[i].$.vehicle;
      tempVehicle.depTripId = vehDepThisStop[i].$.tripTag;
    
      var arrPred = Predictions.getByStopAndVehicle(Stops[direction].thisStop, tempVehicle.id);
      // if there is an arrival time pred for this stop use it
      if (arrPred) {// && tempVehicle.predDeparture > tempVehicle.arrivalTime) { // bug fix: vehicle may have an arrival time pred for the NEXT TRIP
        tempVehicle.arrivalTime = Math.round(arrPred.$.epochTime);
        tempVehicle.status = 'Approaching';
        if (vehicles[tempVehicle.id] && vehicles[tempVehicle.id].schedDeparture) {
          tempVehicle.schedDeparture = vehicles[tempVehicle.id].schedDeparture;
        } else {
          tempVehicle.schedDeparture = Schedule.getNextSchedDep(vehDepThisStop[i].$.block, direction);
        }
        tempVehicle.predDeparture = +vehDepThisStop[i].$.epochTime;
        tempVehicle.apprTripId = arrPred.$.tripTag;
      } else if (vehicles[direction][tempVehicle.id]) { // else if there was already a value use that
        tempVehicle = vehicles[direction][tempVehicle.id];
        tempVehicle.status = 'Terminal';
        tempVehicle.predDeparture = +vehDepThisStop[i].$.epochTime;
      } else { // else assume arrived just now
        tempVehicle.arrivalTime = Math.round(new Date().getTime());
        tempVehicle.status = 'Terminal';
        tempVehicle.schedDeparture = Schedule.getNextSchedDep(vehDepThisStop[i].$.block, direction);
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
    
    if (notYetDeparted.length == 0) {
      var errorText = 'No vehicles found at terminal or approaching';
      vehicles = { inbound: { error: errorText }, outbound: { error: errorText }};
      return;
    }
    
    // Maybe you don't need to sort here...
    var sortedVeh = _.pluck(_.sortBy(notYetDeparted, 'schedDeparture'), 'id');
    var mostRecDep = _.max(departedVehicles, function(v) { return v.departureTime; });
    notYetDeparted[sortedVeh[0]].suggDeparture = getSuggDeparture(notYetDeparted[sortedVeh[0]], mostRecDep, notYetDeparted[sortedVeh[1]]);
    
    if (notYetDeparted[sortedVeh[0]].suggDeparture < notYetDeparted[sortedVeh[0]].arrivalTime) {
      notYetDeparted[sortedVeh[0]].suggDeparture = notYetDeparted[sortedVeh[0]].arrivalTime;
    }
    
    vehicles[direction] = _.extend(departedVehicles, notYetDeparted, onLastTrip);
  });
  
  DatabaseLayer.writeSnapshotToDb(vehicles);
};

// If it's between midnight and 6:00 AM don't do anything
var isDayTime = function() {
  return ((new Date()).getHours() >= 6);
};

var setIntervalAndExecute = function(fn, t) {
  fn();
  return(setInterval(fn, t));
};

Schedule.initialize(routeId, [ {direction: 'Outbound', tag: Stops['outbound'].thisStopDep }, { direction: 'Inbound', tag: Stops['inbound'].thisStopDep } ], function() {
  timerID = setIntervalAndExecute(function () {
      if (isDayTime()) {
        async.parallel([Locations.downloadLocations, Predictions.downloadPredictions], handleNewPredictions)
      } else {
        var errorText = 'App is not available between midnight and 06:00 AM';
        vehicles = { inbound: { error: errorText }, outbound: { error: errorText }};
      }
    }, config.pollingInterval * 1000
  );
});

var app = express();
app.listen(config.port);
app.use(express.static('public'));
app.get('/inbound', function(req, res) {
  res.json(vehicles['inbound']);
  //res.json(JSON.parse('{"2124":{"id":"2124","status":"Departed","arrivalTime":1398890795936,"departureTime":1398891716830,"suggDeparture":1398891780000,"schedDeparture":1398891780000,"predDeparture":1398891780000,"direction":"inbound","currentTime":1398892056054},"2128":{"id":"2128","status":"Terminal","arrivalTime":1398891110868,"departureTime":0,"suggDeparture":1398891110868,"schedDeparture":1398892260000,"predDeparture":1398892340190,"direction":"inbound","currentTime":1398892056055},"2172":{"id":"2172","status":"Terminal","arrivalTime":1398891200901,"departureTime":0,"suggDeparture":0,"schedDeparture":1398892740000,"predDeparture":1398892740000,"direction":"inbound","currentTime":1398892056055},"2175":{"id":"2175","status":"Departed","arrivalTime":1398888500547,"departureTime":1398889743139,"suggDeparture":1398889968377,"schedDeparture":1398889860000,"predDeparture":1398889860000,"direction":"inbound","currentTime":1398892056055},"2206":{"id":"2206","status":"Departed","arrivalTime":1398888938508,"departureTime":1398890997189,"suggDeparture":1398890984772,"schedDeparture":1398890340000,"predDeparture":1398890961405,"direction":"inbound","currentTime":1398892056055},"2225":{"id":"2225","status":"Departed","arrivalTime":1398887900360,"departureTime":1398889596753,"suggDeparture":1398889380000,"schedDeparture":1398889380000,"predDeparture":1398889576504,"direction":"inbound","currentTime":1398892056055},"2241":{"id":"2241","status":"Departed","arrivalTime":1398889865739,"departureTime":1398891094097,"suggDeparture":1398891388595,"schedDeparture":1398891300000,"predDeparture":1398891300000,"direction":"inbound","currentTime":1398892056055},"2247":{"id":"2247","status":"Departed","arrivalTime":1398889670642,"departureTime":1398890669543,"suggDeparture":0,"schedDeparture":1398890820000,"predDeparture":1398890820000,"direction":"inbound","currentTime":1398892056055},"2293":{"id":"2293","status":"Terminal","arrivalTime":1398891831897,"departureTime":0,"suggDeparture":0,"schedDeparture":1398893220000,"predDeparture":1398893220000,"direction":"inbound","currentTime":1398892056055}}'));
});
app.get('/outbound', function(req, res) {
  res.json(vehicles['outbound']);
});