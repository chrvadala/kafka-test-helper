import createKafkaTestHelper from '../src/index.js' // kafka-test-helper
import { test, expect } from '@jest/globals'
import getKafka from '../getKafka.js'
import { ProducerExample } from './ProducerExample'

test('ProducerExample', async () => {
  // init Kafka Test helper
  const kafka = getKafka() // see https://kafka.js.org/docs/configuration
  const topicPrefix = Date.now() //  this avoids cross test interference
  const topicHelper = await createKafkaTestHelper(kafka, topicPrefix + '_something_happened')
  await topicHelper.ensureTopicExists()

  // init the module that has to be tested
  const controller = new ProducerExample()
  await controller.setup(kafka, topicPrefix)

  const record = {
    name: 'Mario',
    surname: 'Rossi'
  }

  await controller.doSomething(record)

  // Kafka Test Helper retrieves published messages
  const messages = await topicHelper.messages()
  expect(messages).toHaveLength(1)
  expect(messages[0].json).toEqual({
    operation: 'doSomething',
    record
  })

  // OR
  expect(messages[0].string).toEqual(JSON.stringify({
    operation: 'doSomething',
    record
  }))

  // OR
  expect(messages[0].buffer).toEqual(Buffer.from(JSON.stringify({
    operation: 'doSomething',
    record
  })))

  // OR
  expect(messages).toEqual([
    expect.objectContaining({
      json: {
        operation: 'doSomething',
        record
      }
    })
  ])

  // destroy
  await controller.destroy()
  await topicHelper.ensureTopicDeleted()
})
