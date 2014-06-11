// Class pattern taken from http://book.mixu.net/node/ch6.html
function Vehicle() {
  this.id = '';
  this.status = '';
  this.arrivalTime = 0;
  this.departureTime = 0;
  this.suggDeparture = 0;
  this.schedDeparture = 0;
  this.predDeparture = 0;
  this.apprTripId = 'unknown';
  this.depTripId = 'unknown';
  //this.location = { lat: 0, lon: 0 };
  //this.nextStop = 0;
}

module.exports = Vehicle;
