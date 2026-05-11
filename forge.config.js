module.exports = {
  packagerConfig: {
    name: 'Job Fair Monitoring System',
    executableName: 'JobFairMonitoring',
    icon: './src/img/dmw_logo',
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'job-fair-monitoring-system',
      },
    },
  ],
};
