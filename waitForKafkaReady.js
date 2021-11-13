import { Kafka } from 'kafkajs'

waitForKafkaReady()
  .then(console.log)
  .catch(console.error)

async function waitForKafkaReady (log = console.log) {
  const KAFKA_SERVER = process.env.KAFKA_SERVER
  if (!KAFKA_SERVER) {
    console.error('KAFKA_SERVER environment variable not found')
    process.exit(1)
  }

  const kafka = new Kafka({
    clientId: 'tester',
    brokers: [KAFKA_SERVER],
    retry: {
      retries: 10
    }
  })

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
