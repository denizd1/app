const db = require("../models");
const config = require("../config/auth.config");
const { user: User, role: Role, refreshToken: RefreshToken } = db;

const Op = db.Sequelize.Op;

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

exports.signup = (req, res) => {
  const { username, email, password, roles } = req.body;

  if (!username || !email || !password) {
    return res
      .status(400)
      .send({ message: "Kullanıcı adı, email, ve şifre zorunludur." });
  }

  // Validate email format
  const emailPattern = /[\w-.]+@([mta.gov]+\.+[tr]{2})/;
  if (!emailPattern.test(email)) {
    return res
      .status(400)
      .send({ message: "Lütfen geçerli bir email adresi giriniz." });
  }

  // Save User to Database
  User.create({
    username,
    email,
    password: bcrypt.hashSync(password, bcrypt.genSaltSync(10)),
  })
    .then((user) => {
      if (req.body.roles) {
        Role.findAll({
          where: {
            name: {
              [Op.or]: roles,
            },
          },
        }).then((roles) => {
          user.setRoles(roles).then(() => {
            res.send({ message: "Kaydınız tamamlandı" });
          });
        });
      } else {
        // user role = 1
        user.setRoles([4]).then(() => {
          res.send({ message: "Kaydınız tamamlandı" });
        });
      }
    })
    .catch((err) => {
      res.status(500).send({ message: err.message });
    });
};

exports.signin = (req, res) => {
  const { username, password } = req.body;
  User.findOne({
    where: {
      username,
    },
  })
    .then(async (user) => {
      if (!user) {
        return res.status(404).send({ message: "Kullanıcı bulunamadı" });
      }

      const passwordIsValid = bcrypt.compareSync(password, user.password);

      if (!passwordIsValid) {
        return res.status(401).send({
          accessToken: null,
          message: "Şifrenizi hatalı girdiniz",
        });
      }

      const token = jwt.sign({ id: user.id }, process.env.JWTSECRET, {
        expiresIn: config.jwtExpiration,
      });

      let refreshToken = await RefreshToken.createToken(user);

      let authorities = [];
      user.getRoles().then((roles) => {
        for (let i = 0; i < roles.length; i++) {
          authorities.push("ROLE_" + roles[i].name.toUpperCase());
        }
        if (!authorities.includes("ROLE_GUEST")) {
          res.status(200).send({
            id: user.id,
            username: user.username,
            email: user.email,
            roles: authorities,
            accessToken: token,
            refreshToken: refreshToken,
          });
        } else {
          res.status(403).send({
            message: "Kullanıcı onay bekliyor",
          });
        }
      });
    })
    .catch((err) => {
      res.status(500).send({ message: err.message });
    });
};

exports.refreshToken = async (req, res) => {
  const { refreshToken: requestToken } = req.body;

  if (requestToken == null) {
    return res.status(403).json({ message: "Refresh Token is required!" });
  }

  try {
    let refreshToken = await RefreshToken.findOne({
      where: { token: requestToken },
    });

    if (!refreshToken) {
      res.status(403).json({ message: "Refresh token is not in database!" });
      return;
    }

    if (RefreshToken.verifyExpiration(refreshToken)) {
      RefreshToken.destroy({ where: { id: refreshToken.id } });

      res.status(403).json({
        message: "Refresh token was expired. Please make a new signin request",
      });
      return;
    }

    const user = await refreshToken.getUser();
    let newAccessToken = jwt.sign({ id: user.id }, process.env.JWTSECRET, {
      expiresIn: config.jwtExpiration,
    });

    return res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: refreshToken.token,
    });
  } catch (err) {
    return res.status(500).send({ message: err });
  }
};
