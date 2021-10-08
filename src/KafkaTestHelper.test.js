import { describe, expect, it, beforeAll, afterAll } from '@jest/globals'
import { Kafka, logLevel } from 'kafkajs'
import { KafkaTestHelper } from './KafkaTestHelper.js'

const KAFKA_SERVER = process.env.KAFKA_SERVER
if (!KAFKA_SERVER) {
  console.error('KAFKA_SERVER environment variable not found')
  process.exit(1)
}

let kafka, admin

beforeAll(async () => {
  kafka = new Kafka({
    clientId: 'tester',
    brokers: [KAFKA_SERVER],
    logLevel: logLevel.ERROR,
    retry: {
      restartOnFailure: async () => false
    }
  })

  admin = kafka.admin()
  await admin.connect()
})

afterAll(async () => {
  await admin.disconnect()
  admin = null
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
      { headers: {}, partition: 0, value: Buffer.from('message-1') },
      { headers: {}, partition: 0, value: Buffer.from('message-2') },
      { headers: {}, partition: 0, value: Buffer.from('message-3') }
    ])

    // wave 2
    await produceMessages(testTopic, [
      { value: 'message-4' },
      { value: 'message-5' }
    ])
    await expect(helper.messages()).resolves.toEqual([
      { headers: {}, partition: 0, value: Buffer.from('message-1') },
      { headers: {}, partition: 0, value: Buffer.from('message-2') },
      { headers: {}, partition: 0, value: Buffer.from('message-3') },
      { headers: {}, partition: 0, value: Buffer.from('message-4') },
      { headers: {}, partition: 0, value: Buffer.from('message-5') }
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
      { headers: {}, partition: 0, value: Buffer.from('message-1') },
      { headers: {}, partition: 0, value: Buffer.from('message-2') },
      { headers: {}, partition: 0, value: Buffer.from('message-3') }
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
    await expect(messages1).toHaveLength(3)
    await expect(messages1).toEqual(expect.arrayContaining([
      { headers: {}, partition: expect.any(Number), value: Buffer.from('message-1') },
      { headers: {}, partition: expect.any(Number), value: Buffer.from('message-2') },
      { headers: {}, partition: expect.any(Number), value: Buffer.from('message-3') }
    ]))

    // wave 2
    await produceMessages(testTopic, [
      { value: 'message-4' },
      { value: 'message-5' }
    ])
    const messages2 = await helper.messages()
    await expect(messages2).toHaveLength(5)
    await expect(messages2).toEqual(expect.arrayContaining([
      { headers: {}, partition: expect.any(Number), value: Buffer.from('message-1') },
      { headers: {}, partition: expect.any(Number), value: Buffer.from('message-2') },
      { headers: {}, partition: expect.any(Number), value: Buffer.from('message-3') },
      { headers: {}, partition: expect.any(Number), value: Buffer.from('message-4') },
      { headers: {}, partition: expect.any(Number), value: Buffer.from('message-5') }
    ]))
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
