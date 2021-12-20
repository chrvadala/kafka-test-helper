# kafka-test-helper

Kafka test helper is a Node.js library that helps you writing integration tests that interacts with Apache Kafka.

[![chrvadala](https://img.shields.io/badge/website-chrvadala-orange.svg)](https://chrvadala.github.io)
[![Test](https://github.com/chrvadala/kafka-test-helper/workflows/Test/badge.svg)](https://github.com/chrvadala/node-ble/actions)
[![Coverage Status](https://coveralls.io/repos/github/chrvadala/kafka-test-helper/badge.svg)](https://coveralls.io/github/chrvadala/kafka-test-helper)
[![npm](https://img.shields.io/npm/v/kafka-test-helper.svg?maxAge=2592000?style=plastic)](https://www.npmjs.com/package/kafka-test-helper)
[![Downloads](https://img.shields.io/npm/dm/kafka-test-helper.svg)](https://www.npmjs.com/package/kafka-test-helper)
[![Donate](https://img.shields.io/badge/donate-PayPal-green.svg)](https://www.paypal.me/chrvadala/25)


# Features 
This library can:
- read events published on a topic 
- publish events on a channel or a specific partition
- create/delete topic on the fly

Kafka test helper is able to work both with independent messages and messages managed in the context of a transaction (commited or aborted).
You can use Kafka test helper in conjunction with your preferred testing library, because it is compatible with jest, mocha, tap and so on..., by the way it's agnostic by test runners.

# Documentation
- [Architecture](https://github.com/chrvadala/kafka-test-helper/blob/main/docs/architecture.md)
- [APIs](https://github.com/chrvadala/kafka-test-helper/blob/main/docs/api.md)

# Install
```sh
npm install kafka-test-helper
```
# Examples

## Testing a producer
Full source code available here: [ProducerExample.test.js](https://github.com/chrvadala/kafka-test-helper/blob/main/examples/ProducerExample.test.js) and [ProducerExample.js](https://github.com/chrvadala/kafka-test-helper/blob/main/examples/ProducerExample.js)
````javascript
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
    name: 'Tony',
    surname: 'Stark'
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
````

## Testing a consumer
Full source code available here: [ConsumerExample.test.js](https://github.com/chrvadala/kafka-test-helper/blob/main/examples/ConsumerExample.test.js) and [ConsumerExample.js](https://github.com/chrvadala/kafka-test-helper/blob/main/examples/ConsumerExample.js)
````javascript
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
````

# Changelog
- **0.x** - Beta version

# Contributors
- [chrvadala](https://github.com/chrvadala) (author)

# References
- https://cwiki.apache.org/confluence/display/KAFKA/KIP-98+-+Exactly+Once+Delivery+and+Transactional+Messaging
- https://kafka.apache.org/documentation
- https://github.com/edenhill/kcat#examples
