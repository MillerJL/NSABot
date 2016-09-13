import config from 'config'
import bodyParser from 'body-parser'
import rp from 'request-promise'
import slackClient from '@slack/client'
import cloneDeep from 'clone-deep'
import { RtmClient, RTM_EVENTS, RTM_MESSAGE_SUBTYPES, CLIENT_EVENTS, MemoryDataStore, WebClient } from '@slack/client'
const RTM_CLIENT_EVENTS = CLIENT_EVENTS.RTM
const token = config.get('slackToken') || ''
const web = new WebClient(token)
const rtm = new RtmClient(token, {
  logLevel: 'error',
  dataStore: new MemoryDataStore()
})

class Request {
  constructor (options = {}) {
    const {
      method = null,
      uri = config.get('apiHost'),
      body = {}
    } = options

    this.method = method
    this.uri = config.get('apiHost') + ((uri != null) ? this.setUri(uri) : '')
    this.body = body
    this.json = true
  }

  POST (options = {}) {
    const {
      uri = this.uri,
      body = this.body
    } = options

    if(this.uri !== uri)
      this.uri += this.setUri(uri)
    this.body = body
    this.method = 'POST'

    return rp(this)
  }

  PATCH (options = {}) {
    const {
      uri = this.uri,
      body = this.body
    } = options

    if(this.uri !== uri)
      this.uri += this.setUri(uri)
    this.body = body
    this.method = 'PATCH'

    return rp(this)
  }

  PUT (options = {}) {
    const {
      uri = this.uri,
      body = this.body
    } = options

    if(this.uri !== uri)
      this.uri += this.setUri(uri)
    this.body = body
    this.method = 'PUT'

    return rp(this)
  }

  DELETE (options = {}) {
    const {
      uri = this.uri,
      body = this.body
    } = options

    if(this.uri !== uri)
      this.uri += this.setUri(uri)
    this.body = body
    this.method = 'DELETE'

    return rp(this)
  }

  GET (options = {}) {
    const {
      uri = this.uri,
      body = this.body
    } = options

    if(this.uri !== uri)
      this.uri += this.setUri(uri)
    this.body = body
    this.method = 'GET'

    return rp(this)
  }

  setUri (uri) {
    let newUri = ''
    const paths = { msg: 'messages', chnl: 'channels', user: 'users',
                    rct: 'reactions', fil: 'files' }

    for(let k in uri) {
      if (uri.hasOwnProperty(k) && typeof paths[k] !== 'undefined')
        newUri += '/' + paths[k] + ((uri[k]) ? '/' + uri[k] : '')
    }
    return newUri
  }
}

/**
 * Performs request based off message subtype. Also inserts message if necessary.
 */
function messageSubTypes (args = {}) {
  const {
    subtype = 'default',
    body
  } = args

  console.log(subtype);

  const requests = []
  let store_message = true

  const subtypes = {
    'message_changed': function () {
      store_message = false

      if(typeof body.message.subtype === 'undefined')
        return new Request({
          uri: { msg: body.message.ts, chnl: body.channel },
          body: {
            message_history: body.previous_message,
            message: {
              text: body.message.text,
              edited: body.message.edited
            }
          }
        }).PATCH()
    },
    'message_deleted': function () {
      store_message = false
      return
    },
    'channel_join': function () {
      return new Request({
        uri: { chnl: body.channel, user: body.user },
        body: {}
      }).PATCH()
    },
    'channel_leave': function () {
      return new Request({
        uri: { chnl: body.channel, user: body.user },
        body: {}
      }).DELETE()
    },
    'channel_topic': function () {
      return new Request({
        uri: { chnl: body.channel },
        body: {
          topic: {
            value: body.topic,
            creator: body.user,
            last_set: parseInt(body.ts.substring(0, body.ts.indexOf('.')))
          }
        }
      }).PATCH()
    },
    'channel_purpose': function () {
      return new Request({
        uri: { chnl: body.channel },
        body: {
          purpose: {
            value: body.purpose,
            creator: body.user,
            last_set: parseInt(body.ts.substring(0, body.ts.indexOf('.')))
          }
        }
      }).PATCH()
    },
    'channel_name': function () {
      // Probably not really necessary
      return
    },
    'file_share': function () {
      const clonebody = cloneDeep(body.file)
      clonebody.ts = body.ts

      return new Request({
        uri: { fil: null },
        body: clonebody
      }).POST()
    },
    'default': function () {
      let formattedMessage = body
      formattedMessage.message_history = []

      return new Request({
        uri: { msg: null },
        body: formattedMessage,
      }).POST()
    }
  }

  requests.push(subtypes[subtype]())
  if(store_message && subtype !== 'default')
    requests.push(subtypes['default']())

  return requests
}


