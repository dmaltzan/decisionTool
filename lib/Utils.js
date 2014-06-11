module.exports = {
  getMidnight: function() {
    var date = new Date().getDate();
    var month = new Date().getMonth();
    var year = new Date().getFullYear();
    return new Date(year, month, date).getTime();
  },
  
  getDistanceMeters: function(lat1, lon1, lat2, lon2) {
    var mPerDegLat = 111080.01;
    var mPerDegLon = 82137.32;
    
    var mLat = (+lat1 - +lat2) * mPerDegLat;
    var mLon = (+lon1 - +lon2) * mPerDegLon;
    
    var dist = Math.sqrt(Math.pow(mLat, 2) + Math.pow(mLon, 2));
    return dist;
  }
};