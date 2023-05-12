//jshint esversion:6
require('dotenv').config();
const express = require('express');
const bodyparser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
// const mongooseFieldEncryption = require("mongoose-field-encryption").fieldEncryption;
// const md5 = require('md5');
// const bcrypt = require('bcrypt');
// const saltRounds = 10;
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');

const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');

const app = express();
app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyparser.urlencoded({
    extended: true
}));

//it is necessary to config passport between these statements
app.use(session({
    secret:"Our little secret.",
    resave:false,
    saveUninitialized:false
}));
app.use(passport.initialize());
app.use(passport.session());

main().catch(err => console.log(err));

async function main(){
    await mongoose.connect('mongodb://127.0.0.1:27017/userDB');
}

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId:String,
    secret:String
});


// userSchema.plugin(mongooseFieldEncryption,{fields:["password"],secret:process.env.SECRET});
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model('User', userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, {
        id: user.id,
        username: user.username,
        picture: user.picture
      });
    });
  });
  
  passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
  });

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL:"https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get('/', function (req, res) {
    res.render("home");
})

//Below code will allow our web app to redirect user to consent screem;
app.get("/auth/google", passport.authenticate("google", { scope: ["profile","email"] }));

//Google after authenticating user on its database send info to given url; so in our web app server get method for the same should be defined;
app.get("/auth/google/secrets", 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect secrets.
    
    res.redirect("/secrets");
  });

app.get('/register', function (req, res) {
    res.render("register");
})
app.get('/login', function (req, res) {
    res.render("login");
})
app.get("/secrets",async function(req,res){
    try{
    let x = await User.find({"secret": {$ne: null}})
          if (x) {
            res.render("secrets", {usersWithSecrets: x});
          }
        }catch(err){
            console.log(err);
        }
})

app.get('/logout', function(req, res, next){
    req.logout(function(err) {
      if (err) { return next(err); }
      res.redirect('/');
    });
  });
app.get("/submit",function (req,res) { 
    if(req.isAuthenticated()){
        res.render("submit");
    }else{
        res.redirect("/login");
    }
 })
app.post("/submit",async function(req,res){
    const secret = req.body.secret;
    // console.log(req.user); //this user information is handed by passport that which user is rightnow logged in.
    try{
    let x = await User.findById(req.user["id"]);
    if(x){
        x.secret = secret;
        await x.save();
        res.redirect("/secrets")
        
    }
}catch(err){
    console.log(err);
}
});
app.post('/register', function (req, res) {
    User.register({username:req.body.username}, req.body.password, function(err,user){
        if(err){
            console.log(err);
            res.redirect('/register');
        }else{
            passport.authenticate("local")(req,res,function(){
                res.redirect("/secrets");
            })
        }
    })
})

app.post('/login', async function (req, res) {
    const user = new User({
        email : req.body.username,
        password : req.body.password
    });

    req.login(user,function(err){
        if(err){
            console.log(err);
        }else{
            passport.authenticate("local")(req,res,function(){
                res.redirect("/secrets");
            })
        }
    })
    
});

app.listen(3000, function () {
    console.log("Server started on port 3000.")
})