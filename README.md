# NSABot
Bot that sits in your chat and logs everything you say
Used with [NSABot_api](https://github.com/MillerJL/NSABot_api)

node_slack_sdk(@slack/client)

## Important
Do NOT share or publish sensitive info in your config/default.json

## Installation
* Get slackbot token
* Create channel for NSABot to log certain events
  * e.g. connected, certain errors, commands, etc.
* Copy config/default-sample.json to config/default.json and modify contents to match necessary environment variables
* npm install
* Use with [NSABot_api](https://github.com/MillerJL/NSABot_api)

## Usage
* Just connect and leave it alone

## Future Plans
- [x] Create files collection
- [x] Handle reactions being added.
- [ ] Pinned items
- [x] Switch message :id to ts based
* /messages/:ts/channels/:c_id seems to be best way as ts is only unique to channel
- [ ] Create some way to send message to NSABot channel if connection fails
* Couldn't be to slack, but maybe an email if it doesn't happen too often
  * Maybe put on a timer and if connection is lost for over x amount of time send email
- [ ] Script to get all group info from slack storage when bot first activated
* e.g. last ~20k messages w/ reactions, channels, users, files, pinned items, etc.
* This would be called when first activating bot
- [ ] Create some way to retroactively get events if connection fails
