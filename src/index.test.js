import { expect, beforeAll, test } from '@jest/globals'
import kafkaTestHelper from './index.js'
import { Kafka, logLevel } from 'kafkajs'

const KAFKA_SERVER = process.env.KAFKA_SERVER
if (!KAFKA_SERVER) {
  console.error('KAFKA_SERVER environment variable not found')
  process.exit(1)
}

const random = () => Math.round(Math.random() * 100_000)

let kafka

beforeAll(async () => {
  kafka = new Kafka({
    clientId: 'tester',
    brokers: [KAFKA_SERVER],
    logLevel: logLevel.ERROR,
    retry: {
      restartOnFailure: async () => false
    }
  })
})

test('index', async () => {
  const testTopic = 'topic' + random()
  const topicHelper = await kafkaTestHelper(kafka, testTopic)

  expect(typeof topicHelper).toBe('object')

  await topicHelper.ensureTopicExists()
  await topicHelper.ensureTopicDeleted()
})
