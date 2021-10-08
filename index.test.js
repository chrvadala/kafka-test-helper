import { describe, expect, it, jest } from '@jest/globals'
import { Kafka, logLevel } from 'kafkajs'
import { KafkaTestHelper } from '.';
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
    maxWaitTimeInMs: 100,
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

        const helper = new KafkaTestHelper(kafka, testTopic)
        await helper.init()
    })

    it("should construct and setup the component when topic does NOT exist", async () => {
        const testTopic = randomString('topic')
        const helper = new KafkaTestHelper(kafka, testTopic)
        await helper.init()
    })

    it("should construct and setup the component, consumer group included", async () => {
        const testTopic = randomString('topic')
        const testGroup1 = randomString('group1')
        const testGroup2 = randomString('group2')

        await createTopic(testTopic)
        const consumer1 = kafka.consumer({ groupId: testGroup1 })
        await consumer1.subscribe({ topic: testTopic })

        const helper = new KafkaTestHelper(kafka, testTopic, [testGroup1, testGroup2])
        await helper.init()

        await consumer1.disconnect()
    })
})

describe("ensureTopicExists", () => {
    it("should create a new topic", async () => {
        const testTopic = randomString('topic')

        const helper = new KafkaTestHelper(kafka, testTopic)

        await expect(admin.listTopics()).resolves
            .toEqual(expect.not.arrayContaining([testTopic]))

        await helper.ensureTopicExists()

        await expect(admin.listTopics()).resolves
            .toEqual(expect.arrayContaining([testTopic]))
    })

    it("should not fail, even if the topic already exists", async () => {
        const testTopic = randomString('topic')

        const helper = new KafkaTestHelper(kafka, testTopic)

        await createTopic(testTopic)

        await helper.ensureTopicExists()

        await expect(admin.listTopics()).resolves
            .toEqual(expect.arrayContaining([testTopic]))
    })
})

describe("ensureTopicDeleted", () => {
    it("should delete a topic", async () => {
        const testTopic = randomString('topic')

        await createTopic(testTopic)

        await expect(admin.listTopics()).resolves
            .toEqual(expect.arrayContaining([testTopic]))

        const helper = new KafkaTestHelper(kafka, testTopic)
        await helper.ensureTopicDeleted()

        await expect(admin.listTopics()).resolves
            .toEqual(expect.not.arrayContaining([testTopic]))
    })

    it("should not fail, even if the topic does not exist", async () => {
        const testTopic = randomString('topic')

        const helper = new KafkaTestHelper(kafka, testTopic)

        await expect(admin.listTopics()).resolves
            .toEqual(expect.not.arrayContaining([testTopic]))

        await helper.ensureTopicDeleted()
    })
})

describe("offsetDelta", () => {
    it.each([
        { a: "4", b: "4", expected: 0 },
        { a: "4", b: "5", expected: 1 },
        { a: "100", b: "200", expected: 100 },
        { a: "0", b: "200", expected: 200 },
        { a: "-1", b: "-1", expected: 0 },
        { a: "-1", b: "9007199254740991", expected: 9007199254740991 },
    ])("should calculate delta on ordered offsets ($a, $b)", ({ a, b, expected }) => {
        expect(KafkaTestHelper.offsetDelta(a, b)).toBe(expected)
    })

    it.each([
        { a: "0", b: "9007199254740992", error: "Unsupported offsets" },
        { a: "100", b: "0", error: "Unsupported offsets" },
        { a: "-2", b: "100", error: "Invalid offsets" },
        { a: "-2", b: "-2", error: "Invalid offsets" },
    ])("should throw error $error with offsets ($a, $b)", ({ a, b, error }) => {
        function exec() {
            KafkaTestHelper.offsetDelta(a, b)
        }
        expect(exec).toThrow(error)
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

        const helper = new KafkaTestHelper(kafka, testTopic)
        await helper.init()

        await expect(helper.producedMessages()).resolves.toBe(0)

        await produceMessages(testTopic, [
            { value: 'message-3' },
            { value: 'message-4' },
            { value: 'message-5' },
        ])

        await expect(helper.producedMessages()).resolves.toBe(3)
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

        const helper = new KafkaTestHelper(kafka, testTopic, [testGroup])
        await helper.init()
        await expect(helper.consumedMessagesByGroup(testGroup)).resolves.toBe(0)
        await produceMessages(testTopic, [
            { value: 'message-4' },
            { value: 'message-5' },
        ])

        await waitForExpect(() => {
            expect(handleMessage).toHaveBeenCalledTimes(5);
        })

        await expect(helper.consumedMessagesByGroup(testGroup)).resolves.toBe(2)
        await consumer.disconnect()
    })

    it("should calculate consumed message by a group - consumer does not exist on setup", async () => {
        const testTopic = randomString('topic')
        const testGroup = randomString('group')
        const handleMessage = jest.fn()

        await createTopic(testTopic)

        //setup
        const helper = new KafkaTestHelper(kafka, testTopic, [testGroup])
        await helper.init()
        await expect(helper.consumedMessagesByGroup(testGroup)).resolves.toBe(0)

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

        await expect(helper.consumedMessagesByGroup(testGroup)).resolves.toBe(3)
        await consumer.disconnect()
    })
})

