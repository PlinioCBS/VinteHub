const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // Skip auth for login
  if (req.path === '/api/auth/login' || req.originalUrl === '/api/auth/login') {
    return next();
  }

  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
