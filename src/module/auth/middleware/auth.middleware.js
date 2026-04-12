const jwt = require('jsonwebtoken');
const prisma = require('../config/auth.config');

const authenticate = async (req, res, next) => {
    try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ message: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    if(!token){
        return res.status(401).json({ message: 'No token provided' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
        where: {
            id: decoded.id
        }
    });
    if (!user) {
        return res.status(401).json({ message: 'User not found' });
    }
    req.user = { id: user.id, name: user.name, email: user.email };
    next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};
/*
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      message: "Validation failed",
      errors: result.error.flatten(),
    });
  }

  // overwrite with clean data
  req.body = result.data;

  next();
};
*/
module.exports = { authenticate };