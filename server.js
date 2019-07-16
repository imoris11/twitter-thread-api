'use strict';

//mongoose file must be loaded before all other files in order to provide
// models to other modules
var express = require('express'),
  router = express.Router(),
  cors = require('cors'),
  bodyParser = require('body-parser'),
  request = require('request'),
  Twit = require('twit'),
  util = require("util");

  //var twitterConfig = require('./twitter.config.js');

var app = express();

var T = new Twit({
  consumer_key:         process.env.CONSUMER_KEY,
  consumer_secret:      process.env.CONSUMER_SECRET,
  access_token:         process.env.ACCESS_TOKEN,
  access_token_secret:  process.env.ACCESS_TOKEN_SECRET,
  timeout_ms:           60*1000,  // optional HTTP request timeout to apply to all requests.
//  strictSSL:            true,     // optional - requires SSL certificates to be valid.
});

// enable cors
var corsOption = {
  origin: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  exposedHeaders: ['x-auth-token']
};
app.use(cors(corsOption));

//rest API requirements
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());

let send_single_tweet = require('util').promisify(
  (options, data, cb) => T.post(
    options,
    data,
    (err, ...results) => cb(err, results)
  )
);

const thread = async (posts, id, res) => {
  for(let i = 0; i < posts.length; i++){
    let content = await send_single_tweet('statuses/update', { status: posts[i], in_reply_to_status_id: id });
    id = content[0].id_str;
  };
  res.json({message: "Completed"});
};

const start_thread = (first, tweets, res) => {
  send_single_tweet('statuses/update', { status: `${first}` })
    .then((first_tweet) => {
        console.log(`First tweet tweeted!`);
        let starting_id = first_tweet[0].id_str;
        return thread(tweets, starting_id, res);
    })
    .catch(err => console.log(err));
};

router.route('/auth/twitter/reverse')
  .post(function(req, res) {
    request.post({
      url: 'https://api.twitter.com/oauth/request_token',
      oauth: {
        oauth_callback: "http%3A%2F%2Flocalhost%3A3000%2Ftwitter-callback",
        consumer_key:  process.env.CONSUMER_KEY,
        consumer_secret: process.env.CONSUMER_SECRET
      }
    }, function (err, r, body) {
      if (err) {
        return res.send(500, { message: err.message });
      }
      var jsonStr = '{ "' + body.replace(/&/g, '", "').replace(/=/g, '": "') + '"}';
      res.send(JSON.parse(jsonStr));
    });
  });

router.route('/status')
  .post((req, res) => {
    let posts = req.body.posts;
    start_thread(posts[0], posts.slice(1), res);
  });

router.route('/auth/twitter')
  .post((req, res) => {
    request.post({
      url: `https://api.twitter.com/oauth/access_token?oauth_verifier`,
      oauth: {
        consumer_key: process.env.CONSUMER_KEY,
        consumer_secret: process.env.CONSUMER_SECRET,
        token: req.query.oauth_token
      },
      form: { oauth_verifier: req.query.oauth_verifier }
    }, function (err, r, body) {
      if (err) {
        return res.send(500, { message: err.message });
      }

      const bodyString = '{ "' + body.replace(/&/g, '", "').replace(/=/g, '": "') + '"}';
      const parsedBody = JSON.parse(bodyString);

      req.body['oauth_token'] = parsedBody.oauth_token;
      req.body['oauth_token_secret'] = parsedBody.oauth_token_secret;
      req.body['user_id'] = parsedBody.user_id;
      res.json(req.body);
    });
  });



app.use('/api/v1', router);
const port = process.env.PORT || 4000
app.listen(port);
module.exports = app;
