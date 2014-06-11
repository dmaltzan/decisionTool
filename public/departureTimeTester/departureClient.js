function setIntervalAndExecute(fn, t) {
  fn();
  return(setInterval(fn, t));
}

var formatTime = function(time, isTimespan) {
  if (time == 0 && !isTimespan) { return ''; }
  time = new Date(time);
  if (isTimespan) {
    var hours = time.getUTCHours();
    var minutes = time.getUTCMinutes();
    var seconds = time.getUTCSeconds();
  } else {
    var hours = time.getHours();
    var minutes = time.getMinutes();
    var seconds = time.getSeconds();
  }

  if (hours < 10) { hours = "0" + hours; }
  if (minutes < 10) { minutes = "0" + minutes; }
  if (seconds < 10) { seconds = "0" + seconds; }
  
  if (hours === '00') {
    return minutes + ':' + seconds;
  } else {
    return hours + ':' + minutes + ':' + seconds;
  }
};

var getJsonAndDisplay = function() {
  $.getJSON('/stuff').done(function(departures) {
    $('#pastEstimates').find('tr:gt(0)').remove();
    console.log('departures: ' + JSON.stringify(departures, null, 4));
    console.log('departures.length = ' + departures.length);
    for (var i = 0; i < departures.length; i++) {
      $('#pastEstimates > tbody:last').append('<tr><td>' + departures[i].direction + '</td><td>' + departures[i].id + '</td><td>' + departures[i].stopType + '</td><td>' + formatTime(departures[i].time) + '</td></tr>');
    }
  });
}

var timerId = setIntervalAndExecute(function() {
  getJsonAndDisplay();
}, 15000);

var clockTimerId = setIntervalAndExecute(function() {
  $('#clock').text('Current Time: ' + new Date().toLocaleTimeString());
}, 1000);