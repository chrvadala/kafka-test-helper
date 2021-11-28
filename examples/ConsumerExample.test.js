import { getKafka } from '../test/_testUtils.js'
import { test, jest, expect } from '@jest/globals'

import createKafkaTestHelper from '../src/index.js'
import { ConsumerExample } from './ConsumerExample'

test('ConsumerExample', async () => {
  // init Kafka Test helper
  const kafka = getKafka() // see https://kafka.js.org/docs/configuration
  const topicPrefix = Date.now() //  this avoids cross test interference
  const topicHelper = await createKafkaTestHelper(kafka, topicPrefix + 'test-topic')
  await topicHelper.ensureTopicExists()

  // init the module that has to be tested
  const controller = new ConsumerExample()
  await controller.setup(kafka, topicPrefix)

  // a way to intercepts when the controller has done (there could be other ways...)
  const waitMessage = () => new Promise(resolve => {
    controller.handleMessage = jest.fn()
      .mockImplementation(message => {
        resolve(message)
      })
  })

  // Kafka Test Helper publishes a message, serialized as JSON string
  await topicHelper.publishMessages([
    {
      json: {
        hello: 'world'
      }
    }
  ])

  // wait for post elaboration and validates output
  const message = await waitMessage()
  expect(message).toBe('{"hello":"world"}')
  await controller.destroy()
  await topicHelper.ensureTopicDeleted()
})
