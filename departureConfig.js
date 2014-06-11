var config = {
  port: 8081,
  connStr: 'postgres://postgres:mendelssohn@localhost:5432/mbta',
  routeId: '1',
  pollingInterval: 15, // in seconds
  stops: {
    outbound:  
    {
      thisStop: '64_ar',   // Dudley
      thisStopDep: '64',   // Dudley
      secondStop: '1',
      thirdStop: '2'
    },
    inbound:
    {
      thisStop: '110_ar', // Holyoke Gate
      thisStopDep: '110', // Holyoke Gate
      secondStop: '2168',
      thirdStop: '2166'
    }
  }
};

module.exports = config;