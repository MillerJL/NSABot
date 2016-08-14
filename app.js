// Todo
// Change Qu to "SetURI or something"

require('dotenv').config()

var bodyParser = require('body-parser')
var rp = require('request-promise')

var RtmClient = require('@slack/client').RtmClient
var RTM_EVENTS = require('@slack/client').RTM_EVENTS
var RTM_SUBTYPES = require('@slack/client').RTM_MESSAGE_SUBTYPES
var RTM_CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS.RTM
var MemoryDataStore = require('@slack/client').MemoryDataStore
var cloneDeep = require('clone-deep')

var WebClient = require('@slack/client').WebClient

var token = process.env.SLACK_TOKEN || ''
var web = new WebClient(token)

var rtm = new RtmClient(process.env.SLACK_TOKEN, {
  logLevel: 'error',
  dataStore: new MemoryDataStore()
})

class Request {
  constructor (method, uri, body) {
    this.method = method || null
    this.uri = process.env.API_HOST + ((uri != null) ? this.setUri(uri) : '')
    this.body = body || {}
    this.json = true
  }

  POST (qu, body) {
    this.method = 'POST'
    this.uri += this.setUri(qu)
    this.body = body

    return this
  }

  PATCH (qu, body) {
    this.method = 'PATCH'
    this.uri += this.setUri(qu)
    this.body = body

    return this
  }

  PUT (qu, body) {
    this.method = 'PUT'
    this.uri += this.setUri(qu)
    this.body = (body) || this.body

    return this
  }

  DELETE (qu, body) {
    this.method = 'DELETE'
    this.uri += this.setUri(qu)
    this.body = body

    return this
  }

  GET (qu, body) {
    this.method = 'GET'
    this.uri += this.setUri(qu)
    this.body = body

    return this
  }

  setUri (qu) {
    var newUri = ''
    var paths = { msg: 'messages', chnl: 'channels', user: 'users',
                  rct: 'reactions', fil: 'files' }

    for (var k in qu) {
      if (qu.hasOwnProperty(k) && typeof paths[k] !== 'undefined')
        newUri += '/' + paths[k] + ((qu[k]) ? '/' + qu[k] : '')
    }
    return newUri
  }
}

function fileShare (msg) {
  var body = msg.file
  body.ts = msg.ts

  return rp(new Request('POST', { fil: null }, body))
}

rtm.start()

/**
 * Message Received
 */
rtm.on(RTM_EVENTS.MESSAGE, (msg) => {
  console.log("MESSAGE")
  console.log(msg)

  var api_host = process.env.API_HOST
  var stor_msg = true
  var requests = []
  var req = new Request()

  if('subtype' in msg) {
    switch(msg.subtype) {
      case 'message_changed':
        // This is fucking dumb, but for some reason either slack or the api wrapper I'm using
        // has a file reaction add event cause a message_changed message event ONLY for files.
        if(typeof msg.message.subtype === 'undefined')
          requests.push(rp(req.PATCH({ msg: msg.message.ts, chnl: msg.channel }, {
            'message_history': msg.previous_message,
            'message': {
              text: msg.message.text,
              edited: msg.message.edited
            }
          })))
        stor_msg = false
        break
      case 'message_deleted':
        // requests.push(rp(req.DELETE({ msg: msg.msg, chnl: msg.channel }, msg)))
        // stor_msg = false
        break
      case 'channel_join':
        var options = req.POST({ chnl: msg.channel, usr: msg.user }, msg)
        requests.push(rp(options))
        break
      case 'channel_leave':
      // requests.push(rp(req.DELETE({ chnl: msg.channel, usr: msg.user }, msg)))
        break
      case 'channel_topic':
        // requests.push(rp(req.PATCH({ chnl: msg.channel }, { topic: msg.topic })))
        break
      case 'channel_purpose':
        // requests.push(rp(req.PATCH({ chnl: msg.channel }, { purpose: msg.purpose })))
        break
      case 'channel_rename':
        break
      case 'file_share':
        requests.push(fileShare(cloneDeep(msg)))
        break
    }
  }

  if(stor_msg === true) {
    msg.message_history = []
    requests.push(rp(new Request('POST', { msg: null }, msg)))
  }

  // Bad fix later
  if (typeof requests[0] !== 'undefined')
    Promise.all(requests)
      .then( (res) => { console.log('NSABot_api: ', res) })
      .catch( (err) => { console.log('NSABot_api: ', err) })
})

/**
 * reaction added
 */
