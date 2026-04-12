const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/auth.controller');
//const validate = require('../middlewares/auth.middleware').validate;
//const { registerSchema } = require('../validators/auth.schema');

router.post('/register', /*validate(registerSchema),*/ register);
router.post('/login', login);

module.exports = router;