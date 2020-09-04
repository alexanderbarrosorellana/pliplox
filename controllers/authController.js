require('dotenv/config');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { registerValidation, loginValidation } = require('../validation');

const cid = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(cid);
const User = require('../models/User');

// seconds to expire token in normal signIn function (4 hours)
const SIGN_IN_TIME_OUT = 14400;

// ======================================================
// GitHub Authentication TODO: stand by
// ======================================================
/* const request = require('superagent');
  const cicularJSON = require('circular-json');
  const signInGitHub = (req, res) => {
  const code = 'dbea628f1f05a165a7cc';
  if (!code) {
    return res.send({
      ok: false,
      err: 'Error: no code'
    });
  }

  const clientId = 'cc029f3d6736663ed8eb';
  const clientSecret = 'a8ba44fbf04cc077909ef753dd9037e01512239c';

  request
    .post('https://github.com/login/oauth/access_token')
    .send({ client_id: clientId, client_secret: clientSecret, code: code })
    // .set('X-API-Key', 'foobar')
    .set('Accept', 'application/json')
    .then(resp => {
      return res.send({
        resultado: JSON.stringify(resp.body),
        type: typeof resp.body,
        resultado2: JSON.parse(JSON.stringify(resp.body))
      });
    });
}; */

// ======================================================
// Google Authentication
// ======================================================
const verify = async token => {
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: cid
  });

  const payload = ticket.getPayload();
  return {
    name: payload.name,
    email: payload.email,
    img: payload.picture,
    loginType: 'GOOGLE'
  };
};

const signInGoogle = async (req, res) => {
  const { token } = req.body;
  const googleUser = await verify(token).catch(e => {
    return res.status(403).json({
      ok: false,
      err: ` Token no valido: ${e}`
    });
  });

  const userExist = await User.findOne({ email: googleUser.email });
  if (userExist) {
    const jwtoken = jwt.sign({ user: userExist }, process.env.TOKEN_SECRET, { expiresIn: 900 }); //  15 minutes...

    return res.status(200).json({
      ok: true,
      msg: 'Inicio de sesion con Google',
      user: {
        createAt: userExist.createdAt,
        id: userExist.id,
        name: userExist.name,
        email: userExist.email,
        avatarUrl: userExist.avatarUrl,
        loginType: userExist.loginType
      },
      token: { jwtoken }
    });
  }
  const userGoogle = new User({
    name: googleUser.name,
    email: googleUser.email,
    avatarUrl: googleUser.img,
    loginType: googleUser.loginType,
    password: 'SECRET' // plain passwords are never saved in pliplox db
  });

  try {
    const savedUser = await userGoogle.save();
    const jwtoken = jwt.sign({ user: savedUser }, process.env.TOKEN_SECRET, { expiresIn: 900 }); // 15 minutes...
    return res.status(200).send({
      ok: true,
      msg: 'Usuario guardado',
      user: {
        createAt: savedUser.createdAt,
        id: savedUser.id,
        name: savedUser.name,
        email: savedUser.email,
        avatarUrl: savedUser.avatarUrl,
        loginType: savedUser.loginType
      },
      token: { jwtoken }
    });
  } catch (saveErr) {
    return res.status(400).json({
      ok: false,
      err: saveErr
    });
  }
};

// ======================================================
// Sign Up
// ======================================================
const signUp = async (req, res) => {
  const { error } = registerValidation(req.body);
  if (error) return res.status(400).send({ message: error.details[0].message });
  const emailExist = await User.findOne({ email: req.body.email });
  if (emailExist) return res.status(400).send({ ok: false, err: 'Email ya existe' });
  const user = new User();
  user.name = req.body.name;
  user.email = req.body.email;
  user.password = req.body.password;

  try {
    const savedUser = await user.save();
    return res.status(201).send({ message: 'Usuario creado con éxito', userId: savedUser._id });
  } catch (err) {
    return res.status(400).send(err);
  }
};

// ======================================================
// Normal Authentication
// ======================================================
const signIn = async (req, res) => {
  const { body } = req;
  const { error } = loginValidation(body);

  if (error) return res.status(400).send({ message: error.details[0].message });
  const userExist = await User.findOne({ email: body.email });

  // ======================================================
  // Verify email
  // ======================================================
  if (!userExist || !bcrypt.compareSync(body.password, userExist.password)) {
    return res.status(401).json({
      ok: false,
      err: `Correo electronico o contraseña incorrecta`
    });
  }

  // ======================================================
  // Create token
  // ======================================================
  const token = jwt.sign({ user: userExist }, process.env.TOKEN_SECRET, {
    expiresIn: SIGN_IN_TIME_OUT
  });
  return res.status(200).send({
    ok: true,
    userId: userExist.id,
    name: userExist.name,
    email: userExist.email,
    tokenId: token,
    expiresIn: 14400
  });
};

module.exports = {
  signUp,
  signIn,
  signInGoogle
};
