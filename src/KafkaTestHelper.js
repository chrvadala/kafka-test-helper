import { makePlaceholderMessages, isPlaceholderMessage, isPlaceholderMessageWithUUID } from './placeholder.js'
import { randomNumber, tryToConvertBufferToJson, tryToConvertBufferToString } from './utils.js'

const GROUP_ID_PREFIX = 'kafka-test-helper-'
const CONSUMER_TIMEOUT_DEFAULTS = {
  sessionTimeout: 10_000,
  rebalanceTimeout: 12_000,
  heartbeatInterval: 500,
  maxWaitTimeInMs: 100
}

/**
 * @classdesc KafkaTestHelper is the class that helps you interacting with Apache Kafka
 * @class KafkaTestHelper
 * @see You can construct a KafkaTestHelper instancevia {@link createKafkaTestHelper} method
 */
class KafkaTestHelper {
  constructor (kafka, topic) {
    this._kafka = kafka
    this._topic = topic
    this._initialTopicOffsets = [] // e.g. [ { partition: 0, offset: '0', high: '0', low: '0' } ]
  }

  /**
   * @desc Creates and returns an instance of KafkaTestHelper
   * @ignore
   * @static
   * @param {Kafka} kafka KafkaJS instance
   * @param {string} topic Topic that this helper is going to monitor
   * @returns {KafkaTestHelper}
   */
  static async create (kafka, topic) {
    const helper = new KafkaTestHelper(kafka, topic)
    await helper.reset()
    return helper
  }

  /**
   * @desc Resets the helper to the current offset
   * @example await helper.reset()
   */
  async reset () {
    const admin = await this._getAdmin()

    if (await this._topicExists(admin)) {
      this._initialTopicOffsets = await admin.fetchTopicOffsets(this._topic)
    }
    await admin.disconnect()
  }

  /**
   * Creates a topic if doesn't exist
   * @param {number} [timeout = 5000] - Timeout in ms
   * @example await helper.ensureTopicExists()
   */
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

  /**
   * Deletes a topic if exists
   * @param {number} [timeout = 5000] - Timeout in ms
   * @example await helper.ensureTopicDeleted()
   */
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

  /**
   * @typedef {Object} ConsumedMessage
   * @property {Object} headers - Object with headers
   * @property {number} partition - Partition number
   * @property {Buffer} buffer - Buffer with message
   * @property {Object} json - Object with message
   * @property {string} string - String with message
   */

  /**
   * Returns a list of messages published to the topic from last helper reset
   * @returns {ConsumedMessage[]}
   * @example const msgs = await helper.messages()
   * [
   *  {
   *     headers: {}
   *     partition: 0,
   *     buffer: <Buffer 7b 22 62 61 72 22 3a 34 32 7d>,
   *     json: { "bar": 42 },
   *     string: '{"bar":42}',
   *  },
   *  ...
   * ]
   */
  async messages () {
    const uuid = 'placeholder-' + randomNumber()
    const groupId = GROUP_ID_PREFIX + randomNumber()

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
            json: tryToConvertBufferToJson(message.value),
            string: tryToConvertBufferToString(message.value)
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

  /**
   * @typedef {Object} ProducibleMessage
   * @property {number} partition - Partition number
   * @property {string} key - Message key
   * @property {Buffer} buffer - Message value as Buffer
   * @property {Object} json - Message value as object and serialized with JSON.stringify()
   * @property {string} string - Message value as string
   */

  /**
   * Publishes a list of messages to the topic
   * @param {ProducibleMessage[]} messages - List of messages to publish
   *
   * @example
   * await helper.publishMessages([
   *  {
   *    partition: 0,
   *    key: 'key1',
   *    string: "hello world",
   *  },
   * ...
   * ])
   *
   * @example
   * await helper.publishMessages([
   *  {
   *    partition: 0,
   *    key: 'key1',
   *    json: { "foo": "bar" },
   *  },
   * ...
   * ])
   *
   * @example
   * await helper.publishMessages([
   *  {
   *    partition: 0,
   *    key: 'key1',
   *    buffer: Buffer.from('hello world')
   *  },
   * ...
   * ])

   */
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

  /**
   * Gets the admin client
   * @ignore
   * @returns {Kafka.Admin}
   */
  async _getAdmin () {
    const admin = this._kafka.admin()
    await admin.connect()
    return admin
  }

  /**
   * Validates if the topic exists
   * @ignore
   * @param {Kafka.Admin} Kafka admin client
   * @returns {boolean}
   */
  async _topicExists (admin) {
    const topics = await admin.listTopics()
    const exists = topics.includes(this._topic)
    return exists
  }
}

export default KafkaTestHelper
