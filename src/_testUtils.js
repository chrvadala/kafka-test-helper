import { Kafka, logLevel } from 'kafkajs'

export function getKafka () {
  const KAFKA_SERVER = process.env.KAFKA_SERVER
  if (!KAFKA_SERVER) {
    console.error('KAFKA_SERVER environment variable not found')
    process.exit(1)
  }

  return new Kafka({
    clientId: 'tester',
    brokers: [KAFKA_SERVER],
    logLevel: logLevel.ERROR,
    retry: {
      restartOnFailure: async () => false
    }
  })
}
