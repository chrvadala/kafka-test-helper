import KafkaTestHelper from './KafkaTestHelper.js'

export default async function initKafkaTestHelper (kafka, topic) {
  const helper = new KafkaTestHelper(kafka, topic)
  await helper.reset()
  return helper
}
