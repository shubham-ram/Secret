//jshint esversion:6


require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
// const encrypt = require("mongoose-encryption");
// const md5 = require("md5");
// const bcrypt = require("bcrypt");
// const saltRound = 10;
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");
const FacebookStrategy = require("passport-facebook").Strategy;

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: "This is long string",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());


mongoose.connect("mongodb://localhost:27017/secretDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String ,
  facebookId: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
// userSchema.plugin(encrypt, {secret: process.env.SECRET, encryptedFields: ["password"]});
// console.log(secret);

const User = mongoose.model("user", userSchema);

const secretSchema = new mongoose.Schema({
  secret : String
});

const Secret = mongoose.model("secret", secretSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID ,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/secrets",
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
function(accessToken, refreshToken, profile, cb){
  // console.log(profile);
  User.findOrCreate({googleId: profile.id},function(err, user){
    return cb(err, user);
  });
}
));

passport.use(new FacebookStrategy({
  clientID: process.env.APP_ID ,
  clientSecret: process.env.APP_SECRET ,
  callbackURL: "https://localhost:3000/auth/facebook/secrets/"
},
function(accessToken, refreshToken, profile, cb){
  User.findOrCreate({ facebookId: profile.id}, function(err, user){
    return cb(err, user);
  });
}
));



app.get("/", function(req, res) {
  res.render("home");
});

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/secrets',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect('/secrets');
  });

app.get('/auth/facebook',
    passport.authenticate('facebook'));

app.get('/auth/facebook/secrets/',
    passport.authenticate('facebook', { failureRedirect: '/login' }),
    function(req, res) {
      // Successful authentication, redirect secret.
      res.redirect('/secrets');
    });

app.get("/login", function(req, res) {
  res.render("login");
});

app.get("/register", function(req, res) {
  res.render("register");
});

app.get("/secrets",function(req, res){
  if(req.isAuthenticated()){
    Secret.find(function(err, foundSecret){
      if(err){
        console.log(err);
      } else {
        if (foundSecret){
          res.render("secrets", {userWithSecrets : foundSecret});
        }
      }
    });
  } else {
    res.redirect("/login");
  }


  // User.find({"secret": {$ne:null}}, function(err, foundUsers){
  //   if(err){
  //     console.log(err);
  //   } else {
  //     if (foundUsers){
  //       res.render("secrets", {userWithSecrets : foundUsers});
  //     }
  //   }
  // });
});

app.get("/submit", function(req,res){
  if(req.isAuthenticated()){
    res.render("submit");
    // console.log(req.isAuthenticated());
  } else {
    res.redirect("/login");
  }
});

app.post("/submit",function(req, res){
  const submittedSecret = new Secret({
    secret : req.body.secret
  }) ;

  submittedSecret.save(function(){
    res.redirect("/secrets");
  });

  // User.findById(req.user.id, function(err, foundUser){
  //   if(err){
  //     console.log(err);
  //   } else {
  //     if(foundUser){
  //       foundUser.secret = submittedSecret ;
  //       foundUser.save(function(){
  //         res.redirect("/secrets");
  //       });
  //     }
  //   }
  // });
});

app.get("/logout",function(req, res){
  req.logout();
  res.redirect("/");
});

app.post("/register", function(req, res) {
  User.register({username: req.body.username}, req.body.password, function(err, user){
    if(err){
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function(){
          res.redirect("/secrets");
      });
    }
  });


});

app.post("/login", function(req, res) {

  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

    req.login(user, function(err){
      if(err){
        console.log(err);
      } else {
        passport.authenticate("local")(req, res, function(){
          res.redirect("/secrets");
        });
      }
    });



});


app.listen(3000, function(req, res) {
  console.log("Server started on port 3000 successfully");
});