describe("pendingMessagesByGroup", () => {
    it("should calculate pending message on a group", async () => {
        const testTopic = randomString('topic')
        const testGroup = randomString('group')
        const handleMessage = jest.fn()

        await createTopic(testTopic)

        const helper = new KafkaTestHelper(kafka, testTopic, [testGroup])
        await helper.init()

        await expect(helper.pendingMessagesByGroup(testGroup)).resolves.toBe(0)

        await produceMessages(testTopic, [
            { value: 'message-1' },
            { value: 'message-2' },
            { value: 'message-3' },
        ])

        await expect(helper.pendingMessagesByGroup(testGroup)).resolves.toBe(3)

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

        await expect(helper.pendingMessagesByGroup(testGroup)).resolves.toBe(0)
        await consumer.disconnect()
    })
})

describe.only("messages and messageCount", () => {
    it("should return produced messages", async () => {
        const testTopic = randomString('topic')

        await produceMessages(testTopic, [
            { value: 'message-x' },
            { value: 'message-y' },
            { value: 'message-z' },
        ])

        const helper = new KafkaTestHelper(kafka, testTopic)
        await helper.init()

        await expect(helper.messageCount()).resolves.toBe(0)
        await expect(helper.messages()).resolves.toHaveLength(0)

        await produceMessages(testTopic, [
            { value: 'message-1' },
            { value: 'message-2' },
            { value: 'message-3' },
        ])
        
        await expect(helper.messageCount()).resolves.toBe(3)
        await expect(helper.messages()).resolves.toEqual([
            { headers: {}, partition: 0, value: Buffer.from('message-1') },
            { headers: {}, partition: 0, value: Buffer.from('message-2') },
            { headers: {}, partition: 0, value: Buffer.from('message-3') },
        ])

        await produceMessages(testTopic, [
            { value: 'message-4' },
            { value: 'message-5' },
        ])

        await expect(helper.messageCount()).resolves.toBe(5)
        await expect(helper.messages()).resolves.toEqual([
            { headers: {}, partition: 0, value: Buffer.from('message-1') },
            { headers: {}, partition: 0, value: Buffer.from('message-2') },
            { headers: {}, partition: 0, value: Buffer.from('message-3') },
            { headers: {}, partition: 0, value: Buffer.from('message-4') },
            { headers: {}, partition: 0, value: Buffer.from('message-5') },
        ])

    })

    //unsupported case
    it.skip("should return produced messages, even in the context of a commited transaction", async () => {
        const testTopic = randomString('topic')

        await produceMessages(testTopic, [
            { value: 'message-x' },
            { value: 'message-y' },
            { value: 'message-z' },
        ])

        const helper = new KafkaTestHelper(kafka, testTopic)
        await helper.init()

        await expect(helper.messageCount()).resolves.toBe(0)
        await expect(helper.messages()).resolves.toHaveLength(0)
        
        const producer = kafka.producer({transactionalId: "tx-test123"})
        await producer.connect()
        const transaction = await producer.transaction()
        await transaction.send({
            topic: testTopic,
            messages: [
                { value: 'message-1' },
                { value: 'message-2' },
                { value: 'message-3' },
            ],
        })
        await transaction.commit()
        await producer.disconnect()

        await expect(helper.messageCount()).resolves.toBe(3)
        await expect(helper.messages()).resolves.toEqual([
            { headers: {}, partition: 0, value: Buffer.from('message-1') },
            { headers: {}, partition: 0, value: Buffer.from('message-2') },
            { headers: {}, partition: 0, value: Buffer.from('message-3') },
        ])
    })

    //unsupported case
    it.skip("should return produced messages, even in the context of an aborted transaction", async () => {
        const testTopic = randomString('topic')

        await produceMessages(testTopic, [
            { value: 'message-x' },
            { value: 'message-y' },
            { value: 'message-z' },
        ])

        const helper = new KafkaTestHelper(kafka, testTopic)
        await helper.init()

        await expect(helper.messageCount()).resolves.toBe(0)
        await expect(helper.messages()).resolves.toHaveLength(0)
        
        const producer = kafka.producer({transactionalId: "tx-test123"})
        await producer.connect()
        const transaction = await producer.transaction()
        await transaction.send({
            topic: testTopic,
            messages: [
                { value: 'message-1' },
                { value: 'message-2' },
                { value: 'message-3' },
            ],
        })
        await transaction.abort()
        await producer.disconnect()

        await expect(helper.messageCount()).resolves.toBe(0)
    })
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