rtm.on(RTM_EVENTS.REACTION_ADDED, (msg) => {
  var options = new Request('POST', null, {
    user: msg.user,
    reaction: msg.reaction,
    ts: msg.event_ts,
    item_user: msg.item_user
  })

  if(msg.item.type === 'message')
    options.uri += options.setUri({ rct: null, msg: msg.item.ts, chnl: msg.item.channel })
  else if(msg.item.type === 'file')
    options.uri += options.setUri({ rct: null, fil: msg.item.file })

  if(['file', 'message'].indexOf(msg.item.type) > -1)
    rp(options)
      .then( (parsedBody) => { console.log(parsedBody) })
      .catch( (err) => { console.log('Error NSABot_api: ', err) })
})

/**
 * reaction removed
 */
rtm.on(RTM_EVENTS.REACTION_REMOVED, (msg) => {
  var options = new Request('DELETE', null, {
    user: msg.user,
    reaction: msg.reaction,
    ts: msg.event_ts
  })

  if(msg.item.type === 'message')
    options.uri += options.setUri({ rct: null, msg: msg.item.ts, chnl: msg.item.channel })
  else if(msg.item.type === 'file')
    options.uri += options.setUri({ rct: null, fil: msg.item.file })

  if(['file', 'message'].indexOf(msg.item.type) > -1)
    rp(options)
      .then( (parsedBody) => { console.log(parsedBody) })
      .catch( (err) => { console.log('Error NSABot_api: ', err) })
})

/**
 * Message pinned
 */
rtm.on(RTM_EVENTS.PIN_ADDED, (pin_message) => {
  console.log('PIN_ADDED')
  console.log(pin_message)
  // Might be more. Need to test. Api needs message info so it can go mark it as pinned(?)
  // if(pin_message.item.type === 'message') p_id = pin_message.item.message.ts
  // if(pin_message.item.type === 'file') p_id = pin_message.item.file.id
  //
  // var options = formatOptions('POST', `pins/${p_id}/channels/${pin_message.channel_id}`, pin_message)

  // rp(options)
  //   .then((parsedBody) => { console.log(parsedBody) })
  //   .catch((err) => { console.log('Error NSABot_api: ', err) })
})

/**
 * Message unpinned
 */
rtm.on(RTM_EVENTS.PIN_REMOVED, (pin_message) => {
  console.log('PIN_REMOVED')
  console.log(pin_message)
  // Might be more. Need to test
  // if(pin_message.item.type === 'message') p_id = pin_message.item.message.ts
  // if(pin_message.item.type === 'file') p_id = pin_message.item.file.id
  //
  // if(p_id in ['message', 'file']) {
  //   var options = formatOptions('DELETE', `pins/${p_id}/channels/${pin_message.channel_id}`, pin_message)

    // rp(options)
    //   .then((parsedBody) => { console.log(parsedBody) })
    //   .catch((err) => { console.log('Error NSABot_api: ', err) })
  // }
})

/**
 *  Channel Created
 */
rtm.on(RTM_EVENTS.CHANNEL_CREATED, (channel) => {
  console.log('CHANNEL_CREATED')
  console.log(channel)

  // var options = formatOptions('POST', 'channels', channel)

  // rp(options)
  //   .then((parsedBody) => { console.log(parsedBody) })
  //   .catch((err) => { console.log('Error NSABot_api: ', err) })
})

/**
 * NSABot joins channel
 */
rtm.on(RTM_EVENTS.CHANNEL_JOINED, (channel) => {
  console.log('CHANNEL_JOINED')
  console.log(channel)
  // var options = formatOptions('DELETE', 'channels', channel)
  //
  // rp(options)
  //   .then((parsedBody) => { console.log(parsedBody) })
  //   .catch((err) => { console.log('Error NSABot_api: ', err) })
})

/**
 * NSABot leaves channel
 */
rtm.on(RTM_EVENTS.CHANNEL_LEFT, (channel) => {
  console.log('CHANNEL_LEFT')
  console.log(channel)
  // var options = formatOptions('DELETE', 'channels', channel)

  // rp(options)
  //   .then((parsedBody) => { console.log(parsedBody) })
  //   .catch((err) => { console.log('Error NSABot_api: ', err) })
})

/**
 * Channel archived
 */
rtm.on(RTM_EVENTS.CHANNEL_ARCHIVE, (channel) => {
  console.log('CHANNEL_ARCHIVED')
  console.log(channel)
  // var channel_data = {
  //   'type': channel.type
  // }
  // var options = formatOptions('PUT', `channels/${channel.channel}`, channel_data)

  // rp(options)
  //   .then((parsedBody) => { console.log(parsedBody) })
  //   .catch((err) => { console.log('Error NSABot_api: ', err) })
})

