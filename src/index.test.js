import { expect, beforeAll, test } from '@jest/globals'
import kafkaTestHelper from './index.js'
import {getKafka} from './_testUtils.js'

const random = () => Math.round(Math.random() * 100_000)

let kafka

beforeAll(async () => {
  kafka = getKafka()
})

test('index', async () => {
  const testTopic = 'topic' + random()
  const topicHelper = await kafkaTestHelper(kafka, testTopic)

  expect(typeof topicHelper).toBe('object')

  await topicHelper.ensureTopicExists()
  await topicHelper.ensureTopicDeleted()
})
