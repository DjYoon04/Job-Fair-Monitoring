// Custom sign script that skips code signing
module.exports = async function(configuration) {
  console.log('Skipping code signing...');
  return null;
};