rtm.start()

/**
 * Message Received. Possible subtype event as well.
 */
rtm.on(RTM_EVENTS.MESSAGE, async (msg) => {
  console.log("MESSAGE", msg)

  try {
    const result = await Promise.all(messageSubTypes({
      subtype: msg.subtype || 'default',
      body: msg
    }))

    console.log(result);
  } catch (err) {
    console.log('NSABOT_api: ', err);
  }
})

/**
 * reaction added
 */
rtm.on(RTM_EVENTS.REACTION_ADDED, async (msg) => {
  console.log('REACTION_ADDED');
  console.log(msg);

  const request = new Request({
    body: {
      user: msg.user,
      reaction: msg.reaction,
      ts: msg.event_ts,
      item_user: msg.item_user
    }
  })

  try {
    let result = {}

    if(msg.item.type === 'message')
      result = await request.PATCH({
        uri: { rct: null, msg: msg.item.ts, chnl: msg.item.channel },
      })
    else if(msg.item.type === 'file')
      result = await request.PATCH({
        uri: { rct: null, fil: msg.item.file }
      })

    console.log(result)
  } catch(err) {
    console.log('NSABot_api: ', err)
  }
})

/**
 * reaction removed
 */
rtm.on(RTM_EVENTS.REACTION_REMOVED, async (msg) => {
  console.log('REACTION_REMOVED');
  console.log(msg);

  const request = new Request({
    body: {
      user: msg.user,
      reaction: msg.reaction,
      ts: msg.event_ts
    }
  })

  try {
    let result = {}

    if(msg.item.type === 'message')
      result = await request.DELETE({
        uri: { rct: null, msg: msg.item.ts, chnl: msg.item.channel }
      })
    else if(msg.item.type === 'file')
      result = await request.DELETE({
        uri: { rct: null, fil: msg.item.file }
      })

    console.log(result)
  } catch(err) {
    console.log('Error NSABot_api: ', err)
  }
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
rtm.on(RTM_EVENTS.CHANNEL_CREATED, async (channel) => {
  console.log('CHANNEL_CREATED')
  console.log(channel)
  const channelMessage = channel.channel
  channelMessage.event_ts = channel.event_ts

  try {
    const result = await new Request({
      uri: { chnl: null },
      body: channelMessage
    }).POST()

    console.log(result)
  } catch (err) {
    console.log('Error NSABot_api: ', err)
  }
})

/**
 * NSABot joins channel
 */
rtm.on(RTM_EVENTS.CHANNEL_JOINED, async (channel) => {
  console.log('CHANNEL_JOINED')
  console.log(channel)

  // Send update channel request. Will update or create channel nsabot joins
  // Get all available messages in channel
  // "channel" should have all channel info.

  try {
    const result = await new Request({
      uri: { chnl: channel.channel.id },
      body: channel.channel
    }).PUT()

    console.log(result)
  } catch (err) {
    console.log(err)
  }
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
rtm.on(RTM_EVENTS.CHANNEL_RENAME, async (channel) => {
  console.log('CHANNEL_RENAME')
  console.log(channel)

  try {
    const result = await new Request({
      uri: { chnl: channel.channel.id },
      body: {
        name: channel.channel.name
      }
    }).PATCH()

    console.log(result)
  } catch (err) {
    console.log(err)
  }
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
  rtm.sendMessage('Connected', config.get('logChannelId'), function messageSent() {})
})

/*  Move all this over to some cool framework later  */
