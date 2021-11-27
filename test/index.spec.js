import { expect, beforeAll, test } from '@jest/globals'
import createKafkaTestHelper from '../src/index.js'
import { getKafka } from './_testUtils.js'

let i = 0
const randomString = prefix => {
  const random = new Date().toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..*/, '')

  const topic = `${random}_${prefix}_${i++}`

  return topic
}

let kafka

beforeAll(async () => {
  kafka = getKafka()
})

test('create KafkaTestHelper', async () => {
  const testTopic = randomString('topic')
  const topicHelper = await createKafkaTestHelper(kafka, testTopic)

  expect(typeof topicHelper).toBe('object')

  await topicHelper.ensureTopicExists()
  await topicHelper.ensureTopicDeleted()
})
