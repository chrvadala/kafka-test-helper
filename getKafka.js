import { Kafka, logLevel } from 'kafkajs'

export default function getKafka () {
  const KAFKA_SERVER = process.env.KAFKA_SERVER
  if (!KAFKA_SERVER) {
    console.error('KAFKA_SERVER environment variable not found (e.g. KAFKA_SERVER=localhost:9092)')
    process.exit(1)
  }

  return new Kafka({
    clientId: 'kafka-test-helper',
    brokers: [KAFKA_SERVER],
    logLevel: logLevel.ERROR,
    retry: {
      restartOnFailure: async () => false,
      retries: 10
    }
  })
}
