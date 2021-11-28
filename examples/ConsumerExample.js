const CONSUMER_TIMEOUT_DEFAULTS = {
  sessionTimeout: 10_000,
  rebalanceTimeout: 12_000,
  heartbeatInterval: 500,
  maxWaitTimeInMs: 100
}

export class ConsumerExample {
  async setup (kafka, topicPrefix) {
    const consumer = kafka.consumer({ groupId: 'test-group', ...CONSUMER_TIMEOUT_DEFAULTS })

    await consumer.connect()
    await consumer.subscribe({ topic: topicPrefix + 'test-topic', fromBeginning: true })

    await consumer.run({
      eachMessage: async ({ message }) => {
        await this.handleMessage(message.value.toString())
      }
    })

    this.kafka = kafka
    this.consumer = consumer
  }

  async handleMessage (message) {
    // console.log(message)
  }

  async destroy () {
    await this.consumer.disconnect()
    this.consumer = null
    this.kakfa = null
  }
}
