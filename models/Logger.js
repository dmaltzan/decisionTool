module.exports = {
  log: function(logString) {
    console.log(new Date().toLocaleString() + ' -- ' + logString);
  }
};