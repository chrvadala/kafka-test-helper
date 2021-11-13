import { makePlaceholderMessages, isPlaceholderMessage, isPlaceholderMessageWithUUID } from './placeholder.js'

const GROUP_ID_PREFIX = 'kafka-test-helper-'
const CONSUMER_TIMEOUT_DEFAULTS = {
  sessionTimeout: 10_000,
  rebalanceTimeout: 12_000,
  heartbeatInterval: 500,
  maxWaitTimeInMs: 100
}

const random = () => Math.round(Math.random() * 100_000)

export default class KafkaTestHelper {
  constructor (kafka, topic) {
    this._kafka = kafka
    this._topic = topic
    this._initialTopicOffsets = [] // e.g. [ { partition: 0, offset: '0', high: '0', low: '0' } ]
  }

  async reset () {
    const admin = await this._getAdmin()

    if (await this._topicExists(admin)) {
      this._initialTopicOffsets = await admin.fetchTopicOffsets(this._topic)
    }
    await admin.disconnect()
  }

  async ensureTopicExists (timeout = null) {
    const admin = await this._getAdmin()

    if (!await this._topicExists(admin)) {
      await admin.createTopics({
        validateOnly: false,
        waitForLeaders: true,
        timeout: timeout || 5000,
        topics: [{
          topic: this._topic
        }]
      })
      await this.reset()
    }
    await admin.disconnect()
  }

  async ensureTopicDeleted (timeout = null) {
    const admin = await this._getAdmin()
    if (await this._topicExists(admin)) {
      await admin.deleteTopics({
        topics: [this._topic],
        timeout: timeout || 5000
      })
    }
    await admin.disconnect()
  }

  async messages () {
    const uuid = 'placeholder-' + random()
    const groupId = GROUP_ID_PREFIX + random()

    const partitions = this._initialTopicOffsets.length

    // produce messages
    const producer = this._kafka.producer()
    await producer.connect()
    await producer.send({
      topic: this._topic,
      messages: makePlaceholderMessages(uuid, partitions)
    })
    await producer.disconnect()

    // consume messages
    const messages = []
    const receivedPlaceholdersWithUUID = []
    const consumer = this._kafka.consumer({
      groupId,
      ...CONSUMER_TIMEOUT_DEFAULTS
    })
    await consumer.connect()
    await consumer.subscribe({ topic: this._topic, fromBeginning: false })
    consumer.run({
      eachMessage: ({ partition, message }) => {
        if (!isPlaceholderMessage(message)) {
          messages.push({
            partition,
            headers: message.headers,
            buffer: message.value,
            json: _tryToConvertBufferToJson(message.value),
            string: _tryToConvertBufferToString(message.value)
          })
        }

        if (isPlaceholderMessageWithUUID(message, uuid)) {
          receivedPlaceholdersWithUUID.push(message)
        }
      }
    })

    // reset cursor
    for (const initialPartitionCursor of this._initialTopicOffsets) {
      await consumer.seek({
        topic: this._topic,
        partition: initialPartitionCursor.partition,
        offset: initialPartitionCursor.offset
      })
    }

    // wait messages until placeholders
    await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (receivedPlaceholdersWithUUID.length >= partitions) {
          clearInterval(interval)
          consumer.pause()
          resolve()
        }
      }, 50)
    })

    await consumer.disconnect()
    return messages
  }

  async publishMessages (messages) {
    const txMessages = []
    let outcome
    for (const message of messages) {
      outcome = {
        value: message.buffer
      }
      if (message.string) outcome.value = message.string
      if (message.json) outcome.value = JSON.stringify(message.json)
      if (message.key) outcome.key = message.key
      if (message.partition) outcome.partition = message.partition
      txMessages.push(outcome)
    }

    const producer = this._kafka.producer()
    await producer.connect()
    await producer.send({
      topic: this._topic,
      messages: txMessages
    })
    await producer.disconnect()
  }

  async _getAdmin () {
    const admin = this._kafka.admin()
    await admin.connect()
    return admin
  }

  async _topicExists (admin) {
    const topics = await admin.listTopics()
    const exists = topics.includes(this._topic)
    return exists
  }
}

function _tryToConvertBufferToJson (buffer) {
  try {
    return JSON.parse(buffer.toString())
  } catch (e) {
    return null
  }
}

function _tryToConvertBufferToString (buffer) {
  try {
    return buffer.toString()
  } catch (e) {
    return null
  }
}
