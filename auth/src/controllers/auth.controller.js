function getHomePage(req, res) {
  res.status(200).render('index', {
    pageTitle: 'Auth',
    userName: req.user?.userName || 'Utilizador',
    userRole: req.user?.role || '',
    userId: req.user?.id || '',
    session: {
      userId: req.user?.id || null,
      userName: req.user?.userName || null,
      email: req.user?.email || null,
      role: req.user?.role || null,
      roleId: req.user?.roleId || null
    }
  });
}

function getInternalSessionStatus(req, res) {
  return res.status(200).json({
    status: 'ok',
    session: {
      valid: true,
      userId: req.user?.id || null,
      userName: req.user?.userName || null,
      role: req.user?.role || null
    },
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  getHomePage,
  getInternalSessionStatus
};
