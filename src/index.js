import KafkaTestHelper from './KafkaTestHelper.js'

/**
   * Creates and returns an instance of KafkaTestHelper
   * @function createKafkaTestHelper
   * @param {Kafka} kafka - KafkaJS instance. See {@link https://kafka.js.org/docs/configuration}
   * @param {string} topic Topic that the helper is going to monitor
   * @returns {KafkaTestHelper}
   * @example
   * import { createKafkaTestHelper } from 'kafka-test-helper'
   *
   * test('your test', async () => {
   *  const kafka = getKafka() // see https://kafka.js.org/docs/configuration
   *  const topicPrefix = Date.now() //  this avoids cross test interference
   *  const topicHelper = await createKafkaTestHelper(kafka, topicPrefix + 'test-topic')
   *  //do your tests here
   * })
   */
export async function createKafkaTestHelper (kafka, topic) {
  return KafkaTestHelper.create(kafka, topic)
}
