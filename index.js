
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

export default async function initKafkaTestHelper(kafka, topic, groupIds = []) {
    const helper = new KafkaTestHelper(kafka, topic, groupIds)
    await helper.init()
    return helper
}
export class KafkaTestHelper {
    #kafka; #topic; #groupIds;

    #topicOffsets = null;
    #groupTopicOffsets = {};

    constructor(kafka, topic, groupIds = []) {
        this.#kafka = kafka;
        this.#topic = topic;
        this.#groupIds = groupIds;
    }

    async init() {
        const admin = await this.#getAdmin()

        if (await this.#topicExists(admin)) {
            this.#topicOffsets = await admin.fetchTopicOffsets(this.#topic)

            for (const groupId of this.#groupIds) {
                this.#groupTopicOffsets[groupId] = await admin.fetchOffsets({
                    groupId, topic: this.#topic
                })
            }
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

    async producedMessages(partition = null) {
        const admin = await this.#getAdmin()
        const topicOffsets = await admin.fetchTopicOffsets(this.#topic)

        if (!this.#topicOffsets) {
            throw new Error(TOPIC_NOT_INITIALIZED)
        }

        if (this.#topicOffsets.length !== topicOffsets.length) {
            throw new Error(PARTITION_COUNT_DIFFERENCE_ERROR)
        }

        let tot = 0;
        for (let i = 0; i < this.#topicOffsets.length; i++) {
            tot += KafkaTestHelper.offsetDelta(this.#topicOffsets[i].offset, topicOffsets[i].offset)
        }

        await admin.disconnect()

        return tot
    }

    async messageCount() {
        const admin = await this.#getAdmin()

        const curTopicOffsets = await admin.fetchTopicOffsets(this.#topic)
        let delta = 0;
        for (let i = 0; i < this.#topicOffsets.length; i++) {
            delta += KafkaTestHelper.offsetDelta(
                this.#topicOffsets[i].offset,
                curTopicOffsets[i].offset
            )
        }

        await admin.disconnect()
        return delta
    }

    async messages() {
        const admin = await this.#getAdmin()
        const groupId = GROUP_ID_PREFIX + Math.round(Math.random() * 100_000)
        let messages = []
        
        //consume messages
        const consumer = this.#kafka.consumer({
            groupId,
            ...CONSUMER_TIMEOUT_DEFAULTS
        })
        await consumer.connect()
        await consumer.subscribe({ topic: this.#topic, fromBeginning: true })
        consumer.run({
            eachMessage: ({ partition, message }) => messages.push({
                partition,
                headers: message.headers,
                value: message.value
            })
        })
        for(const initialPartitionCursor of this.#topicOffsets){
            await consumer.seek({ 
                topic: this.#topic, 
                partition: initialPartitionCursor.partition, 
                offset: initialPartitionCursor.offset, 
            })
        }
        
        //wait messages
        messages = []
        const expectedMessages = await this.messageCount()
        await new Promise((done) => { 
            const interval = setInterval( () => {
                if(messages.length >= expectedMessages){
                    clearInterval(interval)
                    consumer.pause()
                    done()
                }
            }, 50)
        })
        
        await consumer.disconnect()
        await admin.disconnect()
        return messages.slice(0, expectedMessages)
    }

    async consumedMessagesByGroup(groupId, partition = null) {
        if(!this.#groupIds.includes(groupId)){
            throw new Error(GROUP_NOT_INITIALIZED)
        }
        const admin = await this.#getAdmin()

        const oldGroupTopicOffsets = this.#groupTopicOffsets[groupId]
        const currentGroupTopicOffsets = await admin.fetchOffsets({
            groupId, topic: this.#topic
        })

        if (oldGroupTopicOffsets.length !== currentGroupTopicOffsets.length) {
            throw new Error(PARTITION_COUNT_DIFFERENCE_ERROR)
        }

        let delta = 0;
        for (let i = 0; i < oldGroupTopicOffsets.length; i++) {
            delta += KafkaTestHelper.offsetDelta(
                oldGroupTopicOffsets[i].offset,
                currentGroupTopicOffsets[i].offset
            )
        }

        await admin.disconnect()
        return delta
    }

    async pendingMessagesByGroup(groupId, partition = null) {
        if(!this.#groupIds.includes(groupId)){
            throw new Error(GROUP_NOT_INITIALIZED)
        }
        const admin = await this.#getAdmin()

        const currentGroupTopicOffsets = await admin.fetchOffsets({
            groupId, topic: this.#topic
        })

       const topicOffsets = await admin.fetchTopicOffsets(this.#topic)

       if (currentGroupTopicOffsets.length !== topicOffsets.length) {
        throw new Error(PARTITION_COUNT_DIFFERENCE_ERROR)
    }

       let delta = 0;
        for (let i = 0; i < currentGroupTopicOffsets.length; i++) {
            delta += KafkaTestHelper.offsetDelta(
                currentGroupTopicOffsets[i].offset,
                topicOffsets[i].offset
            )
        }

        await admin.disconnect()
        return delta
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

    static offsetDelta(offset1, offset2) {
        const n1 = BigInt(offset1)
        const n2 = BigInt(offset2)

        if (n1 < -1n || n2 < -1n) {
            throw new Error("Invalid offsets")
        }

        const delta = (n1 < 0n && n2 >= 0n)
            ? n2
            : n2 - n1

        if (!Number.isSafeInteger(Number(delta)) || n1 > n2) {
            throw new Error("Unsupported offsets")
        }

        return Number(delta)
    }
}