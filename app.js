require('dotenv').config()

var bodyParser = require('body-parser')
var rp = require('request-promise')

var RTM_EVENTS = require('@slack/client').RTM_EVENTS
var RTM_CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS.RTM

var RtmClient = require('@slack/client').RtmClient
var rtm = new RtmClient(process.env.SLACK_TOKEN, {logLevel: 'error'})

rtm.start()

rtm.on(RTM_EVENTS.MESSAGE, (message) => {
  var options = {
    method: "POST",
    uri: process.env.API_HOST,
    body: message,
    json: true
  }

  options.method = (message.subtype === 'message_changed') ? "PUT" : "POST"

  rp(options)
    .then((parsedBody) => { console.log(parsedBody) })
    .catch((err) => { console.log(err) })
})

rtm.on(RTM_CLIENT_EVENTS.RTM_CONNECTION_OPENED, function () {
  rtm.sendMessage('Connected', process.env.NSABOT_CHANNEL, function messageSent() {})
})

/*  Move all this over to some cool framework later  */
