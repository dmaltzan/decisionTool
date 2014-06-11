var forever = require('forever-monitor');

var child = new (forever.Monitor)('server.js', {
  max: 100,
  silent: true,
  pidFile: './decisionTool.pid',
  logFile: './foreverLog.txt',
  outFile: './decisionToolLog.txt',
  errFile: './decisionToolErrors.txt',
  options: []
});

child.on('exit', function () {
  console.log('server.js has exited after 100 restarts');
});

child.on('restart', function() {
    console.error('Forever restarting server.js for ' + child.times + ' time at ' + new Date().toLocaleString());
});

child.on('error', function(err) {
  console.log('error at ' + new Date().toLocaleString());
  console.log(err.toString());
});

child.start();