import getKafka from '../getKafka.js'
import { describe, expect, it, beforeAll, afterAll } from '@jest/globals'
import KafkaTestHelper from '../src/KafkaTestHelper.js'

const CONSUMER_TIMEOUT_DEFAULTS = {
  sessionTimeout: 10_000,
  rebalanceTimeout: 12_000,
  heartbeatInterval: 500,
  maxWaitTimeInMs: 100
}

let kafka, admin

beforeAll(async () => {
  kafka = getKafka()

  admin = kafka.admin()
  await admin.connect()
})

afterAll(async () => {
  await admin.disconnect()
  admin = null
})

describe('create', () => {
  it('should create a KafkaTestHelper instance', async () => {
    const testTopic = randomString('topic')
    const topicHelper = await KafkaTestHelper.create(kafka, testTopic)

    expect(typeof topicHelper).toBe('object')

    expect(async () => {
      await topicHelper.ensureTopicExists()
      await topicHelper.ensureTopicDeleted()
    }).not.toThrow()
  })
})

describe('reset', () => {
  it('should construct and setup the component when topic exists', async () => {
    const testTopic = randomString('topic')

    await createTopic(testTopic)

    const helper = new KafkaTestHelper(kafka, testTopic)
    await helper.reset()
  })

  it('should construct and setup the component when topic does NOT exist', async () => {
    const testTopic = randomString('topic')
    const helper = new KafkaTestHelper(kafka, testTopic)
    await helper.reset()
  })
})

describe('ensureTopicExists', () => {
  it('should create a new topic', async () => {
    const testTopic = randomString('topic')

    const helper = new KafkaTestHelper(kafka, testTopic)

    await expect(admin.listTopics()).resolves
      .toEqual(expect.not.arrayContaining([testTopic]))

    await helper.ensureTopicExists()

    await expect(admin.listTopics()).resolves
      .toEqual(expect.arrayContaining([testTopic]))
  })

  it('should not fail, even if the topic already exists', async () => {
    const testTopic = randomString('topic')

    const helper = new KafkaTestHelper(kafka, testTopic)

    await createTopic(testTopic)

    await helper.ensureTopicExists()

    await expect(admin.listTopics()).resolves
      .toEqual(expect.arrayContaining([testTopic]))
  })
})

describe('ensureTopicDeleted', () => {
  it('should delete a topic', async () => {
    const testTopic = randomString('topic')

    await createTopic(testTopic)

    await expect(admin.listTopics()).resolves
      .toEqual(expect.arrayContaining([testTopic]))

    const helper = new KafkaTestHelper(kafka, testTopic)
    await helper.ensureTopicDeleted()

    await expect(admin.listTopics()).resolves
      .toEqual(expect.not.arrayContaining([testTopic]))
  })

  it('should not fail, even if the topic does not exist', async () => {
    const testTopic = randomString('topic')

    const helper = new KafkaTestHelper(kafka, testTopic)

    await expect(admin.listTopics()).resolves
      .toEqual(expect.not.arrayContaining([testTopic]))

    await helper.ensureTopicDeleted()
  })
})

