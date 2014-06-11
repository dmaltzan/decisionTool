var config = {
  port: 8081,
  connStr: 'postgres://postgres:mendelssohn@localhost:5432/mbta',
  routeId: '1',
  pollingInterval: 15, // in seconds
  stops: {
    outbound:  
    {
      thisStop: '64_ar', // Dudley
      thisStopDep: '64', // Dudley
      quarterpoint: '10590',// Washington St at Mass Ave
      midpoint: '93',     // Hynes
      oppTerminal: '110_ar' // Holyoke Gate
    },
    inbound:
    {
      thisStop: '110_ar', // Holyoke Gate
      thisStopDep: '110', // Holyoke Gate
      quarterpoint: '72',// Pearl St (Central Square)
      midpoint: '79',     // Hynes
      oppTerminal: '64_ar' // Dudley
    }
  },
  stopLocations: {
    outbound: {
      lat: 42.3297899,
      lon: -71.08388
    },
    inbound: {
      lat: 42.3732599,
      lon: -71.1175659
    }
  },
  tripTimes: {
    outbound:
    {
      quarterpoint: 7 * 60 * 1000,
      midpoint: 17 * 60 * 1000,
      oppTerminal: 34 * 60 * 1000
    },
    inbound:
    {
      quarterpoint: 11 * 60 * 1000,
      midpoint: 21 * 60 * 1000,
      oppTerminal: 40 * 60 * 1000
    }
  }
};

module.exports = config;