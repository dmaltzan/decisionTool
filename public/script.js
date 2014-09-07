var nextSuggDeparture = 0;

var setIntervalAndExecute = function(fn, t) {
  fn();
  return(setInterval(fn, t));
}

var formatTime = function(time, isTimespan) {
  if (time == 0 && !isTimespan) { return ''; }
  time = new Date(time);
  if (!isTimespan) {
    return time.toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'});
  } else {  // isTimespan == true
    var hours = time.getUTCHours();
    var minutes = time.getUTCMinutes();
    var seconds = time.getUTCSeconds() + (time.getUTCMilliseconds() >= 500 ? 1 : 0);

    if (hours < 10) { hours = "0" + hours; }
    if (minutes < 10) { minutes = "0" + minutes; }
    if (seconds < 10) { seconds = "0" + seconds; }
  
    if (hours === '00') {
      return minutes + ':' + seconds;
    } else {
      return hours + ':' + minutes + ':' + seconds;
    }
  }
};

var updateTimeUntilDep = function(now) {
  var currentTime = now.getTime();
  if (nextSuggDeparture == 0) {
    $('#timeUntilDep').text('');
  } else if (nextSuggDeparture - currentTime > 0) {
    $('#timeUntilDep').text(formatTime(new Date(nextSuggDeparture - currentTime), true));
  } else {
    $('#timeUntilDep').css('visibility', 'hidden');
    setTimeout(function() { $('#timeUntilDep').css('visibility', 'visible'); }, 500);
    $('#timeUntilDep').text('00:00', true);
  }
}

var displayNextDepInfo = function(vehicle) {
  $('#busTable tr:first-child .busId').text(vehicle.id);
  $('#busTable tr:first-child .busApproaching').text(vehicle.status === 'Approaching' ? ('APPROACHING (Arrive @' + formatTime(vehicle.arrivalTime) + ')') : 'AT TERMINAL');
  nextSuggDeparture = Math.round(+vehicle.suggDeparture / 1000) * 1000;
  var now = new Date();
  updateTimeUntilDep(now);
  if (+vehicle.suggDeparture >= +vehicle.arrivalTime && +vehicle.suggDeparture <= +vehicle.arrivalTime + 60000) {
    $('#timeUntilDep, #departureTime').removeClass('greenTime').addClass('orangeTime');
    $('#departureTime').text('ASAP (on arrival)');
    $('#countdownSection').hide();
  } else if (+vehicle.suggDeparture >= +vehicle.schedDeparture && +vehicle.suggDeparture <= +vehicle.schedDeparture + 60000){
    $('#countdownSection').show();
    $('#timeUntilDep, #departureTime').removeClass('orangeTime').addClass('greenTime');
    $('#departureTime').text(formatTime(nextSuggDeparture) + ' (as normal)');
  } else {
    $('#countdownSection').show();
    $('#timeUntilDep, #departureTime').removeClass('greenTime').addClass('orangeTime');
    $('#departureTime').text(formatTime(nextSuggDeparture));
  }
  
  $('#schedDep').text(formatTime(vehicle.schedDeparture));
};

var displayApprVeh = function(apprVehicles) {
  displayNextDepInfo(apprVehicles[0]);
  $('#busTable').find('tr:gt(1)').remove();
  for (var i = 1; i < apprVehicles.length; i++) {
    if (apprVehicles[i].status === 'Approaching') {
      $('#busTable > tbody:last').append('<tr><td class="busId">' + apprVehicles[i].id + '</td><td class="busStatus">Arrive @' + formatTime(apprVehicles[i].arrivalTime) + '</td><td class="busStatus">Sched. Depart @' + formatTime(apprVehicles[i].schedDeparture) + '</td></tr>');
    } else if (apprVehicles[i].status === 'Approaching/Last Trip') {
      $('#busTable > tbody:last').append('<tr><td class="busId">' + apprVehicles[i].id + '</td><td class="busStatus">Arrive @' + formatTime(apprVehicles[i].arrivalTime) + '</td><td class="busStatus">Last Trip</td></tr>');
    } else if (apprVehicles[i].status === 'Terminal') {
      $('#busTable > tbody:last').append('<tr><td class="busId">' + apprVehicles[i].id + '</td><td class="busStatus">At Terminal</td><td class="busStatus">Sched. Depart @' + formatTime(apprVehicles[i].schedDeparture) + '</td></tr>');
    }
  }
};

var displayPastVeh = function(depVehicles) {
  $('#pastBusesTable').find('tr:gt(1)').remove();
  for (var i = 0; i < depVehicles.length; i++) {
    $('#pastBusesTable > tbody:last').append('<tr><td>' + depVehicles[i].id + '</td><td>' + formatTime(depVehicles[i].suggDeparture) + '</td><td>' + formatTime(depVehicles[i].schedDeparture) + '</td><td>' + formatTime(depVehicles[i].departureTime) + '</td></tr>');
  }
}

var getJsonAndDisplay = function() {
  var selectedDir = $('#directionSelector').val();
  if (selectedDir === 'none') {
    $('#mainSection').hide();
    return;
  }
  $.getJSON('/' + selectedDir).done(function(vehicles) {
    console.log('got JSON: ' + JSON.stringify(vehicles));
    if (vehicles.error) {
      $('#mainSection').hide();
      $('#errorMessage').text(vehicles.error);
      $('#errorMessage').show();
    } else {
      $('#mainSection').show();
      $('#errorMessage').text('');
      $('#errorMessage').hide();
      
      // display approaching vehicles
      var apprVehicles = _.sortBy(_.filter(vehicles, function(v) { return v.status === 'Approaching' || v.status === 'Terminal'; }), 'schedDeparture');
      displayApprVeh(apprVehicles);
      
      // display departed vehicles
      var depVehicles = _.sortBy(_.where(vehicles, {status: 'Departed'}), function(v) { return -1 * +v.departureTime; });
      displayPastVeh(depVehicles);
    }
  });
}

$('#directionSelector').change(getJsonAndDisplay);

$.fn.bgColorFade = function() {
    $(this).css({
        backgroundColor: '#fff79f'
    }).animate({
        backgroundColor: '#fff'
    }, 2000);
    return this;
};

var timerId = setIntervalAndExecute(function() {
  getJsonAndDisplay();
}, 15000);

var clockTimerId = setIntervalAndExecute(function() {
  var now = new Date();
  $('#clock').text('Current Time: ' + now.toLocaleTimeString());
  updateTimeUntilDep(now);
}, 1000);