/**
 * Channel Unarchived
 */
rtm .on(RTM_EVENTS.CHANNEL_UNARCHIVE, (channel) => {
  console.log('CHANNEL_UNARCHIVE')
  console.log(channel)
  // var channel_data = {
  //   'type': channel.type
  // }
  // var options = formatOptions('PUT', `channels/${channel.channel}`, channel_data)

  // rp(options)
  // .then((parsedBody) => { console.log(parsedBody) })
  // .catch((err) => { console.log(err) })
})

/**
 * Channel Deleted
 */
rtm.on(RTM_EVENTS.CHANNEL_DELETED, (channel) => {
  console.log('CHANNEL_DELETED')
  console.log(channel)

  // var options = formatOptions('DELETE', `channels/${channel.channel}`, channel)

  // rp(options)
  //   .then((parsedBody) => { console.log(parsedBody) })
  //   .catch((err) => { console.log('Error NSABot_api: ', err) })
})

/**
 * Channel Rename
 */
rtm.on(RTM_EVENTS.CHANNEL_RENAME, (channel) => {
  console.log('CHANNEL_RENAME')
  console.log(channel)
  // var channel_data = {
  //   'name': channel.channel.name
  // }
  // var options = formatOptions('PATCH', `channels/${channel.channel}`, channel_data)

  // rp(options)
  // .then((parsedBody) => { console.log(parsedBody) })
  // .catch((err) => { console.log(err) })
})

/**
 * File shared
 */
rtm.on(RTM_EVENTS.FILE_SHARED, (file) => {
  console.log('FILE_SHARED')
  console.log(file)
  // web.files.info(file.file_id, function teamInfoCb(err, info) {
  //   if (err) {
  //     console.log('Error connecting to web api:', err)
  //   } else {
  //     var options = formatOptions('POST', 'files', info.file)
  //
  //     rp(options)
  //       .then((parsedBody) => { console.log(parsedBody) })
  //       .catch((err) => { console.log('Error NSABot_api: ', err) })
  //   }
  // })
})

/**
 * File unshared
 */
rtm.on(RTM_EVENTS.FILE_UNSHARED, (file) => {
  console.log('FILE_UNSHARED')
  console.log(file)
  // var options = formatOptions('POST', 'files', file)

  // rp(options)
  //   .then((parsedBody) => { console.log(parsedBody) })
  //   .catch((err) => { console.log('Error NSABot_api: ', err) })
})

/**
 * File deleted
 */
rtm.on(RTM_EVENTS.FILE_DELETED, (file) => {
  console.log('FILE_DELETED')
  console.log(file)
  // var options = formatOptions('POST', 'files', file)

  // rp(options)
  //   .then((parsedBody) => { console.log(parsedBody) })
  //   .catch((err) => { console.log('Error NSABot_api: ', err) })
})

/**
 * File comment added
 */
rtm.on(RTM_EVENTS.FILE_COMMENT_ADDED, (file) => {
  console.log('FILE_COMMENT_ADDED')
  console.log(file)
  // var options = formatOptions('DELETE', 'files', file)

  // rp(options)
  //   .then((parsedBody) => { console.log(parsedBody) })
  //   .catch((err) => { console.log('Error NSABot_api: ', err) })
})

/**
 * New user joins team
 */
rtm.on(RTM_EVENTS.TEAM_JOIN, (user) => {
  console.log('TEAM_JOIN')
  console.log(user)
  // var options = formatOptions('POST', 'users', user.user)

  // rp(options)
  //   .then((parsedBody) => { console.log(parsedBody) })
  //   .catch((err) => { console.log('Error NSABot_api: ', err) })
})

/**
 * User changes account info
 */
rtm.on(RTM_EVENTS.USER_CHANGE, (user) => {
  console.log('USER_CHANGE')
  console.log(user)
  // var options = formatOptions('PUT', 'users', user.user)

  // rp(options)
  //   .then((parsedBody) => { console.log(parsedBody) })
  //   .catch((err) => { console.log('Error NSABot_api: ', err) })
})

/**
 * On Connect Send Message to slackboi channel
 */
rtm.on(RTM_CLIENT_EVENTS.RTM_CONNECTION_OPENED, function () {
  rtm.sendMessage('Connected', process.env.NSABOT_CHANNEL, function messageSent() {})
})

/*  Move all this over to some cool framework later  */
