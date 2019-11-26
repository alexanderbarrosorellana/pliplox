/* eslint-disable consistent-return */
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// ======================================================
// Get all users
// ======================================================
const getUsers = (req, res) => {
  User.find(
    {},
    'name email createdAt lastLogin birthdate avatarUrl role loginType',
    // eslint-disable-next-line consistent-return
    (err, users) => {
      if (err) {
        return res.status(500).json({
          ok: false,
          msg: 'Could not load user',
          errors: err
        });
      }
      User.countDocuments({}, (errCount, size) => {
        if (errCount) {
          return res.status(500).json({
            ok: false,
            msg: 'Error trying to count users',
            errors: errCount
          });
        }

        return res.status(200).json({
          ok: true,
          total: size,
          users: { users }
        });
      });
    }
  );
};

// ======================================================
// Update user
// ======================================================
const updateUser = (req, res) => {
  const { id } = req.params;
  const { body } = req;

  User.findById(id, (findErr, userDB) => {
    if (findErr) {
      return res.status(500).json({
        ok: false,
        msg: 'User search failed ',
        errors: findErr
      });
    }

    if (!userDB) {
      return res.status(400).json({
        ok: false,
        msg: `The user id: ${id} not found`
      });
    }

    if (userDB.loginType !== 'NORMAL') {
      return res.status(400).json({
        ok: false,
        msg: `account type: ${userDB.loginType} cannot be modified.`
      });
    }

    const us = new User({
      name: body.name, // require
      email: body.email, // require
      birthdate: body.birthdate,
      avatarUrl: body.avatarUrl,
      role: body.role, // require
      password: userDB.password
    });

    us.save((err, userSave) => {
      if (err) {
        return res.status(400).json({
          ok: false,
          msg: 'Error trying to update user',
          errors: err
        });
      }

      return res.status(200).json({
        ok: true,
        msg: 'User updated',
        user: {
          id: userSave.id,
          name: userSave.name,
          email: userSave.email,
          birthdate: userSave.birthdate,
          avatarUrl: userSave.avatarUrl,
          role: userSave.role
        }
      });
    });
  });
};

// ======================================================
// Create user
// ======================================================
const createUser = async (req, res) => {
  const { body } = req;
  const user = new User({
    name: body.name,
    email: body.email,
    password: bcrypt.hashSync(body.password, 10),
    birthdate: body.birthdate,
    avatarUrl: body.avatarUrl,
    role: body.role
  });

  await user.save((err, userSave) => {
    if (err) {
      return res.status(400).json({
        ok: false,
        msg: 'Error trying to create user',
        errors: err
      });
    }

    res.status(201).json({
      ok: true,
      msg: userSave
    });
  });
};

// ======================================================
// Delete user
// ======================================================
const deleteUser = async (req, res) => {
  const { id } = req.params;

  await User.findByIdAndDelete(id, (err, userDelete) => {
    if (err) {
      return res.status(500).json({
        ok: false,
        msg: 'User search failed ',
        errors: err
      });
    }

    if (!userDelete) {
      return res.status(400).json({
        ok: false,
        msg: `The user id: ${id} not found`
      });
    }

    res.status(200).json({
      ok: true,
      msg: 'User deleted',
      user: userDelete
    });
  });
};

module.exports = {
  getUsers,
  updateUser,
  createUser,
  deleteUser
};
