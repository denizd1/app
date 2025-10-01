//need db, user model and sequelize to get all users from db
const db = require("../models");
const { user: User, role: Role } = db;
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");

exports.getAllUsers = (req, res) => {
  User.findAll({
    include: [
      {
        model: Role,
        //where roles are not defined for user
        where: { id: 4 },
      },
    ],
  })
    .then((data) => {
      var userlist = [];
      const pick = (obj, arr) =>
        arr.reduce(
          (acc, record) => (record in obj && (acc[record] = obj[record]), acc),
          {}
        );
      data.forEach((item) => userlist.push(pick(item, ["id", "username"])));
      res.send(userlist);
    })
    .catch((err) => {
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving users.",
      });
    });
};

//user roles are defined in role table. find the user with user id in req.body then update join table with role id
exports.updateUser = (req, res) => {
  const id = req.body.id;
  User.findByPk(id, {
    include: [
      {
        model: Role,
        //where roles are not defined for user
      },
    ],
  })
    .then((data) => {
      return Promise.all([data.setRoles(req.body.role)]);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send({
        message: "Error updating User with id=" + id,
      });
    });
};

// Function to handle forgot password request
exports.forgotPassword = async (req, res) => {
  // Get the email from the request body
  const { email } = req.body;

  // Check if the email exists in the system
  const user = await User.findOne({ where: { email: email } });

  if (!user) {
    return res.status(404).send({ message: "Kullanıcı bulunamadı." });
  }

  // Generate a JWT token with an expiration time
  const token = Math.floor(1000 + Math.random() * 9000);

  const otpExpier = new Date();
  otpExpier.setMinutes(otpExpier.getMinutes() + 5);

  // Store the token in the database
  user.resetPasswordToken = token;
  user.resetPasswordExpires = otpExpier;

  await user.save();
  // Send the token to the user's email
  const transporter = nodemailer.createTransport({
    // Configure your email provider settings here. use gmail
    service: "gmail",
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    tls: { rejectUnauthorized: false },
    auth: {
      user: "mail.projecthub@gmail.com",
      pass: process.env.EMAILPASSWORD,
    },
  });

  const mailOptions = {
    from: "mail.projecthub@gmail.com",
    to: email,
    subject: "Şifre Yenileme Talebi",
    text: `Güvenlik Kodu (5 dakika için geçerli) : ${token}`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
      return res
        .status(500)
        .send({ message: error.message || "Failed to send email" });
    }
    console.log("Email sent: " + info.response);
    res.status(200).send({ message: "Password reset email sent" });
  });
};
exports.resetPassword = async (req, res) => {
  // Get the token and new password from the request body
  const { email, password, securitycode } = req.body;

  try {
    // Find the user with the matching token{ where: { email: email } }
    const user = await User.findOne({
      where: { email: email, resetPasswordToken: securitycode },
    });

    if (!user) {
      return res.status(404).send({ message: "Kullanıcı bulunamadı." });
    }
    // Check if the token is expired
    if (User.resetPasswordExpires < Date.now()) {
      return res.status(400).send({ message: "Güvenlik kodu süresi doldu." });
    }

    // Update the user's password
    user.password = bcrypt.hashSync(password, bcrypt.genSaltSync(10));
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    await user.save();

    res.status(200).send({ message: "Password reset successful" });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res
        .status(400)
        .send({ message: error.message || "Güvenlik kodu süresü doldu." });
    }
    console.log(error);
    res.status(500).send({ message: "Failed to reset password" });
  }
};
