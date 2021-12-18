export class ProducerExample {
  async setup (kafka, topicPrefix) {
    const producer = kafka.producer()
    await producer.connect()

    this.kafka = kafka
    this.topicPrefix = topicPrefix
    this.producer = producer
  }

  async doSomething (record) {
    await this.producer.send({
      topic: this.topicPrefix + '_something_happened',
      messages: [
        {
          value: JSON.stringify(
            {
              operation: 'doSomething',
              record
            })
        }
      ]
    })
  }

  async destroy () {
    const producer = this.producer
    this.kakfa = null
    this.topicPrefix = null
    this.producer = null
    await producer.disconnect()
  }
}
