import { Kafka, logLevel } from 'kafkajs'

export default function getKafka () {
  const KAFKA_SERVER = process.env.KAFKA_SERVER
  if (!KAFKA_SERVER) {
    console.error('KAFKA_SERVER environment variable not found (e.g. KAFKA_SERVER=localhost:9092)')
    process.exit(1)
  }

  let logLevelConf = logLevel.INFO

  if (process.env.NODE_ENV === 'test') {
    logLevelConf = logLevel.NOTHING
  }

  return new Kafka({
    clientId: 'kafka-test-helper',
    brokers: [KAFKA_SERVER],
    logLevel: logLevelConf,
    retry: {
      restartOnFailure: async () => false,
      retries: 10
    }
  })
}