describe('messages', () => {
  it('should return produced messages', async () => {
    const testTopic = randomString('topic')

    // emulate topic with some previous messages
    await produceMessages(testTopic, [
      { value: 'message-x' },
      { value: 'message-y' },
      { value: 'message-z' }
    ])

    // init lib
    const helper = new KafkaTestHelper(kafka, testTopic)
    await helper.reset()
    await expect(helper.messages()).resolves.toHaveLength(0)

    // wave 1
    await produceMessages(testTopic, [
      { value: 'message-1' },
      { value: 'message-2' },
      { value: 'message-3' }
    ])

    await expect(helper.messages()).resolves.toEqual([
      expect.objectContaining({ headers: {}, partition: 0, buffer: Buffer.from('message-1') }),
      expect.objectContaining({ headers: {}, partition: 0, buffer: Buffer.from('message-2') }),
      expect.objectContaining({ headers: {}, partition: 0, buffer: Buffer.from('message-3') })
    ])

    // wave 2
    await produceMessages(testTopic, [
      { value: 'message-4' },
      { value: 'message-5' }
    ])
    await expect(helper.messages()).resolves.toEqual([
      expect.objectContaining({ headers: {}, partition: 0, buffer: Buffer.from('message-1') }),
      expect.objectContaining({ headers: {}, partition: 0, buffer: Buffer.from('message-2') }),
      expect.objectContaining({ headers: {}, partition: 0, buffer: Buffer.from('message-3') }),
      expect.objectContaining({ headers: {}, partition: 0, buffer: Buffer.from('message-4') }),
      expect.objectContaining({ headers: {}, partition: 0, buffer: Buffer.from('message-5') })
    ])
  })

  it('should return produced messages, even in the context of a commited transaction', async () => {
    const testTopic = randomString('topic')

    // emulate topic with some previous messages
    await produceMessages(testTopic, [
      { value: 'message-x' },
      { value: 'message-y' },
      { value: 'message-z' }
    ])

    // init lib
    const helper = new KafkaTestHelper(kafka, testTopic)
    await helper.reset()
    await expect(helper.messages()).resolves.toHaveLength(0)

    // create transaction and commit
    const producer = kafka.producer({ transactionalId: 'tx-test123' })
    await producer.connect()
    const transaction = await producer.transaction()
    await transaction.send({
      topic: testTopic,
      messages: [
        { value: 'message-1' },
        { value: 'message-2' },
        { value: 'message-3' }
      ]
    })
    await transaction.commit()
    await producer.disconnect()

    // verify
    await expect(helper.messages()).resolves.toEqual([
      expect.objectContaining({ headers: {}, partition: 0, buffer: Buffer.from('message-1') }),
      expect.objectContaining({ headers: {}, partition: 0, buffer: Buffer.from('message-2') }),
      expect.objectContaining({ headers: {}, partition: 0, buffer: Buffer.from('message-3') })
    ])
  })

  it('should return produced messages, even in the context of an aborted transaction', async () => {
    const testTopic = randomString('topic')

    // emulate topic with some previous messages
    await produceMessages(testTopic, [
      { value: 'message-x' },
      { value: 'message-y' },
      { value: 'message-z' }
    ])

    // init lib
    const helper = new KafkaTestHelper(kafka, testTopic)
    await helper.reset()
    await expect(helper.messages()).resolves.toHaveLength(0)

    // create transaction and abort
    const producer = kafka.producer({ transactionalId: 'tx-test123' })
    await producer.connect()
    const transaction = await producer.transaction()
    await transaction.send({
      topic: testTopic,
      messages: [
        { value: 'message-1' },
        { value: 'message-2' },
        { value: 'message-3' }
      ]
    })
    await transaction.abort()
    await producer.disconnect()

    // verify
    await expect(helper.messages()).resolves.toHaveLength(0)
  })

  it('should work even with multiple partitions', async () => {
    const testTopic = randomString('topic')

    // emulate topic with some previous messages
    await createTopic(testTopic, 8, 1)
    await produceMessages(testTopic, [
      { value: 'message-x' },
      { value: 'message-y' },
      { value: 'message-z' }
    ])

    // init lib
    const helper = new KafkaTestHelper(kafka, testTopic)
    await helper.reset()
    await expect(helper.messages()).resolves.toHaveLength(0)

    // wave 1
    await produceMessages(testTopic, [
      { value: 'message-1' },
      { value: 'message-2' },
      { value: 'message-3' }
    ])

    const messages1 = await helper.messages()
    expect(messages1).toHaveLength(3)
    expect(messages1).toEqual(expect.arrayContaining([
      expect.objectContaining({ headers: {}, partition: expect.any(Number), buffer: Buffer.from('message-1') }),
      expect.objectContaining({ headers: {}, partition: expect.any(Number), buffer: Buffer.from('message-2') }),
      expect.objectContaining({ headers: {}, partition: expect.any(Number), buffer: Buffer.from('message-3') })
    ]))

    // wave 2
    await produceMessages(testTopic, [
      { value: 'message-4' },
      { value: 'message-5' }
    ])
    const messages2 = await helper.messages()
    expect(messages2).toHaveLength(5)
    expect(messages2).toEqual(expect.arrayContaining([
      expect.objectContaining({ headers: {}, partition: expect.any(Number), buffer: Buffer.from('message-1') }),
      expect.objectContaining({ headers: {}, partition: expect.any(Number), buffer: Buffer.from('message-2') }),
      expect.objectContaining({ headers: {}, partition: expect.any(Number), buffer: Buffer.from('message-3') }),
      expect.objectContaining({ headers: {}, partition: expect.any(Number), buffer: Buffer.from('message-4') }),
      expect.objectContaining({ headers: {}, partition: expect.any(Number), buffer: Buffer.from('message-5') })
    ]))
  })

  it('should decode json and string', async () => {
    const testTopic = randomString('topic')

    // emulate topic with some previous messages
    await produceMessages(testTopic, [
      { value: 'message-x' },
      { value: 'message-y' },
      { value: 'message-z' }
    ])

    // init lib
    const helper = new KafkaTestHelper(kafka, testTopic)
    await helper.reset()
    await expect(helper.messages()).resolves.toHaveLength(0)

    // wave 1
    await produceMessages(testTopic, [
      { value: JSON.stringify({ bar: 42 }) },
      { value: 'hellohello' },
      { value: 'not_a_{{{{_json' },
      { value: Buffer.from([0x1, 0x2, 0x3, 0x4, 0x5]) }
    ])

    const messages1 = await helper.messages()
    expect(messages1).toHaveLength(4)
    expect(messages1).toEqual([
      expect.objectContaining({ json: { bar: 42 } }),
      expect.objectContaining({ string: 'hellohello', json: null }),
      expect.objectContaining({ string: 'not_a_{{{{_json', json: null }),
      expect.objectContaining({ buffer: Buffer.from([0x1, 0x2, 0x3, 0x4, 0x5]) })
    ])
  })
})

