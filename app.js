require('dotenv').config();

var bodyParser = require('body-parser');
var pgp = require('pg-promise')();

var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
var RTM_CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS.RTM;

var RtmClient = require('@slack/client').RtmClient;
var token = process.env.SLACK_TOKEN || '';
var rtm = new RtmClient(token, {logLevel: 'debug'});

var db = pgp(process.env.DB_CONSTRING);

rtm.start();

rtm.on(RTM_EVENTS.MESSAGE, function (message) {
  db.none("INSERT INTO messages(message_data) values($1)", [message])
    .catch(function (error) {
        console(error);
    });
});

rtm.on(RTM_CLIENT_EVENTS.RTM_CONNECTION_OPENED, function () {
  rtm.sendMessage('Connected', 'C19CDQ789', function messageSent() {

  });
});

/*  Move all this over to some cool framework later  */
