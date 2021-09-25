import { describe, expect, it, jest } from '@jest/globals'
import { Kafka, logLevel } from 'kafkajs'
import { TopicSpy } from '.';
import waitForExpect from "wait-for-expect"

const KAFKA_SERVER = process.env.KAFKA_SERVER;
if (!KAFKA_SERVER) {
    console.error('KAFKA_SERVER environment variable not found')
    process.exit(1)
}

let kafka, admin;

//when running a test suite is it useful to speed up group join
const CONSUMER_TIMEOUT_DEFAULTS = {
    sessionTimeout: 10_000,
    rebalanceTimeout: 12_000,
    heartbeatInterval: 500,
}

beforeAll(async () => {
    kafka = new Kafka({
        clientId: "tester",
        brokers: [KAFKA_SERVER],
        logLevel: logLevel.ERROR,
        retry: {
            restartOnFailure: async (error) => false
        }
    })

    admin = kafka.admin()
    await admin.connect()
})

afterAll(async () => {
    await admin.disconnect()
    admin = null
})

describe("setup", () => {
    it("should construct and setup the component when topic exists", async () => {
        const testTopic = randomString('topic')

        await createTopic(testTopic)

        const spiedTopic = new TopicSpy(kafka, testTopic)
        await spiedTopic.setup()
    })

    it("should construct and setup the component when topic does NOT exist", async () => {
        const testTopic = randomString('topic')
        const spiedTopic = new TopicSpy(kafka, testTopic)
        await spiedTopic.setup()
    })

    it("should construct and setup the component, consumer group included", async () => {
        const testTopic = randomString('topic')
        const testGroup1 = randomString('group1')
        const testGroup2 = randomString('group2')

        await createTopic(testTopic)
        const consumer1 = kafka.consumer({ groupId: testGroup1 })
        await consumer1.subscribe({ topic: testTopic })

        const spiedTopic = new TopicSpy(kafka, testTopic, [testGroup1, testGroup2])
        await spiedTopic.setup()

        await consumer1.disconnect()
    })
})

describe("ensureTopicExists", () => {
    it("should create a new topic", async () => {
        const testTopic = randomString('topic')

        const spiedTopic = new TopicSpy(kafka, testTopic)

        expect(await admin.listTopics())
            .toEqual(expect.not.arrayContaining([testTopic]))

        await spiedTopic.ensureTopicExists()

        expect(await admin.listTopics())
            .toEqual(expect.arrayContaining([testTopic]))
    })

    it("should not fail, even if the topic already exists", async () => {
        const testTopic = randomString('topic')

        const spiedTopic = new TopicSpy(kafka, testTopic)

        await createTopic(testTopic)

        await spiedTopic.ensureTopicExists()

        expect(await admin.listTopics())
            .toEqual(expect.arrayContaining([testTopic]))
    })
})

describe("ensureTopicDeleted", () => {
    it("should delete a topic", async () => {
        const testTopic = randomString('topic')

        await createTopic(testTopic)

        expect(await admin.listTopics())
            .toEqual(expect.arrayContaining([testTopic]))

        const spiedTopic = new TopicSpy(kafka, testTopic)
        await spiedTopic.ensureTopicDeleted()

        expect(await admin.listTopics())
            .toEqual(expect.not.arrayContaining([testTopic]))
    })

    it("should not fail, even if the topic does not exist", async () => {
        const testTopic = randomString('topic')

        const spiedTopic = new TopicSpy(kafka, testTopic)

        expect(await admin.listTopics())
            .toEqual(expect.not.arrayContaining([testTopic]))

        await spiedTopic.ensureTopicDeleted()
    })
})

describe("offsetDelta", () => {
    it("should calculate delta on ordered offsets", () => {
        expect(TopicSpy.offsetDelta("4", "4")).toBe(0)
        expect(TopicSpy.offsetDelta("4", "5")).toBe(1)
        expect(TopicSpy.offsetDelta("100", "200")).toBe(100)
    })
    it.todo("should calculate delta after an offset overflow")
})

describe("producedMessages", () => {
    it("should count produced messages", async () => {
        const testTopic = randomString('topic')

        await createTopic(testTopic)

        await produceMessages(testTopic, [
            { value: 'message-1' },
            { value: 'message-2' },
        ])

        const spiedTopic = new TopicSpy(kafka, testTopic)
        await spiedTopic.setup()

        expect(await spiedTopic.producedMessages()).toBe(0)

        await produceMessages(testTopic, [
            { value: 'message-3' },
            { value: 'message-4' },
            { value: 'message-5' },
        ])

        expect(await spiedTopic.producedMessages()).toBe(3)
    })

    it.todo("should work when the topic is created after setup")
    it.todo("should throw exception when it found new partitions")
    it.todo("should count messages on a specific partition")
})

