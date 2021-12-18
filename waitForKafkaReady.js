import getKafka from './getKafka.js'

waitForKafkaReady()
  .then(console.log)
  .catch(console.error)

async function waitForKafkaReady (log = console.log) {
  const kafka = getKafka()

  const admin = kafka.admin()

  const connectionPromise = new Promise(resolve => {
    admin.on(admin.events.CONNECT, resolve)
  })

  log('waiting for Kafka ready...')
  await admin.connect()
  await connectionPromise
  await admin.describeCluster()
  await admin.disconnect()
  log('Kafka is ready')
}
