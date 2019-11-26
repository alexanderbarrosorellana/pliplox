/* eslint-disable consistent-return */
const bcrypt = require('bcryptjs');

const jwt = require('jsonwebtoken');

const cid = process.env.GOOGLE_CLIENT_ID;
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(cid);
const { registerValidation, loginValidation } = require('../validation');
const User = require('../models/User');

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
      msg: 'Error: no code'
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
async function verify(token) {
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: cid
  });

  const payload = ticket.getPayload();
  return {
    name: payload.name,
    email: payload.email,
    img: payload.picture,
    google: 'GOOGLE'
  };
}

const signInGoogle = async (req, res) => {
  const { token } = req.body;
  const googleUser = await verify(token).catch(e => {
    return res.status(403).json({
      ok: false,
      msg: `Invalid token: ${e}`
    });
  });

  const userExist = await User.findOne({ email: googleUser.email });
  if (userExist) {
    const jwtoken = jwt.sign({ user: userExist }, process.env.TOKEN_SECRET, { expiresIn: 900 });

    return res.status(200).json({
      ok: true,
      msg: 'Login with google',
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
    loginType: googleUser.google,
    password: 'SECRET' // the real pass never saved in the Pliplox DB
  });

  userGoogle.save((saveErr, userSave) => {
    if (saveErr) {
      return res.status(400).json({
        ok: false,
        msg: saveErr
      });
    }

    const jwtoken = jwt.sign({ user: userSave }, process.env.TOKEN_SECRET, { expiresIn: 900 });
    return res.status(200).json({
      ok: true,
      msg: 'User saved in DB',
      user: {
        createAt: userSave.createdAt,
        id: userSave.id,
        name: userSave.name,
        email: userSave.email,
        avatarUrl: userSave.avatarUrl,
        loginType: userSave.loginType
      },
      token: { jwtoken }
    });
  });
};

// ======================================================
// Normal Authentication
// ======================================================
const signUp = async (req, res) => {
  const { error } = registerValidation(req.body);
  if (error) return res.status(400).send(error.details[0].message);
  const emailExist = await User.findOne({ email: req.body.email });
  if (emailExist) return res.status(400).send({ ok: false, err: 'Email already exists' });

  // ======================================================
  // Hash the password
  // ======================================================
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(req.body.password, salt);

  const user = new User({
    name: req.body.name,
    email: req.body.email,
    password: hashedPassword
  });

  try {
    const savedUser = await user.save();
    return res.status(201).send({ userId: savedUser._id });
  } catch (err) {
    return res.status(400).send(err);
  }
};

const signIn = async (req, res) => {
  const { body } = req;
  const { error } = loginValidation(body);

  if (error) return res.status(400).send(error.details[0].message);
  const userExist = await User.findOne({ email: body.email });

  if (!userExist) return res.status(400).send({ ok: false, err: `User don't exist` });

  // ======================================================
  // Verify email
  // ======================================================
  if (userExist.email !== body.email) {
    return res.status(401).json({
      ok: false,
      msg: `The ${body.email} isn´t correct`
    });
  }

  // ======================================================
  // Verify passwords
  // ======================================================
  if (!bcrypt.compareSync(body.password, userExist.password)) {
    return res.status(400).json({
      ok: false,
      msg: 'The password isn´t correct'
    });
  }

  // ======================================================
  // Create token
  // ======================================================
  const token = jwt.sign({ user: userExist }, process.env.TOKEN_SECRET, { expiresIn: 14400 });
  return res.status(200).json({
    ok: true,
    id: userExist.id,
    nombre: userExist.name,
    email: userExist.email,
    token: { token }
  });
};

module.exports = {
  signUp,
  signIn,
  signInGoogle
};