describe("consumedMessagesByGroup", () => {
    it("should calculate consumed message by a group", async () => {
        const testTopic = randomString('topic')
        const testGroup = randomString('group')
        const handleMessage = jest.fn()

        await createTopic(testTopic)

        await produceMessages(testTopic, [
            { value: 'message-1' },
            { value: 'message-2' },
            { value: 'message-3' },
        ])

        //init consumer
        const consumer = kafka.consumer({ groupId: testGroup, ...CONSUMER_TIMEOUT_DEFAULTS })
        await consumer.connect()
        await consumer.subscribe({ topic: testTopic, fromBeginning: true })
        await consumer.run({
            eachMessage: handleMessage
        })
        await waitForExpect(() => {
            expect(handleMessage).toHaveBeenCalledTimes(3);
        })

        const spiedTopic = new TopicSpy(kafka, testTopic, [testGroup])
        await spiedTopic.setup()
        expect(await spiedTopic.consumedMessagesByGroup(testGroup)).toBe(0)
        await produceMessages(testTopic, [
            { value: 'message-4' },
            { value: 'message-5' },
        ])

        await waitForExpect(() => {
            expect(handleMessage).toHaveBeenCalledTimes(5);
        })

        expect(await spiedTopic.consumedMessagesByGroup(testGroup)).toBe(2)
        await consumer.disconnect()
    }, 10_000)

    it("should calculate consumed message by a group - consumer does not exist on setup", async () => {
        const testTopic = randomString('topic')
        const testGroup = randomString('group')
        const handleMessage = jest.fn()

        await createTopic(testTopic)

        //setup
        const spiedTopic = new TopicSpy(kafka, testTopic, [testGroup])
        await spiedTopic.setup()
        expect(await spiedTopic.consumedMessagesByGroup(testGroup)).toBe(0)

        //init consumer
        const consumer = kafka.consumer({ groupId: testGroup, ...CONSUMER_TIMEOUT_DEFAULTS })
        await consumer.connect()
        await consumer.subscribe({ topic: testTopic, fromBeginning: true })
        await consumer.run({
            eachMessage: handleMessage
        })

        await produceMessages(testTopic, [
            { value: 'message-1' },
            { value: 'message-2' },
            { value: 'message-3' },
        ])

        await waitForExpect(() => {
            expect(handleMessage).toHaveBeenCalledTimes(3);
        })

        expect(await spiedTopic.consumedMessagesByGroup(testGroup)).toBe(3)
        await consumer.disconnect()
    }, 10_000)
})

describe("pendingMessagesByGroup", () => {
    it("should calculate pending message on a group", async () => {
        const testTopic = randomString('topic')
        const testGroup = randomString('group')
        const handleMessage = jest.fn()

        await createTopic(testTopic)

        const spiedTopic = new TopicSpy(kafka, testTopic, [testGroup])
        await spiedTopic.setup()

        expect(await spiedTopic.pendingMessagesByGroup(testGroup)).toBe(0)

        await produceMessages(testTopic, [
            { value: 'message-1' },
            { value: 'message-2' },
            { value: 'message-3' },
        ])

        expect(await spiedTopic.pendingMessagesByGroup(testGroup)).toBe(3)

        //init consumer
        const consumer = kafka.consumer({ groupId: testGroup, ...CONSUMER_TIMEOUT_DEFAULTS })
        await consumer.connect()
        await consumer.subscribe({ topic: testTopic, fromBeginning: true })
        await consumer.run({
            eachMessage: handleMessage
        })
        await waitForExpect(() => {
            expect(handleMessage).toHaveBeenCalledTimes(3);
        })

        expect(await spiedTopic.pendingMessagesByGroup(testGroup)).toBe(0)
        await consumer.disconnect()
    }, 10_000)
})


let i = 0;
const randomString = prefix => {
    const random = new Date().toISOString()
        .replace(/[-:]/g, '')
        .replace(/\..*/, '')

    const topic = `${random}_${prefix}_${i++}`

    return topic;
}

const createTopic = async (topic, numPartitions = 1, replicationFactor = 1) => {
    await admin.createTopics({
        validateOnly: false,
        waitForLeaders: true,
        topics: [{
            topic,
            numPartitions,
            replicationFactor
        }],
    })
}

const produceMessages = async (topic, messages) => {
    const producer = kafka.producer()
    await producer.connect()
    await producer.send({
        topic,
        messages,
    })
    await producer.disconnect()
}