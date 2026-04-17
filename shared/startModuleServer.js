function startModuleServer(app, defaultPort, moduleLabel) {
  const port = process.env.PORT || defaultPort;

  app.listen(port, () => {
    console.log(`${moduleLabel} server running on http://localhost:${port}`);
  });
}

module.exports = {
  startModuleServer
};
