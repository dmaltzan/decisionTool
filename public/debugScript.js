var addBuses = function(canvas, buses, status) {
  var ctx = canvas.getContext('2d');
  var x, y, upOrDown;
  if (status === 'Departed') {
    x = 97; y = 150; upOrDown = -1;
  } else if (status === 'Terminal') {
    x = 75; y = 235; upOrDown = 1;
  } else if (status === 'Approaching') {
    x = 53; y = 150; upOrDown = 1;
  }
  var ctx = canvas.getContext('2d');
  for (var i = 0; i < buses.length; i++) {
    ctx.fillText(buses[i], x, y + 10 * upOrDown * i);
  }
};

function drawBusDiagram(canvas, apprVehicles, depVehicles, vehAtTerminal) {
  var ctx = canvas.getContext('2d');
  
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  
  ctx.beginPath();
  ctx.arc(70, 75, 3, -.5 * Math.PI, 1.5 * Math.PI, true);
  ctx.lineTo(70, 152);
  ctx.lineTo(74, 146);
  ctx.lineTo(70, 152);
  ctx.lineTo(66, 146);
  ctx.lineTo(70, 152);
  ctx.lineTo(70, 225);
  ctx.arc(70, 225, 3, -.5 * Math.PI, 1.5 * Math.PI, true);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  ctx.beginPath();
  ctx.arc(80, 75, 3, -.5 * Math.PI, 1.5 * Math.PI, true);
  ctx.lineTo(80, 148);
  ctx.lineTo(76, 152);
  ctx.lineTo(80, 148);
  ctx.lineTo(84, 152);
  ctx.lineTo(80, 148);
  ctx.lineTo(80, 225);
  ctx.arc(80, 225, 3, -.5 * Math.PI, 1.5 * Math.PI, true);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  ctx.fillText('Dudley', 45, 230);
  ctx.fillText('Harvard', 45, 80);
  
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  addBuses(canvas, _.pluck(apprVehicles, 'id'), 'Approaching');
  addBuses(canvas, _.pluck(depVehicles, 'id'), 'Departed');
  addBuses(canvas, _.pluck(vehAtTerminal, 'id'), 'Terminal');
}

function setIntervalAndExecute(fn, t) {
  fn();
  return(setInterval(fn, t));
}

var canvas = document.getElementById('busDiagram');
drawBusDiagram(canvas);

var getJsonAndDisplay = function() {
  var selectedDir = $('#directionSelector').val();
  $.getJSON('/' + selectedDir).done(function(vehicles) {
    console.log('got JSON: ' + JSON.stringify(vehicles));
    $("#BusTable").find("tr:gt(0)").remove();
    
    var list = _.sortBy(vehicles, 'schedDeparture');
    for (var i = 0; i < list.length; i++) {
      $('#BusTable tr:last').after('<tr><td>' + list[i].id + '</td><td>' + 
        list[i].status + '</td><td>' + 
        (list[i].arrivalTime == 0 ? 'n/a' : new Date(list[i].arrivalTime).toLocaleTimeString()) + '</td><td>' + 
        (list[i].schedDeparture == 0 ? 'n/a' : new Date(list[i].schedDeparture).toLocaleTimeString()) +'</td><td>' + 
        (list[i].predDeparture == 0 ? 'n/a' : new Date(list[i].predDeparture).toLocaleTimeString()) + '</td><td>' + 
        (list[i].suggDeparture == 0 ? 'n/a' : new Date(list[i].suggDeparture).toLocaleTimeString()) +'</td><td>' + 
        (list[i].departureTime == 0 ? 'n/a' : new Date(list[i].departureTime).toLocaleTimeString()) + '</td></tr>');
    }
    
    var vehAtTerminal = _.where(vehicles, {status: 'Terminal'});
    var depVehicles = _.where(vehicles, {status: 'Departed'});
    var apprVehicles = _.where(vehicles, {status: 'Approaching'});
    
    drawBusDiagram(canvas, apprVehicles, depVehicles, vehAtTerminal);
  });
};

$('#directionSelector').change(getJsonAndDisplay);
var timerId = setIntervalAndExecute(function() {
  getJsonAndDisplay();
}, 15000);

var clockTimerId = setIntervalAndExecute(function() {
  $('#clock').text('Current Time: ' + new Date().toLocaleTimeString());
}, 1000);