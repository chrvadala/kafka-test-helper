import { makePlaceholderMessages, isPlaceholderMessage, isPlaceholderMessageWithUUID } from './placeholder.js'

const PARTITION_COUNT_DIFFERENCE_ERROR = "The number of partion can't change after setup()"
const TOPIC_NOT_INITIALIZED = "This topic has not been initialized. Please call ensureTopic()"
const GROUP_NOT_INITIALIZED = "This consumer has not been initialized. Please call ensureTopic()"


const GROUP_ID_PREFIX = 'kafka-test-helper-'
const CONSUMER_TIMEOUT_DEFAULTS = {
    sessionTimeout: 10_000,
    rebalanceTimeout: 12_000,
    heartbeatInterval: 500,
    maxWaitTimeInMs: 100,
}

const random = () => Math.round(Math.random() * 100_000)

export class KafkaTestHelper {
    #kafka; #topic;

    #initialTopicOffsets = []; //e.g. [ { partition: 0, offset: '0', high: '0', low: '0' } ]

    constructor(kafka, topic) {
        this.#kafka = kafka;
        this.#topic = topic;
    }

    async reset() {
        const admin = await this.#getAdmin()

        if (await this.#topicExists(admin)) {
            this.#initialTopicOffsets = await admin.fetchTopicOffsets(this.#topic)
        }
        await admin.disconnect()
    }

    async ensureTopicExists(timeout = null) {
        const admin = await this.#getAdmin()

        if (!await this.#topicExists(admin)) {
            await admin.createTopics({
                validateOnly: false,
                waitForLeaders: true,
                timeout: timeout ? timeout : 5000,
                topics: [{
                    topic: this.#topic,
                }],
            })
        }
        await admin.disconnect()
    }

    async ensureTopicDeleted(timeout = null) {
        const admin = await this.#getAdmin()
        if (await this.#topicExists(admin)) {
            await admin.deleteTopics({
                topics: [this.#topic],
                timeout: timeout ? timeout : 5000,
            })
        }
        await admin.disconnect()
    }

    async messages() {
        const uuid = 'placeholder-' + random()
        const groupId = GROUP_ID_PREFIX + random()

        const partitions = this.#initialTopicOffsets.length

        //produce messages
        const producer = this.#kafka.producer()
        await producer.connect()
        await producer.send({
            topic: this.#topic,
            messages: makePlaceholderMessages(uuid, partitions),
        })
        await producer.disconnect()


        //consume messages
        let messages = []
        let receivedPlaceholdersWithUUID = []
        const consumer = this.#kafka.consumer({
            groupId,
            ...CONSUMER_TIMEOUT_DEFAULTS
        })
        await consumer.connect()
        await consumer.subscribe({ topic: this.#topic, fromBeginning: false })
        consumer.run({
            eachMessage: ({ partition, message }) => {
                if(!isPlaceholderMessage(message)){
                    messages.push({
                        partition,
                        headers: message.headers,
                        value: message.value
                    })
                }

                if(isPlaceholderMessageWithUUID(message, uuid)){
                    receivedPlaceholdersWithUUID.push(message)
                }
            }
        })

        //reset cursor
        for (const initialPartitionCursor of this.#initialTopicOffsets) {
            await consumer.seek({
                topic: this.#topic,
                partition: initialPartitionCursor.partition,
                offset: initialPartitionCursor.offset,
            })
        }

        //wait messages until placeholders
        await new Promise((done) => {
            const interval = setInterval(() => {
                if (receivedPlaceholdersWithUUID.length >= partitions) {
                    clearInterval(interval)
                    consumer.pause()
                    done()
                }
            }, 50)
        })

        await consumer.disconnect()
        return messages;
    }

    async #getAdmin() {
        const admin = this.#kafka.admin()
        await admin.connect()
        return admin
    }

    async #topicExists(admin) {
        const topics = await admin.listTopics()
        const exists = topics.includes(this.#topic)
        return exists
    }
}