describe('publishMessages', () => {
  it('should populate a topic', async () => {
    const testTopic = randomString('topic')
    const groupId = randomString('group')
    await createTopic(testTopic, 4)

    const json = { json: { hello: 42, ciao: 42 } }
    const string = { string: 'hello_42' }
    const buffer = { buffer: Buffer.from([0x1, 0x2, 0x3, 0x4, 0x5]) }
    const advancedKafkaFeatures = { key: 'key123', partition: 1, buffer: Buffer.from([0x42]) }

    const messages = [
      json,
      string,
      buffer,
      advancedKafkaFeatures
    ]

    const helper = new KafkaTestHelper(kafka, testTopic)
    await helper.reset()
    await helper.publishMessages(messages)

    // download messages
    const recvMessages = []
    const consumer = kafka.consumer({
      groupId,
      ...CONSUMER_TIMEOUT_DEFAULTS
    })
    await consumer.connect()
    await consumer.subscribe({ topic: testTopic, fromBeginning: true })
    await new Promise((resolve) => {
      consumer.run({
        eachMessage: ({ partition, message }) => {
          recvMessages.push({
            partition,
            key: message.key,
            headers: message.headers,
            value: message.value
          })
          if (recvMessages.length >= messages.length) resolve()
        }
      })
    })

    // verify
    expect(recvMessages).toHaveLength(messages.length)
    expect(recvMessages).toEqual(expect.arrayContaining([
      {
        partition: expect.any(Number),
        key: null,
        headers: expect.any(Object),
        value: Buffer.from(JSON.stringify({ hello: 42, ciao: 42 }))
      },
      {
        partition: expect.any(Number),
        key: null,
        headers: expect.any(Object),
        value: Buffer.from('hello_42')
      },
      {
        partition: expect.any(Number),
        key: null,
        headers: expect.any(Object),
        value: Buffer.from([0x1, 0x2, 0x3, 0x4, 0x5])
      },
      {
        key: Buffer.from('key123'),
        partition: 1,
        headers: expect.any(Object),
        value: Buffer.from([0x42])
      }
    ]))

    await consumer.disconnect()
  })
})

let i = 0
const randomString = prefix => {
  const random = new Date().toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..*/, '')

  const topic = `${random}_${prefix}_${i++}`

  return topic
}

const createTopic = async (topic, numPartitions = 1, replicationFactor = 1) => {
  await admin.createTopics({
    validateOnly: false,
    waitForLeaders: true,
    topics: [{
      topic,
      numPartitions,
      replicationFactor
    }]
  })
}

const produceMessages = async (topic, messages) => {
  const producer = kafka.producer()
  await producer.connect()
  await producer.send({
    topic,
    messages
  })
  await producer.disconnect()
}
